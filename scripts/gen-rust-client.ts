/**
 * Codegen scaffold: pull the live OpenAPI spec from the Rust BFF and emit a
 * TypeScript client into `src/lib/rust-client/generated.ts`.
 *
 * Usage:
 *     RUST_API_URL=http://localhost:8080 npx tsx scripts/gen-rust-client.ts
 *
 * Prereqs (orchestrator installs these — do not run from this script):
 *     npm i -D openapi-typescript
 *
 * Once the generated file exists, hand-written types in
 * `src/lib/rust-client/types.ts` should be deleted in favor of the generated
 * `paths` / `components` types. Do that in a follow-up PR — keeping both
 * during Phase 0 lets us flip cutover one endpoint at a time.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const RUST_API_URL = process.env.RUST_API_URL || 'http://localhost:8080';
const SPEC_URL = `${RUST_API_URL}/openapi.json`;
const OUTPUT_PATH = 'src/lib/rust-client/generated.ts';
const SPEC_TMP_PATH = '.tmp/rust-openapi.json';

async function main(): Promise<void> {
    console.log(`[gen-rust-client] fetching ${SPEC_URL}`);
    const res = await fetch(SPEC_URL);
    if (!res.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
    }
    const spec = await res.text();

    mkdirSync(dirname(SPEC_TMP_PATH), { recursive: true });
    writeFileSync(SPEC_TMP_PATH, spec, 'utf8');
    console.log(`[gen-rust-client] wrote spec to ${SPEC_TMP_PATH} (${spec.length} bytes)`);

    console.log(`[gen-rust-client] running openapi-typescript -> ${OUTPUT_PATH}`);
    execSync(`npx openapi-typescript ${SPEC_TMP_PATH} -o ${OUTPUT_PATH}`, {
        stdio: 'inherit',
    });

    console.log('[gen-rust-client] done');
}

main().catch((err) => {
    console.error('[gen-rust-client] failed:', err);
    process.exit(1);
});
