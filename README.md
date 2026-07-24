# Vigie — Veille réglementaire vin (standalone)

Outil autonome (hors écosystème Clos) à deux onglets :

1. **Veille pays** — récupération automatique des textes officiels (UE, UK, USA en V1), extraction IA en table d'exigences triée par section, sources citées ligne par ligne. Mise à jour le 1er de chaque mois (cron Vercel) + bouton "lancer maintenant".
2. **Veille client** — dépôt manuel de documents (PDF, Excel, Word, CSV…) : classification IA, renommage cohérent `{CLIENT}_{type}_{libellé}_{date}_v{N}`, versionnage (V2 archive V1, jamais de suppression), date de mise en application, extraction en table au même format.

Outils croisés : **couple pays × client** (tout ce qu'il faut respecter) et **comparateur** 2-3 cibles (2 pays, 1 client dans 2 pays, 2 clients dans 1 pays…), différences surlignées.

Principe économique : le LLM n'intervient **qu'à l'ingestion** (et seulement si la source a changé — hash). La consultation est du SQL pur, coût zéro.

Workflow qualité : scan IA → proposition → **validation humaine** → consultable. Rien ne devient actif tout seul.

## Déploiement (une fois)

1. **Supabase** : créer un nouveau projet (séparé de Clos) →
   - SQL Editor : exécuter `supabase/schema.sql` puis `supabase/seed_sources.sql`
   - Storage : créer 2 buckets privés `snapshots` et `client-docs`
2. **GitHub** : nouveau repo, pousser ce dossier.
3. **Vercel** : importer le repo, variables d'environnement :
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service role)
   - `ANTHROPIC_API_KEY`
   - `ADMIN_KEY` (clé d'accès à l'interface, à choisir)
   - optionnel `EXTRACT_MODEL` (défaut `claude-sonnet-4-5`)
4. Premier run : ouvrir l'app, saisir la clé admin, onglet Veille pays → "Lancer la veille maintenant" pour chaque juridiction, puis valider dans l'onglet Validation qualité.

## Ajouter un pays

Aucun code si le format de source est déjà géré : `INSERT INTO jurisdictions...` + lignes dans `sources` avec le bon `fetcher` (`eurlex`, `uklegislation`, `ecfr`, `federalregister`, `pdf_url` — ce dernier couvre les rapports FAIRS/GAIN de l'USDA, voie d'entrée pour Canada/Japon/Chine). Voir `docs/SOURCES.md`.

## Coûts de run estimés

- Consultation : 0 (SQL).
- Veille mensuelle : extraction uniquement sur sources modifiées ; mois calme ≈ 0-2 $, refresh complet des 15 sources ≈ 5-15 $ de tokens.
- Dépôt d'un CDC client de 80 pages ≈ 1-3 $.
- Supabase + Vercel : paliers gratuits suffisants au départ.

Le "refresh à la demande payant" (V2 monétisation) est trivial à brancher : l'endpoint `POST /api/watch?trigger=manual` est déjà séparé du cron.

## Structure

- `supabase/schema.sql` — schéma complet commenté (socle commun : table `requirements` unique pour les 2 origines)
- `supabase/seed_sources.sql` — sources officielles V1 (licences vérifiées, cf. `docs/SOURCES.md`)
- `lib/fetchers.js` — un fetcher par format de source
- `lib/extract.js` — extraction structurée Claude (chunking, PDF natif, classification docs)
- `lib/diff.js` — diff vs existant, staging en validation (pas d'auto-merge)
- `api/watch.js` — pipeline veille pays (cron + manuel)
- `api/documents.js` — pipeline veille client (upload, tri, renommage, versions, bibliothèque)
- `api/query.js` — consultation, couple, comparateur
- `api/validate.js` — workflow de validation qualité
- `public/index.html` — interface complète (5 onglets)
