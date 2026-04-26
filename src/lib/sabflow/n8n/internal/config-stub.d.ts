/**
 * Type-only stubs for n8n source-files that import packages we do not
 * install at runtime. All declarations here are intentionally loose
 * (`unknown` / open-ended structural types) — the goal is only to make
 * the TypeScript compiler accept the n8n source after a verbatim copy.
 *
 * Replace any of these with the real package if/when we begin actually
 * exercising the corresponding code path at runtime.
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

declare module 'ssh2' {
  // Used as a type-only reference inside interfaces.ts (`SSHClient`).
  export class Client {}
}

declare module '@langchain/core/callbacks/manager' {
  // Used as a type-only reference for AI agent callbacks.
  export interface CallbackManager {
    [key: string]: unknown;
  }
}

declare module 'nock' {
  // Test-only matchers referenced (not invoked) by interfaces.ts.
  export type ReplyHeaders = unknown;
  export type RequestBodyMatcher = unknown;
  export type RequestHeaderMatcher = unknown;
}
