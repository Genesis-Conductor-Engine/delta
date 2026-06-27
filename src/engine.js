// ─────────────────────────────────────────────────────────────────────────────
// Delta Truth Emergent Engine — RTPTPA core, faithful JS port of
// engine/delta_truth_engine.py. Pure/deterministic: no platform deps so it can
// be unit-tested under Node and run inside the Cloudflare worker unchanged.
//   Core principle: "Truth is Structural" — relative tensors, never absolutes.
// ─────────────────────────────────────────────────────────────────────────────

export const TIER_COLOR = { aligned: "#27e070", tension: "#f5b544", divergent: "#ff5d5d" };

/** Stable [0,1] hash — identical algorithm to the Python `hash01`. */
export function hash01(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0; // & 0xFFFFFFFF, unsigned
  }
  return Math.abs(h) / 2147483648.0;
}

export function makeBeliefTensor(text, dim = 64) {
  const vec = new Array(dim).fill(0);
  const base = hash01(text);
  const rev = text.split("").reverse().join("");
  for (let i = 0; i < dim; i++) {
    const phase = (i / dim) * 2 * Math.PI;
    const pos = 0.5 + 0.5 * Math.sin(phase + base * 6.28);
    const h1 = hash01(`${text}|${i}`);
    const h2 = hash01(`${rev}|${i * 7}`);
    const h3 = hash01(`${base.toFixed(8)}|${i}`);
    const val = pos * 0.4 + h1 * 0.3 + h2 * 0.2 + h3 * 0.1;
    vec[i] = Math.max(0.02, Math.min(0.98, val));
  }
  return vec;
}

export function makeOracleTensor(oracleName, claim, dim = 64) {
  const base = makeBeliefTensor(claim, dim);
  const drift = hash01(oracleName + claim) - 0.5;
  for (let i = 0; i < dim; i++) {
    const perturbation = drift * (0.15 + 0.1 * Math.sin(i * 0.3));
    base[i] = Math.max(0.02, Math.min(0.98, base[i] + perturbation));
  }
  return base;
}

export function relativeTensor(belief, oracle, eps = 1e-6) {
  return belief.map((b, i) => (b - oracle[i]) / (oracle[i] + eps));
}

export function powerTowerWeight(layer, crystalScore, spectralGap, stagnation = 0.0, beta = 1.15) {
  let w = 0.6 + 0.3 * crystalScore + 0.1 * spectralGap;
  for (let k = 0; k < layer; k++) {
    w = Math.pow(beta, w) * (1.0 - stagnation * 0.6);
    w = Math.max(0.1, Math.min(4.0, w));
  }
  return w;
}

export function antagonisticFusion(belief, oracles, crystalScore = 0.82, spectralGap = 0.71) {
  const dim = belief.length;
  const names = Object.keys(oracles);
  const relTensors = {};
  for (const name of names) relTensors[name] = relativeTensor(belief, oracles[name]);

  const weights = {};
  for (const name of names) {
    const w0 = powerTowerWeight(0, crystalScore, spectralGap);
    const w1 = powerTowerWeight(1, crystalScore, spectralGap);
    const w2 = powerTowerWeight(2, crystalScore, spectralGap, 0.08);
    weights[name] = (w0 + w1 * 0.7 + w2 * 0.4) / 2.1;
  }

  const fused = new Array(dim).fill(0);
  const tensions = [];
  const perOracleDivs = [];

  for (const name of names) {
    const rel = relTensors[name];
    const w = weights[name];
    const oracleDiv = rel.reduce((a, r) => a + Math.abs(r), 0) / dim;
    perOracleDivs.push(Math.min(0.99, Math.max(0.01, oracleDiv)));
    for (let i = 0; i < dim; i++) {
      fused[i] += w * rel[i] * (0.6 + 0.4 * (1.0 - crystalScore));
    }
    tensions.push(Math.max(...rel.map(Math.abs)));
  }

  let div = fused.reduce((a, x) => a + Math.abs(x), 0) / dim;
  div = Math.max(0.01, Math.min(0.99, div));

  let tension = tensions.length ? Math.max(...tensions) : 0.22;
  tension = Math.max(0.01, Math.min(0.95, tension));

  let confidence = Math.trunc(68 + crystalScore * 22 - tension * 18);
  confidence = Math.max(55, Math.min(96, confidence));

  return { div, tension, perOracleDivs, confidence };
}

export function computeTier(div) {
  if (div < 0.25) return "aligned";
  if (div < 0.55) return "tension";
  return "divergent";
}

/** SHA-256 short hash "0xABCD…WXYZ" — async (WebCrypto), matches Python hex_hash shape. */
export async function hexHash(s, block) {
  const data = new TextEncoder().encode(`${s}|${block}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex.slice(0, 4) + "…" + hex.slice(-4);
}

const round = (x, n) => { const f = 10 ** n; return Math.round(x * f) / f; };

export const ORACLE_NAMES = ["ArXiv", "X_API", "Grokpedia"];
export const DEFAULTS = { crystalScore: 0.82, spectralGap: 0.71, version: "0.9.1-emergent-antagonistic" };

/** Pure verification → reading object (no persistence). */
export function verify(claim, opts = {}) {
  if (!claim || !claim.trim()) throw new Error("Claim cannot be empty");
  const crystalScore = opts.crystalScore ?? DEFAULTS.crystalScore;
  const spectralGap = opts.spectralGap ?? DEFAULTS.spectralGap;
  const oracleNames = opts.oracleNames ?? ORACLE_NAMES;

  const belief = makeBeliefTensor(claim);
  const oracles = {};
  for (const n of oracleNames) oracles[n] = makeOracleTensor(n, claim);

  const { div, tension, perOracleDivs, confidence } = antagonisticFusion(
    belief, oracles, crystalScore, spectralGap
  );
  const tier = computeTier(div);
  const consensus = Math.trunc((1.0 - div) * 100);

  return {
    statement: claim,
    div: round(div, 4),
    tier,
    consensus,
    confidence,
    oracle_divs: perOracleDivs.map((d) => round(d, 4)),
    oracle_names: oracleNames,
    tension: round(tension, 4),
    anchored: false,
    crystal_score: crystalScore,
    spectral_gap: spectralGap,
    belief_preview: belief.slice(0, 8).map((x) => round(x, 3)),
    evt_id: `evt_delta_${Date.now()}`,
    relative_tensor_method: "R = (B - O) / (O + eps)",
    engine_version: DEFAULTS.version,
  };
}
