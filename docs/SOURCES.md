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

**Secondaires** : TTB.gov (rulings, industry circulars, COLA), FDA, Californie Prop 65 (liste OEHHA), FSVP/FSMA pour importateurs.

---

## Sources transverses (toutes juridictions)

- **USDA FAS — rapports FAIRS/GAIN** : rapport annuel par pays sur les règles d'import alimentaire (étiquetage, packaging, additifs). PDF publics, téléchargement direct (`apps.fas.usda.gov/newgainapi`). Excellent recoupement, et source principale pour les futurs pays difficiles (Japon, Chine).
- **OIV** : Recueil des pratiques œnologiques + limites analytiques internationales, mis à jour annuellement. Référence de recoupement pour la section analytique.

## Réplicabilité pays suivants

Le modèle par juridiction = `{sources: [{type, config}], change_detection}` en config DB, pas en dur. Ajouter un pays = ajouter des lignes sources + éventuellement un fetcher si le format est nouveau. Canada : Justice Laws + CFIA (accès ouvert). Japon/Chine : FAIRS d'abord, sources primaires ensuite.

## Conformité d'accès

| Source | Base légale d'accès |
|---|---|
| EUR-Lex/CELLAR | Décision 2011/833/UE, réutilisation libre avec attribution |
| legislation.gov.uk | Open Government Licence v3 |
| eCFR / Federal Register | Domaine public US |
| USDA FAS GAIN | Publications publiques US |
| OIV | Documents publics, citation requise |

Cadence mensuelle + à la demande : volumes très faibles (quelques dizaines de requêtes/mois), aucun enjeu de rate-limiting.
