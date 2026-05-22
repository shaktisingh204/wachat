/**
 * Observability: Prometheus Metrics Scaffolding
 */

export class MetricsRegistry {
  private counters: Record<string, number> = {};

  incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}) {
    const key = `${name}_${JSON.stringify(labels)}`;
    this.counters[key] = (this.counters[key] || 0) + value;
  }

  async getMetricsPayload(): Promise<string> {
    let payload = '';
    for (const [key, value] of Object.entries(this.counters)) {
      payload += `${key} ${value}\n`;
    }
    return payload;
  }
}

export const globalMetricsRegistry = new MetricsRegistry();

export function recordWorkflowExecution(status: 'success' | 'error', workflowId: string) {
  globalMetricsRegistry.incrementCounter('sabflow_workflow_executions_total', 1, { status, workflowId });
}

export function recordNodeExecutionDuration(nodeType: string, durationMs: number) {
  globalMetricsRegistry.incrementCounter('sabflow_node_execution_duration_ms', durationMs, { nodeType });
}
