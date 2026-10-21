-- Clara · migração 003: imóveis, publicações, checklist, auditorias,
-- problemas, alterações e QA (slice 2).

CREATE TABLE property (
  id                      TEXT PRIMARY KEY,
  ego_reference_original  TEXT NOT NULL,
  ego_reference_key       TEXT NOT NULL UNIQUE,
  label                   TEXT NOT NULL DEFAULT '',
  ego_url                 TEXT,
  archived_at             TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE TABLE listing (
  id                 TEXT PRIMARY KEY,
  property_id        TEXT NOT NULL REFERENCES property(id),
  portal_id          TEXT NOT NULL REFERENCES portal(id),
  portal_reference   TEXT,
  portal_reference_key TEXT,
  public_url         TEXT,
  language           TEXT NOT NULL DEFAULT 'pt',
  visibility_status  TEXT NOT NULL DEFAULT 'desconhecida'
                     CHECK (visibility_status IN ('desconhecida', 'ativa', 'inativa', 'retirada')),
  monitoring_enabled INTEGER NOT NULL DEFAULT 1 CHECK (monitoring_enabled IN (0, 1)),
  last_observed_at   TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX listing_property ON listing(property_id);
CREATE UNIQUE INDEX listing_portal_ref ON listing(portal_id, portal_reference_key)
  WHERE portal_reference_key IS NOT NULL;

-- Checklist versionada. Uma auditoria fica sempre presa à versão usada.
CREATE TABLE checklist_version (
  id          TEXT PRIMARY KEY,
  version     INTEGER NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE checklist_item (
  id          TEXT PRIMARY KEY,
  version_id  TEXT NOT NULL REFERENCES checklist_version(id),
  area        TEXT NOT NULL,
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  hint        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL,
  UNIQUE (version_id, code)
);

CREATE TABLE audit (
  id                    TEXT PRIMARY KEY,
  listing_id            TEXT NOT NULL REFERENCES listing(id),
  checklist_version_id  TEXT NOT NULL REFERENCES checklist_version(id),
  status                TEXT NOT NULL CHECK (status IN ('rascunho', 'concluida')),
  notes                 TEXT NOT NULL DEFAULT '',
  started_at            TEXT NOT NULL,
  completed_at          TEXT
);
CREATE INDEX audit_listing ON audit(listing_id);

CREATE TABLE audit_result (
  audit_id  TEXT NOT NULL REFERENCES audit(id),
  item_id   TEXT NOT NULL REFERENCES checklist_item(id),
  result    TEXT NOT NULL CHECK (result IN ('conforme', 'nao_conforme', 'por_verificar', 'nao_aplicavel')),
  note      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (audit_id, item_id)
);

-- Auditoria concluída não muda: correções fazem-se com uma nova auditoria.
CREATE TRIGGER audit_result_frozen_update BEFORE UPDATE ON audit_result
WHEN (SELECT status FROM audit WHERE id = OLD.audit_id) = 'concluida'
BEGIN SELECT RAISE(ABORT, 'audit_completed'); END;
CREATE TRIGGER audit_result_frozen_insert BEFORE INSERT ON audit_result
WHEN (SELECT status FROM audit WHERE id = NEW.audit_id) = 'concluida'
BEGIN SELECT RAISE(ABORT, 'audit_completed'); END;

CREATE TABLE issue (
  id              TEXT PRIMARY KEY,
  property_id     TEXT NOT NULL REFERENCES property(id),
  listing_id      TEXT REFERENCES listing(id),
  audit_id        TEXT REFERENCES audit(id),
  item_id         TEXT REFERENCES checklist_item(id),
  title           TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgente', 'alta', 'normal', 'baixa')),
  note            TEXT NOT NULL DEFAULT '',
  manual_state    TEXT CHECK (manual_state IN ('cancelado', 'bloqueado')),
  manual_reason   TEXT,
  detected_at     TEXT NOT NULL,
  resolved_at     TEXT,
  updated_at      TEXT NOT NULL
);
CREATE INDEX issue_listing ON issue(listing_id);
CREATE INDEX issue_property ON issue(property_id);

-- Edição manual feita pela Andreia no portal ou no EGO.
CREATE TABLE change (
  id              TEXT PRIMARY KEY,
  listing_id      TEXT NOT NULL REFERENCES listing(id),
  field           TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'pt',
  edit_location   TEXT NOT NULL CHECK (edit_location IN ('portal', 'ego')),
  description     TEXT NOT NULL,
  reason          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL CHECK (status IN ('qa_pendente', 'qa_aprovado', 'qa_falhou', 'substituido')),
  implemented_at  TEXT NOT NULL,
  recheck_after   TEXT,
  updated_at      TEXT NOT NULL
);
CREATE INDEX change_listing ON change(listing_id);

CREATE TABLE issue_change (
  issue_id   TEXT NOT NULL REFERENCES issue(id),
  change_id  TEXT NOT NULL REFERENCES change(id),
  PRIMARY KEY (issue_id, change_id)
);

CREATE TABLE qa_check (
  id            TEXT PRIMARY KEY,
  change_id     TEXT NOT NULL REFERENCES change(id),
  observed_url  TEXT,
  checked_at    TEXT NOT NULL,
  result        TEXT NOT NULL CHECK (result IN ('aprovado', 'falhou', 'nao_verificavel')),
  note          TEXT NOT NULL DEFAULT ''
);
CREATE INDEX qa_change ON qa_check(change_id);

-- Checklist-base v1 (PRD 6.2). Genérica: nada aqui é "obrigatório do portal".
INSERT INTO checklist_version (id, version, name, created_at)
VALUES ('cl-v1', 1, 'Checklist-base v1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO checklist_item (id, version_id, area, code, label, hint, sort_order) VALUES
 ('cl-v1-01','cl-v1','Identificação','id.referencias','Referência EGO, referência do portal e URL corretas','Confirma que é o imóvel certo.',1),
 ('cl-v1-02','cl-v1','Identificação','id.visivel','Anúncio visível publicamente','Abre o URL público sem sessão iniciada.',2),
 ('cl-v1-03','cl-v1','Fotografias','foto.publicadas','Fotografias disponíveis no EGO estão publicadas','Distingue material ausente do EGO de material não publicado.',3),
 ('cl-v1-04','cl-v1','Fotografias','foto.principal','Imagem principal adequada','',4),
 ('cl-v1-05','cl-v1','Fotografias','foto.ordem','Ordem das fotografias conta a história do imóvel','',5),
 ('cl-v1-06','cl-v1','Fotografias','foto.qualidade','Qualidade, resolução e enquadramento','',6),
 ('cl-v1-07','cl-v1','Fotografias','foto.atuais','Sem fotografias duplicadas ou desatualizadas','',7),
 ('cl-v1-08','cl-v1','Alt texts','alt.presentes','Alt texts presentes, factuais e no idioma certo','Não aplicável se o portal não tiver este campo.',8),
 ('cl-v1-09','cl-v1','Descrição','desc.factual','Descrição otimizada e factual, sem inventar características','',9),
 ('cl-v1-10','cl-v1','Descrição','desc.abertura','Abertura clara e diferenciação suportada','',10),
 ('cl-v1-11','cl-v1','Descrição','desc.limites','Dentro dos limites reais do portal','',11),
 ('cl-v1-12','cl-v1','Título','titulo.exato','Título exato, legível e coerente com o imóvel','',12),
 ('cl-v1-13','cl-v1','Vídeo','video.publicado','Vídeo publicado e a funcionar','Não aplicável se não existir vídeo no EGO ou o portal não suportar.',13),
 ('cl-v1-14','cl-v1','Planta','planta.publicada','Planta publicada, versão certa e legível','',14),
 ('cl-v1-15','cl-v1','Características','carac.principais','Preço, tipologia, áreas e divisões corretos','',15),
 ('cl-v1-16','cl-v1','Características','carac.energia','Certificação energética indicada','',16),
 ('cl-v1-17','cl-v1','Características','carac.localizacao','Localização dentro do permitido','',17),
 ('cl-v1-18','cl-v1','Idiomas','idioma.cobertura','Idiomas aplicáveis presentes e revistos','',18),
 ('cl-v1-19','cl-v1','Consistência','cons.ego','Coerente com o EGO, sem textos antigos ou contradições','',19),
 ('cl-v1-20','cl-v1','Experiência pública','pub.funcional','Imagens e links funcionam, sem truncagem, legível no telemóvel','',20);
