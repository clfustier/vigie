# Catalogue des sources — Veille réglementaire pays

Principe : pour chaque juridiction, 1 source primaire officielle (texte de loi, avec API), des sources secondaires de recoupement, et un mécanisme officiel de détection de changement. Toutes les sources ci-dessous autorisent explicitement l'accès programmatique.

---

## Union Européenne

**Source primaire : EUR-Lex / CELLAR** — API REST + endpoint SPARQL.
Licence : réutilisation libre avec attribution (Décision 2011/833/UE). Accès machine officiel documenté.
- API REST CELLAR : récupération des textes (XML/HTML) par identifiant CELEX
- SPARQL : requêtes sur les métadonnées, dont les dates de modification → **détection de changement**

Textes suivis (par section) :

| CELEX | Texte | Sections couvertes |
|---|---|---|
| 32013R1308 | Règl. (UE) 1308/2013 — OCM unique | Définitions produits, pratiques (annexes VII-VIII) |
| 32019R0934 | Règl. délégué (UE) 2019/934 | Composés/additifs autorisés, limites analytiques (annexe I) |
| 32019R0033 | Règl. délégué (UE) 2019/33 | Étiquetage, mentions, AOP/IGP |
| 32019R0034 | Règl. d'exécution (UE) 2019/34 | Procédures étiquetage/AOP |
| 32011R1169 | Règl. (UE) 1169/2011 — INCO | Étiquetage, allergènes |
| 32021R2117 | Règl. (UE) 2021/2117 | Ingrédients + nutrition (e-label, oblig. depuis 12/2023) |
| 32005R0396 | Règl. (CE) 396/2005 | LMR pesticides (analytique) |
| 32023R0915 | Règl. (UE) 2023/915 — contaminants | Analytique (plomb, OTA...) |
| 32004R1935 | Règl. (CE) 1935/2004 | Packaging / contact alimentaire |
| 32005R2073 | Règl. (CE) 2073/2005 | Microbiologie |
| 32018R0848 | Règl. (UE) 2018/848 | Certifications bio |
| 32025R0040 | Règl. (UE) 2025/40 — PPWR | Packaging/emballages, REP |

**Secondaires** : pages vin DG AGRI, base LMR pesticides UE (interface dédiée), rapport FAIRS UE (USDA).

---

## Royaume-Uni

**Source primaire : legislation.gov.uk** — API REST (suffixe `/data.xml` sur toute page), formats XML/Akoma Ntoso/RDF.
Licence : Open Government Licence v3 — réutilisation libre.
**Détection de changement** : flux Atom officiels (nouvelle législation + "changes to legislation").

Textes suivis : droit UE assimilé (2019/33, 2019/934, 1308/2013 tels qu'amendés par les réformes vin 2023-2024), The Wine Regulations 2011 (SI 2011/2936), règl. 1169/2011 assimilé (FIC), Food Safety Act 1990, Materials and Articles in Contact with Food Regulations.

**Secondaires** : guidance gov.uk "wine trade regulations" et importation, Food Standards Agency, rapport FAIRS UK (USDA). Attention post-Brexit : divergences croissantes UE/UK (ex. réformes d'étiquetage 2023+), d'où l'importance du recoupement FAIRS.

---

## USA

**Source primaire : eCFR** — API officielle (`ecfr.gov/api/versioner/v1/`), XML/JSON par titre, avec **dates d'amendement par section** → détection de changement native (point-in-time).
Licence : domaine public (US federal works).

Parties suivies : 27 CFR Part 4 (étiquetage vin), Part 24 (pratiques cave, §24.246 matériaux autorisés), Part 13, Part 16 (health warning), Part 27 (imports) ; 21 CFR 101 (FDA étiquetage), 175-178 (contact alimentaire).

**Source complémentaire : Federal Register API** (`federalregister.gov/api/v1`) — règles proposées/finales TTB & FDA, domaine public, idéal pour capter les changements *avant* codification dans le CFR.

**TTB Public COLA Registry** (`ttbonline.gov` / `ttb.gov/regulated-commodities/labeling/cola-public-registry`) — base de toutes les étiquettes de vin approuvées/refusées/révoquées depuis 1999. Aucune inscription requise. Utile comme **signal complémentaire** : une hausse soudaine de refus/conditions sur un type de mention donne une alerte précoce, avant même une évolution du 27 CFR Part 4. Non intégré comme fetcher V1 (ce n'est pas un texte de loi, mais un registre d'actes administratifs individuels) — piste V2.

**Secondaires** : TTB.gov (rulings, industry circulars), FDA (openFDA API, clé optionnelle recommandée pour un usage soutenu), Californie Prop 65 (liste OEHHA, mise à jour périodique, pas d'API officielle stable — surveillance manuelle ou via GDELT), FSVP/FSMA pour importateurs.

---

## Sources transverses (toutes juridictions)

- **USDA FAS — rapports FAIRS/GAIN** : rapport annuel par pays sur les règles d'import alimentaire (étiquetage, packaging, additifs). PDF publics, téléchargement direct (`apps.fas.usda.gov/newgainapi`). Excellent recoupement, et source principale pour les futurs pays difficiles (Japon, Chine). **Changement récent : l'accès programmatique aux API du portail FAS (au-delà du téléchargement direct d'un PDF déjà référencé) nécessite désormais une clé API**, à obtenir sur le portail FAS Open Data (fas.usda.gov/data/databases-applications) — gratuite, auto-service. Le fetcher `pdf_url` actuel (téléchargement direct d'un PDF déjà identifié) n'en a pas besoin ; une clé ne devient nécessaire que si on veut interroger le catalogue GAIN pour découvrir automatiquement les nouveaux rapports.
- **OIV** : Recueil des pratiques œnologiques + limites analytiques internationales, mis à jour annuellement. Référence de recoupement pour la section analytique.

## Veille presse (signal faible — distincte de la veille pays)

Constat de l'audit : la V1 ne couvrait QUE des textes de loi officiels. Aucun mécanisme ne remontait un
changement en préparation, une consultation publique, ou un article professionnel signalant une réforme
avant sa codification. C'est un vrai trou : sur EU/UK/US, les réformes d'étiquetage 2023+ ont d'abord
été visibles dans la presse spécialisée et les communiqués d'agence, des mois avant la publication finale.

**Principe** : la presse n'est jamais une source normative. `press_sources`/`press_alerts` (nouvelles
tables) alimentent un flux séparé de `requirements`, avec triage IA (pertinent/urgence) puis validation
humaine ; une alerte retenue **invite à lancer une veille pays ciblée**, elle ne crée jamais d'exigence
elle-même.

Sources V1 (voir `supabase/seed_press_sources.sql`, toutes vérifiées accessibles sans clé) :
- **TTB — RSS officiels** (News & Events, Announcements, Press Releases) : `ttb.gov/online-services/rss/rss-feeds-from-ttb`.
- **Wine-Searcher — Wine News RSS** : recoupement presse généraliste vin.
- **GDELT DOC 2.0 API** (`api.gdeltproject.org/api/v2/doc/doc`) : recherche plein texte multilingue, gratuite, sans clé, mise à jour toutes les 15 min — requêtes mots-clés par juridiction (EU/UK/US) déjà seedées.

Identifiées mais **non intégrées faute de flux RSS confirmé** (à vérifier manuellement avant ajout, cf.
notes en fin de `seed_press_sources.sql`) : Vitisphere (newsletters thématiques, dont une couvrant le
réglementaire/politique — pas de RSS public trouvé), DGCCRF France (pas de flux dédié vin identifié),
Libation Law Blog et Stoel Rives Alcohol Beverage Blog (blogs juridiques US spécialisés droit des
boissons alcoolisées — RSS probable, URL à confirmer).

## Réplicabilité pays suivants

Le modèle par juridiction = `{sources: [{type, config}], change_detection}` en config DB, pas en dur. Ajouter un pays = ajouter des lignes sources + éventuellement un fetcher si le format est nouveau. Canada : Justice Laws (laws-lois.justice.gc.ca, API/XML officiel) + CFIA (accès ouvert). Japon/Chine : FAIRS d'abord, sources primaires ensuite.

## Autorisations / clés API — récapitulatif complet

Tableau exhaustif de ce qui est nécessaire pour que l'app tourne à pleine capacité (V1 + veille presse).
Colonne "Requis pour" précise si c'est bloquant pour le V1 actuel ou seulement pour une extension.

| Service | Clé / autorisation | Requis pour | Où l'obtenir | Coût |
|---|---|---|---|---|
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY` | Extraction pays + client, classification documents, triage presse — **bloquant, tout le produit en dépend** | console.anthropic.com | Pay-as-you-go, cf. estimation coûts dans le README |
| **Supabase** | `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (service role, PAS la clé anon) | Base de données + Storage (buckets `snapshots`, `client-docs`) — bloquant | Dashboard du projet Supabase → Settings → API | Palier gratuit suffisant au départ |
| **Vercel** | Compte + déploiement (pas une "clé" à proprement parler) | Hébergement API + cron mensuel | vercel.com | ⚠️ **Voir alerte plan ci-dessous — bloquant en pratique** |
| `ADMIN_KEY` | Choisie par vous (chaîne aléatoire), pas un service tiers | Protège l'accès à toute l'interface/API — bloquant | À générer (ex: `openssl rand -hex 24`) | Gratuit |
| EUR-Lex / CELLAR | Aucune clé pour le contenu HTML/CELEX utilisé ici | Veille pays UE — déjà opérationnel | — | Gratuit |
| legislation.gov.uk | Aucune clé (OGL v3) | Veille pays UK — déjà opérationnel | — | Gratuit |
| eCFR / Federal Register | Aucune clé | Veille pays US — déjà opérationnel | — | Gratuit |
| GDELT DOC 2.0 | Aucune clé | Veille presse — déjà opérationnel | — | Gratuit |
| RSS (TTB, Wine-Searcher) | Aucune clé | Veille presse — déjà opérationnel | — | Gratuit |
| **USDA FAS Open Data** | Clé API (auto-service) | Uniquement si on veut interroger le catalogue GAIN au lieu de PDF déjà identifiés à la main — **pas bloquant en V1** | fas.usda.gov/data/databases-applications | Gratuit |
| TTB Public COLA Registry | Aucune inscription | Piste V2 (signal labels) — pas intégré | ttb.gov | Gratuit |
| openFDA | Clé optionnelle recommandée au-delà d'un usage occasionnel | Si section `packaging`/contact alimentaire US approfondie (21 CFR 175-178 au-delà de l'eCFR) — piste V2 | open.fda.gov | Gratuit |
| Justice Laws Canada / CFIA | Aucune clé | Réplicabilité pays suivant (Canada) — piste V2 | laws-lois.justice.gc.ca | Gratuit |

### ⚠️ Alerte bloquante : plan Vercel

`vercel.json` déclare `maxDuration: 300` (5 min) pour `/api/watch` et `/api/documents` (traitement d'un
gros CDC ou run mensuel multi-sources). **Sur le plan Vercel Hobby (gratuit), la durée réelle d'une
fonction est plafonnée à 60 secondes quoi que dise `maxDuration`** — le paramètre est silencieusement
ignoré/écrêté. Concrètement : le cron mensuel de veille pays ou le dépôt d'un CDC de 80 pages risquent
d'être tués en cours de route sans erreur explicite, avec des exigences partiellement extraites.
**Le plan Vercel Pro est nécessaire** pour bénéficier réellement des 300 s déclarées (jusqu'à 800 s
disponibles sur Pro selon la configuration). À vérifier/mettre à niveau avant la mise en production.
