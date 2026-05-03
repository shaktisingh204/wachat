/**
 * SIEM forwarder.
 *
 * Pushes audit / security events to one or more downstream SIEMs via
 * their HTTP-Event-Collector (HEC) style endpoints:
 *
 *   - Splunk      — `SPLUNK_HEC_URL`     + `SPLUNK_HEC_TOKEN`
 *   - Datadog     — `DATADOG_LOGS_URL`   + `DATADOG_API_KEY`
 *   - Elastic     — `ELASTIC_BULK_URL`   + `ELASTIC_API_KEY`
 *
 * The fan-out is intentionally simple — best-effort, fire-and-forget
 * with structured error reporting.  Persistence and retry are the
 * responsibility of the caller (typically a Bull / cron worker).
 */

import type { AuditEvent, SiemPushResult, SiemTarget } from './types';

/* ── Target adapters ────────────────────────────────────────────────── */

interface TargetConfig {
    url: string;
    headers: Record<string, string>;
    body: string;
}

function configFor(
    target: SiemTarget,
    events: AuditEvent[],
): TargetConfig {
    switch (target) {
        case 'splunk': {
            const url = process.env.SPLUNK_HEC_URL;
            const token = process.env.SPLUNK_HEC_TOKEN;
            if (!url || !token) {
                throw new Error(
                    'SIEM splunk: SPLUNK_HEC_URL and SPLUNK_HEC_TOKEN required',
                );
            }
            const body = events
                .map((e) =>
                    JSON.stringify({
                        time: Math.floor(new Date(e.ts).getTime() / 1000),
                        host: 'sabnode',
                        source: 'audit',
                        sourcetype: e.action,
                        event: e,
                    }),
                )
                .join('\n');
            return {
                url,
                headers: {
                    'Authorization': `Splunk ${token}`,
                    'Content-Type': 'application/json',
                },
                body,
            };
        }
        case 'datadog': {
            const url =
                process.env.DATADOG_LOGS_URL ??
                'https://http-intake.logs.datadoghq.com/api/v2/logs';
            const apiKey = process.env.DATADOG_API_KEY;
            if (!apiKey) throw new Error('SIEM datadog: DATADOG_API_KEY required');
            const body = JSON.stringify(
                events.map((e) => ({
                    ddsource: 'sabnode',
                    ddtags: `tenant:${e.tenantId},action:${e.action}`,
                    hostname: 'sabnode',
                    service: 'audit',
                    message: JSON.stringify(e),
                    timestamp: e.ts,
                })),
            );
            return {
                url,
                headers: {
                    'DD-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
                body,
            };
        }
        case 'elastic': {
            const url = process.env.ELASTIC_BULK_URL;
            const apiKey = process.env.ELASTIC_API_KEY;
            if (!url || !apiKey) {
                throw new Error(
                    'SIEM elastic: ELASTIC_BULK_URL and ELASTIC_API_KEY required',
                );
            }
            // Elastic _bulk wants newline-delimited (action / source) pairs.
            const lines: string[] = [];
            for (const e of events) {
                lines.push(JSON.stringify({ index: { _index: 'sabnode-audit' } }));
                lines.push(JSON.stringify(e));
            }
            return {
                url,
                headers: {
                    'Authorization': `ApiKey ${apiKey}`,
                    'Content-Type': 'application/x-ndjson',
                },
                body: lines.join('\n') + '\n',
            };
        }
    }
}

/* ── Fan-out ────────────────────────────────────────────────────────── */

/**
 * Push `events` to every requested `target`.  Returns one result per
 * target so callers can decide how to handle partial failures.
 */
export async function pushToSiem(
    events: AuditEvent[],
    target: SiemTarget | SiemTarget[],
): Promise<SiemPushResult[]> {
    const targets = Array.isArray(target) ? target : [target];
    if (events.length === 0) {
        return targets.map((t) => ({
            target: t,
            accepted: 0,
            rejected: 0,
            errors: [],
        }));
    }

    const results = await Promise.all(
        targets.map(async (t): Promise<SiemPushResult> => {
            const errors: string[] = [];
            try {
                const cfg = configFor(t, events);
                const res = await fetch(cfg.url, {
                    method: 'POST',
                    headers: cfg.headers,
                    body: cfg.body,
                });
                if (!res.ok) {
                    errors.push(
                        `HTTP ${res.status} ${res.statusText}`.trim(),
                    );
                    return {
                        target: t,
                        accepted: 0,
                        rejected: events.length,
                        errors,
                    };
                }
                return {
                    target: t,
                    accepted: events.length,
                    rejected: 0,
                    errors,
                };
            } catch (err) {
                errors.push((err as Error).message);
                return {
                    target: t,
                    accepted: 0,
                    rejected: events.length,
                    errors,
                };
            }
        }),
    );

    return results;
}

/** Exposed for tests. */
export const __internals = { configFor };
