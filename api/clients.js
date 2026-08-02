// Gestion des clients. C'est la SEULE fenêtre où un nom de client est saisi
// librement (formulaire "nouveau client"). Partout ailleurs dans l'app
// (dépôt de document, couple pays×client, comparateur) la sélection se fait
// exclusivement sur la liste qui en résulte — jamais de champ texte libre.
import { db, requireAdmin } from '../lib/db.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const action = req.query.action || 'list';

  try {
    if (action === 'list') {
      let q = db.from('clients').select('*').order('name');
      if (!req.query.all) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      return res.json(data);
    }

    if (action === 'create' && req.method === 'POST') {
      const { name, parent_id, country } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'nom requis' });
      const { data, error } = await db.from('clients')
        .insert({ name: name.trim(), parent_id: parent_id || null, country: country || null })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    // Pas de suppression : on désactive (garde l'historique des exigences/documents liés)
    if (action === 'set_active' && req.method === 'POST') {
      const { id, active } = req.body;
      const { error } = await db.from('clients').update({ active: !!active }).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    res.status(400).json({ error: 'action inconnue' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
