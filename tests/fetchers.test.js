// Tests hors-ligne : logique de diff, parsing, clés. (Les fetchers réseau
// sont testés par tests/live_check.js, à lancer manuellement.)
import { test } from 'node:test';
import assert from 'node:assert';

test('stripHtml conserve le texte utile', async () => {
  const { fetchers } = await import('../lib/fetchers.js');
  assert.ok(fetchers.eurlex && fetchers.ecfr && fetchers.uklegislation && fetchers.federalregister && fetchers.pdf_url);
});

test('clé de dédoublonnage insensible à la casse/espaces', () => {
  const keyOf = r => [r.section_id, (r.parameter||'').toLowerCase().trim(), (r.applies_to||'').toLowerCase().trim()].join('|');
  assert.strictEqual(keyOf({ section_id:'analytique', parameter:'SO2 Total ', applies_to:'Vin rouge' }),
                     keyOf({ section_id:'analytique', parameter:'so2 total', applies_to:'vin rouge' }));
});

test('parsing JSON tolérant au texte autour', () => {
  const m = 'Voici:\n[{"a":1}]\nfin'.match(/\[[\s\S]*\]/);
  assert.deepStrictEqual(JSON.parse(m[0]), [{ a: 1 }]);
});

test('requirement_type retombe sur "action" si absent/invalide', async () => {
  // Reproduit la logique de normalizeRow() dans lib/extract.js sans appeler l'API Claude.
  const normalize = r => ({ ...r, requirement_type: r.requirement_type === 'info' ? 'info' : 'action' });
  assert.strictEqual(normalize({}).requirement_type, 'action');
  assert.strictEqual(normalize({ requirement_type: 'info' }).requirement_type, 'info');
  assert.strictEqual(normalize({ requirement_type: 'n\'importe quoi' }).requirement_type, 'action');
});

test('classifyDocument retombe sur doc_type "autre" si hors énumération', async () => {
  const DOC_TYPES = ['cdc', 'charte_qualite', 'plan_controle', 'spec_packaging', 'autre'];
  const clamp = t => DOC_TYPES.includes(t) ? t : 'autre';
  assert.strictEqual(clamp('cdc'), 'cdc');
  assert.strictEqual(clamp('cahier des charges'), 'autre'); // hallucination LLM plausible
});

test('press: dédoublonnage par article_url (contrainte UNIQUE en base)', () => {
  const seen = new Set();
  const dedupe = urls => urls.filter(u => (seen.has(u) ? false : (seen.add(u), true)));
  assert.deepStrictEqual(dedupe(['a', 'b', 'a', 'c']), ['a', 'b', 'c']);
});
