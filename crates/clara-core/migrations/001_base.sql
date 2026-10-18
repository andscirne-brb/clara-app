-- Clara · migração 001: definições, histórico imutável e registo de backups.

CREATE TABLE app_setting (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Histórico append-only, encadeado por hashes.
CREATE TABLE history_event (
  seq                   INTEGER PRIMARY KEY AUTOINCREMENT,
  id                    TEXT NOT NULL UNIQUE,
  occurred_at           TEXT NOT NULL,              -- UTC, RFC 3339
  actor                 TEXT NOT NULL CHECK (actor IN ('andreia', 'sistema')),
  entity_type           TEXT NOT NULL,
  entity_id             TEXT,
  action                TEXT NOT NULL,
  origin                TEXT NOT NULL,
  reason                TEXT,
  summary               TEXT NOT NULL,              -- texto curto, sem conteúdo sensível
  correlation_id        TEXT,
  compensates_event_id  TEXT REFERENCES history_event(id),
  payload_sha256        TEXT,
  prev_hash             TEXT NOT NULL,
  hash                  TEXT NOT NULL UNIQUE
);
CREATE INDEX history_event_entity ON history_event(entity_type, entity_id);
CREATE INDEX history_event_time ON history_event(occurred_at);

-- Conteúdo antes/depois, separado para poder ser expurgado sem partir a cadeia.
CREATE TABLE history_payload (
  event_id  TEXT PRIMARY KEY REFERENCES history_event(id),
  content   TEXT NOT NULL
);

CREATE TRIGGER history_event_no_update BEFORE UPDATE ON history_event
BEGIN SELECT RAISE(ABORT, 'history_immutable'); END;

CREATE TRIGGER history_event_no_delete BEFORE DELETE ON history_event
BEGIN SELECT RAISE(ABORT, 'history_immutable'); END;

CREATE TRIGGER history_payload_no_update BEFORE UPDATE ON history_payload
BEGIN SELECT RAISE(ABORT, 'history_immutable'); END;

-- Só se apaga um conteúdo depois de existir um evento de redação para ele.
CREATE TRIGGER history_payload_delete_needs_redaction BEFORE DELETE ON history_payload
WHEN NOT EXISTS (
  SELECT 1 FROM history_event
  WHERE action = 'historico.redacao' AND entity_type = 'history_event' AND entity_id = OLD.event_id
)
BEGIN SELECT RAISE(ABORT, 'history_immutable'); END;

CREATE TABLE backup_run (
  id           TEXT PRIMARY KEY,
  started_at   TEXT NOT NULL,
  finished_at  TEXT NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('app', 'agendado')),
  status       TEXT NOT NULL CHECK (status IN ('ok', 'falhou')),
  file_name    TEXT,
  bytes        INTEGER,
  error        TEXT
);
