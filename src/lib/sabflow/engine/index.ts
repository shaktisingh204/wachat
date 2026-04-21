// Engine public API — re-export everything callers need
export { executeFlow } from './executeFlow';
export { executeBlock } from './executeBlock';
export { evaluateCondition } from './evaluateCondition';
export { substituteVariables } from './substituteVariables';
export { getNextGroup } from './getNextGroup';
export { runWithRetry } from './runWithRetry';
export { resolveErrorEdge } from './errorRouting';
export type { NodeRunOutcome } from './runWithRetry';

export type {
  SessionState,
  ExecutionStep,
  ExecutionResult,
  OutgoingMessage,
  InputRequest,
} from './types';

export type {
  BlockExecutionResult,
} from './executeBlock';

export type {
  Comparison,
  Condition,
  ComparisonOperator,
  LogicalOperator,
} from './evaluateCondition';
