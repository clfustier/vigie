// Veille presse : déclenchement manuel (bouton) ou cron optionnel (à ajouter
// dans vercel.json si souhaité, ex. hebdomadaire — voir README).
// Ne produit JAMAIS d'exigence directement : seulement des alertes dans
// `press_alerts`, que la qualité trie (pertinent/pas pertinent) et qui,
// si pertinentes, invitent à lancer une veille pays ciblée pour vérifier
// et, le cas échéant, extraire officiellement.
import { db, requireAdmin } from '../lib/db.js';
import { fetchPressSource, triageArticle } from '../lib/press.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const action = req.query.action || 'run';

  try {
    if (action === 'run') {
      const { data: srcs, error } = await db.from('press_sources').select('*').eq('active', true);
      if (error) throw error;
      const stats = { sources_checked: 0, articles_seen: 0, alerts_created: 0, errors: [] };

      for (const src of srcs || []) {
        try {
          stats.sources_checked++;
          const articles = await fetchPressSource(src);
          for (const a of articles.slice(0, 25)) {
            stats.articles_seen++;
            const { data: exists } = await db.from('press_alerts')
              .select('id').eq('article_url', a.url).limit(1);
            if (exists?.length) continue; // déjà vu (UNIQUE sur article_url en base de toute façon)

            const triage = await triageArticle({ title: a.title, summary: a.summary });
            if (!triage.relevant) continue; // bruit écarté, pas stocké

            const { error: insErr } = await db.from('press_alerts').insert({
              press_source_id: src.id, jurisdiction: triage.jurisdiction || src.jurisdiction,
              title: a.title, summary: a.summary, article_url: a.url,
              published_at: a.published_at ? new Date(a.published_at).toISOString() : null,
              urgency: triage.urgency, suggested_action: triage.suggested_action
            });
            if (!insErr) stats.alerts_created++;
          }
        } catch (e) {
          stats.errors.push({ source: src.name, error: String(e.message || e) });
        }
      }
      return res.json(stats);
    }

    if (action === 'list') {
      let q = db.from('press_alerts').select('*, press_sources(name)')
        .order('fetched_at', { ascending: false }).limit(200);
      if (req.query.relevance) q = q.eq('relevance', req.query.relevance);
      if (req.query.jurisdiction) q = q.eq('jurisdiction', req.query.jurisdiction);
      const { data, error } = await q;
      if (error) throw error;
      return res.json(data);
    }

    if (action === 'review' && req.method === 'POST') {
      const { id, relevance, reviewed_by, linked_source_id } = req.body;
      if (!['relevant', 'not_relevant', 'to_review'].includes(relevance)) {
        return res.status(400).json({ error: 'relevance invalide' });
      }
      const { error } = await db.from('press_alerts').update({
        relevance, reviewed_by, reviewed_at: new Date().toISOString(),
        linked_source_id: linked_source_id || null
      }).eq('id', id);
      if (error) throw error;
      return res.json({ ok: true });
    }

    res.status(400).json({ error: 'action inconnue' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
