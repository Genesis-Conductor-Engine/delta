import { test } from "node:test";
import assert from "node:assert/strict";
import { verify, computeTier, hash01, relativeTensor } from "../src/engine.js";

test("hash01 is stable & in range", () => {
  assert.equal(hash01("delta"), hash01("delta"));
  const a = hash01("delta");
  assert.ok(a >= 0 && a < 1);
});

test("relativeTensor matches R=(B-O)/(O+eps)", () => {
  const r = relativeTensor([0.5], [0.25]);
  assert.ok(Math.abs(r[0] - (0.25 / (0.25 + 1e-6))) < 1e-9);
});

test("computeTier thresholds", () => {
  assert.equal(computeTier(0.10), "aligned");
  assert.equal(computeTier(0.40), "tension");
  assert.equal(computeTier(0.80), "divergent");
});

const GOLDEN = {
  "The earth is flat": { div: 0.2172, tension: 0.4454, consensus: 78, confidence: 78, oracle_divs: [0.1861, 0.1108, 0.018] },
  "Markets are perfectly efficient": { div: 0.2001, tension: 0.2701, consensus: 79, confidence: 81, oracle_divs: [0.0981, 0.1155, 0.0766] },
  "A Mediterranean diet extends median lifespan": { div: 0.0532, tension: 0.1149, consensus: 94, confidence: 83, oracle_divs: [0.0267, 0.0259, 0.0245] },
  "Quantum advantage is commercially imminent": { div: 0.0389, tension: 0.3022, consensus: 96, confidence: 80, oracle_divs: [0.01, 0.0436, 0.0371] },
};

test("RTPTPA parity with Python reference (golden values)", () => {
  for (const [claim, g] of Object.entries(GOLDEN)) {
    const r = verify(claim);
    assert.equal(r.div, g.div, `${claim} div`);
    assert.equal(r.tension, g.tension, `${claim} tension`);
    assert.equal(r.consensus, g.consensus, `${claim} consensus`);
    assert.equal(r.confidence, g.confidence, `${claim} confidence`);
    assert.deepEqual(r.oracle_divs, g.oracle_divs, `${claim} oracle_divs`);
  }
});

test("verify rejects empty claim", () => assert.throws(() => verify("  ")));
