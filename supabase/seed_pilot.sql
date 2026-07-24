-- Jeu pilote : exigences réelles (vérifiées manuellement) pour tester
-- l'affichage, le couple pays×client et le comparateur AVANT le premier run.
-- Tout est en pending_validation : à valider dans l'onglet Validation qualité.

CREATE OR REPLACE FUNCTION _src(j TEXT, n TEXT) RETURNS UUID LANGUAGE sql AS
$$ SELECT id FROM sources WHERE jurisdiction = j AND name LIKE n || '%' LIMIT 1 $$;

INSERT INTO requirements (origin, jurisdiction, section_id, parameter, requirement, operator, limit_value, unit, applies_to, source_id, source_ref, source_url, status) VALUES
-- === UE ===
('country','EU','analytique','SO2 total (sucres < 5 g/L)','Teneur maximale en anhydride sulfureux total à la mise à la consommation','<=',150,'mg/L','vin rouge',_src('EU','Règl. 2019/934'),'Annexe I, partie B, A.1.a','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0934','pending_validation'),
('country','EU','analytique','SO2 total (sucres < 5 g/L)','Teneur maximale en anhydride sulfureux total à la mise à la consommation','<=',200,'mg/L','vin blanc / rosé',_src('EU','Règl. 2019/934'),'Annexe I, partie B, A.2.a','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0934','pending_validation'),
('country','EU','analytique','SO2 total (sucres ≥ 5 g/L)','Limite relevée de 50 mg/L pour les vins à sucres résiduels ≥ 5 g/L (rouge 200, blanc/rosé 250)','<=',250,'mg/L','tous vins, sucres ≥ 5 g/L',_src('EU','Règl. 2019/934'),'Annexe I, partie B, A.1.b et A.2.b','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0934','pending_validation'),
('country','EU','analytique','Acidité volatile','Teneur maximale en acidité volatile (20 méq/L = 1,2 g/L ac. acétique)','<=',20,'méq/L','vin rouge',_src('EU','Règl. 2019/934'),'Annexe I, partie C','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0934','pending_validation'),
('country','EU','analytique','Acidité volatile','Teneur maximale en acidité volatile (18 méq/L = 1,08 g/L ac. acétique)','<=',18,'méq/L','vin blanc / rosé',_src('EU','Règl. 2019/934'),'Annexe I, partie C','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0934','pending_validation'),
('country','EU','analytique','Ochratoxine A','Teneur maximale en OTA','<=',2,'µg/kg','vins (dont vins de liqueur)',_src('EU','Règl. 2023/915'),'Annexe I (à vérifier: point mycotoxines)','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02023R0915','pending_validation'),
('country','EU','analytique','Plomb','Teneur maximale en plomb (vins produits à partir de la vendange 2022)','<=',0.10,'mg/kg','vins',_src('EU','Règl. 2023/915'),'Annexe I (à vérifier: point métaux)','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02023R0915','pending_validation'),
('country','EU','composes','Pratiques œnologiques autorisées','Seuls les pratiques, additifs et auxiliaires listés en annexe I (tableaux 1 et 2) sont autorisés, aux doses et conditions prescrites','obligatoire',NULL,NULL,'tous vins',_src('EU','Règl. 2019/934'),'Art. 3 + Annexe I, partie A','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0934','pending_validation'),
('country','EU','allergenes','Sulfites — mention allergène','Mention obligatoire (« contient des sulfites ») si SO2 > 10 mg/L','obligatoire',10,'mg/L','tous vins',_src('EU','Règl. 1169/2011'),'Annexe II, point 12 ; Règl. 2019/33 art. 41','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02011R1169','pending_validation'),
('country','EU','etiquetage','Titre alcoométrique acquis','TAV indiqué en unités ou demi-unités de %, suivi de « % vol », éventuellement précédé de « alc »','obligatoire',NULL,'% vol','tous vins',_src('EU','Règl. 2019/33'),'Art. 44','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0033','pending_validation'),
('country','EU','etiquetage','Ingrédients & déclaration nutritionnelle','Liste des ingrédients et déclaration nutritionnelle obligatoires (dématérialisation e-label possible sauf valeur énergétique, sur l''étiquette)','obligatoire',NULL,NULL,'vins produits après le 08/12/2023',_src('EU','Règl. 1308/2013'),'Art. 119 (mod. Règl. 2021/2117)','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02013R1308','pending_validation'),

-- === USA ===
('country','US','etiquetage','Government Warning','Mention d''avertissement sanitaire obligatoire, texte et typographie imposés','obligatoire',NULL,NULL,'toutes boissons alcoolisées ≥ 0,5 % vol',_src('US','27 CFR Part 16'),'§ 16.21','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16','pending_validation'),
('country','US','allergenes','Sulfites — déclaration','« Contains sulfites » obligatoire si ≥ 10 ppm de SO2','obligatoire',10,'ppm','tous vins',_src('US','27 CFR Part 4'),'§ 4.32(e)','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4','pending_validation'),
('country','US','etiquetage','Degré alcoolique — tolérance','Tolérance de ±1,5 % vol entre TAV étiqueté et réel pour les vins 7-14 % (±1 % au-delà de 14 %)','<=',1.5,'% vol','vins 7-14 % vol',_src('US','27 CFR Part 4'),'§ 4.36','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4','pending_validation'),
('country','US','analytique','Acidité volatile','Maximum d''acidité volatile (hors vinaigre) pour vin de table rouge','<=',0.14,'g/100 mL','vin rouge (grape table wine)',_src('US','27 CFR Part 4'),'§ 4.21(a)','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4','pending_validation'),
('country','US','composes','Matériaux et traitements autorisés en cave','Seuls les matériaux et procédés listés (avec limites d''emploi) sont autorisés pour le traitement du vin','obligatoire',NULL,NULL,'tous vins',_src('US','27 CFR Part 24'),'§ 24.246','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-24','pending_validation'),

-- === UK ===
('country','UK','allergenes','Sulfites — mention allergène','Mention allergène obligatoire si SO2 > 10 mg/L (règl. 1169/2011 assimilé)','obligatoire',10,'mg/L','tous vins',_src('UK','Règl. 1169/2011 assimilé'),'Annexe II (droit assimilé)','https://www.legislation.gov.uk/eur/2011/1169','pending_validation'),
('country','UK','etiquetage','Adresse de l''opérateur UK','Nom et adresse d''un opérateur/importateur établi au Royaume-Uni obligatoires sur l''étiquette','obligatoire',NULL,NULL,'vins importés en GB',_src('UK','Règl. 2019/33 assimilé'),'Droit assimilé 2019/33 (mentions obligatoires, adapté post-Brexit)','https://www.legislation.gov.uk/eur/2019/33','pending_validation');

DROP FUNCTION _src(TEXT, TEXT);
