# Vigie — Veille réglementaire vin (standalone)

Outil autonome (hors écosystème Clos) à trois onglets d'alimentation :

1. **Veille pays** — récupération automatique des textes officiels (UE, UK, USA en V1), extraction IA en table d'exigences triée par section, sources citées ligne par ligne. Mise à jour le 1er de chaque mois (cron Vercel) + bouton "lancer maintenant".
2. **Veille client** — dépôt manuel de documents (PDF, Excel, Word, CSV…) : classification IA, renommage cohérent `{CLIENT}_{type}_{libellé}_{date}_v{N}`, versionnage (V2 archive V1, jamais de suppression), date de mise en application, extraction en table au même format. Extraction durcie contre les généralités creuses ("respecter la réglementation en vigueur") et classification systématique **Action** (il faut faire/vérifier quelque chose) vs **Info** (pour mémoire, ne change rien). Sélection client exclusivement sur liste — le seul champ texte libre est le formulaire d'ajout de client.
3. **Veille presse** — signal faible (RSS agences officielles + GDELT, triage IA pertinence/urgence). Ne crée jamais d'exigence directement : une alerte retenue invite à vérifier via la veille pays.

Outils croisés : **couple pays × client** (tout ce qu'il faut respecter) et **comparateur** 2-3 cibles (2 pays, 1 client dans 2 pays, 2 clients dans 1 pays…), différences surlignées.

Principe économique : le LLM n'intervient **qu'à l'ingestion** (et seulement si la source a changé — hash). La consultation est du SQL pur, coût zéro.

Workflow qualité : scan IA → proposition → **validation humaine** → consultable. Rien ne devient actif tout seul.

## Déploiement (une fois)

1. **Supabase** : créer un nouveau projet (séparé de Clos) →
   - SQL Editor : exécuter dans l'ordre `supabase/schema.sql`, `supabase/seed_sources.sql`, `supabase/seed_press_sources.sql`, puis `supabase/seed_pilot.sql` si vous voulez un jeu de données de démo.
   - Storage : créer 2 buckets privés `snapshots` et `client-docs`
2. **GitHub** : nouveau repo, pousser ce dossier.
3. **Vercel** : importer le repo, variables d'environnement :
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service role)
   - `ANTHROPIC_API_KEY`
   - `ADMIN_KEY` (clé d'accès à l'interface, à choisir — ex: `openssl rand -hex 24`)
   - optionnel `EXTRACT_MODEL` (défaut `claude-sonnet-4-5`)
   - ⚠️ **Plan Vercel Pro requis** (pas Hobby) : `vercel.json` déclare des fonctions à 300s (`watch`, `documents`) et 120s (`press`), mais le plan Hobby plafonne silencieusement toute fonction à 60s quoi que dise `maxDuration` — le cron mensuel ou un gros CDC risquent d'être coupés en cours de route sans erreur visible. Voir `docs/SOURCES.md`, section "Alerte bloquante".
4. Premier run : ouvrir l'app, saisir la clé admin, onglet Veille pays → "Lancer la veille maintenant" pour chaque juridiction, puis valider dans l'onglet Validation qualité. Idem pour "Lancer la veille presse maintenant" sur l'onglet dédié.

## Ajouter un pays

Aucun code si le format de source est déjà géré : `INSERT INTO jurisdictions...` + lignes dans `sources` avec le bon `fetcher` (`eurlex`, `uklegislation`, `ecfr`, `federalregister`, `pdf_url` — ce dernier couvre les rapports FAIRS/GAIN de l'USDA, voie d'entrée pour Canada/Japon/Chine). Voir `docs/SOURCES.md`, qui liste aussi **toutes les clés/autorisations nécessaires ou recommandées** (récapitulatif complet, y compris pour les extensions V2).

## Coûts de run estimés

- Consultation : 0 (SQL).
- Veille mensuelle : extraction uniquement sur sources modifiées ; mois calme ≈ 0-2 $, refresh complet des 15 sources ≈ 5-15 $ de tokens.
- Dépôt d'un CDC client de 80 pages ≈ 1-3 $.
- Veille presse (triage IA par article retenu) : quelques centimes par run hebdomadaire.
- Supabase + Vercel : paliers gratuits suffisants pour Supabase ; **Vercel Pro nécessaire** (cf. alerte ci-dessus).

Le "refresh à la demande payant" (V2 monétisation) est trivial à brancher : l'endpoint `POST /api/watch?trigger=manual` est déjà séparé du cron.

## Structure

- `supabase/schema.sql` — schéma complet commenté (socle commun : table `requirements` unique pour les 2 origines, + `press_sources`/`press_alerts` pour la veille presse)
- `supabase/seed_sources.sql` — sources officielles V1 (licences vérifiées, cf. `docs/SOURCES.md`)
- `supabase/seed_press_sources.sql` — sources de veille presse V1 (RSS + requêtes GDELT)
- `lib/fetchers.js` — un fetcher par format de source (veille pays)
- `lib/press.js` — fetchers RSS/GDELT + triage IA (veille presse)
- `lib/extract.js` — extraction structurée Claude (chunking, PDF natif, classification docs, prompts distincts pays/client anti-généralités)
- `lib/diff.js` — diff vs existant, staging en validation (pas d'auto-merge), résilient ligne par ligne
- `api/watch.js` — pipeline veille pays (cron + manuel)
- `api/documents.js` — pipeline veille client (upload, tri, renommage, versions, bibliothèque)
- `api/press.js` — pipeline veille presse (run, list, review)
- `api/clients.js` — gestion de la liste des clients (créer, activer/désactiver)
- `api/query.js` — consultation, couple, comparateur
- `api/validate.js` — workflow de validation qualité
- `public/index.html` — interface complète (6 onglets)
