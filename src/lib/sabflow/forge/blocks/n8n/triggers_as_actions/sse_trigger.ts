/**
 * Forge block: SSE Trigger (port of SseTrigger as a one-shot subscribe action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/SseTrigger/SseTrigger.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. Long-lived SSE subscriptions belong in the trigger system
 * under src/lib/sabflow/triggers/. This action connects, reads the first
 * event (or times out), then closes.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type SseEvent = {
  event: string;
  data: string;
  id?: string;
};

function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const lines = buffer.split(/\r?\n/);
  let pending: SseEvent | null = null;
  let lastBoundary = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      if (pending && pending.data !== '') {
        events.push(pending);
      }
      pending = null;
      lastBoundary = i + 1;
      continue;
    }
    if (line.startsWith(':')) continue; // comment
    const idx = line.indexOf(':');
    const field = idx === -1 ? line : line.slice(0, idx);
    const value = idx === -1 ? '' : line.slice(idx + 1).replace(/^ /, '');
    if (!pending) pending = { event: 'message', data: '' };
    if (field === 'event') pending.event = value;
    else if (field === 'data') pending.data = pending.data ? `${pending.data}\n${value}` : value;
    else if (field === 'id') pending.id = value;
  }
  const rest = lines.slice(lastBoundary).join('\n');
  return { events, rest };
}

async function subscribeOnce(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('SSE Trigger: url is required');
  const timeoutSeconds = Math.min(Math.max(asNumber(ctx.options.timeoutSeconds) ?? 30, 1), 120);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SSE Trigger: connect failed → ${message}`);
  }

  if (!response.ok) {
    clearTimeout(timer);
    throw new Error(`SSE Trigger: HTTP ${response.status} from ${url}`);
  }
  const body = response.body;
  if (!body) {
    clearTimeout(timer);
    throw new Error('SSE Trigger: response has no body');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let firstEvent: SseEvent | null = null;
  try {
    while (!firstEvent) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseChunk(buffer);
      buffer = rest;
      if (events.length > 0) {
        firstEvent = events[0];
        break;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`SSE Trigger: timed out after ${timeoutSeconds}s waiting for an event`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors
    }
  }

  if (!firstEvent) throw new Error('SSE Trigger: stream closed before yielding an event');

  return {
    outputs: { event: firstEvent },
    logs: [`SSE Trigger → received "${firstEvent.event}" event from ${url}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_sse_trigger',
  name: 'SSE Trigger',
  description: 'Connect to a server-sent events stream and capture the first event. Long-lived SSE belongs in the trigger system.',
  iconName: 'LuRadioTower',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'subscribe_once',
      label: 'Subscribe once',
      description: 'Open an SSE connection, read the first event (or time out), then close.',
      fields: [
        {
          id: 'url',
          label: 'URL',
          type: 'text',
          required: true,
          placeholder: 'https://example.com/events',
        },
        {
          id: 'timeoutSeconds',
          label: 'Timeout (seconds, 1-120)',
          type: 'number',
          defaultValue: 30,
        },
      ],
      run: subscribeOnce,
    },
  ],
};

registerForgeBlock(block);
export default block;
