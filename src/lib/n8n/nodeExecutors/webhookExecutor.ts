/**
 * Webhook / Trigger executor.
 *
 * In a live webhook scenario the trigger fires when an inbound HTTP request
 * is received.  Inside the synchronous executor this node simply validates
 * the incoming trigger data and passes it downstream as the first item.
 *
 * Parameters (all optional):
 *   httpMethod        – expected HTTP method (GET | POST | ...)
 *   path              – webhook path suffix (for documentation / matching)
 *   responseMode      – 'onReceived' | 'lastNode' | 'responseNode'
 *   responseCode      – numeric HTTP status to return to caller
 *   responseData      – body to return to caller
 *   authentication    – 'none' | 'basicAuth' | 'headerAuth'
 *   headerAuthName    – header name when authentication === 'headerAuth'
 *   headerAuthValue   – expected value when authentication === 'headerAuth'
 */

import type { N8NNode, ExecutionContext, NodeExecutorResult } from '../types';
import { interpolateParameters } from '../helpers/interpolateVariables';

export async function executeWebhook(
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
): Promise<NodeExecutorResult> {
  const params = interpolateParameters(node.parameters, context, inputItems);

  // When trigger data was injected via inputItems (from executeWorkflow), just
  // pass it through unchanged after optional authentication check.
  const items = inputItems.length > 0 ? inputItems : [{}];

  // Header-auth validation when configured
  const authentication = params.authentication as string | undefined;
  if (authentication === 'headerAuth') {
    const headerName = (params.headerAuthName as string | undefined)?.toLowerCase();
    const headerValue = params.headerAuthValue as string | undefined;
    if (headerName && headerValue) {
      for (const item of items) {
        const headers = item.headers as Record<string, string> | undefined;
        if (!headers) continue;
        const received = headers[headerName] ?? headers[headerName.toLowerCase()];
        if (received !== headerValue) {
          return {
            items: [],
            error: `Webhook authentication failed: invalid value for header "${headerName}"`,
          };
        }
      }
    }
  }

  // Basic-auth validation
  if (authentication === 'basicAuth') {
    const user = params.basicAuthUser as string | undefined;
    const pass = params.basicAuthPassword as string | undefined;
    if (user && pass) {
      for (const item of items) {
        const headers = item.headers as Record<string, string> | undefined;
        const authHeader = headers?.authorization ?? headers?.Authorization ?? '';
        const expected = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
        if (authHeader !== expected) {
          return {
            items: [],
            error: 'Webhook authentication failed: invalid Basic auth credentials',
          };
        }
      }
    }
  }

  // Normalise — ensure every item has a `body` key so downstream nodes can
  // access {{$json.body.field}} reliably.
  const normalised = items.map((item) => {
    if ('body' in item) return item;
    return { body: item, headers: {}, query: {}, params: {} };
  });

  return { items: normalised };
}
