#!/usr/bin/env node
/**
 * template-init.mjs — standalone fallback for the SabFlow template-authoring CLI.
 *
 * Mirror of `packages/sabnode-template-cli/src/cli.ts`, written in plain Node
 * stdlib so contributors can scaffold a template without `npm install` or any
 * TypeScript transpile.
 *
 * Usage:
 *   node scripts/sabflow/template-init.mjs <name> [--dir <output-dir>] [--force]
 *
 * Examples:
 *   node scripts/sabflow/template-init.mjs lead-to-whatsapp-welcome
 *   node scripts/sabflow/template-init.mjs payment-receipt --dir templates-incoming
 *
 * Output (under `<output-dir>/<name>/`, default `templates-incoming/<name>/`):
 *   - template.json       — id / displayName / description / category / requiredCredentials / screenshots
 *   - flow.json           — the flow definition (nodes + edges + variables + trigger)
 *   - README.md           — user-facing description and authoring checklist
 *   - verification.json   — declarative test input the CI verifier consumes
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import process from 'node:process';

const VALID_CATEGORIES = [
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
];

const USAGE = `Usage: node scripts/sabflow/template-init.mjs <name> [--dir <output-dir>] [--force] [--category <cat>]

Arguments:
  <name>             URL-safe template id (kebab-case). Required.

Options:
  --dir <path>       Output directory (default: templates-incoming).
  --category <cat>   One of: ${VALID_CATEGORIES.join(', ')}. Default: ops.
  --force            Overwrite existing files in the target directory.
  -h, --help         Show this help.
`;

function parseArgs(argv) {
  const out = { name: '', dir: 'templates-incoming', category: 'ops', force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      return { help: true };
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
      return { error: `Unknown argument: ${a}` };
    }
  }
  return out;
}

function validateName(name) {
  if (!name) return 'Template name is required.';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    return 'Template name must be kebab-case (lowercase letters, digits, dashes; must start with a letter or digit).';
  }
  if (name.length > 64) return 'Template name is too long (max 64 chars).';
  return null;
}

function toTitleCase(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function buildTemplateJson(name, displayName, category) {
  return {
    id: name,
    displayName,
    description: `TODO — short marketing-style description of "${displayName}". 1–3 sentences.`,
    category,
    requiredCredentials: [
      // Example: { type: 'forge_slack', label: 'Slack workspace' }
    ],
    screenshots: [
      // Example: { url: '/screenshots/your-template-1.png', alt: 'Canvas overview' }
    ],
    tags: [],
    version: '0.1.0',
    author: 'TODO',
  };
}

function buildFlowJson(name) {
  // Minimal but valid SabFlow shape: one trigger, one block, single edge.
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

function buildVerificationJson(name) {
  return {
    schemaVersion: 1,
    /** Identifier the verifier uses to match this template. */
    templateId: name,
    /** Declarative inputs the CI verifier injects into the trigger. */
    cases: [
      {
        id: 'happy-path',
        description: 'Default trigger payload — should run to completion.',
        triggerPayload: {
          input: 'hello world',
        },
        expect: {
          /** Status the run must finish with. */
          finalStatus: 'success',
          /** Blocks expected to execute; order-insensitive. */
          executedBlocks: [`b_${name.replace(/-/g, '_')}_step1`],
          /** Optional assertions on the final variable bag. */
          variables: {},
        },
      },
    ],
  };
}

function buildReadme(name, displayName, category) {
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

async function writeIfFree(path, content, force) {
  if (!force && (await exists(path))) {
    throw new Error(`Refusing to overwrite existing file: ${path} (re-run with --force to overwrite)`);
  }
  await writeFile(path, content);
}

async function scaffoldTemplate({ name, dir, category, force, cwd = process.cwd() }) {
  const nameErr = validateName(name);
  if (nameErr) throw new Error(nameErr);
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(
      `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}.`,
    );
  }

  const baseDir = isAbsolute(dir) ? dir : resolve(cwd, dir);
  const outDir = resolve(baseDir, name);
  await mkdir(outDir, { recursive: true });

  const displayName = toTitleCase(name);
  const templateJson = buildTemplateJson(name, displayName, category);
  const flowJson = buildFlowJson(name);
  const verificationJson = buildVerificationJson(name);
  const readme = buildReadme(name, displayName, category);

  const written = [];
  const pairs = [
    ['template.json', JSON.stringify(templateJson, null, 2) + '\n'],
    ['flow.json', JSON.stringify(flowJson, null, 2) + '\n'],
    ['verification.json', JSON.stringify(verificationJson, null, 2) + '\n'],
    ['README.md', readme],
  ];
  for (const [file, content] of pairs) {
    const path = join(outDir, file);
    await writeIfFree(path, content, force);
    written.push(path);
  }
  return { outDir, written };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (args.error) {
    process.stderr.write(args.error + '\n\n' + USAGE);
    process.exit(2);
  }
  try {
    const { outDir, written } = await scaffoldTemplate(args);
    process.stdout.write(
      `\nScaffolded SabFlow template at:\n  ${outDir}\n\nFiles:\n${written.map((p) => '  - ' + p).join('\n')}\n\n` +
        `Next steps:\n` +
        `  1. Edit template.json and fill in description / requiredCredentials.\n` +
        `  2. Replace the placeholder block in flow.json with your real flow.\n` +
        `  3. Add at least one realistic case to verification.json.\n` +
        `  4. Open a PR — CI will run the template verifier.\n`,
    );
  } catch (err) {
    process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

// Allow this file to be imported by the CLI package as well as run directly.
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('template-init.mjs');

if (isDirectRun) {
  main();
}

export {
  scaffoldTemplate,
  parseArgs,
  validateName,
  toTitleCase,
  VALID_CATEGORIES,
  buildTemplateJson,
  buildFlowJson,
  buildVerificationJson,
  buildReadme,
  USAGE,
};
