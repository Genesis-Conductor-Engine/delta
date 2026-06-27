-- Link D1 anchors to real on-chain transactions written by a CDP wallet.
ALTER TABLE anchors ADD COLUMN onchain_tx      TEXT;
ALTER TABLE anchors ADD COLUMN onchain_addr    TEXT;
ALTER TABLE anchors ADD COLUMN onchain_network TEXT;
