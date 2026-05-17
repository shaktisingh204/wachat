// Inside project root so module resolution works. Stub `server-only`.
import { Module } from 'node:module';
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'server-only') return import.meta.dirname + '/.tmp-server-only-stub.cjs';
  return origResolve.call(this, request, ...rest);
};

import('./src/lib/sabflow/app-presets/importers/postman.ts').then(async (m) => {
  const fs = await import('node:fs/promises');
  const col = JSON.parse(await fs.readFile('/tmp/test-postman.json', 'utf-8'));
  const preset = m.postmanToPreset(col, { id: 'test-smoke-postman' });
  console.log('endpoints=', preset.endpoints.length);
  console.log('baseUrl=', preset.baseUrl);
  console.log('first=', JSON.stringify(preset.endpoints[0], null, 2));
  console.log('second=', JSON.stringify(preset.endpoints[1], null, 2));
  console.log('id=', preset.id);
  console.log('status=', preset.status);
  console.log('auth=', JSON.stringify(preset.auth));
}).catch(e => { console.error(e); process.exit(1); });
