-- Clara · migração 002: catálogo dos 23 destinos (PRD secção 4).
-- Grupo, regras e capacidades ficam "por confirmar" até ao levantamento.

CREATE TABLE portal (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('portal', 'site_proprio', 'rede_social', 'categoria')),
  sort_order          INTEGER NOT NULL,
  monitoring_enabled  INTEGER NOT NULL DEFAULT 0 CHECK (monitoring_enabled IN (0, 1)),
  grupo               TEXT NOT NULL DEFAULT 'por_confirmar'
                      CHECK (grupo IN ('por_confirmar', 'core', 'secondary', 'feed_only')),
  rules_status        TEXT NOT NULL DEFAULT 'por_levantar'
                      CHECK (rules_status IN ('por_levantar', 'em_levantamento', 'levantado')),
  last_verified_at    TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE portal_alias (
  portal_id  TEXT NOT NULL REFERENCES portal(id),
  alias      TEXT NOT NULL,
  PRIMARY KEY (portal_id, alias)
);

INSERT INTO portal (id, name, kind, sort_order, created_at, updated_at)
SELECT id, name, kind, sort_order, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT 'supercasa' AS id, 'SUPERCASA' AS name, 'portal' AS kind, 1 AS sort_order
  UNION ALL SELECT 'casa-sapo', 'Casa Sapo', 'portal', 2
  UNION ALL SELECT 'imovirtual', 'Imovirtual', 'portal', 3
  UNION ALL SELECT 'site-agencia', 'Site da agência', 'site_proprio', 4
  UNION ALL SELECT 'bpi-expresso', 'BPI Expresso', 'portal', 5
  UNION ALL SELECT 'casas-na-web', 'Casas na Web', 'portal', 6
  UNION ALL SELECT 'facebook', 'Facebook', 'rede_social', 7
  UNION ALL SELECT 'green-acres-pt', 'Green-Acres Portugal', 'portal', 8
  UNION ALL SELECT 'idealista-pt', 'Idealista PT', 'portal', 9
  UNION ALL SELECT 'immobilierportugal-fr', 'immobilierportugal.fr', 'portal', 10
  UNION ALL SELECT 'james-edition', 'James Edition', 'portal', 11
  UNION ALL SELECT 'kyero-pt', 'Kyero Portugal', 'portal', 12
  UNION ALL SELECT 'luxury-estate', 'Luxury Estate', 'portal', 13
  UNION ALL SELECT 'mer-et-demeures', 'Mer et Demeures', 'portal', 14
  UNION ALL SELECT 'mitula', 'Mitula', 'portal', 15
  UNION ALL SELECT 'net-anuncio', 'Net Anúncio', 'portal', 16
  UNION ALL SELECT 'outros-nacionais', 'Outros portais nacionais', 'categoria', 17
  UNION ALL SELECT 'portugalcasas-br', 'portugalcasas.com.br', 'portal', 18
  UNION ALL SELECT 'properstar-free', 'Properstar (Free)', 'portal', 19
  UNION ALL SELECT 'propertiesinportugal-uk', 'propertiesinportugal.uk', 'portal', 20
  UNION ALL SELECT 'property-portal', 'Property Portal', 'portal', 21
  UNION ALL SELECT 'rightmove-pt', 'RightMove Portugal', 'portal', 22
  UNION ALL SELECT 'vizzit', 'Vizzit', 'portal', 23
);
