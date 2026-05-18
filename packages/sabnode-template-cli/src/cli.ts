/**
 * sabnode-template — CLI entry point.
 *
 * Usage:
 *   npx sabnode-template init <name> [--dir <output-dir>] [--category <cat>] [--force]
 *
 * This file is the canonical TypeScript source.  The executable shim lives
 * at `bin/sabnode-template.mjs` and re-uses the shared scaffolder in
 * `scripts/sabflow/template-init.mjs` (loaded via the repo's `templates/scaffold/`
 * registry) so that contributors who don't `npm install` still get an identical
 * code path.
 *
 * The CLI is intentionally dependency-free: it uses only Node stdlib so it can
 * be published with no transitive surface area, and run with `npx` without
 * pulling in the rest of the SabNode workspace.
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// ── Constants ────────────────────────────────────────────────────────────────

export const VALID_CATEGORIES = [
  'sales',
  'marketing',
  'support',
  'ops',
  'finance',
  'crm',
  'whatsapp',
  'ecommerce',
  'ads',
  'onboarding',
] as const;

export type Category = (typeof VALID_CATEGORIES)[number];

export const USAGE = `sabnode-template — scaffold a new SabFlow template package.

Usage:
  npx sabnode-template init <name> [--dir <output-dir>] [--category <cat>] [--force]

Arguments:
  <name>             URL-safe template id (kebab-case). Required.

Options:
  --dir <path>       Output directory (default: templates-incoming).
  --category <cat>   One of: ${VALID_CATEGORIES.join(', ')}. Default: ops.
  --force            Overwrite existing files in the target directory.
  -h, --help         Show this help.

Examples:
  npx sabnode-template init lead-to-whatsapp-welcome
  npx sabnode-template init payment-receipt --category finance
  npx sabnode-template init my-template --dir ./drafts --force
`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CliArgs {
  command?: 'init';
  name: string;
  dir: string;
  category: Category | string;
  force: boolean;
  help?: boolean;
  error?: string;
}

export interface ScaffoldOptions {
  name: string;
  dir: string;
  category: Category | string;
  force?: boolean;
  cwd?: string;
}

export interface ScaffoldResult {
  outDir: string;
  written: string[];
}

// ── Arg parsing ──────────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    name: '',
    dir: 'templates-incoming',
    category: 'ops',
    force: false,
  };
  // Optional leading subcommand (we only support "init" today).
  let i = 0;
  if (argv[0] === 'init') {
    out.command = 'init';
    i = 1;
  }
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      out.help = true;
    } else if (a === '--force') {
      out.force = true;
    } else if (a === '--dir') {
      out.dir = argv[++i] ?? '';
    } else if (a === '--category') {
      out.category = argv[++i] ?? '';
    } else if (a.startsWith('--dir=')) {
      out.dir = a.slice('--dir='.length);
    } else if (a.startsWith('--category=')) {
      out.category = a.slice('--category='.length);
    } else if (!out.name && !a.startsWith('-')) {
      out.name = a;
    } else {
      out.error = `Unknown argument: ${a}`;
      return out;
    }
  }
  return out;
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateName(name: string): string | null {
  if (!name) return 'Template name is required.';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    return 'Template name must be kebab-case (lowercase letters, digits, dashes; must start with a letter or digit).';
  }
  if (name.length > 64) return 'Template name is too long (max 64 chars).';
  return null;
}

export function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ── Scaffold payloads ────────────────────────────────────────────────────────

export function buildTemplateJson(name: string, displayName: string, category: string) {
  return {
    id: name,
    displayName,
    description: `TODO — short marketing-style description of "${displayName}". 1–3 sentences.`,
    category,
    requiredCredentials: [] as Array<{ type: string; label: string }>,
    screenshots: [] as Array<{ url: string; alt: string }>,
    tags: [] as string[],
    version: '0.1.0',
    author: 'TODO',
  };
}

export function buildFlowJson(name: string) {
  const triggerId = `t_${name.replace(/-/g, '_')}_start`;
  const blockId = `b_${name.replace(/-/g, '_')}_step1`;
  const groupId = `g_${name.replace(/-/g, '_')}_main`;
  return {
    schemaVersion: 1,
    trigger: {
      id: triggerId,
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'template.start',
      options: {
        path: `/webhooks/${name}`,
        method: 'POST',
        authentication: 'header',
        authHeaderName: 'X-Webhook-Secret',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    groups: [
      {
        id: groupId,
        title: 'Main',
        graphCoordinates: { x: 320, y: 0 },
        blockIds: [blockId],
      },
    ],
    blocks: [
      {
        id: blockId,
        groupId,
        type: 'set_variable',
        options: {
          name: 'placeholder',
          value: 'TODO — replace with real block(s)',
        },
      },
    ],
    edges: [
      {
        id: `e_${triggerId}__${blockId}`,
        from: { eventId: triggerId },
        to: { blockId },
      },
    ],
    variables: [
      { id: 'v_input', name: 'input', defaultValue: '' },
    ],
    events: [],
    settings: {},
  };
}

export function buildVerificationJson(name: string) {
  return {
    schemaVersion: 1,
    templateId: name,
    cases: [
      {
        id: 'happy-path',
        description: 'Default trigger payload — should run to completion.',
        triggerPayload: { input: 'hello world' },
        expect: {
          finalStatus: 'success',
          executedBlocks: [`b_${name.replace(/-/g, '_')}_step1`],
          variables: {},
        },
      },
    ],
  };
}

export function buildReadme(name: string, displayName: string, category: string): string {
  return `# ${displayName}

> SabFlow template — \`${name}\` (category: \`${category}\`)

## Description

TODO — describe what this template does, who it's for, and what credentials are needed.

## What's in this package

- \`template.json\` — listing metadata (id, displayName, description, category, requiredCredentials, screenshots).
- \`flow.json\` — the actual flow definition (trigger + nodes + edges + variables).
- \`verification.json\` — declarative test input the CI verifier consumes.
- \`README.md\` — this file.

## Authoring checklist

- [ ] Fill in \`template.json\` → \`description\`, \`requiredCredentials\`, \`screenshots\`, \`tags\`, \`author\`.
- [ ] Replace the placeholder block(s) in \`flow.json\` with the real flow.
- [ ] Add at least one realistic test case to \`verification.json\`.
- [ ] Run the local verifier (\`npm run sabflow:verify-template -- ${name}\`) before opening a PR.

## How to author

1. Build the flow visually inside SabFlow.
2. Export the flow JSON from the canvas (Settings → Export).
3. Paste it into \`flow.json\` here.
4. Add screenshots under \`public/templates/${name}/\` and reference them in \`template.json\`.
5. Open a PR — the CI template verifier runs against \`verification.json\`.
`;
}

// ── Scaffold ─────────────────────────────────────────────────────────────────

async function writeIfFree(path: string, content: string, force: boolean): Promise<void> {
  if (!force && (await exists(path))) {
    throw new Error(
      `Refusing to overwrite existing file: ${path} (re-run with --force to overwrite)`,
    );
  }
  await writeFile(path, content);
}

export async function scaffoldTemplate(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const { name, dir, category, force = false, cwd = process.cwd() } = opts;
  const nameErr = validateName(name);
  if (nameErr) throw new Error(nameErr);
  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(
      `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}.`,
    );
  }

  const baseDir = isAbsolute(dir) ? dir : resolve(cwd, dir);
  const outDir = resolve(baseDir, name);
  await mkdir(outDir, { recursive: true });

  const displayName = toTitleCase(name);
  const pairs: [string, string][] = [
    ['template.json', JSON.stringify(buildTemplateJson(name, displayName, category), null, 2) + '\n'],
    ['flow.json', JSON.stringify(buildFlowJson(name), null, 2) + '\n'],
    ['verification.json', JSON.stringify(buildVerificationJson(name), null, 2) + '\n'],
    ['README.md', buildReadme(name, displayName, category)],
  ];

  const written: string[] = [];
  for (const [file, content] of pairs) {
    const path = join(outDir, file);
    await writeIfFree(path, content, force);
    written.push(path);
  }
  return { outDir, written };
}

// ── main() ───────────────────────────────────────────────────────────────────

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(rawArgv);

  if (args.help || rawArgv.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (args.error) {
    process.stderr.write(args.error + '\n\n' + USAGE);
    return 2;
  }
  if (args.command && args.command !== 'init') {
    process.stderr.write(`Unknown command: ${args.command}\n\n` + USAGE);
    return 2;
  }

  try {
    const { outDir, written } = await scaffoldTemplate(args);
    process.stdout.write(
      `\nScaffolded SabFlow template at:\n  ${outDir}\n\nFiles:\n${written
        .map((p) => '  - ' + p)
        .join('\n')}\n\n` +
        `Next steps:\n` +
        `  1. Edit template.json and fill in description / requiredCredentials.\n` +
        `  2. Replace the placeholder block in flow.json with your real flow.\n` +
        `  3. Add at least one realistic case to verification.json.\n` +
        `  4. Open a PR — CI will run the template verifier.\n`,
    );
    return 0;
  } catch (err) {
    process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

// Allow direct execution via `tsx src/cli.ts`.
const __filename =
  typeof import.meta !== 'undefined' && import.meta.url
    ? fileURLToPath(import.meta.url)
    : '';
const __dirname = __filename ? dirname(__filename) : '';
void __dirname; // silence "unused" if downstream uses are stripped

const isDirectRun = __filename && process.argv[1] === __filename;
if (isDirectRun) {
  main().then((code) => process.exit(code));
}
