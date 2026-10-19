CREATE TABLE property (
  id TEXT PRIMARY KEY,
  ego_ref TEXT NOT NULL UNIQUE,
  nature TEXT NOT NULL,
  municipality TEXT NOT NULL,
  availability TEXT NOT NULL,
  ego_modified TEXT NOT NULL DEFAULT '',
  original_description TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE listing (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES property(id),
  portal_id TEXT NOT NULL REFERENCES portal(id),
  portal_ref TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'desconhecida'
    CHECK (visibility IN ('desconhecida','ativa','inativa','retirada')),
  monitoring INTEGER NOT NULL DEFAULT 1 CHECK (monitoring IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(property_id, portal_id)
);
CREATE INDEX listing_property ON listing(property_id);
CREATE TABLE audit (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listing(id),
  listing_revision INTEGER NOT NULL,
  checklist_version TEXT NOT NULL,
  rules_status TEXT NOT NULL,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE issue (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listing(id),
  audit_id TEXT REFERENCES audit(id),
  field TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE audit_draft (
  listing_id TEXT PRIMARY KEY REFERENCES listing(id),
  items_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX issue_listing ON issue(listing_id);
CREATE TABLE manual_change (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issue(id),
  listing_revision INTEGER NOT NULL,
  edit_location TEXT NOT NULL CHECK (edit_location IN ('portal','ego')),
  fields TEXT NOT NULL,
  reason TEXT NOT NULL,
  implemented_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE qa_check (
  id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL REFERENCES manual_change(id),
  listing_revision INTEGER NOT NULL,
  observed_url TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('aprovado','falhou','nao_verificavel')),
  note TEXT NOT NULL,
  observed_at TEXT NOT NULL
);
CREATE TABLE ego_import (
  id TEXT PRIMARY KEY,
  source_sha256 TEXT NOT NULL,
  sheet TEXT NOT NULL,
  description_enabled INTEGER NOT NULL CHECK (description_enabled IN (0,1)),
  created_count INTEGER NOT NULL,
  updated_count INTEGER NOT NULL,
  unchanged_count INTEGER NOT NULL,
  applied_at TEXT NOT NULL
);
