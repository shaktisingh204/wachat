/**
 * Type-only stub for `@n8n/config` so n8n's interfaces.ts can resolve
 * `import type { LogScope } from '@n8n/config'` without pulling in the
 * full config package (which expects DI/decorators infrastructure we do
 * not vendor).
 */
declare module '@n8n/config' {
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
}
