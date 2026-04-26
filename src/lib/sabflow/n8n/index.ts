/**
 * Sabflow's n8n-derived engine module.
 *
 * **Purpose:** house code ported (largely verbatim) from
 * `n8n-master/packages/workflow/src/`. Sabflow stays on its own typebot-style
 * data model (groups + blocks) for authoring + chat runtime; this module is
 * the n8n-style execution layer for node-based automation flows.
 *
 * **Phases**
 *  - Phase 1 (this commit) — connection-graph helpers, cron parser,
 *    expression helpers, and native-method docs ported with minimal stubs.
 *  - Phase 2 — `Workflow` class + `expression.ts` + `workflow-data-proxy.ts`.
 *  - Phase 3 — `WorkflowExecute` engine + partial-execution-utils.
 *  - Phase 4 — node-execute-context, node loader, NodeExecuteFunctions glue.
 *
 * Source repo (Apache-2.0): https://github.com/n8n-io/n8n
 */

export * from './interfaces';
export * as Common from './common';
export * as Graph from './graph/graph-utils';
export * as ExpressionHelpers from './expressions/expression-helpers';
export { NativeMethods } from './native-methods';
export { toCronExpression, type TriggerTime } from './cron';
export { randomInt, isObject } from './utils';
