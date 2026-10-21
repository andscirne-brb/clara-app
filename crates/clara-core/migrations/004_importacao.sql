-- Clara · migração 004: dados mínimos vindos da listagem do EGO e registo de importações.

ALTER TABLE property ADD COLUMN natureza TEXT;
ALTER TABLE property ADD COLUMN concelho TEXT;
ALTER TABLE property ADD COLUMN disponibilidade TEXT;
ALTER TABLE property ADD COLUMN ego_created_on TEXT;
ALTER TABLE property ADD COLUMN ego_updated_on TEXT;
-- Só preenchida se a Andreia escolher guardar as descrições (NDA).
ALTER TABLE property ADD COLUMN description_original TEXT;
ALTER TABLE property ADD COLUMN source_seen_at TEXT;

CREATE TABLE import_run (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('imoveis_ego')),
  file_name     TEXT NOT NULL,
  file_sha256   TEXT NOT NULL,
  sheet         TEXT NOT NULL,
  rows_total    INTEGER NOT NULL,
  created       INTEGER NOT NULL,
  updated       INTEGER NOT NULL,
  unchanged     INTEGER NOT NULL,
  invalid       INTEGER NOT NULL,
  with_descriptions INTEGER NOT NULL CHECK (with_descriptions IN (0, 1)),
  applied_at    TEXT NOT NULL
);
