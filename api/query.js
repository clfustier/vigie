// Consultation (lecture seule, coût zéro token) :
//  - table par pays / par client (triée par section)
//  - outil 1 : couple pays+client -> tout ce qu'il faut respecter
//  - outil 2 : comparateur de 2-3 cibles (pays, client, ou couple)
import { db, requireAdmin } from '../lib/db.js';

async function tableFor(target) {
  // target: {jurisdiction} | {client_id} | {jurisdiction, client_id}
  if (target.jurisdiction && target.client_id) {
    const { data, error } = await db.rpc('get_country_client_matrix',
      { p_jurisdiction: target.jurisdiction, p_client: target.client_id });
    if (error) throw error;
    return data;
  }
  if (target.client_id) {
    // Exigences propres au client + exigences de sa holding cochées pour lui
    const { data: scoped } = await db.from('requirement_scope')
      .select('requirement_id').eq('client_id', target.client_id);
    const ids = (scoped || []).map(s => s.requirement_id);
    let q = db.from('v_requirements_table').select('*').eq('origin', 'client')
      .order('sort_order').order('parameter');
    q = ids.length
      ? q.or(`client_id.eq.${target.client_id},id.in.(${ids.join(',')})`)
      : q.eq('client_id', target.client_id);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }
  const { data, error } = await db.from('v_requirements_table').select('*')
    .eq('origin', 'country').eq('jurisdiction', target.jurisdiction)
    .order('sort_order').order('parameter');
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const action = req.query.action;

  try {
    if (action === 'table') {
      return res.json(await tableFor({
        jurisdiction: req.query.jurisdiction || undefined,
        client_id: req.query.client_id || undefined
      }));
    }

    // Comparateur : body {targets:[{label, jurisdiction?, client_id?}, ...]} (2 ou 3)
    if (action === 'compare' && req.method === 'POST') {
      const { targets } = req.body;
      const tables = await Promise.all(targets.map(tableFor));
      // Alignement par section + paramètre (clé souple)
      const keyOf = r => `${r.section}|${(r.parameter || '').toLowerCase().trim()}`;
      const allKeys = new Map();
      tables.forEach((rows, i) => rows.forEach(r => {
        if (!allKeys.has(keyOf(r))) allKeys.set(keyOf(r), { section: r.section, sort: r.sort_order, parameter: r.parameter, cells: {} });
        allKeys.get(keyOf(r)).cells[i] = r;
      }));
      const rows = [...allKeys.values()].sort((a, b) => a.sort - b.sort || a.parameter.localeCompare(b.parameter));
      return res.json({ targets: targets.map(t => t.label), rows });
    }

    if (action === 'clients') {
      const { data } = await db.from('clients').select('*').order('name');
      return res.json(data);
    }
    if (action === 'jurisdictions') {
      const { data } = await db.from('jurisdictions').select('*').eq('active', true);
      return res.json(data);
    }
    if (action === 'pending') { // file de validation qualité
      const { data } = await db.from('requirements').select('*, sections(label), clients(name)')
        .eq('status', 'pending_validation').order('extracted_at');
      return res.json(data);
    }
    if (action === 'runs') {
      const { data } = await db.from('watch_runs').select('*').order('started_at', { ascending: false }).limit(20);
      return res.json(data);
    }
    res.status(400).json({ error: 'action inconnue' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
