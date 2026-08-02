// Extraction structurée par Claude. Un seul point d'entrée pour les deux
// veilles : le LLM n'intervient QU'À l'ingestion, jamais à la consultation.
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.EXTRACT_MODEL || 'claude-sonnet-4-5';
const CHUNK = 120_000; // caractères par appel

const SECTIONS = `analytique (paramètres physico-chimiques, LMR pesticides, métaux lourds, contaminants),
composes (additifs, auxiliaires, pratiques œnologiques autorisées/interdites, doses max),
microbiologie, allergenes, etiquetage (mentions obligatoires, langues, pictogrammes, e-label),
packaging (bouteille, bouchage, contact alimentaire, REP/recyclage), certifications (bio, IFS/BRC, durabilité),
documents (preuves, certificats, analyses par lot, traçabilité), import (douane, licences, procédures),
rse (audit, social, carbone, exigences hors réglementaire)`;

const OUTPUT_FORMAT = `Réponds UNIQUEMENT avec un tableau JSON d'objets:
{section_id, parameter, requirement, requirement_type, operator|null, limit_value|null, unit|null, applies_to|null, source_ref, effective_date|null}

requirement_type — classification obligatoire, exactement l'une de ces deux valeurs:
- "action" : le lecteur doit faire, vérifier ou changer quelque chose de concret (seuil à respecter,
  mention à ajouter, document/preuve à fournir, procédure à suivre, interdiction à observer).
- "info"   : rappel contextuel ou définition qui ne déclenche AUCUNE action ni vérification particulière.`;

// Règles communes aux deux veilles : interdiction des généralités creuses,
// exigence de précision chiffrée/actionnable.
const ANTI_GENERIC_RULES = `- N'extrais JAMAIS une généralité creuse sans contenu vérifiable, du type
  "respecter la réglementation en vigueur", "être conforme aux normes applicables",
  "garantir un produit de qualité" prise seule. Si le texte ne fait qu'un renvoi générique
  à "la loi" ou "la réglementation" SANS préciser quel texte, quel seuil ou quelle obligation,
  IGNORE cette phrase — n'en fais pas une ligne.
- Si un renvoi à une norme externe (ISO, IFS, BRC, réglementation d'un pays) est fait SANS
  détailler son contenu, tu peux l'extraire mais uniquement en requirement_type="info", avec
  le requirement formulé comme "(renvoi à vérifier: <nom de la norme citée>)" — jamais présenté
  comme une obligation chiffrée que tu aurais inventée.
- Priorise le pratico-pratique : qui doit faire quoi, avec quelle preuve, avant quelle échéance,
  avec quelle tolérance chiffrée. Une exigence exploitable a un verbe d'action et, si possible,
  un seuil, une liste fermée, ou un document nommé.`;

const SYSTEM_COUNTRY = `Tu es un expert en réglementation vitivinicole (production, étiquetage, packaging, import).
Tu extrais des EXIGENCES structurées applicables au vin à partir d'un texte de loi officiel.
Lecture FINE : ne rate ni les seuils chiffrés, ni les interdictions, ni les documents de preuve exigés.

Règles:
- Une exigence = une ligne. Ne fusionne pas des seuils différents (ex: SO2 rouge vs blanc = 2 lignes).
- section_id parmi exactement: ${SECTIONS.replace(/\n/g, ' ')}
- source_ref OBLIGATOIRE et précis (article/annexe/paragraphe).
- Un seuil "<X" ou "ND" est une vraie valeur (reporter X en limit_value avec operator '<'), pas une absence.
- effective_date si le texte donne une date d'application, sinon null.
- N'invente RIEN : si une valeur est illisible/ambiguë, mets-la en requirement en texte et signale "(à vérifier)".
${ANTI_GENERIC_RULES}

${OUTPUT_FORMAT}`;

// Prompt dédié aux CDC/documents clients : ces documents sont réputés truffés
// de généralités ("garantir la conformité", "respecter la législation du pays
// de destination") qui ne veulent rien dire opérationnellement. On durcit
// encore le filtre par rapport à la veille pays.
const SYSTEM_CLIENT = `Tu es un expert qualité/réglementaire vitivinicole qui lit des cahiers des
charges, chartes qualité et plans de contrôle de la grande distribution pour en extraire les
exigences opposables au fournisseur de vin.

Les CDC clients contiennent BEAUCOUP de remplissage générique ("le produit doit être conforme
à la réglementation en vigueur", "le fournisseur garantit la qualité et la sécurité du produit",
"respect des normes en vigueur dans le pays de commercialisation"). Ce remplissage n'apporte
RIEN d'actionnable : tu dois le repérer et l'écarter, sauf s'il est assorti d'un seuil, d'une
liste, d'un document nommé ou d'une échéance — auquel cas tu l'extrais normalement.

Règles:
- Une exigence = une ligne. Ne fusionne pas des exigences différentes.
- section_id parmi exactement: ${SECTIONS.replace(/\n/g, ' ')}
- source_ref OBLIGATOIRE et précis (page, section ou numéro d'article du document).
- Un seuil "<X" ou "ND" est une vraie valeur (reporter X en limit_value avec operator '<'), pas une absence.
- effective_date si le document donne une date d'application, sinon null.
- N'invente RIEN : si une valeur est illisible/ambiguë, mets-la en requirement en texte et signale "(à vérifier)".
${ANTI_GENERIC_RULES}

${OUTPUT_FORMAT}`;

function parseJson(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

// requirement_type doit être 'action' ou 'info' ; tout le reste retombe sur 'action'
// (par défaut on préfère signaler trop que pas assez).
function normalizeRow(r) {
  return { ...r, requirement_type: r.requirement_type === 'info' ? 'info' : 'action' };
}

async function callClaude(content, contextNote, origin) {
  const system = origin === 'client' ? SYSTEM_CLIENT : SYSTEM_COUNTRY;
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `Contexte du document: ${contextNote}\nExtrais toutes les exigences.` },
      ...(Array.isArray(content) ? content : [{ type: 'text', text: content }])
    ]}]
  });
  return parseJson(msg.content.map(b => b.text || '').join('')).map(normalizeRow);
}

// Texte long -> découpage avec léger recouvrement, puis dédoublonnage
export async function extractFromText(text, contextNote, origin = 'country') {
  const rows = [];
  for (let i = 0; i < text.length; i += CHUNK - 5000) {
    rows.push(...await callClaude(text.slice(i, i + CHUNK), contextNote, origin));
    if (text.length <= CHUNK) break;
  }
  const seen = new Set();
  return rows.filter(r => {
    const k = `${r.section_id}|${r.parameter}|${r.applies_to}|${r.limit_value}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

export async function extractFromPdf(pdfBase64, contextNote, origin = 'country') {
  return callClaude(
    [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } }],
    contextNote, origin
  );
}

const DOC_TYPES = ['cdc', 'charte_qualite', 'plan_controle', 'spec_packaging', 'autre'];

// Classification d'un document client déposé (type + date d'application)
export async function classifyDocument(excerpt, filename) {
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 500,
    messages: [{ role: 'user', content:
      `Fichier "${filename}". Extrait:\n${excerpt.slice(0, 8000)}\n\n` +
      `Classe ce document. Réponds en JSON: {"doc_type":"cdc|charte_qualite|plan_controle|spec_packaging|autre",` +
      `"effective_date":"YYYY-MM-DD"|null,"short_label":"libellé court pour nom de fichier (ascii, tirets)"}` }]
  });
  let cls;
  try { cls = JSON.parse(msg.content[0].text.match(/\{[\s\S]*\}/)[0]); }
  catch { cls = { doc_type: 'autre', effective_date: null, short_label: 'document' }; }
  // Le LLM peut halluciner une valeur hors énum (contrainte CHECK en base) -> on retombe sur 'autre'
  if (!DOC_TYPES.includes(cls.doc_type)) cls.doc_type = 'autre';
  if (!cls.short_label) cls.short_label = 'document';
  return cls;
}
