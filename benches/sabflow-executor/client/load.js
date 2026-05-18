// SabFlow executor bench — load driver.
//
// POSTs N parallel runs of M items each at the chosen server, records
// throughput + latency + peak RSS, and prints one JSON line to stdout.
//
// Workload + decision rule live in docs/adr/sabflow-executor-rust-bench.md.
//
// Usage:
//   node load.js --impl node|rust --host 127.0.0.1 --port 7070 \
//                --concurrency 16 --requests 200 --items 10000 \
//                [--warmup 20] [--field foo] [--out-field fooUpper]
//
// Exit code is 0 if all requests returned 2xx and error rate < 0.1%.

'use strict';

const http = require('node:http');
const { performance } = require('node:perf_hooks');

function parseArgs(argv) {
    const out = {
        impl: 'node',
        host: '127.0.0.1',
        port: 7070,
        concurrency: 16,
        requests: 200,
        items: 10_000,
        warmup: 20,
        field: 'foo',
        outField: 'fooUpper',
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = argv[i + 1];
        switch (a) {
            case '--impl': out.impl = next; i++; break;
            case '--host': out.host = next; i++; break;
            case '--port': out.port = Number(next); i++; break;
            case '--concurrency':
            case '-N': out.concurrency = Number(next); i++; break;
            case '--requests':
            case '-M': out.requests = Number(next); i++; break;
            case '--items': out.items = Number(next); i++; break;
            case '--warmup': out.warmup = Number(next); i++; break;
            case '--field': out.field = next; i++; break;
            case '--out-field': out.outField = next; i++; break;
            default:
                if (a && a.startsWith('--')) {
                    process.stderr.write(`unknown flag: ${a}\n`);
                    process.exit(2);
                }
        }
    }
    return out;
}

function makeItems(n, field) {
    const items = new Array(n);
    for (let i = 0; i < n; i++) {
        // 8-char string per ADR §3.
        const foo = ('00000000' + (i.toString(36))).slice(-8);
        items[i] = { [field]: foo, n: i };
    }
    return items;
}

function buildRequestBody({ items, field, outField }) {
    const payload = {
        workflow: {
            node: 'set',
            expression: `$json.${field}.toUpperCase()`,
            outputField: outField,
        },
        items,
    };
    return Buffer.from(JSON.stringify(payload), 'utf8');
}

function postOnce({ agent, host, port, body }) {
    return new Promise((resolve) => {
        const start = performance.now();
        const req = http.request(
            {
                method: 'POST',
                host,
                port,
                path: '/run',
                agent,
                headers: {
                    'content-type': 'application/json; charset=utf-8',
                    'content-length': body.length,
                    connection: 'keep-alive',
                },
            },
            (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => {
                    const elapsed = performance.now() - start;
                    if (res.statusCode !== 200) {
                        resolve({ ok: false, elapsed, status: res.statusCode });
                        return;
                    }
                    // We parse the body so the cost of JSON deserialization on
                    // the client side is included — fair to both impls.
                    try {
                        JSON.parse(Buffer.concat(chunks).toString('utf8'));
                        resolve({ ok: true, elapsed });
                    } catch {
                        resolve({ ok: false, elapsed, status: res.statusCode });
                    }
                });
            },
        );
        req.on('error', () => {
            resolve({ ok: false, elapsed: performance.now() - start, status: 0 });
        });
        req.write(body);
        req.end();
    });
}

function percentile(sortedAsc, p) {
    if (sortedAsc.length === 0) return 0;
    const idx = Math.min(
        sortedAsc.length - 1,
        Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
    );
    return sortedAsc[idx];
}

function startRssSampler(intervalMs) {
    let peak = 0;
    const tick = () => {
        const rss = process.memoryUsage.rss();
        if (rss > peak) peak = rss;
    };
    tick();
    const t = setInterval(tick, intervalMs);
    if (t.unref) t.unref();
    return {
        stop() {
            clearInterval(t);
            return peak;
        },
    };
}

async function waitForServer({ host, port, timeoutMs = 10_000 }) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const ok = await new Promise((resolve) => {
            const req = http.request(
                { method: 'GET', host, port, path: '/health', timeout: 500 },
                (res) => {
                    res.resume();
                    resolve(res.statusCode === 200);
                },
            );
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.end();
        });
        if (ok) return;
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`server at ${host}:${port} did not become healthy in time`);
}

async function runPool({ concurrency, total, task }) {
    const latencies = [];
    let errors = 0;
    let nextIndex = 0;
    const inFlight = new Array(concurrency);

    async function worker() {
        for (;;) {
            const i = nextIndex++;
            if (i >= total) return;
            const r = await task();
            if (r.ok) latencies.push(r.elapsed);
            else errors++;
        }
    }

    for (let w = 0; w < concurrency; w++) inFlight[w] = worker();
    await Promise.all(inFlight);
    return { latencies, errors };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const items = makeItems(args.items, args.field);
    const body = buildRequestBody({
        items,
        field: args.field,
        outField: args.outField,
    });

    // Keep-alive agent so we measure steady-state, not TCP handshake.
    const agent = new http.Agent({
        keepAlive: true,
        maxSockets: args.concurrency,
        maxFreeSockets: args.concurrency,
    });

    await waitForServer({ host: args.host, port: args.port });

    // Warmup — discarded.
    if (args.warmup > 0) {
        await runPool({
            concurrency: Math.min(args.concurrency, args.warmup),
            total: args.warmup,
            task: () => postOnce({ agent, host: args.host, port: args.port, body }),
        });
    }

    const sampler = startRssSampler(100);
    const cpu0 = process.cpuUsage();
    const wall0 = performance.now();

    const { latencies, errors } = await runPool({
        concurrency: args.concurrency,
        total: args.requests,
        task: () => postOnce({ agent, host: args.host, port: args.port, body }),
    });

    const elapsedMs = performance.now() - wall0;
    const cpu = process.cpuUsage(cpu0);
    const peakRssBytes = sampler.stop();
    agent.destroy();

    latencies.sort((a, b) => a - b);
    const totalItems = latencies.length * args.items;
    const throughput = totalItems / (elapsedMs / 1000);
    const errorRate = args.requests === 0 ? 0 : errors / args.requests;

    const result = {
        impl: args.impl,
        concurrency: args.concurrency,
        totalRequests: args.requests,
        warmupRequests: args.warmup,
        itemsPerRequest: args.items,
        totalItems,
        elapsedMs: Number(elapsedMs.toFixed(2)),
        throughputItemsPerSec: Math.round(throughput),
        latencyMs: {
            p50: Number(percentile(latencies, 50).toFixed(3)),
            p95: Number(percentile(latencies, 95).toFixed(3)),
            p99: Number(percentile(latencies, 99).toFixed(3)),
            max: Number((latencies[latencies.length - 1] || 0).toFixed(3)),
        },
        perItemNs: {
            p50: Math.round((percentile(latencies, 50) * 1e6) / args.items),
            p99: Math.round((percentile(latencies, 99) * 1e6) / args.items),
        },
        peakRssMb: Number((peakRssBytes / (1024 * 1024)).toFixed(1)),
        cpuMs: {
            user: Math.round(cpu.user / 1000),
            sys: Math.round(cpu.system / 1000),
        },
        errorRate: Number(errorRate.toFixed(4)),
    };

    process.stdout.write(JSON.stringify(result) + '\n');

    // Per ADR §4: any error rate above 0.1% invalidates the run.
    if (errorRate > 0.001) process.exit(1);
}

main().catch((err) => {
    process.stderr.write(`load driver failed: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
});
