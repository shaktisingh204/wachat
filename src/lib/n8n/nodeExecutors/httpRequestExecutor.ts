/**
 * HTTP Request executor — makes outbound HTTP calls using the Node.js
 * built-in `fetch` API (available since Node 18 / Next.js 13).
 *
 * Parameters:
 *   method            – GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS
 *   url               – target URL (supports variable interpolation)
 *   authentication    – 'none' | 'genericCredentialType' | 'predefinedCredentialType'
 *   sendHeaders       – boolean
 *   headerParameters  – { parameters: [{ name, value }] }
 *   sendQuery         – boolean
 *   queryParameters   – { parameters: [{ name, value }] }
 *   sendBody          – boolean
 *   contentType       – 'json' | 'form-urlencoded' | 'multipart-form-data' | 'raw'
 *   body              – body object / string
 *   responseFormat    – 'json' | 'text' | 'file'
 *   timeout           – milliseconds (default 30000)
 *   followRedirects   – boolean (default true)
 */

import type { N8NNode, ExecutionContext, NodeExecutorResult } from '../types';
import { interpolateParameters } from '../helpers/interpolateVariables';

type KVParam = { name: string; value: string };

function buildHeaders(params: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!params.sendHeaders) return headers;
  const hp = params.headerParameters as { parameters?: KVParam[] } | undefined;
  for (const { name, value } of hp?.parameters ?? []) {
    if (name) headers[name] = value ?? '';
  }
  return headers;
}

function buildQueryString(params: Record<string, unknown>): string {
  if (!params.sendQuery) return '';
  const qp = params.queryParameters as { parameters?: KVParam[] } | undefined;
  const pairs = (qp?.parameters ?? [])
    .filter((p) => p.name)
    .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value ?? '')}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export async function executeHttpRequest(
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
): Promise<NodeExecutorResult> {
  const items = inputItems.length > 0 ? inputItems : [{}];
  const outputItems: Record<string, unknown>[] = [];

  for (let i = 0; i < items.length; i++) {
    const params = interpolateParameters(node.parameters, context, items, i);

    const method = ((params.method as string) ?? 'GET').toUpperCase();
    const rawUrl = (params.url as string | undefined) ?? '';
    if (!rawUrl) {
      return { items: [], error: 'HTTP Request node is missing a URL' };
    }

    const queryString = buildQueryString(params);
    const url = `${rawUrl}${queryString}`;
    const headers = buildHeaders(params);
    const timeout = typeof params.timeout === 'number' ? params.timeout : 30_000;
    const responseFormat = (params.responseFormat as string) ?? 'json';

    // Build request body
    let body: BodyInit | undefined;
    if (params.sendBody && method !== 'GET' && method !== 'HEAD') {
      const contentType = (params.contentType as string) ?? 'json';
      if (contentType === 'json') {
        headers['Content-Type'] = 'application/json';
        const rawBody = params.body;
        body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {});
      } else if (contentType === 'form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const rawBody = params.body as Record<string, string> | undefined;
        body = new URLSearchParams(rawBody ?? {}).toString();
      } else if (contentType === 'raw') {
        body = String(params.body ?? '');
      }
      // multipart-form-data requires FormData; skip Content-Type so browser sets boundary
      else if (contentType === 'multipart-form-data') {
        const formData = new FormData();
        const rawBody = params.body as Record<string, string> | undefined;
        for (const [k, v] of Object.entries(rawBody ?? {})) {
          formData.append(k, v);
        }
        body = formData;
      }
    }

    // AbortController for timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let responseData: unknown;
    let statusCode: number;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
        redirect: params.followRedirects === false ? 'manual' : 'follow',
      });

      clearTimeout(timer);
      statusCode = response.status;

      if (responseFormat === 'json') {
        try {
          responseData = await response.json();
        } catch {
          responseData = await response.text();
        }
      } else if (responseFormat === 'text') {
        responseData = await response.text();
      } else {
        // file — return as base64 string
        const buffer = await response.arrayBuffer();
        responseData = Buffer.from(buffer).toString('base64');
      }

      if (!response.ok && params.failOnError !== false) {
        return {
          items: [],
          error: `HTTP Request failed with status ${statusCode}: ${JSON.stringify(responseData)}`,
        };
      }

      outputItems.push({
        ...items[i],
        statusCode,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries()),
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      return { items: [], error: `HTTP Request error: ${msg}` };
    }
  }

  return { items: outputItems };
}
