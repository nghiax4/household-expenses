// Bundles the TypeScript backend into the single Code.js file Apps Script runs, next to its
// manifest, in apps-script/dist (which clasp uploads).
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

const outDir = 'apps-script/dist';
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ['apps-script/src/main.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'Backend',
  target: 'es2020',
  outfile: `${outDir}/Code.js`,
  // Apps Script only finds functions declared at the top level, so expose the entry points.
  footer: {
    js: [
      'function doGet(e) { return Backend.doGet(e); }',
      'function doPost(e) { return Backend.doPost(e); }',
      'function setupStorage() { return Backend.setupStorage(); }',
    ].join('\n'),
  },
});
await copyFile('apps-script/appsscript.json', `${outDir}/appsscript.json`);
console.log(`Built ${outDir}/Code.js`);
