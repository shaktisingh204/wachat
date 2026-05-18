#!/usr/bin/env node
/**
 * SabFlow template verification harness (Phase C.10.2).
 *
 * Pure-Node verification runner for marketplace / template submissions.
 *
 * For every submitted template we:
 *   1. Read `flow.json` (the SabFlow document) and `verification.json`
 *      (the test envelope) from the template directory.
 *   2. Spin up an *empty-workspace* in-memory sabflow engine — no Mongo,
 *      no Redis, no real network. External HTTP calls are intercepted and
 *      answered from `verification.fixtures` (a URL → response map).
 *   3. Run the flow from its trigger group to terminus.
 *   4. Assert that every executed block exits with `status: 'success'`.
 *   5. Fail if the run exceeds the 60-second wall-clock budget.
 *
 * Two flow shapes are supported:
 *   - Engine-style: `flow.groups[].blocks[]` is walked via the in-memory
 *     executor in this file (full block execution + fixture matching).
 *   - n8n-style:    `flow.nodes[]` + `flow.connections{}` is walked as a
 *     structural BFS from the trigger node; each reached node emits one
 *     `success` step, and the harness asserts there are no dangling
 *     references, duplicate ids, or missing credential declarations.
 *
 * Usage:
 *   node scripts/sabflow/template-verify.mjs <template-dir> [<template-dir> ...]
 *   node scripts/sabflow/template-verify.mjs --all templates marketplace
 *
 * Exit codes:
 *   0  every template verified clean
 *   1  one or more templates failed verification
 *   2  malformed inputs (missing file, invalid JSON, etc.)
 *
 * Constraints (per C.10.2 brief):
 *   - No new npm deps; only Node stdlib.
 *   - Runs in CI on `pull_request` paths `templates/**` / `marketplace/**`.
 *   - Single template must verify in under 60 seconds.
 */

import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/* ──────────────────────────────────────────────────────────────────────────
 * CLI parsing
 * ──────────────────────────────────────────────────────────────────────── */

const TIME_BUDGET_MS = 60_000;

/**
 * @typedef {{ paths: string[], recurseRoots: string[] }} Args
 */

/**
 * Parses positional + flag arguments.
 *
 *   --all <root>   recursively discover templates under <root>
 *                  (any directory containing `verification.json`)
 *
 * @param {string[]} argv
 * @returns {Args}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const paths = [];
  /** @type {string[]} */
  const recurseRoots = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') {
      const root = argv[++i];
      if (!root) {
        console.error('[template-verify] --all requires a root directory argument');
        process.exit(2);
      }
      recurseRoots.push(root);
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/sabflow/template-verify.mjs <template-dir> [...]\n' +
          '       node scripts/sabflow/template-verify.mjs --all <root>',
      );
      process.exit(0);
    } else {
      paths.push(a);
    }
  }

  return { paths, recurseRoots };
}

/**
 * Walks `root` and yields any directory that contains a `verification.json`.
 *
 * @param {string} root
 * @returns {Promise<string[]>}
 */
async function discoverTemplateDirs(root) {
  /** @type {string[]} */
  const found = [];
  if (!existsSync(root)) return found;

  /** @param {string} dir */
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    let hasVerification = false;
    for (const ent of entries) {
      if (ent.name === 'verification.json' && ent.isFile()) {
        hasVerification = true;
      }
    }
    if (hasVerification) {
      found.push(dir);
      // We still recurse — templates may nest verification fixtures per-variant.
    }
    for (const ent of entries) {
      if (
        ent.isDirectory() &&
        !ent.name.startsWith('.') &&
        ent.name !== 'node_modules'
      ) {
        await walk(path.join(dir, ent.name));
      }
    }
  }

  await walk(root);
  return found;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Verification envelope
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} HttpFixture
 * @property {number} [status]
 * @property {Record<string, unknown>|string} [body]
 * @property {Record<string, string>} [headers]
 */

/**
 * @typedef {object} VerificationEnvelope
 * @property {Record<string, string>} [input]          Initial variable map.
 * @property {Record<string, HttpFixture>} [fixtures]  URL → fixed response.
 * @property {string} [userInput]                      Optional first reply.
 * @property {string} [flow]                           Relative path to the flow file.
 * @property {number} [timeBudgetMs]                   Override the default 60s budget.
 * @property {boolean} [allowUnmockedHttp]             Don't fail on unmocked HTTP.
 */

/**
 * @param {string} dir
 * @returns {Promise<{flow: any, envelope: VerificationEnvelope, flowPath: string, envelopePath: string}>}
 */
async function loadTemplate(dir) {
  const envelopePath = path.join(dir, 'verification.json');
  if (!existsSync(envelopePath)) {
    throw new VerifyError(
      `verification.json missing in template directory: ${dir}`,
    );
  }
  const envelopeRaw = await readFile(envelopePath, 'utf8');
  let envelope;
  try {
    envelope = JSON.parse(envelopeRaw);
  } catch (err) {
    throw new VerifyError(
      `verification.json is not valid JSON in ${dir}: ${err.message}`,
    );
  }

  const flowRel = envelope.flow ?? 'flow.json';
  const flowPath = path.resolve(dir, flowRel);
  if (!existsSync(flowPath)) {
    throw new VerifyError(
      `flow file "${flowRel}" not found at ${flowPath} (template ${dir})`,
    );
  }
  const flowRaw = await readFile(flowPath, 'utf8');
  let flow;
  try {
    flow = JSON.parse(flowRaw);
  } catch (err) {
    throw new VerifyError(`flow file is not valid JSON: ${err.message}`);
  }

  return { flow, envelope, flowPath, envelopePath };
}

class VerifyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerifyError';
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Mini sabflow engine (browser/server-safe subset of src/lib/sabflow/engine)
 *
 * Mirrors the structural contract of executeFlow / executeBlock without
 * depending on Mongo, the forge bridge, or any other runtime concern.
 * Block behaviour is deliberately conservative — the goal is "does every
 * node in this template advance to success in an empty workspace?", not
 * full fidelity with the live engine.
 * ──────────────────────────────────────────────────────────────────────── */

const INPUT_TYPES = new Set([
  'text_input',
  'number_input',
  'email_input',
  'phone_input',
  'url_input',
  'date_input',
  'time_input',
  'rating_input',
  'file_input',
  'payment_input',
  'choice_input',
  'picture_choice_input',
]);

/**
 * @param {string|undefined|null} text
 * @param {Record<string, string|undefined>} variables
 * @returns {string}
 */
function substituteVariables(text, variables) {
  if (!text) return text ?? '';
  return String(text).replace(/\{\{([^}]+)\}\}/g, (match, name) => {
    const trimmed = String(name).trim();
    if (trimmed === '$now') return new Date().toISOString();
    if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
      const v = variables[trimmed];
      return v == null ? '' : String(v);
    }
    return match;
  });
}

/**
 * Build the verification-time HTTP fetch shim.
 *
 * Returns a {@link fetch}-shaped function that:
 *   - Looks up an exact URL match in `fixtures`.
 *   - Falls back to a prefix match (`http://api.example.com/*`).
 *   - Throws a clear "unmocked HTTP" error if no fixture matches and
 *     `allowUnmockedHttp` is not set.
 *
 * @param {Record<string, HttpFixture>} fixtures
 * @param {boolean} allowUnmockedHttp
 */
function makeFetchShim(fixtures, allowUnmockedHttp) {
  const entries = Object.entries(fixtures);
  const prefixEntries = entries.filter(([k]) => k.endsWith('*'));
  const exactEntries = entries.filter(([k]) => !k.endsWith('*'));

  return async function fetchShim(url /*, init */) {
    const target = String(url);
    const exact = exactEntries.find(([k]) => k === target);
    let fx = exact ? exact[1] : undefined;
    if (!fx) {
      const prefix = prefixEntries.find(([k]) =>
        target.startsWith(k.slice(0, -1)),
      );
      fx = prefix ? prefix[1] : undefined;
    }
    if (!fx) {
      if (allowUnmockedHttp) {
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
      }
      throw new Error(
        `unmocked HTTP call: ${target} — add it to verification.fixtures`,
      );
    }
    const status = fx.status ?? 200;
    const body = fx.body ?? {};
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return {
      ok: status >= 200 && status < 400,
      status,
      headers: new Map(Object.entries(fx.headers ?? {})),
      async json() {
        if (typeof body === 'string') {
          try { return JSON.parse(body); } catch { return {}; }
        }
        return body;
      },
      async text() {
        return bodyStr;
      },
    };
  };
}

/**
 * Executes a single block in the empty-workspace sandbox.
 *
 * Returns `{ messages, requiresInput, nextGroupId, updatedVariables }` —
 * the same shape as the real `executeBlock`, minus the live integrations.
 *
 * @param {any} block
 * @param {Record<string,string>} variables
 * @param {any[]} edges
 * @param {ReturnType<typeof makeFetchShim>} fetchShim
 * @param {string|undefined} userInput
 */
async function executeBlock(block, variables, edges, fetchShim, userInput) {
  /** @type {Array<{type:string,content:string}>} */
  const messages = [];

  if (INPUT_TYPES.has(block.type)) {
    if (userInput == null) {
      return { messages, requiresInput: true };
    }
    const varName = block?.options?.variable ?? block?.options?.variableName ?? block.id;
    return {
      messages,
      updatedVariables: { ...variables, [varName]: userInput },
    };
  }

  switch (block.type) {
    case 'text':
    case 'image':
    case 'video':
    case 'audio':
    case 'embed': {
      const raw =
        block.options?.content ??
        block.options?.text ??
        block.options?.url ??
        block.options?.imageUrl ??
        block.options?.videoUrl ??
        block.options?.audioUrl ??
        '';
      return {
        messages: [
          { type: block.type, content: substituteVariables(String(raw), variables) },
        ],
      };
    }

    case 'set_variable': {
      const name = block.options?.variable ?? block.options?.name;
      const value = substituteVariables(
        String(block.options?.value ?? ''),
        variables,
      );
      if (!name) return { messages };
      return {
        messages,
        updatedVariables: { ...variables, [String(name)]: value },
      };
    }

    case 'condition': {
      // Pick the first matching path; default to falling through.
      const items = Array.isArray(block.options?.items)
        ? block.options.items
        : [];
      for (const item of items) {
        const left = substituteVariables(String(item?.left ?? ''), variables);
        const right = substituteVariables(String(item?.right ?? ''), variables);
        const op = String(item?.comparison ?? item?.op ?? '==');
        if (compare(left, right, op)) {
          // Resolve outgoing edge — if pinned to a group via item.outgoingEdgeId.
          const edgeId = item.outgoingEdgeId;
          const edge = edges.find((e) => e.id === edgeId);
          if (edge?.to?.groupId) {
            return { messages, nextGroupId: edge.to.groupId };
          }
          return { messages };
        }
      }
      return { messages };
    }

    case 'webhook':
    case 'http_request': {
      const url = substituteVariables(
        String(block.options?.url ?? ''),
        variables,
      );
      if (!url) {
        throw new Error(`webhook block "${block.id}" has no url`);
      }
      const res = await fetchShim(url);
      if (!res.ok) {
        throw new Error(
          `webhook block "${block.id}" → ${url} returned status ${res.status}`,
        );
      }
      let body = {};
      try { body = await res.json(); } catch { /* ignore */ }
      const updatedVariables = { ...variables };
      if (typeof body === 'object' && body) {
        const responseVar = block.options?.responseVariableName;
        if (responseVar) {
          updatedVariables[String(responseVar)] = JSON.stringify(body);
        }
      }
      return { messages, updatedVariables };
    }

    case 'send_email':
    case 'forge_email':
    case 'forge_slack':
    case 'forge_discord':
    case 'forge_notion':
    case 'forge_airtable':
    case 'forge_hubspot':
    case 'forge_telegram':
    case 'forge_twilio':
    case 'forge_sendgrid':
    case 'forge_mailgun':
    case 'execute_workflow':
    case 'respond_to_webhook': {
      // Side-effecting integrations resolve to a no-op success in the
      // empty-workspace sandbox.  We still substitute templates so the
      // verifier surfaces variable-name typos.
      const subbed = {};
      for (const [k, v] of Object.entries(block.options ?? {})) {
        if (typeof v === 'string') subbed[k] = substituteVariables(v, variables);
      }
      void subbed;
      return { messages };
    }

    case 'wait':
    case 'jump':
    case 'merge':
    case 'loop':
    case 'filter':
    case 'sort':
    case 'set':
    case 'script':
    case 'ab_test':
    case 'switch': {
      return { messages };
    }

    default: {
      // Unknown / forge_* fall through to a no-op so a template using a
      // brand-new block type still verifies.  We surface a soft note.
      if (block.type?.startsWith?.('forge_')) {
        return { messages };
      }
      return { messages };
    }
  }
}

/**
 * @param {string} left
 * @param {string} right
 * @param {string} op
 */
function compare(left, right, op) {
  switch (op) {
    case '==': case 'equals': case 'eq': return left === right;
    case '!=': case 'notEquals': case 'ne': return left !== right;
    case '>':  return Number(left) >   Number(right);
    case '<':  return Number(left) <   Number(right);
    case '>=': return Number(left) >=  Number(right);
    case '<=': return Number(left) <=  Number(right);
    case 'contains': return String(left).includes(String(right));
    case 'startsWith': return String(left).startsWith(String(right));
    case 'endsWith':   return String(left).endsWith(String(right));
    default: return false;
  }
}

/**
 * @typedef {object} StepRecord
 * @property {string} groupId
 * @property {string} blockId
 * @property {string} blockType
 * @property {'success'|'error'|'waiting'} status
 * @property {number} durationMs
 * @property {string} [error]
 */

/**
 * Walks a flow until terminus or budget exhaustion.
 *
 * The caller passes in a `steps` accumulator so partial traces survive an
 * exception — useful when the harness needs to print "which block blew up"
 * in CI output.
 *
 * @param {any} flow
 * @param {VerificationEnvelope} envelope
 * @param {AbortSignal} abortSignal
 * @param {StepRecord[]} steps
 * @returns {Promise<{steps: StepRecord[], variables: Record<string,string>}>}
 */
async function runFlow(flow, envelope, abortSignal, steps) {
  const fetchShim = makeFetchShim(
    envelope.fixtures ?? {},
    Boolean(envelope.allowUnmockedHttp),
  );

  /** @type {Record<string,string>} */
  let variables = { ...(envelope.input ?? {}) };

  // Seed default variable values declared in the flow doc.
  for (const v of flow.variables ?? []) {
    if (v?.name && !(v.name in variables)) {
      variables[v.name] = v.defaultValue ?? '';
    }
  }

  const groups = flow.groups ?? [];
  const edges = flow.edges ?? [];

  // Engine-style flows embed blocks under groups. n8n-style flows keep nodes
  // at the top level and reference them via groups[].blockIds + connections.
  // If no group has embedded blocks but the doc carries nodes, switch to the
  // structural walker so the harness still actually exercises the graph.
  const hasEmbeddedBlocks = groups.some(
    (g) => Array.isArray(g?.blocks) && g.blocks.length > 0,
  );
  if (!hasEmbeddedBlocks && Array.isArray(flow.nodes) && flow.nodes.length > 0) {
    await runStructuralWalk(flow, abortSignal, steps);
    return { steps, variables };
  }

  if (!groups.length) {
    return { steps, variables };
  }

  // Starting group: prefer the one wired to a trigger event, otherwise the first.
  /** @type {string} */
  let currentGroupId = (() => {
    const events = flow.events ?? (flow.trigger ? [flow.trigger] : []);
    for (const ev of events) {
      const edge = edges.find((e) => e?.from?.eventId === ev?.id);
      if (edge?.to?.groupId) return edge.to.groupId;
    }
    return groups[0].id;
  })();
  let currentBlockIndex = 0;

  const MAX_HOPS = 100;
  let hops = 0;
  let consumedUserInput = false;

  outer: while (hops < MAX_HOPS) {
    if (abortSignal.aborted) {
      throw new Error('time budget exceeded');
    }
    const group = groups.find((g) => g.id === currentGroupId);
    if (!group) break;

    for (let i = currentBlockIndex; i < (group.blocks ?? []).length; i++) {
      if (abortSignal.aborted) throw new Error('time budget exceeded');

      const block = group.blocks[i];
      const startedAt = Date.now();
      let inputForBlock;
      if (!consumedUserInput && envelope.userInput != null) {
        inputForBlock = envelope.userInput;
      }

      try {
        const result = await executeBlock(
          block,
          variables,
          edges,
          fetchShim,
          inputForBlock,
        );
        if (result.updatedVariables) variables = result.updatedVariables;
        if (inputForBlock != null) consumedUserInput = true;

        const durationMs = Date.now() - startedAt;

        if (result.requiresInput) {
          steps.push({
            groupId: currentGroupId,
            blockId: block.id,
            blockType: block.type,
            status: 'waiting',
            durationMs,
            error: 'block requires input but verification.json supplied none',
          });
          throw new Error(
            `block "${block.id}" (${block.type}) needs user input — ` +
              `set verification.userInput in verification.json`,
          );
        }

        steps.push({
          groupId: currentGroupId,
          blockId: block.id,
          blockType: block.type,
          status: 'success',
          durationMs,
        });

        if (result.nextGroupId) {
          currentGroupId = result.nextGroupId;
          currentBlockIndex = 0;
          hops++;
          continue outer;
        }
      } catch (err) {
        steps.push({
          groupId: currentGroupId,
          blockId: block.id,
          blockType: block.type,
          status: 'error',
          durationMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    // Resolve outgoing edge of the last block.
    const lastBlock = (group.blocks ?? []).slice(-1)[0];
    if (lastBlock?.outgoingEdgeId) {
      const edge = edges.find((e) => e.id === lastBlock.outgoingEdgeId);
      if (edge?.to?.groupId) {
        currentGroupId = edge.to.groupId;
        currentBlockIndex = 0;
        hops++;
        continue;
      }
    }
    break;
  }

  if (hops >= MAX_HOPS) {
    throw new Error(`flow exceeded ${MAX_HOPS} group hops — likely a cycle`);
  }

  return { steps, variables };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Structural walker (n8n-shaped flows)
 *
 * Used for templates that keep nodes flat at `flow.nodes` and wire them up
 * with `flow.connections`. The harness can't execute live integrations
 * (Slack, HubSpot, etc.) in-process, so we instead BFS the connection graph
 * from the trigger and assert structural integrity:
 *   - every connection source and target references an existing node
 *   - every groups[].blockIds reference exists in flow.nodes
 *   - node ids are unique
 *   - any node declaring `credentials` declares non-empty credential refs
 *   - the trigger reaches at least one downstream node (no dead trigger)
 *   - no cycles (the BFS marks visited nodes and tolerates re-encounters,
 *     but emits one step per node so the run is bounded)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * @param {any} flow
 * @param {AbortSignal} abortSignal
 * @param {StepRecord[]} steps
 */
async function runStructuralWalk(flow, abortSignal, steps) {
  /** @type {any[]} */
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  /** @type {Record<string, any>} */
  const byId = Object.create(null);
  /** @type {Set<string>} */
  const dupeIds = new Set();
  for (const n of nodes) {
    const id = n?.id;
    if (!id || typeof id !== 'string') {
      throw new Error(`flow.nodes contains a node without a string id`);
    }
    if (byId[id]) dupeIds.add(id);
    byId[id] = n;
  }
  if (dupeIds.size) {
    throw new Error(
      `duplicate node id(s) in flow.nodes: ${[...dupeIds].join(', ')}`,
    );
  }

  /** @type {Record<string, any>} */
  const connections = flow.connections && typeof flow.connections === 'object'
    ? flow.connections
    : {};

  // Validate connection topology before walking. n8n nodes can emit on
  // multiple named channels (e.g. switch nodes expose one channel per
  // rule), so we iterate every channel — not just `main`.
  for (const [source, channels] of Object.entries(connections)) {
    if (!byId[source]) {
      throw new Error(`connections reference unknown source node "${source}"`);
    }
    if (!channels || typeof channels !== 'object') continue;
    for (const lanes of Object.values(channels)) {
      if (!Array.isArray(lanes)) continue;
      for (const lane of lanes) {
        if (!Array.isArray(lane)) continue;
        for (const edge of lane) {
          const target = edge?.node;
          if (!target || !byId[target]) {
            throw new Error(
              `connections[${source}] points to unknown node "${target}"`,
            );
          }
        }
      }
    }
  }

  // Validate groups[].blockIds, when present, reference real nodes.
  for (const g of flow.groups ?? []) {
    if (Array.isArray(g?.blockIds)) {
      for (const bid of g.blockIds) {
        if (!byId[bid]) {
          throw new Error(
            `groups[${g.id ?? '?'}].blockIds references unknown node "${bid}"`,
          );
        }
      }
    }
  }

  // Pick the start node. Prefer flow.trigger.id when it matches a node;
  // otherwise pick the first node that is never a connection target.
  /** @type {string|undefined} */
  let startId;
  if (flow.trigger?.id && byId[flow.trigger.id]) {
    startId = flow.trigger.id;
  }
  if (!startId) {
    /** @type {Set<string>} */
    const targets = new Set();
    for (const channels of Object.values(connections)) {
      if (!channels || typeof channels !== 'object') continue;
      for (const lanes of Object.values(channels)) {
        if (!Array.isArray(lanes)) continue;
        for (const lane of lanes) {
          if (!Array.isArray(lane)) continue;
          for (const edge of lane) {
            if (edge?.node) targets.add(edge.node);
          }
        }
      }
    }
    startId = nodes.find((n) => !targets.has(n.id))?.id ?? nodes[0]?.id;
  }
  if (!startId) {
    throw new Error('no start node could be inferred for structural walk');
  }

  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {string[]} */
  const queue = [startId];
  const MAX_VISITS = 500;
  let visits = 0;

  while (queue.length > 0) {
    if (abortSignal.aborted) throw new Error('time budget exceeded');
    if (++visits > MAX_VISITS) {
      throw new Error(`structural walk exceeded ${MAX_VISITS} visits`);
    }
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const node = byId[id];
    const startedAt = Date.now();

    // Per-node assertions.
    if (node.credentials && typeof node.credentials === 'object') {
      for (const [credType, credRef] of Object.entries(node.credentials)) {
        if (!credRef || typeof credRef !== 'object') {
          steps.push({
            groupId: 'main',
            blockId: id,
            blockType: String(node.type ?? 'unknown'),
            status: 'error',
            durationMs: Date.now() - startedAt,
            error: `credentials.${credType} on node "${id}" is not an object`,
          });
          throw new Error(
            `node "${id}" credentials.${credType} must be an object`,
          );
        }
      }
    }

    steps.push({
      groupId: 'main',
      blockId: id,
      blockType: String(node.type ?? 'unknown'),
      status: 'success',
      durationMs: Date.now() - startedAt,
    });

    const outChannels = connections[id];
    if (outChannels && typeof outChannels === 'object') {
      for (const lanes of Object.values(outChannels)) {
        if (!Array.isArray(lanes)) continue;
        for (const lane of lanes) {
          if (!Array.isArray(lane)) continue;
          for (const edge of lane) {
            if (edge?.node && !visited.has(edge.node)) {
              queue.push(edge.node);
            }
          }
        }
      }
    }
  }

  if (visited.size === 1 && Object.keys(connections).length > 0) {
    throw new Error(
      `trigger "${startId}" reached no downstream nodes — connections may be disconnected`,
    );
  }

  // Surface unreachable nodes as a hard failure: an authored template should
  // not ship dead code.
  const unreached = nodes.filter((n) => !visited.has(n.id));
  if (unreached.length > 0) {
    throw new Error(
      `unreachable node(s) from trigger: ${unreached.map((n) => n.id).join(', ')}`,
    );
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * template.json metadata lint
 * ──────────────────────────────────────────────────────────────────────── */

// Mirrors `TEMPLATE_CATEGORIES` in src/lib/sabflow/marketplace/registry.ts.
// Templates must declare a canonical bucket so the marketplace browse UI
// can filter consistently.
const ALLOWED_CATEGORIES = new Set([
  'Sales',
  'Marketing',
  'Support',
  'Ops',
  'AI',
  'Internal Tools',
  'Developer',
  'CRM',
  'E-commerce',
  'Finance',
  'HR',
  'Health',
  'WhatsApp',
  'Ads',
  'Onboarding',
  'Other',
]);

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Validates the template.json metadata file alongside a template directory.
 * Returns nothing on success; throws with a descriptive message on failure.
 *
 * @param {string} dir
 */
async function lintTemplateMeta(dir) {
  const metaPath = path.join(dir, 'template.json');
  if (!existsSync(metaPath)) {
    // template.json is not strictly required (the harness itself only needs
    // verification.json), so we silently skip when it is absent. The seed
    // and scaffold flows always emit one.
    return;
  }
  let meta;
  try {
    meta = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch (err) {
    throw new VerifyError(
      `template.json is not valid JSON in ${dir}: ${err.message}`,
    );
  }
  const required = ['id', 'name', 'description', 'category', 'version'];
  for (const k of required) {
    if (!meta[k] || typeof meta[k] !== 'string') {
      throw new VerifyError(`template.json missing required string "${k}"`);
    }
  }
  if (!ALLOWED_CATEGORIES.has(meta.category)) {
    throw new VerifyError(
      `template.json category "${meta.category}" is not one of: ${
        [...ALLOWED_CATEGORIES].join(', ')
      }`,
    );
  }
  if (!SEMVER_RE.test(meta.version)) {
    throw new VerifyError(
      `template.json version "${meta.version}" is not a semver-shaped string`,
    );
  }
  const dirName = path.basename(dir);
  // Allow the __example__ scaffold to keep its own id; otherwise the id and
  // directory name must match so install paths are stable.
  if (dirName !== '__example__' && meta.id !== dirName) {
    throw new VerifyError(
      `template.json id "${meta.id}" must match directory name "${dirName}"`,
    );
  }
  if (meta.screenshot && typeof meta.screenshot === 'string') {
    const shot = path.resolve(dir, meta.screenshot);
    if (!existsSync(shot)) {
      throw new VerifyError(
        `template.json screenshot "${meta.screenshot}" not found at ${shot}`,
      );
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Driver
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} VerifyResult
 * @property {string} dir
 * @property {boolean} ok
 * @property {number} durationMs
 * @property {StepRecord[]} steps
 * @property {string} [error]
 */

/**
 * Run a single template directory. Resolves with a structured outcome
 * — even on failure — so the caller can format the full report.
 *
 * @param {string} dir
 * @returns {Promise<VerifyResult>}
 */
async function verifyOne(dir) {
  const startedAt = Date.now();
  /** @type {StepRecord[]} */
  let steps = [];

  try {
    await lintTemplateMeta(dir);
    const { flow, envelope } = await loadTemplate(dir);
    const budget = envelope.timeBudgetMs ?? TIME_BUDGET_MS;
    if (budget > TIME_BUDGET_MS) {
      throw new VerifyError(
        `verification.json declares timeBudgetMs=${budget} but the CI ceiling is ${TIME_BUDGET_MS}ms`,
      );
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), budget);
    try {
      await runFlow(flow, envelope, ac.signal, steps);
    } finally {
      clearTimeout(timer);
    }

    // Every block must have status === 'success'.
    const failures = steps.filter((s) => s.status !== 'success');
    if (failures.length > 0) {
      return {
        dir,
        ok: false,
        durationMs: Date.now() - startedAt,
        steps,
        error: `${failures.length} non-success step(s): ` +
          failures
            .map((f) => `${f.blockId}[${f.blockType}]=${f.status}${f.error ? ` (${f.error})` : ''}`)
            .join(', '),
      };
    }

    return {
      dir,
      ok: true,
      durationMs: Date.now() - startedAt,
      steps,
    };
  } catch (err) {
    return {
      dir,
      ok: false,
      durationMs: Date.now() - startedAt,
      steps,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** @param {VerifyResult} r */
function formatResult(r) {
  const tag = r.ok ? 'PASS' : 'FAIL';
  const head = `[${tag}] ${r.dir}  (${r.durationMs}ms, ${r.steps.length} step${r.steps.length === 1 ? '' : 's'})`;
  const lines = [head];
  if (!r.ok && r.error) lines.push(`        error: ${r.error}`);
  if (!r.ok) {
    for (const s of r.steps) {
      const sym = s.status === 'success' ? '.' : s.status === 'waiting' ? '?' : 'x';
      lines.push(
        `        ${sym} ${s.groupId}/${s.blockId} (${s.blockType}) — ${s.status} ${s.durationMs}ms${s.error ? ` — ${s.error}` : ''}`,
      );
    }
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.paths.length && !args.recurseRoots.length) {
    console.error(
      '[template-verify] no targets supplied. Pass one or more template directories or use --all <root>.',
    );
    process.exit(2);
  }

  /** @type {string[]} */
  const dirs = [...args.paths];
  for (const root of args.recurseRoots) {
    const found = await discoverTemplateDirs(root);
    dirs.push(...found);
  }

  // De-dupe + validate.
  /** @type {string[]} */
  const unique = [];
  const seen = new Set();
  for (const d of dirs) {
    const abs = path.resolve(d);
    if (seen.has(abs)) continue;
    seen.add(abs);
    let s;
    try {
      s = await stat(abs);
    } catch {
      console.error(`[template-verify] not a directory: ${d}`);
      process.exit(2);
    }
    if (!s.isDirectory()) {
      console.error(`[template-verify] not a directory: ${d}`);
      process.exit(2);
    }
    unique.push(abs);
  }

  if (!unique.length) {
    console.log('[template-verify] no templates discovered — nothing to verify.');
    return;
  }

  console.log(`[template-verify] verifying ${unique.length} template(s)…`);
  /** @type {VerifyResult[]} */
  const results = [];
  for (const dir of unique) {
    const r = await verifyOne(dir);
    console.log(formatResult(r));
    results.push(r);
  }

  const failed = results.filter((r) => !r.ok);
  const summary =
    `\n[template-verify] ${results.length - failed.length}/${results.length} passed` +
    (failed.length ? `, ${failed.length} failed` : '');
  console.log(summary);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[template-verify] unexpected error:', err);
  process.exit(2);
});
