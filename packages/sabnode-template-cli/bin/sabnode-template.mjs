#!/usr/bin/env node
/**
 * sabnode-template — executable shim.
 *
 * The canonical source is `src/cli.ts`.  This file is a thin runtime wrapper
 * that the published package ships so `npx sabnode-template` works without a
 * build step.  It implements the same surface as `src/cli.ts` but in plain
 * `.mjs` form so we don't need to ship a transpile pipeline in the package.
 *
 * If you change scaffold logic, change `src/cli.ts` *and* this file (they are
 * intentionally kept in lockstep), or simply re-export from
 * `../src/cli.ts` once consumers have a tsx loader available.
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

const USAGE = `sabnode-template — scaffold a new SabFlow template package.

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

function parseArgs(argv) {
  const out = { name: '', dir: 'templates-incoming', category: 'ops', force: false };
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
    requiredCredentials: [],
    screenshots: [],
    tags: [],
    version: '0.1.0',
    author: 'TODO',
  };
}

function buildFlowJson(name) {
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
    variables: [{ id: 'v_input', name: 'input', defaultValue: '' }],
    events: [],
    settings: {},
  };
}

function buildVerificationJson(name) {
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
    throw new Error(
      `Refusing to overwrite existing file: ${path} (re-run with --force to overwrite)`,
    );
  }
  await writeFile(path, content);
}

async function scaffoldTemplate({ name, dir, category, force = false, cwd = process.cwd() }) {
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
  const pairs = [
    ['template.json', JSON.stringify(buildTemplateJson(name, displayName, category), null, 2) + '\n'],
    ['flow.json', JSON.stringify(buildFlowJson(name), null, 2) + '\n'],
    ['verification.json', JSON.stringify(buildVerificationJson(name), null, 2) + '\n'],
    ['README.md', buildReadme(name, displayName, category)],
  ];

  const written = [];
  for (const [file, content] of pairs) {
    const path = join(outDir, file);
    await writeIfFree(path, content, force);
    written.push(path);
  }
  return { outDir, written };
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.help || argv.length === 0) {
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
      `\nScaffolded SabFlow template at:\n  ${outDir}\n\nFiles:\n${written.map((p) => '  - ' + p).join('\n')}\n\n` +
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

main().then((code) => process.exit(code));
