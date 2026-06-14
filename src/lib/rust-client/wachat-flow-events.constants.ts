import type { FlowMetrics } from './wachat-flow-events';

/**
 * Zero / never-triggered baseline — mirrors `FlowMetrics::empty()` on the Rust
 * side.
 *
 * Client-safe: this module has NO runtime dependency on the `server-only`
 * rust-client (the `import type` above is erased at build time), so client
 * components such as the flow-builder page can import this baseline without
 * dragging mongodb / firebase-admin / pg / next-headers into the browser bundle.
 */
export const EMPTY_METRICS: FlowMetrics = {
  triggersToday: 0,
  totalTriggers: 0,
  lastTriggeredAt: null,
};
