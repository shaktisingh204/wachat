/**
 * Types for the SabCRM runtime ("run engines now") server actions in
 * `./sabcrm-runtime.actions.ts`.
 */

/** Run counts surfaced to the UI (mirrors the runtime `WorkflowRunSummary`). */
export interface RunWorkflowNowSummary {
  workflowsRun: number;
  stepsRun: number;
  stepsFailed: number;
}

/** Payload returned by a manual workflow run. */
export interface RunWorkflowNowResult {
  /** Whether the workflow was found + executed. */
  ran: boolean;
  /** Run counts (workflows/steps run + failed). Shape mirrors the runtime. */
  summary?: RunWorkflowNowSummary;
}
