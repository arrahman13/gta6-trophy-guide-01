// Leonida Legend — entry program for the make.fun gta6-trophy-guide-01 bounty.
// Node 22, standard library only.
//
// The guide itself is the app/ folder beside this file: plain static files a
// browser opens at app/index.html, running fully offline, with the trophy list
// and every guide in app/data/trophies.json. This program is only the delivery
// step the bounty asks for: it copies app/ and screenshots/ into the output
// directory and writes dossier.json — the summary the judge reads — using the
// vendored make.fun library in vendor/. That library stays byte-for-byte as
// the kit ships it, because the scorer requires the dossier to be exactly what
// its own copy of the library produces.
//
// Run it the way the grader does, or locally with an override:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Preview the guide itself with:  node serve.ts   (then http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'app'), join(outDir, 'app'), { recursive: true });

const shotsTarget = join(outDir, 'screenshots');
mkdirSync(shotsTarget, { recursive: true });
const shotsSource = join(root, 'screenshots');
if (existsSync(shotsSource)) cpSync(shotsSource, shotsTarget, { recursive: true });

// The limits passed to buildDossier are the scorer's published gate for this
// bounty family: text shaped to 160 KiB, at most 4 screenshots of at most
// 256 KiB each, and the app/ file-count and byte ceilings. Matching them here
// means a local run refuses anything the scorer would refuse anyway.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`Leonida Legend delivered to ${outDir} (app/, screenshots/, dossier.json)`);
