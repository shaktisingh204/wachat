#!/usr/bin/env node
/**
 * Build SabSites (the vendored Webstudio builder) and stage its client
 * assets for the SabNode app.
 *
 *   node scripts/build-sabsites.mjs            # full build (packages + app)
 *   node scripts/build-sabsites.mjs --app-only # rebuild the app only
 *
 * Requires Node 22 (the webstudio workspace pins engines.node=22) and pnpm
 * via corepack. The server build stays in vendor/ (loaded at runtime by
 * src/app/sites/[[...path]]/route.ts); the client build is copied into
 * public/sites/ so Next serves /sites/assets/* statically.
 */
import { execSync } from 'node:child_process';
import { cpSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const webstudio = path.join(root, 'vendor/webstudio');
const clientBuild = path.join(webstudio, 'apps/builder/build/client');
const publicSites = path.join(root, 'public/sites');

const run = (command, cwd) => {
    console.log(`$ ${command}`);
    execSync(command, { cwd, stdio: 'inherit' });
};

const appOnly = process.argv.includes('--app-only');

if (!appOnly) {
    run("corepack pnpm -r --filter='./packages/**' build", webstudio);
}
run('corepack pnpm --filter=@webstudio-is/builder build', webstudio);

if (!existsSync(clientBuild)) {
    console.error(`Client build missing at ${clientBuild}`);
    process.exit(1);
}

rmSync(publicSites, { recursive: true, force: true });
cpSync(clientBuild, publicSites, { recursive: true });
console.log(`Copied client assets -> ${path.relative(root, publicSites)}`);
