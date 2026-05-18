// SabFlow executor — Node baseline (n8n-style hot path).
//
// HTTP POST /run
//   { workflow: { node, expression, outputField }, items: [...] }
// -> { items: [...], elapsedMs: number }
//
// The workflow is a single Set/Transform node that evaluates one expression
// per item and writes the result to `outputField`. v1 supports the
// `$json.<field>.toUpperCase()` shape — see ADR §3 (workload).
//
// No third-party deps. Pure node:http to keep the Node baseline honest:
// any wins we measure must come from the language/runtime, not from a
// faster web framework on either side.
//
// Companion: docs/adr/sabflow-executor-rust-bench.md
// Run:       node server.js [--port 7070]

'use strict';

const http = require('node:http');
const { performance } = require('node:perf_hooks');

const DEFAULT_PORT = 7070;
const MAX_BODY_BYTES = 64 * 1024 * 1024; // 64 MiB; 10k items fits comfortably.

/**
 * Compile a v1 expression into a closure over `item`.
 *
 * Supported v1 shape (matches ADR §3):
 *   $json.<field>.toUpperCase()
 *   $json.<field>.toLowerCase()
 *   $json.<field>            (passthrough — useful for sanity runs)
 *
 * Anything else throws. This is deliberate: the bench measures the dispatch
 * + per-item loop cost, not expression-engine completeness (Track B Phase 4).
 */
function compileExpression(src) {
    if (typeof src !== 'string') {
        throw new TypeError('expression must be a string');
    }
    const trimmed = src.trim();

    // $json.<field>.toUpperCase()
    let m = trimmed.match(/^\$json\.([A-Za-z_][A-Za-z0-9_]*)\.toUpperCase\(\)$/);
    if (m) {
        const field = m[1];
        return (item) => {
            const v = item[field];
            return typeof v === 'string' ? v.toUpperCase() : String(v).toUpperCase();
        };
    }

    // $json.<field>.toLowerCase()
    m = trimmed.match(/^\$json\.([A-Za-z_][A-Za-z0-9_]*)\.toLowerCase\(\)$/);
    if (m) {
        const field = m[1];
        return (item) => {
            const v = item[field];
            return typeof v === 'string' ? v.toLowerCase() : String(v).toLowerCase();
        };
    }

    // $json.<field>
    m = trimmed.match(/^\$json\.([A-Za-z_][A-Za-z0-9_]*)$/);
    if (m) {
        const field = m[1];
        return (item) => item[field];
    }

    throw new Error(`unsupported expression: ${src}`);
}

/**
 * Apply the Set/Transform node to every item.
 *
 * Mutates a fresh array; does not touch the input items array identity.
 */
function runWorkflow(workflow, items) {
    if (!workflow || workflow.node !== 'set') {
        throw new Error('only node=set is supported in v1');
    }
    const evalFn = compileExpression(workflow.expression);
    const outputField = workflow.outputField || 'out';

    const out = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
        const src = items[i];
        // Shallow clone — the bench is about dispatch overhead, not GC churn.
        const next = { ...src };
        next[outputField] = evalFn(src);
        out[i] = next;
    }
    return out;
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let received = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            received += chunk.length;
            if (received > MAX_BODY_BYTES) {
                reject(new Error('body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const buf = Buffer.concat(chunks);
                resolve(JSON.parse(buf.toString('utf8')));
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

function writeJson(res, status, body) {
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': payload.length,
        connection: 'keep-alive',
    });
    res.end(payload);
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
        writeJson(res, 200, { ok: true, impl: 'node' });
        return;
    }

    if (req.method !== 'POST' || req.url !== '/run') {
        writeJson(res, 404, { error: 'not found' });
        return;
    }

    try {
        const body = await readJsonBody(req);
        if (!body || !Array.isArray(body.items)) {
            writeJson(res, 400, { error: 'items must be an array' });
            return;
        }
        const t0 = performance.now();
        const items = runWorkflow(body.workflow, body.items);
        const elapsedMs = performance.now() - t0;
        writeJson(res, 200, { items, elapsedMs });
    } catch (err) {
        writeJson(res, 400, { error: err && err.message ? err.message : String(err) });
    }
});

// HTTP/1.1 keep-alive is what the bench expects (see ADR §3).
server.keepAliveTimeout = 60_000;
server.headersTimeout = 65_000;

function parseArgs(argv) {
    const out = { port: DEFAULT_PORT };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--port' && argv[i + 1]) {
            out.port = Number(argv[++i]);
        }
    }
    return out;
}

if (require.main === module) {
    const { port } = parseArgs(process.argv.slice(2));
    server.listen(port, '127.0.0.1', () => {
        // The driver greps stderr for "listening on" to know it's ready.
        process.stderr.write(`sabflow-bench[node] listening on 127.0.0.1:${port}\n`);
    });

    for (const sig of ['SIGINT', 'SIGTERM']) {
        process.on(sig, () => {
            server.close(() => process.exit(0));
        });
    }
}

module.exports = { compileExpression, runWorkflow, server };
