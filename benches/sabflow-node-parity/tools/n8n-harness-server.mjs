// benches/sabflow-node-parity/tools/n8n-harness-server.mjs
//
// Tiny shim that runs INSIDE the n8nio/n8n container.  Exposes
// `POST /test` with the runner's wire contract:
//
//   request:  { nodeType, params, items }
//   response: { items }
//
// It does NOT depend on the n8n REST API, the editor, the database, or
// any workflow-save lifecycle.  It calls into n8n-core's node executor
// directly, which is what the editor uses internally for "Execute node".
//
// v0 fallback: the runner sends a node type and the harness looks it up
// in the upstream n8n nodes-base package.  If the node isn't found, the
// shim returns HTTP 404 — the runner treats that as a non-parity result.
//
// No new deps: this script uses Node built-ins + the n8n packages
// already present in the image.

import { createServer } from 'node:http';

const PORT = Number.parseInt(process.env.HARNESS_PORT ?? '5679', 10);

// --- Lazy import so the harness can boot even if a particular n8n
// package layout changes; we only need it on the first request. ---
let n8nWorkflow;
let n8nCore;
let nodesBase;

async function loadN8n() {
  if (n8nWorkflow && n8nCore && nodesBase) return;
  // These resolve against the n8n image's bundled node_modules.
  n8nWorkflow = await import('n8n-workflow').catch(() => null);
  n8nCore = await import('n8n-core').catch(() => null);
  // nodes-base ships every reference node implementation we want parity
  // against.  We import the package's index lazily.
  nodesBase = await import('n8n-nodes-base').catch(() => null);
}

function notFound(res, msg) {
  res.statusCode = 404;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: msg }));
}

function badRequest(res, msg) {
  res.statusCode = 400;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: msg }));
}

function internalError(res, err) {
  res.statusCode = 500;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: String(err?.stack ?? err) }));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) return {};
  return JSON.parse(body);
}

// Build a minimal in-memory workflow containing exactly one node.
// We bypass workflow persistence and editor UI by invoking the node's
// execute() directly with a hand-built execution context.
async function runSingleNode({ nodeType, params, items }) {
  await loadN8n();
  if (!nodesBase) {
    const err = new Error('n8n-nodes-base not found in image');
    err.code = 'E_NODES_BASE_MISSING';
    throw err;
  }

  // The nodes-base package exports a registry under .nodeTypes or similar.
  // Different n8n versions ship slightly different layouts; probe.
  const candidates = [
    nodesBase.NodeTypes,
    nodesBase.default?.NodeTypes,
    nodesBase.nodeTypes,
    nodesBase.default?.nodeTypes,
  ].filter(Boolean);

  let nodeClass = null;
  for (const reg of candidates) {
    const lookup = typeof reg === 'function' ? reg() : reg;
    if (lookup && typeof lookup.getByName === 'function') {
      nodeClass = lookup.getByName(nodeType);
      if (nodeClass) break;
    }
    if (lookup && lookup[nodeType]) {
      nodeClass = lookup[nodeType];
      break;
    }
  }

  if (!nodeClass) {
    const err = new Error(`n8n node type not registered: ${nodeType}`);
    err.code = 'E_UNKNOWN_NODE';
    throw err;
  }

  // Per-version: nodeClass may be a class or a descriptor with a
  // `description` + `execute`.  Normalise.
  const instance = typeof nodeClass === 'function' ? new nodeClass() : nodeClass;
  if (typeof instance.execute !== 'function') {
    const err = new Error(
      `n8n node ${nodeType} has no execute() — likely a declarative node, not supported by harness v0`,
    );
    err.code = 'E_NO_EXECUTE';
    throw err;
  }

  // Construct a minimal IExecuteFunctions stand-in.
  // n8n's real one wraps a workflow + run-data; we synthesise the slice
  // the upstream nodes touch for a single-node call.
  const ctx = makeMinimalExecuteContext({ params, items });

  const result = await instance.execute.call(ctx);
  // n8n returns INodeExecutionData[][] — one inner array per output
  // branch.  The harness contract is single-branch, so flatten branch 0.
  const branch0 = (result?.[0] ?? []).map((item) => item.json ?? item);
  return { items: branch0 };
}

function makeMinimalExecuteContext({ params, items }) {
  // Mirror just enough of IExecuteFunctions for pure / transform-style
  // nodes (Set, IF, Switch, Merge, HTML, XML, JWT, Crypto, DateTime...).
  // Network-heavy nodes are out of scope for v0 — the runner skips them
  // until the harness grows credential / HTTP plumbing.
  const inputItems = items.map((item) => ({ json: item }));
  return {
    getInputData() {
      return inputItems;
    },
    getNode() {
      return { name: 'parity-harness-node', type: 'parity-harness-node' };
    },
    getNodeParameter(name, _itemIndex, fallback) {
      if (params && Object.prototype.hasOwnProperty.call(params, name)) {
        return params[name];
      }
      return fallback;
    },
    getCredentials() {
      throw new Error('credentials not supported in parity harness v0');
    },
    getMode() {
      return 'manual';
    },
    getWorkflow() {
      return { id: 'parity-harness', name: 'parity-harness' };
    },
    getWorkflowStaticData() {
      return {};
    },
    helpers: {
      returnJsonArray(data) {
        return (Array.isArray(data) ? data : [data]).map((json) => ({ json }));
      },
      constructExecutionMetaData(data) {
        return data;
      },
    },
    continueOnFail() {
      return false;
    },
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
  };
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, impl: 'n8n-harness' }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/test') {
    notFound(res, `unsupported route ${req.method} ${req.url}`);
    return;
  }
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    badRequest(res, `bad json: ${err.message}`);
    return;
  }
  const { nodeType, params, items } = body;
  if (!nodeType || !Array.isArray(items)) {
    badRequest(res, 'expected { nodeType: string, params: object, items: array }');
    return;
  }
  try {
    const out = await runSingleNode({ nodeType, params: params ?? {}, items });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(out));
  } catch (err) {
    if (err.code === 'E_UNKNOWN_NODE') {
      notFound(res, err.message);
      return;
    }
    internalError(res, err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`sabflow-parity-harness listening on :${PORT}`);
});
