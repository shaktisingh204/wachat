/**
 * CRM Depth — public API barrel.
 *
 * Pure TypeScript primitives for advanced CRM features:
 *   - Pipelines + 8 industry templates
 *   - Deal scoring (rule + linear-weight)
 *   - Lead routing (round-robin / weighted / territory / sla-aware)
 *   - E-signature sessions
 *   - Quotes (versioned + redlined) and contract templates
 *   - Sequences, cadences and playbooks
 *   - Meeting availability + booking
 *   - Revenue forecasting (best-case / commit / weighted)
 *   - Customer health scoring
 */
export * from './types';
export * from './pipeline-templates';
export * from './deal-scoring';
export * from './lead-routing';
export * from './esign';
export * from './quotes';
export * from './contracts';
export * from './sequences';
export * from './playbooks';
export * from './meetings';
export * from './forecast';
export * from './health-score';
