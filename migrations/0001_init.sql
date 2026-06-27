-- Delta Truth Engine — persistent anchored ledger
CREATE TABLE IF NOT EXISTS anchors (
  block       INTEGER PRIMARY KEY,           -- monotonic block height
  statement   TEXT    NOT NULL,
  divergence  REAL    NOT NULL,
  tier        TEXT    NOT NULL,              -- aligned | tension | divergent
  tension     REAL    NOT NULL,
  consensus   INTEGER NOT NULL,
  confidence  INTEGER NOT NULL,
  oracle_divs TEXT    NOT NULL,              -- JSON array
  hash        TEXT    NOT NULL,              -- 0x….… short hash
  evt_id      TEXT,
  crystal_score REAL  NOT NULL,
  spectral_gap  REAL  NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_anchors_created ON anchors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anchors_tier    ON anchors(tier);

-- Singleton chain head/counter row (id=1)
CREATE TABLE IF NOT EXISTS chain_state (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  genesis_block   INTEGER NOT NULL,
  current_block   INTEGER NOT NULL,
  anchored_total  INTEGER NOT NULL
);
INSERT OR IGNORE INTO chain_state (id, genesis_block, current_block, anchored_total)
VALUES (1, 8492103, 8492103, 2418);
