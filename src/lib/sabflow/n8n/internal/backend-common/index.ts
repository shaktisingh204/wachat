/**
 * Minimal sabflow stub for `@n8n/backend-common`.
 *
 * The upstream package wraps logging, file-system safety helpers, and runtime
 * environment probes. We reproduce only the surface the ported core/ source
 * actually imports — everything is a thin no-op or a small pure function.
 */
import { Service } from '../di/di';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/* ── Logger ─────────────────────────────────────────────────────────────── */

type LogMeta = Record<string, unknown> | undefined;

@Service()
export class Logger {
  private prefix = '[sabflow:n8n]';

  setPrefix(prefix: string) {
    this.prefix = prefix;
    return this;
  }
  scoped(_scope: string | string[]) {
    return this;
  }
  debug(_msg: string, _meta?: LogMeta): void {}
  info(msg: string, meta?: LogMeta): void {
    if (process.env.SABFLOW_VERBOSE) console.log(this.prefix, msg, meta ?? '');
  }
  warn(msg: string, meta?: LogMeta): void {
    console.warn(this.prefix, msg, meta ?? '');
  }
  error(msg: string, meta?: LogMeta): void {
    console.error(this.prefix, msg, meta ?? '');
  }
}

/* ── Runtime probes ─────────────────────────────────────────────────────── */

export function inTest(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

/* ── Path helpers (just-enough wrappers around node:path / fs) ─────────── */

export function isContainedWithin(parent: string, candidate: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(candidate));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function safeJoinPath(base: string, ...segments: string[]): string {
  const joined = path.join(base, ...segments);
  if (!isContainedWithin(base, joined)) {
    throw new Error(`safeJoinPath: ${segments.join('/')} escapes ${base}`);
  }
  return joined;
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function assertDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

/* ── Type guards ─────────────────────────────────────────────────────────── */

export function isObjectLiteral(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
