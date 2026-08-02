-- ============================================================
-- VIGIE — Veille réglementaire vin (standalone, hors Clos)
-- Schéma Supabase. Socle commun aux 2 onglets :
--   1. Veille pays (scraping sources officielles)
--   2. Veille client (dépôt manuel de documents)
-- Les deux alimentent la MÊME table `requirements`, différenciée
-- par `origin` — d'où un format de sortie identique et des
-- outils croisés (couple pays/client, comparateur) triviaux.
-- ============================================================

-- ---------- RÉFÉRENTIELS ----------

-- Sections de la table de sortie (taxonomie validée en session "Projet clos")
CREATE TABLE sections (
  id            TEXT PRIMARY KEY,           -- slug stable ex: 'analytique'
  label         TEXT NOT NULL,
  sort_order    INT NOT NULL
);

INSERT INTO sections (id, label, sort_order) VALUES
  ('analytique',      'Paramètres analytiques & contaminants',     1),
  ('composes',        'Composés / additifs / pratiques autorisés', 2),
  ('microbiologie',   'Microbiologie',                             3),
  ('allergenes',      'Allergènes',                                4),
  ('etiquetage',      'Étiquetage & mentions légales',             5),
  ('packaging',       'Emballage & matériaux',                     6),
  ('certifications',  'Certifications & durabilité',               7),
  ('documents',       'Documents de preuve & traçabilité',         8),
  ('import',          'Import / douane / licences',                9),
  ('rse',             'RSE & exigences au-delà du réglementaire', 10);

-- Juridictions (pays ou zone : 'EU' est une juridiction)
CREATE TABLE jurisdictions (
  code          TEXT PRIMARY KEY,           -- 'EU','UK','US','CA','JP'...
  name          TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO jurisdictions (code, name) VALUES
  ('EU','Union Européenne'), ('UK','Royaume-Uni'), ('US','États-Unis');

-- ---------- VEILLE PAYS : SOURCES & CAPTURES ----------

-- Config des sources par juridiction (réplicable : ajouter un pays
-- = insérer des lignes ici, pas de code en dur)
CREATE TABLE sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction  TEXT NOT NULL REFERENCES jurisdictions(code),
  name          TEXT NOT NULL,              -- ex: 'EUR-Lex 2019/934'
  fetcher       TEXT NOT NULL,              -- 'eurlex'|'uklegislation'|'ecfr'|'federalregister'|'pdf_url'
  fetch_config  JSONB NOT NULL,             -- ex: {"celex":"32019R0934"} / {"title":27,"part":4}
  url_human     TEXT NOT NULL,              -- lien citable pour vérification manuelle
  license_note  TEXT,                       -- base légale d'accès
  active        BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (jurisdiction, name)
);

-- Capture brute à chaque passage : audit + détection de changement par hash
CREATE TABLE source_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID NOT NULL REFERENCES sources(id),
  run_id        UUID,                       -- rempli après création de watch_runs
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash  TEXT NOT NULL,              -- sha256 du contenu normalisé
  storage_path  TEXT,                       -- copie brute dans Supabase Storage (bucket 'snapshots')
  changed       BOOLEAN NOT NULL,           -- hash différent du snapshot précédent ?
  meta          JSONB                       -- version/date d'amendement annoncée par la source
);

-- Exécutions de veille (cron mensuel ou déclenchement manuel)
CREATE TABLE watch_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger       TEXT NOT NULL CHECK (trigger IN ('scheduled','manual')),
  jurisdiction  TEXT REFERENCES jurisdictions(code),  -- NULL = toutes
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  stats         JSONB                       -- {sources_checked, changed, extracted, errors:[...]}
);

-- ---------- VEILLE CLIENT : CLIENTS & DOCUMENTS ----------

-- Hiérarchie holding -> filiales (ex: Aldi GS -> Aldi FR, Aldi DE)
CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  parent_id     UUID REFERENCES clients(id),
  country       TEXT,                       -- pays principal du client (indicatif)
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents déposés (toutes formes : pdf, xlsx, docx...)
-- Renommage cohérent : {CLIENT}_{TYPE}_{YYYY-MM-DD}_v{N}.{ext}
-- Versionnage : la V2 ARCHIVE la V1 (jamais de suppression -> audit)
CREATE TABLE client_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID NOT NULL REFERENCES clients(id),
  original_filename  TEXT NOT NULL,
  normalized_filename TEXT NOT NULL,
  doc_type           TEXT NOT NULL,         -- 'cdc','charte_qualite','plan_controle','spec_packaging','autre' (classé par IA, corrigeable)
  version            INT NOT NULL DEFAULT 1,
  replaces_id        UUID REFERENCES client_documents(id),  -- V(n-1) archivée
  status             TEXT NOT NULL DEFAULT 'processing'
                     CHECK (status IN ('processing','pending_validation','active','archived','rejected')),
  effective_date     DATE,                  -- date de mise en application
  storage_path       TEXT NOT NULL,         -- bucket 'client-docs'
  mime               TEXT,
  uploaded_by        TEXT,
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  extraction_meta    JSONB                  -- modèle, coût tokens, pages...
);

-- ---------- SOCLE COMMUN : EXIGENCES ----------

-- LA table centrale. Une ligne = une exigence, qu'elle vienne
-- d'une loi (origin='country') ou d'un CDC client (origin='client').
CREATE TABLE requirements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin         TEXT NOT NULL CHECK (origin IN ('country','client')),
  jurisdiction   TEXT REFERENCES jurisdictions(code),   -- si origin='country' (ou portée pays d'une exigence client)
  client_id      UUID REFERENCES clients(id),           -- si origin='client'
  section_id     TEXT NOT NULL REFERENCES sections(id),
  parameter      TEXT NOT NULL,             -- ex: 'SO2 total (vin rouge, ≤5 g/L sucres)'
  requirement    TEXT NOT NULL,             -- énoncé lisible de l'exigence
  operator       TEXT,                      -- '<=','>=','=','interdit','obligatoire','autorisé'
  limit_value    NUMERIC,
  unit           TEXT,
  applies_to     TEXT,                      -- ex: 'vin rouge', 'tous vins', 'BIB'
  -- Traçabilité source (OBLIGATOIRE — vérif manuelle toujours possible)
  source_id      UUID REFERENCES sources(id),           -- veille pays
  document_id    UUID REFERENCES client_documents(id),  -- veille client
  source_ref     TEXT NOT NULL,             -- 'Annexe I, partie A' / 'p.14 §3.2' / '§4.32(a)'
  source_url     TEXT,                      -- lien direct citable
  -- Cycle de vie
  status         TEXT NOT NULL DEFAULT 'pending_validation'
                 CHECK (status IN ('pending_validation','active','superseded','rejected')),
  effective_date DATE,                      -- date de mise en application
  superseded_by  UUID REFERENCES requirements(id),
  extracted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_by   TEXT,
  validated_at   TIMESTAMPTZ,
  confidence     TEXT NOT NULL DEFAULT 'ai_extracted'
                 CHECK (confidence IN ('ai_extracted','manual_unverified','validated')),
  -- Classification métier (demandée en session) :
  --   'action' = il faut faire/vérifier/changer quelque chose de concret
  --   'info'   = rappel contextuel, ne change rien à l'activité
  requirement_type TEXT NOT NULL DEFAULT 'action'
                 CHECK (requirement_type IN ('action','info')),
  CHECK ( (origin='country' AND jurisdiction IS NOT NULL)
       OR (origin='client'  AND client_id  IS NOT NULL) )
);

CREATE INDEX idx_req_lookup ON requirements (origin, jurisdiction, client_id, section_id, status);
CREATE INDEX idx_req_type ON requirements (requirement_type);

-- Portée d'une exigence de holding sur ses filiales (coche explicite,
-- jamais de propagation automatique)
CREATE TABLE requirement_scope (
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id),
  PRIMARY KEY (requirement_id, client_id)
);

-- Changements détectés à chaque run (file de validation humaine)
-- ---------- VEILLE PRESSE (signal faible — jamais une source d'exigences) ----------
-- Rôle différent de `sources` : la presse n'est pas normative. On détecte un
-- signal (article), on le fait trier par IA (pertinent ? urgence ?), et un
-- humain décide s'il déclenche une vérification officielle (veille pays
-- classique, qui elle seule peut créer une ligne dans `requirements`).

CREATE TABLE press_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction  TEXT REFERENCES jurisdictions(code),  -- NULL = transverse (toutes zones)
  name          TEXT NOT NULL,
  fetcher       TEXT NOT NULL,              -- 'rss' | 'gdelt'
  fetch_config  JSONB NOT NULL,             -- {"url":"..."} ou {"query":"...","timespan":"7d"}
  url_human     TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (name)
);

CREATE TABLE press_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  press_source_id  UUID REFERENCES press_sources(id),
  jurisdiction     TEXT REFERENCES jurisdictions(code),
  title            TEXT NOT NULL,
  summary          TEXT,
  article_url      TEXT NOT NULL UNIQUE,
  published_at     TIMESTAMPTZ,
  relevance        TEXT NOT NULL DEFAULT 'to_review'
                   CHECK (relevance IN ('to_review','relevant','not_relevant')),
  urgency          TEXT CHECK (urgency IN ('high','medium','low')),
  suggested_action TEXT,                    -- ex: "vérifier si le règl. 2019/934 est modifié"
  linked_source_id UUID REFERENCES sources(id),  -- rapproché d'une source officielle existante
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_press_relevance ON press_alerts (relevance, jurisdiction);

CREATE TABLE change_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         UUID REFERENCES watch_runs(id),
  document_id    UUID REFERENCES client_documents(id),
  requirement_id UUID REFERENCES requirements(id),
  change_type    TEXT NOT NULL CHECK (change_type IN ('new','modified','removed')),
  diff           JSONB,                     -- {before:{...}, after:{...}}
  reviewed       BOOLEAN NOT NULL DEFAULT false,
  reviewed_by    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- VUES DE SORTIE (mêmes colonnes pour les 2 onglets) ----------

CREATE VIEW v_requirements_table AS
SELECT r.id, r.origin, r.jurisdiction, r.client_id, c.name AS client_name,
       s.label AS section, s.sort_order,
       r.parameter, r.requirement, r.operator, r.limit_value, r.unit,
       r.applies_to, r.source_ref, r.source_url,
       COALESCE(src.name, d.normalized_filename) AS source_name,
       r.effective_date, r.status, r.confidence
FROM requirements r
JOIN sections s ON s.id = r.section_id
LEFT JOIN clients c ON c.id = r.client_id
LEFT JOIN sources src ON src.id = r.source_id
LEFT JOIN client_documents d ON d.id = r.document_id
WHERE r.status = 'active';

-- Outil 1 : couple pays/client -> tout ce qu'il faut respecter
-- (exigences pays + exigences du client et de sa holding si scope coché)
CREATE OR REPLACE FUNCTION get_country_client_matrix(p_jurisdiction TEXT, p_client UUID)
RETURNS SETOF v_requirements_table LANGUAGE sql STABLE AS $$
  SELECT * FROM v_requirements_table v
  WHERE (v.origin = 'country' AND v.jurisdiction = p_jurisdiction)
     OR (v.origin = 'client' AND v.id IN (
          SELECT r.id FROM requirements r
          WHERE r.client_id = p_client
             OR r.id IN (SELECT requirement_id FROM requirement_scope WHERE client_id = p_client)
        )
        -- une exigence client limitée à un pays ne sort que pour ce pays
        AND (v.jurisdiction IS NULL OR v.jurisdiction = p_jurisdiction))
  ORDER BY sort_order, parameter;
$$;
