// Assembles public/_worker.js/ (Pages advanced-mode, esbuild-bundled by wrangler)
// from the canonical, unit-tested sources in src/. Keeps a single source of truth.
import { mkdir, copyFile, rm } from "node:fs/promises";
const OUT = "public/_worker.js";
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await copyFile("src/engine.js", `${OUT}/engine.js`);
await copyFile("src/widget.js", `${OUT}/widget.js`);
await copyFile("src/worker.js", `${OUT}/index.js`);
console.log("[build] public/_worker.js/{index.js,engine.js} assembled");
