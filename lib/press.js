// Veille presse : signal faible, JAMAIS une source d'exigences. RSS + GDELT
// (aucune clé requise pour ces deux fetchers). Le rôle de ce module est de
// repérer un article qui MÉRITE une vérification officielle — pas d'en tirer
// une obligation juridique. Seule la veille pays (lib/fetchers.js + sources
// officielles) peut alimenter la table `requirements`.
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.EXTRACT_MODEL || 'claude-sonnet-4-5';
const UA = 'VigieWineCompliance/1.0 (veille presse; contact: cl.fustier@gmail.com)';

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return r;
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
}

// --- RSS/Atom générique : pas de dépendance XML, parsing par regex (suffisant
// pour des flux bien formés comme TTB/Wine-Searcher) ---
async function rss({ url }) {
  const xml = await (await get(url)).text();
  const items = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/gi)].map(m => m[0]);
  return items.map(it => ({
    title: (tag(it, 'title') || '(sans titre)').replace(/<[^>]+>/g, ''),
    url: tag(it, 'link') || (it.match(/<link[^>]*href="([^"]+)"/i)?.[1]) || null,
    published_at: tag(it, 'pubDate') || tag(it, 'updated') || tag(it, 'published') || null,
    summary: (tag(it, 'description') || tag(it, 'summary') || '').replace(/<[^>]+>/g, ' ').slice(0, 500)
  })).filter(a => a.url);
}

// --- GDELT DOC 2.0 : recherche plein texte par mots-clés, gratuit, sans clé ---
async function gdelt({ query, timespan = '7d', maxrecords = 30 }) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}` +
    `&mode=artlist&maxrecords=${maxrecords}&timespan=${timespan}&format=json`;
  const json = await (await get(url)).json();
  return (json.articles || []).map(a => ({
    title: a.title, url: a.url, published_at: a.seendate, summary: a.domain || ''
  }));
}

export const pressFetchers = { rss, gdelt };

export async function fetchPressSource(src) {
  const fn = pressFetchers[src.fetcher];
  if (!fn) throw new Error(`Fetcher presse inconnu: ${src.fetcher}`);
  return fn(src.fetch_config);
}

// Triage IA : ne JAMAIS transformer un article en exigence. Le seul rôle est
// de dire "à vérifier officiellement, avec cette urgence" ou d'écarter le bruit
// (la presse n'est pas une source normative fiable — trop d'approximation,
// d'anticipation ou d'article déjà obsolète).
const TRIAGE_SYSTEM = `Tu es un veilleur réglementaire vin. On te donne le titre et un résumé
d'un article de presse ou de blog juridique. Ton seul rôle : dire s'il signale un changement
réglementaire (ou projet de changement, consultation publique, contentieux) pertinent pour le
vin (production, étiquetage, import/douane, packaging, durabilité) dans une des juridictions
suivies (EU, UK, US), et avec quelle urgence il faudrait aller vérifier la source officielle.
Tu n'extrais JAMAIS une exigence à partir de cet article seul : la presse n'est pas une source
normative fiable, elle sert uniquement à déclencher une vérification humaine.
Réponds UNIQUEMENT en JSON: {"relevant":true|false,"jurisdiction":"EU"|"UK"|"US"|null,
"urgency":"high"|"medium"|"low"|null,"suggested_action":"phrase courte: quoi vérifier et où"}`;

export async function triageArticle({ title, summary }) {
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 300,
    system: TRIAGE_SYSTEM,
    messages: [{ role: 'user', content: `Titre: ${title}\nRésumé: ${summary || '(aucun)'}` }]
  });
  try {
    const j = JSON.parse(msg.content[0].text.match(/\{[\s\S]*\}/)[0]);
    return {
      relevant: !!j.relevant,
      jurisdiction: ['EU', 'UK', 'US'].includes(j.jurisdiction) ? j.jurisdiction : null,
      urgency: ['high', 'medium', 'low'].includes(j.urgency) ? j.urgency : null,
      suggested_action: j.suggested_action || null
    };
  } catch { return { relevant: false, jurisdiction: null, urgency: null, suggested_action: null }; }
}
