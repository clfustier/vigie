// Diff extraction fraîche vs exigences actives. JAMAIS d'auto-merge :
// tout passe en pending_validation + change_log, la qualité valide.
import { db } from './db.js';

const keyOf = r => [r.section_id, (r.parameter||'').toLowerCase().trim(), (r.applies_to||'').toLowerCase().trim()].join('|');

export async function diffAndStage({ rows, origin, jurisdiction, clientId, sourceId, documentId, sourceUrl, runId, replacesDocId }) {
  // Périmètre de comparaison :
  //  - pays : les exigences actives de la MÊME source
  //  - client + nouvelle version d'un doc : les exigences issues du doc remplacé
  //  - client + document inédit : toutes ses exigences actives, mais sans
  //    signaler de "removed" (un doc nouveau ne couvre pas tous les sujets)
  const q = db.from('requirements').select('*').eq('status', 'active').eq('origin', origin);
  if (origin === 'country') q.eq('jurisdiction', jurisdiction).eq('source_id', sourceId);
  else if (replacesDocId) q.eq('client_id', clientId).eq('document_id', replacesDocId);
  else q.eq('client_id', clientId);
  const detectRemoved = origin === 'country' || !!replacesDocId;
  const { data: current, error } = await q;
  if (error) throw error;

  const currentByKey = new Map(current.map(r => [keyOf(r), r]));
  const staged = { new: 0, modified: 0, removed: 0, errors: [] };

  for (const r of rows) {
    const existing = currentByKey.get(keyOf(r));
    currentByKey.delete(keyOf(r));
    const same = existing &&
      String(existing.limit_value) === String(r.limit_value ?? null) &&
      existing.operator === (r.operator ?? null) &&
      existing.requirement === r.requirement;
    if (same) continue;

    // Une ligne malformée (ex: section_id inconnu -> violation de la FK) ne doit
    // JAMAIS faire perdre tout le reste du lot : on isole l'erreur par ligne.
    try {
      const { data: ins, error: e2 } = await db.from('requirements').insert({
        origin, jurisdiction: jurisdiction ?? null, client_id: clientId ?? null,
        section_id: r.section_id, parameter: r.parameter, requirement: r.requirement,
        requirement_type: r.requirement_type === 'info' ? 'info' : 'action',
        operator: r.operator ?? null, limit_value: r.limit_value ?? null, unit: r.unit ?? null,
        applies_to: r.applies_to ?? null, source_id: sourceId ?? null, document_id: documentId ?? null,
        source_ref: r.source_ref || 'non précisé', source_url: sourceUrl ?? null,
        effective_date: r.effective_date ?? null, status: 'pending_validation'
      }).select('id').single();
      if (e2) throw e2;

      const { error: e3 } = await db.from('change_log').insert({
        run_id: runId ?? null, document_id: documentId ?? null, requirement_id: ins.id,
        change_type: existing ? 'modified' : 'new',
        diff: existing ? { before: existing, after: r } : { after: r }
      });
      if (e3) staged.errors.push({ row: r.parameter, error: `change_log: ${e3.message}` });
      staged[existing ? 'modified' : 'new']++;
    } catch (e) {
      staged.errors.push({ row: r.parameter || '(sans paramètre)', error: String(e.message || e) });
    }
  }

  // Exigences actives plus présentes dans la nouvelle extraction -> signalées, pas supprimées
  if (!detectRemoved) return staged;
  for (const [, orphan] of currentByKey) {
    const { error } = await db.from('change_log').insert({
      run_id: runId ?? null, requirement_id: orphan.id,
      change_type: 'removed', diff: { before: orphan }
    });
    if (error) { staged.errors.push({ row: orphan.parameter, error: error.message }); continue; }
    staged.removed++;
  }
  return staged;
}
