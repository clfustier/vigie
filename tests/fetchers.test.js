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
