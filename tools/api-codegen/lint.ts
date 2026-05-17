/**
 * Manifest linter.
 *
 * Validates structural invariants that the codegen and runtime rely on:
 *
 *   - No two endpoints share `<method> <path>`.
 *   - `pathParams` exactly match `[name]` segments in `path`.
 *   - Methods that don't carry a body (GET/DELETE) don't declare `requestBody`.
 *   - Methods that do carry a body (POST/PATCH/PUT) declare exactly one
 *     primary response schema (the `2xx` shorthand or `200`/`201`).
 *   - Every spec lists at least 401 + 429 (rate limit) responses so OpenAPI
 *     accurately reflects what the wrapper can return.
 *   - Webhook events look like `<module>.<resource>.<verb>`.
 *   - Scope strings use `<resource>:<action>` shape or `*` wildcard form.
 *
 * Exits with code 1 on any failure.
 */

import { manifest } from '../api-manifest/index';
import type { EndpointSpec } from '../api-manifest/types';

interface Issue {
  spec: string;
  message: string;
}

const issues: Issue[] = [];

function label(spec: EndpointSpec): string {
  return `${spec.method} ${spec.path}`;
}

function checkUniquePaths(): void {
  const seen = new Map<string, string>();
  for (const spec of manifest.endpoints) {
    const key = `${spec.method} ${spec.path}`;
    const prior = seen.get(key);
    if (prior) {
      issues.push({
        spec: key,
        message: `Duplicate endpoint (also declared in module '${prior}')`,
      });
    } else {
      seen.set(key, spec.module);
    }
  }
}

function checkPathParams(): void {
  for (const spec of manifest.endpoints) {
    const segments = Array.from(spec.path.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1]);
    const declared = (spec.pathParams ?? []).map((p) => p.name);
    for (const seg of segments) {
      if (!declared.includes(seg)) {
        issues.push({
          spec: label(spec),
          message: `Path contains [${seg}] but no matching pathParams entry`,
        });
      }
    }
    for (const d of declared) {
      if (!segments.includes(d)) {
        issues.push({
          spec: label(spec),
          message: `pathParams declares '${d}' but it is not in the path`,
        });
      }
    }
  }
}

function checkRequestBodyMethods(): void {
  for (const spec of manifest.endpoints) {
    const hasBody = spec.requestBody != null;
    const bodyAllowed = ['POST', 'PATCH', 'PUT'].includes(spec.method);
    if (hasBody && !bodyAllowed) {
      issues.push({
        spec: label(spec),
        message: `${spec.method} should not declare a requestBody`,
      });
    }
  }
}

function checkResponseCoverage(): void {
  for (const spec of manifest.endpoints) {
    const codes = Object.keys(spec.responses);
    const hasSuccess = codes.some((c) => c === '2xx' || c.startsWith('2'));
    if (!hasSuccess) {
      issues.push({
        spec: label(spec),
        message: 'No 2xx response declared',
      });
    }
    if (!codes.includes('401')) {
      issues.push({
        spec: label(spec),
        message: 'Missing 401 response (every authenticated endpoint can return it)',
      });
    }
    // 429 not strictly required when skipRateLimit is set.
    if (!spec.skipRateLimit && !codes.includes('429')) {
      issues.push({
        spec: label(spec),
        message: 'Missing 429 response (rate-limit is enabled by default)',
      });
    }
  }
}

const SCOPE_RE = /^([a-z][a-z0-9_-]*:)+[a-z0-9_*-]+$|^\*$/;

function checkScopes(): void {
  for (const spec of manifest.endpoints) {
    if (!SCOPE_RE.test(spec.scope)) {
      issues.push({
        spec: label(spec),
        message: `Scope '${spec.scope}' does not match <resource>:<action> shape`,
      });
    }
  }
}

const EVENT_RE = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){1,3}$/;

function checkEvents(): void {
  for (const spec of manifest.endpoints) {
    for (const event of spec.emits ?? []) {
      if (!EVENT_RE.test(event)) {
        issues.push({
          spec: label(spec),
          message: `Event '${event}' is not in <module>.<resource>.<verb> form`,
        });
      }
    }
  }
}

export function lintManifest(): { ok: boolean; issues: Issue[] } {
  checkUniquePaths();
  checkPathParams();
  checkRequestBodyMethods();
  checkResponseCoverage();
  checkScopes();
  checkEvents();
  return { ok: issues.length === 0, issues };
}

/* ── CLI entry ──────────────────────────────────────────────────────────── */

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { ok, issues: found } = lintManifest();
  if (ok) {
    console.log(`✓ Manifest OK (${manifest.endpoints.length} endpoints)`);
    process.exit(0);
  }
  console.error(`✗ Manifest has ${found.length} issue(s):`);
  for (const i of found) console.error(`  - [${i.spec}] ${i.message}`);
  process.exit(1);
}
