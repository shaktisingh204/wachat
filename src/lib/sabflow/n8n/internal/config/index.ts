/**
 * Minimal sabflow stub for `@n8n/config`.
 *
 * The upstream package uses metadata decorators (`@Config`, `@Env`,
 * `@Nested`) to populate config classes from environment variables at
 * runtime. We reproduce no-op decorators plus empty config classes so the
 * `Container.get(SomeConfig)` calls in the ported core return well-defined
 * instances.
 */
import { Service } from '../di/di';

/* ── Decorators (no-ops) ────────────────────────────────────────────────── */

export function Config<T extends new (...args: unknown[]) => object>(target: T): void {
  // Behave like @Service so the class is registered with our DI container.
  Service()(target as unknown as new (...args: unknown[]) => unknown);
}

export function Env(_envVar: string, _opts?: unknown): PropertyDecorator {
  return () => undefined;
}

export function Nested(_target: object, _propertyKey: string | symbol): void {}

/* ── Concrete config classes referenced by ported source ────────────────── */

@Config
export class AiConfig {
  enabled = false;
  defaultModel = 'openai/gpt-4o-mini';
}

@Config
export class ExecutionsConfig {
  mode: 'regular' | 'queue' = 'regular';
  timeout = 0; // seconds; 0 = unlimited
  maxTimeout = 3600;
  saveDataOnError: 'all' | 'none' = 'all';
  saveDataOnSuccess: 'all' | 'none' = 'all';
}

@Config
export class CronLoggingConfig {
  enabled = false;
  level: 'debug' | 'info' | 'warn' | 'error' = 'info';
}

@Config
export class InstanceSettingsConfig {
  enforceSettingsFilePermissions = false;
}

@Config
export class SecurityConfig {
  blockFileAccessToN8nFiles = true;
  restrictFileAccessTo = '';
  daysAbandonedWorkflow = 0;
}

/* ── Type aliases referenced as types only ─────────────────────────────── */

export type LogScope =
  | 'concurrency'
  | 'license'
  | 'multi-main-setup'
  | 'pruning'
  | 'pubsub'
  | 'redis'
  | 'scaling'
  | 'task-runner'
  | 'waiting-executions'
  | string;
