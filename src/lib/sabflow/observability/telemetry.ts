/**
 * Observability: OpenTelemetry Scaffolding
 */

export interface SpanContext {
  traceId: string;
  spanId: string;
}

export class TelemetryTracer {
  constructor(private serviceName: string) {}

  startSpan(name: string, attributes?: Record<string, string | number>): SpanContext {
    const traceId = Math.random().toString(16).substring(2, 18);
    const spanId = Math.random().toString(16).substring(2, 10);
    return { traceId, spanId };
  }

  endSpan(context: SpanContext, error?: Error): void {
    if (error) {
      this.recordException(context, error);
    }
  }

  recordException(context: SpanContext, error: Error): void {
    // Scaffolding: attach error metadata to current span
  }
}

export const globalTracer = new TelemetryTracer('sabflow-engine');

export async function withTrace<T>(
  spanName: string, 
  attributes: Record<string, string | number>, 
  fn: (span: SpanContext) => Promise<T>
): Promise<T> {
  const span = globalTracer.startSpan(spanName, attributes);
  try {
    const result = await fn(span);
    globalTracer.endSpan(span);
    return result;
  } catch (error) {
    globalTracer.endSpan(span, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
