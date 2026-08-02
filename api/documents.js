// Veille client : dépôt manuel de documents (pdf, xlsx, docx, csv, txt...).
// Flux : upload_url -> le navigateur pousse le fichier dans Storage -> process.
// process = classification IA + renommage cohérent + versionnage (archive V1)
//           + extraction des exigences -> pending_validation.
import { db, requireAdmin } from '../lib/db.js';
import { extractFromText, extractFromPdf, classifyDocument } from '../lib/extract.js';
import { diffAndStage } from '../lib/diff.js';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Filet de sécurité si le nom de fichier n'a pas d'extension (rare, mais un
// original_filename.split('.').pop() sur un nom sans point renvoyait avant
// le nom entier comme "extension" -> chemin de stockage absurde).
function ext_fallback(mimeType) {
  const map = { 'application/pdf': 'pdf', 'text/csv': 'csv', 'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx' };
  return map[mimeType] || 'bin';
}

async function fileToText(buf, mime, name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'docx') return (await mammoth.extractRawText({ buffer: buf })).value;
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
    const wb = XLSX.read(buf, { type: 'buffer' });
    return wb.SheetNames.map(n => `--- Feuille: ${n} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n');
  }
  if (['txt', 'md', 'html'].includes(ext)) return buf.toString('utf8');
  return null; // pdf et autres -> traités en binaire par Claude
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const action = req.query.action;

  // 1) URL signée pour upload direct navigateur -> Storage (pas de limite proxy)
  if (action === 'upload_url') {
    const { filename } = req.body;
    const path = `incoming/${Date.now()}_${filename.replace(/[^\w.\-]/g, '_')}`;
    const { data, error } = await db.storage.from('client-docs').createSignedUploadUrl(path);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ path, token: data.token, signedUrl: data.signedUrl });
  }

  // 2) Traitement après upload
  if (action === 'process') {
    const { client_id, storage_path, original_filename, replaces_id, effective_date_override, mime: mimeType } = req.body;
    const { data: client } = await db.from('clients').select('*').eq('id', client_id).single();
    if (!client) return res.status(400).json({ error: 'client inconnu' });
    // Sélection client = uniquement depuis la liste (/api/clients) ; un client
    // désactivé ne doit plus pouvoir recevoir de nouveau dépôt même via appel API direct.
    if (client.active === false) return res.status(400).json({ error: 'client désactivé' });

    const { data: blob, error: dlErr } = await db.storage.from('client-docs').download(storage_path);
    if (dlErr) return res.status(500).json({ error: dlErr.message });
    const buf = Buffer.from(await blob.arrayBuffer());
    const ext = (original_filename.includes('.') ? original_filename.split('.').pop() : ext_fallback(mimeType)).toLowerCase();
    const text = await fileToText(buf, null, original_filename);

    // Classification (type + date d'application + libellé court)
    const cls = await classifyDocument(text ? text : `(PDF binaire, ${buf.length} octets)`, original_filename);
    const effective = effective_date_override || cls.effective_date || null;

    // Versionnage : nouvelle version = archive de la précédente
    let version = 1;
    if (replaces_id) {
      const { data: prev } = await db.from('client_documents').select('version').eq('id', replaces_id).single();
      version = (prev?.version || 0) + 1;
    }
    const clientSlug = client.name.replace(/[^\w]/g, '-').replace(/-+/g, '-');
    const normalized = `${clientSlug}_${cls.doc_type}_${cls.short_label}_${effective || 'sans-date'}_v${version}.${ext}`;
    const finalPath = `library/${clientSlug}/${normalized}`;
    await db.storage.from('client-docs').move(storage_path, finalPath);

    const { data: doc, error: insErr } = await db.from('client_documents').insert({
      client_id, original_filename, normalized_filename: normalized,
      doc_type: cls.doc_type, version, replaces_id: replaces_id || null,
      status: 'processing', effective_date: effective, storage_path: finalPath,
      mime: mimeType || `application/${ext}`  // vrai type MIME envoyé par le navigateur si dispo
    }).select().single();
    if (insErr) return res.status(500).json({ error: insErr.message });

    // Extraction des exigences (prompt "client" : plus strict sur les généralités creuses)
    try {
      const note = `Cahier des charges / document qualité du client "${client.name}" (${normalized})`;
      const rows = ext === 'pdf'
        ? await extractFromPdf(buf.toString('base64'), note, 'client')
        : await extractFromText(text || '(document vide)', note, 'client');
      const staged = await diffAndStage({
        rows, origin: 'client', clientId: client_id, documentId: doc.id,
        replacesDocId: replaces_id || null, runId: null
      });
      await db.from('client_documents').update({
        status: 'pending_validation',
        extraction_meta: { rows: rows.length, ...staged }
      }).eq('id', doc.id);
      if (replaces_id) await db.from('client_documents').update({ status: 'archived' }).eq('id', replaces_id);
      return res.json({ document: doc.id, normalized, extracted: rows.length, staged });
    } catch (e) {
      await db.from('client_documents').update({ status: 'processing', extraction_meta: { error: String(e) } }).eq('id', doc.id);
      return res.status(500).json({ error: String(e.message || e), document: doc.id });
    }
  }

  // 3) Bibliothèque consultable (filtres : client, type, statut, dates)
  if (action === 'library') {
    let q = db.from('client_documents')
      .select('*, clients(name)').order('uploaded_at', { ascending: false });
    for (const f of ['client_id', 'doc_type', 'status']) if (req.query[f]) q = q.eq(f, req.query[f]);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // 4) Lien de téléchargement d'un doc source
  if (action === 'download') {
    const { data: doc } = await db.from('client_documents').select('storage_path').eq('id', req.query.id).single();
    const { data } = await db.storage.from('client-docs').createSignedUrl(doc.storage_path, 3600);
    return res.json({ url: data.signedUrl });
  }

  res.status(400).json({ error: 'action inconnue' });
}
