import { manifest } from '../../api-manifest/index';
const byModule = new Map<string, number>();
for (const e of manifest.endpoints) byModule.set(e.module, (byModule.get(e.module) ?? 0) + 1);
console.log('TOTAL:', manifest.endpoints.length);
for (const [m, n] of Array.from(byModule.entries()).sort((a, b) => b[1] - a[1])) {
  console.log('  ', m.padEnd(20), n);
}
