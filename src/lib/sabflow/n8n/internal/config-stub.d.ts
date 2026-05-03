/**
 * Type-only stubs for n8n source-files that import packages we do not
 * install at runtime. All declarations here are intentionally loose
 * (`unknown` / open-ended structural types) — the goal is only to make
 * the TypeScript compiler accept the n8n source after a verbatim copy.
 *
 * Replace any of these with the real package if/when we begin actually
 * exercising the corresponding code path at runtime.
 */
// `@n8n/config` is now a real stub module at internal/config/index.ts;
// keeping an ambient declaration here would shadow its exports.

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

declare module '@sentry/node-native' {
  // Optional native add-on; ported core's error-reporter probes for it but
  // operates without it. Type-only stub.
  export const ProfilingIntegration: unknown;
}

declare module '@sentry/profiling-node' {
  export function nodeProfilingIntegration(): unknown;
}

declare module '@n8n/expression-runtime' {
  // `@n8n/expression-runtime` is an optionalDependency in package.json
  // because its native `isolated-vm` build needs Node 22 + Python and
  // fails on many production environments. Loose ambient types so
  // `expression.ts` (and the dynamic-import call inside it) compile
  // whether the package is installed or not.
  export interface IExpressionEvaluator {
    initialize(): Promise<void>;
    acquire(owner: unknown): Promise<void>;
    release(owner: unknown): Promise<void>;
    dispose(): Promise<void>;
    evaluate(
      expression: string,
      data: unknown,
      owner: unknown,
      options?: unknown,
    ): unknown;
  }
  // Concrete classes are referenced only inside `await import(...)` blocks
  // that we already wrap in try/catch — declare them as `any`-shaped.
  export const ExpressionEvaluator: new (_opts: unknown) => IExpressionEvaluator;
  export const IsolatedVmBridge: new (_opts: unknown) => unknown;
  export class TimeoutError extends Error {}
  export class MemoryLimitError extends Error {}
  export class SecurityViolationError extends Error {}
}

declare module '@aws-sdk/client-s3' {
  // Optional S3 dep for the storage adapter; type-only stub keeps build clean
  // when the package is not installed at runtime.
  export class S3Client {
    constructor(_opts?: unknown);
    send(_cmd: unknown): Promise<unknown>;
    destroy(): void;
  }
  export class PutObjectCommand {
    constructor(_input: unknown);
  }
  export class GetObjectCommand {
    constructor(_input: unknown);
  }
  export class DeleteObjectCommand {
    constructor(_input: unknown);
  }
  export class HeadObjectCommand {
    constructor(_input: unknown);
  }
  export class ListObjectsV2Command {
    constructor(_input: unknown);
  }
  export interface PutObjectCommandInput {
    Bucket?: string;
    Key?: string;
    Body?: unknown;
    ContentType?: string;
    [key: string]: unknown;
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  export function getSignedUrl(
    _client: unknown,
    _command: unknown,
    _options?: { expiresIn?: number },
  ): Promise<string>;
}

declare module '@langchain/core/tools' {
  // Used as type-only references for AI agent tools wiring.
  export class Tool {
    name: string = '';
    description: string = '';
    schema: unknown;
    invoke(_input: unknown): Promise<unknown> {
      return Promise.resolve(undefined);
    }
  }
  export class StructuredTool extends Tool {}
  export class DynamicStructuredTool extends StructuredTool {}
}
