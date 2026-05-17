/**
 * Master codegen entry point.
 *
 *   pnpm api:gen           — regenerate everything
 *   pnpm api:gen --check   — fail if anything would change (CI drift check)
 *
 * Always runs the linter first so a broken manifest can't produce broken
 * generated code.
 */

import { lintManifest } from './lint';
import { generateRoutes } from './generate-routes';
import { generateOpenApiPaths } from './generate-openapi-paths';
import { generateScopes } from './generate-scopes';
import { generateTsSdk } from './generate-ts-sdk';
import { generateDocs } from './generate-docs';

interface Result {
  written: string[];
  unchanged: string[];
}

function main(): void {
  const checkMode = process.argv.includes('--check');

  /* 1. Lint */
  const lintResult = lintManifest();
  if (!lintResult.ok) {
    console.error(`✗ Manifest lint failed (${lintResult.issues.length} issue(s)):`);
    for (const i of lintResult.issues) console.error(`  - [${i.spec}] ${i.message}`);
    process.exit(1);
  }

  /* 2. Generate */
  const result: Result = { written: [], unchanged: [] };

  const routes = generateRoutes();
  result.written.push(...routes.written);
  result.unchanged.push(...routes.unchanged);

  const oapi = generateOpenApiPaths();
  if (oapi.wrote) result.written.push(oapi.relPath);
  else result.unchanged.push(oapi.relPath);

  const scopes = generateScopes();
  if (scopes.wrote) result.written.push(scopes.relPath);
  else result.unchanged.push(scopes.relPath);

  const sdk = generateTsSdk();
  if (sdk.wrote) result.written.push(sdk.relPath);
  else result.unchanged.push(sdk.relPath);

  const docs = generateDocs();
  if (docs.wrote) result.written.push(...docs.relPaths);

  /* 3. Report */
  console.log(`✓ Lint OK (${lintResult.issues.length === 0 ? 0 : lintResult.issues.length} issues)`);
  if (result.written.length === 0) {
    console.log(`✓ Generated artifacts already up-to-date (${result.unchanged.length} files).`);
  } else {
    console.log(`✓ Wrote ${result.written.length} file(s):`);
    for (const f of result.written) console.log(`    ${f}`);
    if (result.unchanged.length) {
      console.log(`  (${result.unchanged.length} unchanged)`);
    }
  }

  if (checkMode && result.written.length > 0) {
    console.error(
      '\n✗ --check failed: generated artifacts are out of date. ' +
        'Run `pnpm api:gen` locally and commit the result.',
    );
    process.exit(1);
  }
}

main();
