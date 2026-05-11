export const SABFLOW_QUEUE = 'sabflow-executions';
export const SABFLOW_CRON_QUEUE = 'sabflow-cron';
export const SABFLOW_CLEANUP_QUEUE = 'sabflow-cleanup';
export const SABFLOW_EXEC_CHANNEL = (executionId: string) =>
  `sabflow:exec:${executionId}`;
export const SABFLOW_WEBHOOK_RESPONSE = (executionId: string) =>
  `sabflow:webhook-response:${executionId}`;
