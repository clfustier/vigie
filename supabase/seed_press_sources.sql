-- Sources de veille presse V1. Toutes vérifiées accessibles sans clé au
-- moment de la rédaction (cf. docs/SOURCES.md, section "Veille presse").
-- Rappel : ces sources n'alimentent JAMAIS `requirements` directement,
-- seulement `press_alerts` (signal à vérifier officiellement).

INSERT INTO press_sources (jurisdiction, name, fetcher, fetch_config, url_human) VALUES
-- === USA — TTB (officiel, RSS natif) ===
('US','TTB — News & Events','rss','{"url":"https://www.ttb.gov/system/files/templates/ttb/news/ttb.xml"}','https://www.ttb.gov/online-services/rss/rss-feeds-from-ttb'),
('US','TTB — Announcements','rss','{"url":"https://www.ttb.gov/system/files/templates/ttb/news/announcements.xml"}','https://www.ttb.gov/online-services/rss/rss-feeds-from-ttb'),
('US','TTB — Press Releases','rss','{"url":"https://www.ttb.gov/system/files/templates/ttb/news/press.xml"}','https://www.ttb.gov/online-services/rss/rss-feeds-from-ttb'),

-- === Transverse — presse spécialisée vin (RSS) ===
(NULL,'Wine-Searcher — Wine News','rss','{"url":"https://www.wine-searcher.com/rss-feed/dept/wine+news"}','https://www.wine-searcher.com/rss'),

-- === Transverse — GDELT (mots-clés, recoupement large, pas de clé) ===
(NULL,'GDELT — wine labeling regulation EU','gdelt','{"query":"wine labeling regulation European Union","timespan":"14d"}','https://api.gdeltproject.org/api/v2/doc/doc'),
(NULL,'GDELT — wine regulation TTB FDA','gdelt','{"query":"wine regulation TTB OR FDA labeling","timespan":"14d"}','https://api.gdeltproject.org/api/v2/doc/doc'),
(NULL,'GDELT — wine regulation UK post-Brexit','gdelt','{"query":"wine regulation UK labelling Brexit","timespan":"14d"}','https://api.gdeltproject.org/api/v2/doc/doc'),
(NULL,'GDELT — vin réglementation étiquetage France UE','gdelt','{"query":"vin réglementation étiquetage France Union Européenne","timespan":"14d"}','https://api.gdeltproject.org/api/v2/doc/doc');

-- Sources identifiées mais NON intégrées faute de flux RSS public confirmé au
-- moment de la rédaction (vérifier manuellement avant d'ajouter) :
--   - Vitisphere.com : newsletters par thématique (dont "politique"/réglementaire),
--     mais pas de flux RSS public trouvé -> passer par GDELT (déjà couvert) ou
--     un abonnement e-mail suivi manuellement.
--   - DGCCRF (France) : pas de flux RSS dédié "vin" identifié -> à surveiller
--     via GDELT (mots-clés DGCCRF + vin) en attendant.
--   - Food Standards Agency (UK) : à évaluer si un pays UK plus poussé est ajouté.
--   - Libation Law Blog / Stoel Rives Alcohol Beverage Blog (droit des boissons
--     alcoolisées, blogs juridiques US) : RSS probable via leur CMS, URL exacte
--     à vérifier avant intégration (ne pas deviner une URL de flux non confirmée).
