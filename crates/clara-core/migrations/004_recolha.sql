CREATE TABLE collection_snapshot (
 id TEXT PRIMARY KEY,
 property_id TEXT NOT NULL REFERENCES property(id),
 collected_at TEXT NOT NULL,
 payload TEXT NOT NULL
);
CREATE INDEX collection_property ON collection_snapshot(property_id,collected_at);
