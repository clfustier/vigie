-- Sources V1 : UE, UK, USA (cf. docs/SOURCES.md pour la justification)
-- Réplicable : ajouter un pays = ajouter des lignes ici.

INSERT INTO sources (jurisdiction, name, fetcher, fetch_config, url_human, license_note) VALUES
-- === UE (EUR-Lex, réutilisation libre — Décision 2011/833/UE) ===
('EU','Règl. 2019/934 — pratiques œno & limites','eurlex','{"celex":"02019R0934","fallback_celex":"32019R0934","lang":"FR"}','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0934','EUR-Lex réutilisation libre'),
('EU','Règl. 2019/33 — étiquetage & AOP/IGP','eurlex','{"celex":"02019R0033","fallback_celex":"32019R0033","lang":"FR"}','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02019R0033','EUR-Lex réutilisation libre'),
('EU','Règl. 1308/2013 — OCM (annexes VII-VIII)','eurlex','{"celex":"02013R1308","fallback_celex":"32013R1308","lang":"FR"}','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02013R1308','EUR-Lex réutilisation libre'),
('EU','Règl. 1169/2011 — INCO (allergènes, mentions)','eurlex','{"celex":"02011R1169","fallback_celex":"32011R1169","lang":"FR"}','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02011R1169','EUR-Lex réutilisation libre'),
('EU','Règl. 2023/915 — contaminants','eurlex','{"celex":"02023R0915","fallback_celex":"32023R0915","lang":"FR"}','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02023R0915','EUR-Lex réutilisation libre'),
('EU','Règl. 2018/848 — bio','eurlex','{"celex":"02018R0848","fallback_celex":"32018R0848","lang":"FR"}','https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02018R0848','EUR-Lex réutilisation libre'),

-- === UK (legislation.gov.uk, Open Government Licence v3) ===
('UK','Règl. 2019/33 assimilé (étiquetage vin UK)','uklegislation','{"path":"eur/2019/33"}','https://www.legislation.gov.uk/eur/2019/33','OGL v3'),
('UK','Règl. 2019/934 assimilé (pratiques œno UK)','uklegislation','{"path":"eur/2019/934"}','https://www.legislation.gov.uk/eur/2019/934','OGL v3'),
('UK','The Wine Regulations 2011','uklegislation','{"path":"uksi/2011/2936"}','https://www.legislation.gov.uk/uksi/2011/2936','OGL v3'),
('UK','Règl. 1169/2011 assimilé (FIC UK)','uklegislation','{"path":"eur/2011/1169"}','https://www.legislation.gov.uk/eur/2011/1169','OGL v3'),

-- === USA (eCFR + Federal Register, domaine public) ===
('US','27 CFR Part 4 — étiquetage vin (TTB)','ecfr','{"title":27,"part":"4"}','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4','Domaine public US'),
('US','27 CFR Part 24 — pratiques cave & matériaux','ecfr','{"title":27,"part":"24"}','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-24','Domaine public US'),
('US','27 CFR Part 16 — health warning','ecfr','{"title":27,"part":"16"}','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16','Domaine public US'),
('US','27 CFR Part 27 — importation','ecfr','{"title":27,"part":"27"}','https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-27','Domaine public US'),
('US','Federal Register — règles TTB récentes','federalregister','{"agency":"alcohol-tobacco-tax-and-trade-bureau","sinceDays":40}','https://www.federalregister.gov/agencies/alcohol-tobacco-tax-and-trade-bureau','Domaine public US');
