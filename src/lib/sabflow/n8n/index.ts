/**
 * Sabflow's n8n-derived engine module.
 *
 * **Purpose:** house code ported (largely verbatim) from
 * `n8n-master/packages/workflow/src/`. Sabflow stays on its own typebot-style
 * data model (groups + blocks) for authoring + chat runtime; this module is
 * the n8n-style execution layer for node-based automation flows.
 *
 * **Phase status**
 *  - Phase 1 ✓ — graph helpers, cron parser, native-method docs.
 *  - Phase 2 ✓ — Workflow class, Expression, WorkflowDataProxy, run-execution-data
 *    factory, augment-object, observable-object, errors/, extensions/.
 *  - Phase 3 — WorkflowExecute engine + partial-execution-utils (next).
 *  - Phase 4 — node-execute-context, node loader, NodeExecuteFunctions glue.
 *
 * **Resolved external deps:** esprima-next, jsonrepair, lodash, luxon,
 * p-cancelable, reflect-metadata, tslib, callsites, @sentry/types, jmespath,
 * md5, jssha, @codemirror/autocomplete, ast-types, recast, uuid, zod,
 * title-case, js-base64, transliteration, @n8n/expression-runtime
 * (incl. isolated-vm), @n8n/tournament. Type-only stubs for ssh2,
 * @langchain/core, nock, @n8n/config live in `internal/config-stub.d.ts`.
 *
 * **Vendored internal n8n packages:** @n8n/errors, @n8n/di, @n8n/constants
 * under `internal/` and resolved via tsconfig path aliases.
 *
 * Source repo (Apache-2.0): https://github.com/n8n-io/n8n
 */

/* ── Public types & connection model ────────────────────────────────── */
export * from './interfaces';
export * from './execution-context';

/* ── Connection-graph helpers (Phase 1) ─────────────────────────────── */
export * as Common from './common';
export * as Graph from './graph/graph-utils';

/* ── Cron + native methods + expression helpers ─────────────────────── */
export { toCronExpression, type TriggerTime } from './cron';
export { NativeMethods } from './native-methods';
export * as ExpressionHelpers from './expressions/expression-helpers';

/* ── Phase 2: workflow + expression engine ──────────────────────────── */
export { Workflow } from './workflow';
export { WorkflowExpression } from './workflow-expression';
export { Expression } from './expression';
export { WorkflowDataProxy } from './workflow-data-proxy';
export { createRunExecutionData } from './run-execution-data-factory';
export { getGlobalState, setGlobalState } from './global-state';
export * as Utils from './utils';
export * as TypeGuards from './type-guards';
export * as TypeValidation from './type-validation';

/* ── Constants + node helpers ───────────────────────────────────────── */
export * as Constants from './constants';
export * as NodeHelpers from './node-helpers';

/* ── Errors ─────────────────────────────────────────────────────────── */
export * from './errors';
