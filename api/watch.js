// Veille pays : cron mensuel (vercel.json) + déclenchement manuel.
// GET/POST /api/watch?trigger=manual[&jurisdiction=EU]
import crypto from 'node:crypto';
import { db, requireAdmin } from '../lib/db.js';
import { fetchSource } from '../lib/fetchers.js';
import { extractFromText, extractFromPdf } from '../lib/extract.js';
import { diffAndStage } from '../lib/diff.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const trigger = req.query.trigger === 'scheduled' ? 'scheduled' : 'manual';
  const jurisdiction = req.query.jurisdiction || null;

  const { data: run, error: runErr } = await db.from('watch_runs')
    .insert({ trigger, jurisdiction }).select().single();
  if (runErr) return res.status(500).json({ error: runErr.message });

  const stats = { sources_checked: 0, changed: 0, extracted: 0, errors: [] };

  // Tout le corps est protégé : quoi qu'il arrive, le run est finalisé
  // (sinon un watch_runs reste bloqué en 'running' pour toujours).
  try {
    const q = db.from('sources').select('*').eq('active', true);
    if (jurisdiction) q.eq('jurisdiction', jurisdiction);
    const { data: sources, error: srcErr } = await q;
    if (srcErr) throw srcErr;

    for (const src of sources || []) {
      try {
        stats.sources_checked++;
        const fetched = await fetchSource(src);
        const isPdf = !!fetched.pdfBase64;
        const raw = fetched.text ?? fetched.pdfBase64;
        const hash = crypto.createHash('sha256').update(raw).digest('hex');

        const { data: prev } = await db.from('source_snapshots')
          .select('content_hash').eq('source_id', src.id)
          .order('fetched_at', { ascending: false }).limit(1);
        const changed = !prev?.length || prev[0].content_hash !== hash;

        // PDF binaire stocké tel quel (décodé) avec le bon content-type,
        // sinon le snapshot n'est pas réellement réouvrable comme PDF.
        const path = `snapshots/${src.jurisdiction}/${src.id}/${Date.now()}.${isPdf ? 'pdf' : 'txt'}`;
        if (changed) {
          const body = isPdf ? Buffer.from(fetched.pdfBase64, 'base64') : raw;
          await db.storage.from('snapshots').upload(path, body, {
            contentType: isPdf ? 'application/pdf' : 'text/plain'
          });
        }
        await db.from('source_snapshots').insert({
          source_id: src.id, run_id: run.id, content_hash: hash,
          changed, storage_path: changed ? path : null, meta: fetched.meta
        });
        if (!changed) continue;
        stats.changed++;

        const note = `Législation ${src.jurisdiction} — ${src.name} (${src.url_human})`;
        const rows = isPdf
          ? await extractFromPdf(fetched.pdfBase64, note, 'country')
          : await extractFromText(fetched.text, note, 'country');
        const staged = await diffAndStage({
          rows, origin: 'country', jurisdiction: src.jurisdiction,
          sourceId: src.id, sourceUrl: src.url_human, runId: run.id
        });
        stats.extracted += rows.length;
        Object.assign(stats, { [`staged_${src.name}`]: staged });
        if (staged.errors?.length) stats.errors.push({ source: src.name, rowErrors: staged.errors });
      } catch (e) {
        stats.errors.push({ source: src.name, error: String(e.message || e) });
      }
    }
  } catch (e) {
    stats.errors.push({ source: '(sources)', error: String(e.message || e) });
  } finally {
    await db.from('watch_runs').update({
      finished_at: new Date().toISOString(),
      status: stats.sources_checked > 0 && stats.errors.length >= stats.sources_checked ? 'failed' : 'done',
      stats
    }).eq('id', run.id);
  }

  res.json({ run_id: run.id, ...stats });
}
