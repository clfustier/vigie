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

const SYSTEM = `Tu es un expert en réglementation vitivinicole et cahiers des charges de la grande distribution.
Tu extrais des EXIGENCES structurées applicables au vin (produit + packaging + étiquetage + logistique).
Lecture FINE : ne rate ni les seuils chiffrés, ni les interdictions, ni les documents de preuve exigés.

Règles:
- Une exigence = une ligne. Ne fusionne pas des seuils différents (ex: SO2 rouge vs blanc = 2 lignes).
- section_id parmi exactement: ${SECTIONS.replace(/\n/g, ' ')}
- source_ref OBLIGATOIRE et précis (article/annexe/paragraphe pour une loi, page/section pour un document).
- Un seuil "<X" ou "ND" est une vraie valeur (reporter X en limit_value avec operator '<'), pas une absence.
- effective_date si le texte donne une date d'application, sinon null.
- N'invente RIEN : si une valeur est illisible/ambiguë, mets-la en requirement en texte et signale "(à vérifier)".
Réponds UNIQUEMENT avec un tableau JSON d'objets:
{section_id, parameter, requirement, operator|null, limit_value|null, unit|null, applies_to|null, source_ref, effective_date|null}`;

function parseJson(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

async function callClaude(content, contextNote) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `Contexte du document: ${contextNote}\nExtrais toutes les exigences.` },
      ...(Array.isArray(content) ? content : [{ type: 'text', text: content }])
    ]}]
  });
  return parseJson(msg.content.map(b => b.text || '').join(''));
}

// Texte long -> découpage avec léger recouvrement, puis dédoublonnage
export async function extractFromText(text, contextNote) {
  const rows = [];
  for (let i = 0; i < text.length; i += CHUNK - 5000) {
    rows.push(...await callClaude(text.slice(i, i + CHUNK), contextNote));
    if (text.length <= CHUNK) break;
  }
  const seen = new Set();
  return rows.filter(r => {
    const k = `${r.section_id}|${r.parameter}|${r.applies_to}|${r.limit_value}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

export async function extractFromPdf(pdfBase64, contextNote) {
  return callClaude(
    [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } }],
    contextNote
  );
}

// Classification d'un document client déposé (type + date d'application)
export async function classifyDocument(excerpt, filename) {
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 500,
    messages: [{ role: 'user', content:
      `Fichier "${filename}". Extrait:\n${excerpt.slice(0, 8000)}\n\n` +
      `Classe ce document. Réponds en JSON: {"doc_type":"cdc|charte_qualite|plan_controle|spec_packaging|autre",` +
      `"effective_date":"YYYY-MM-DD"|null,"short_label":"libellé court pour nom de fichier (ascii, tirets)"}` }]
  });
  try { return JSON.parse(msg.content[0].text.match(/\{[\s\S]*\}/)[0]); }
  catch { return { doc_type: 'autre', effective_date: null, short_label: 'document' }; }
}
