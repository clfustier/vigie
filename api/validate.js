// Workflow qualité : dépôt -> scan IA -> PROPOSITION -> validation humaine
// -> consultable. Rien ne devient 'active' sans passage ici.
import { db, requireAdmin } from '../lib/db.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const { requirement_ids, decision, validated_by, edits } = req.body;
  // decision: 'approve' | 'reject' ; edits: corrections manuelles optionnelles {id: {champ: valeur}}

  const results = [];
  for (const id of requirement_ids) {
    if (edits?.[id]) await db.from('requirements').update(edits[id]).eq('id', id);

    if (decision === 'approve') {
      const { data: r } = await db.from('requirements').select('*').eq('id', id).single();
      // Remplace l'éventuelle version active du même paramètre (supersede, pas de suppression)
      const q = db.from('requirements').select('id').eq('status', 'active')
        .eq('origin', r.origin).eq('section_id', r.section_id).eq('parameter', r.parameter);
      if (r.origin === 'country') q.eq('jurisdiction', r.jurisdiction).eq('source_id', r.source_id);
      else q.eq('client_id', r.client_id);
      const { data: olds } = await q;
      for (const o of olds || []) {
        await db.from('requirements').update({ status: 'superseded', superseded_by: id }).eq('id', o.id);
      }
      await db.from('requirements').update({
        status: 'active', confidence: 'validated',
        validated_by, validated_at: new Date().toISOString()
      }).eq('id', id);
    } else {
      await db.from('requirements').update({ status: 'rejected', validated_by }).eq('id', id);
    }
    await db.from('change_log').update({ reviewed: true, reviewed_by: validated_by }).eq('requirement_id', id);
    results.push(id);
  }

  // Un document dont toutes les exigences sont traitées devient 'active'
  const { data: docs } = await db.from('client_documents').select('id').eq('status', 'pending_validation');
  for (const d of docs || []) {
    const { count } = await db.from('requirements')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', d.id).eq('status', 'pending_validation');
    if (count === 0) await db.from('client_documents').update({ status: 'active' }).eq('id', d.id);
  }

  res.json({ processed: results.length, decision });
}
