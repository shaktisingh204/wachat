/**
 * testNode — single-block execution runner for the "Test this node" panel.
 *
 * This is SabFlow's n8n-style isolated node runner.  Given a block, a sample
 * input, and a variables map, it executes the block's side effect in
 * isolation (no session, no engine hop) and returns a structured result.
 *
 * The runner is intentionally pure and transport-agnostic:
 *   - It never touches the engine's session state.
 *   - It never writes to the flow document.
 *   - It never imports any React / Next.js specifics.
 *
 * It may make real network calls (webhook, LLM providers) when real
 * credentials are supplied — that is the whole point of a test runner.
 */

import type { Block, KVPair } from '@/lib/sabflow/types';
import { substituteVariables } from '@/lib/sabflow/engine/substituteVariables';
import { evaluateCondition } from '@/lib/sabflow/engine/evaluateCondition';

/* ── Public types ────────────────────────────────────────────────────────── */

export type TestLogLevel = 'log' | 'warn' | 'error';

export type TestLogEntry = {
  level: TestLogLevel;
  message: string;
};

export type TestNodeParams = {
  block: Block;
  inputData: Record<string, unknown>;
  variables: Record<string, unknown>;
  /** Map of credentialId → key-value bag. */
  credentials?: Record<string, Record<string, string>>;
};

export type TestNodeResult = {
  output: unknown;
  logs: TestLogEntry[];
  durationMs: number;
  error?: string;
};

/* ── Internal helpers ────────────────────────────────────────────────────── */

/** Stringify any value into the shape expected by substituteVariables(). */
function toStringMap(
  source: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (v === undefined || v === null) {
      out[k] = '';
    } else if (typeof v === 'string') {
      out[k] = v;
    } else {
      try {
        out[k] = JSON.stringify(v);
      } catch {
        out[k] = String(v);
      }
    }
  }
  return out;
}

/** Coalesce variables + inputData into a single string-map for interpolation. */
function buildInterpolationMap(
  variables: Record<string, unknown>,
  inputData: Record<string, unknown>,
): Record<string, string> {
  return { ...toStringMap(variables), ...toStringMap(inputData) };
}

/** Resolve headers list to plain record with variable interpolation. */
function resolveHeaders(
  headers: KVPair[] | undefined,
  vars: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers ?? []) {
    if (!h?.key) continue;
    out[substituteVariables(h.key, vars)] = substituteVariables(
      h.value ?? '',
      vars,
    );
  }
  return out;
}

/** Read a string option safely. */
function optString(
  options: Record<string, unknown> | undefined,
  key: string,
): string {
  const v = options?.[key];
  return typeof v === 'string' ? v : '';
}

/** Read a number option safely. */
function optNumber(
  options: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const v = options?.[key];
  return typeof v === 'number' ? v : undefined;
}

/** Parse a response body as JSON, falling back to text. */
async function readResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return '';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* ── Per-block executors ─────────────────────────────────────────────────── */

async function runHttp(
  block: Block,
  vars: Record<string, string>,
  logs: TestLogEntry[],
): Promise<unknown> {
  const options = (block.options ?? {}) as Record<string, unknown>;
  const rawUrl = optString(options, 'url');
  if (!rawUrl) throw new Error('Webhook block is missing a URL');
  const url = substituteVariables(rawUrl, vars);
  const method = (optString(options, 'method') || 'GET').toUpperCase();
  const headers = resolveHeaders(
    options.headers as KVPair[] | undefined,
    vars,
  );
  const rawBody = optString(options, 'body');
  const body = rawBody ? substituteVariables(rawBody, vars) : undefined;

  logs.push({ level: 'log', message: `${method} ${url}` });

  const init: RequestInit = { method, headers };
  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = body;
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, init);
  const data = await readResponseBody(res);
  logs.push({
    level: res.ok ? 'log' : 'warn',
    message: `← ${res.status} ${res.statusText}`,
  });

  return {
    status: res.status,
    ok: res.ok,
    headers: Object.fromEntries(res.headers.entries()),
    body: data,
  };
}

function runSetVariable(
  block: Block,
  variables: Record<string, unknown>,
  vars: Record<string, string>,
): unknown {
  const options = (block.options ?? {}) as Record<string, unknown>;
  const key =
    optString(options, 'variableName') || optString(options, 'variableId');
  if (!key) return { variables };

  const expression =
    optString(options, 'expressionToEvaluate') || optString(options, 'value');
  const resolved = substituteVariables(expression, vars);
  const next: Record<string, unknown> = { ...variables, [key]: resolved };
  return { variables: next, set: { key, value: resolved } };
}

function runCondition(
  block: Block,
  vars: Record<string, string>,
): unknown {
  const options = block.options;
  if (!options) return { branch: 'false' as const, reason: 'no-options' };

  let matched = false;
  try {
    if ('conditionGroups' in options) {
      matched = evaluateCondition(
        options as unknown as Parameters<typeof evaluateCondition>[0],
        vars,
      );
    } else {
      // Per-item evaluation (legacy): check block.items for the first truthy.
      const items = block.items ?? [];
      for (const item of items) {
        const content = (item as { content?: unknown }).content;
        if (
          content &&
          typeof content === 'object' &&
          evaluateCondition(
            content as unknown as Parameters<typeof evaluateCondition>[0],
            vars,
          )
        ) {
          matched = true;
          break;
        }
      }
    }
  } catch (err) {
    return {
      branch: 'false' as const,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return { branch: matched ? ('true' as const) : ('false' as const) };
}

function runBubble(
  block: Block,
  vars: Record<string, string>,
): unknown {
  const options = (block.options ?? {}) as Record<string, unknown>;
  const raw =
    optString(options, 'content') ||
    optString(options, 'text') ||
    optString(options, 'url') ||
    optString(options, 'html');
  const content = raw ? substituteVariables(raw, vars) : '';
  return { type: block.type, content };
}

async function runOpenAI(
  block: Block,
  vars: Record<string, string>,
  credentials: Record<string, Record<string, string>> | undefined,
  logs: TestLogEntry[],
): Promise<unknown> {
  const options = (block.options ?? {}) as Record<string, unknown>;
  const credentialId = optString(options, 'credentialsId');
  const credBag = credentialId ? credentials?.[credentialId] : undefined;
  const apiKey = credBag?.apiKey ?? optString(options, 'apiKey');
  if (!apiKey) throw new Error('OpenAI credentials are not configured');

  const model = optString(options, 'model') || 'gpt-4o-mini';
  const systemPrompt = substituteVariables(
    optString(options, 'systemPrompt'),
    vars,
  );
  const userMessage = substituteVariables(
    optString(options, 'userMessage'),
    vars,
  );
  const temperature = optNumber(options, 'temperature');
  const maxTokens = optNumber(options, 'maxTokens');

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (userMessage) messages.push({ role: 'user', content: userMessage });

  logs.push({ level: 'log', message: `OpenAI chat.completions → ${model}` });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  const data = await readResponseBody(res);
  if (!res.ok) {
    throw new Error(
      `OpenAI API ${res.status}: ${
        typeof data === 'string' ? data : JSON.stringify(data)
      }`,
    );
  }
  return { model, response: data };
}

async function runAnthropic(
  block: Block,
  vars: Record<string, string>,
  credentials: Record<string, Record<string, string>> | undefined,
  logs: TestLogEntry[],
): Promise<unknown> {
  const options = (block.options ?? {}) as Record<string, unknown>;
  const credentialId = optString(options, 'credentialsId');
  const credBag = credentialId ? credentials?.[credentialId] : undefined;
  const apiKey = credBag?.apiKey ?? optString(options, 'apiKey');
  if (!apiKey) throw new Error('Anthropic credentials are not configured');

  const model = optString(options, 'model') || 'claude-3-5-sonnet-latest';
  const systemPrompt = substituteVariables(
    optString(options, 'systemPrompt'),
    vars,
  );
  const userMessage = substituteVariables(
    optString(options, 'userMessage'),
    vars,
  );
  const maxTokens = optNumber(options, 'maxTokens') ?? 1024;

  logs.push({ level: 'log', message: `Anthropic messages → ${model}` });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: maxTokens,
    }),
  });
  const data = await readResponseBody(res);
  if (!res.ok) {
    throw new Error(
      `Anthropic API ${res.status}: ${
        typeof data === 'string' ? data : JSON.stringify(data)
      }`,
    );
  }
  return { model, response: data };
}

async function runMistral(
  block: Block,
  vars: Record<string, string>,
  credentials: Record<string, Record<string, string>> | undefined,
  logs: TestLogEntry[],
): Promise<unknown> {
  const options = (block.options ?? {}) as Record<string, unknown>;
  const credentialId = optString(options, 'credentialsId');
  const credBag = credentialId ? credentials?.[credentialId] : undefined;
  const apiKey = credBag?.apiKey ?? optString(options, 'apiKey');
  if (!apiKey) throw new Error('Mistral credentials are not configured');

  const model = optString(options, 'model') || 'mistral-small-latest';
  const systemPrompt = substituteVariables(
    optString(options, 'systemPrompt'),
    vars,
  );
  const userMessage = substituteVariables(
    optString(options, 'userMessage'),
    vars,
  );

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (userMessage) messages.push({ role: 'user', content: userMessage });

  logs.push({ level: 'log', message: `Mistral chat.completions → ${model}` });

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages }),
  });
  const data = await readResponseBody(res);
  if (!res.ok) {
    throw new Error(
      `Mistral API ${res.status}: ${
        typeof data === 'string' ? data : JSON.stringify(data)
      }`,
    );
  }
  return { model, response: data };
}

async function runScript(
  block: Block,
  inputData: Record<string, unknown>,
  variables: Record<string, unknown>,
  logs: TestLogEntry[],
): Promise<unknown> {
  const options = (block.options ?? {}) as Record<string, unknown>;
  const source = optString(options, 'content');
  if (!source) return { returned: undefined };

  // Try to load a shared sandbox — if one exists we use it; otherwise fall
  // back to a narrowly-scoped Function constructor (still client-side only).
  try {
    const sandbox = (await import(
      /* webpackIgnore: true */ '@/lib/sabflow/execution/sandbox'
    ).catch(() => null)) as
      | { runScript?: (src: string, ctx: Record<string, unknown>) => unknown }
      | null;

    if (sandbox?.runScript) {
      logs.push({ level: 'log', message: 'Running via sandbox…' });
      const returned = await sandbox.runScript(source, {
        input: inputData,
        variables,
      });
      return { returned };
    }
  } catch {
    // fall through to Function fallback
  }

  logs.push({
    level: 'warn',
    message: 'Sandbox not available — using Function() fallback',
  });
  const fn = new Function(
    'input',
    'variables',
    `"use strict";\nreturn (async () => {\n${source}\n})();`,
  ) as (
    input: Record<string, unknown>,
    variables: Record<string, unknown>,
  ) => Promise<unknown>;
  const returned = await fn(inputData, variables);
  return { returned };
}

/* ── Public entry point ──────────────────────────────────────────────────── */

export async function testNode(
  params: TestNodeParams,
): Promise<TestNodeResult> {
  const { block, inputData, variables, credentials } = params;
  const logs: TestLogEntry[] = [];
  const start = performance.now();
  const vars = buildInterpolationMap(variables, inputData);

  try {
    let output: unknown;

    switch (block.type) {
      case 'webhook':
        output = await runHttp(block, vars, logs);
        break;

      case 'open_ai':
        output = await runOpenAI(block, vars, credentials, logs);
        break;

      case 'anthropic':
        output = await runAnthropic(block, vars, credentials, logs);
        break;

      case 'mistral':
      case 'together_ai':
        output = await runMistral(block, vars, credentials, logs);
        break;

      case 'set_variable':
        output = runSetVariable(block, variables, vars);
        break;

      case 'condition':
        output = runCondition(block, vars);
        break;

      case 'text':
      case 'image':
      case 'video':
      case 'audio':
      case 'embed':
        output = runBubble(block, vars);
        break;

      case 'script':
        output = await runScript(block, inputData, variables, logs);
        break;

      default:
        output = { skipped: true, reason: `No test runner for "${block.type}"` };
        break;
    }

    return {
      output,
      logs,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push({ level: 'error', message });
    return {
      output: null,
      logs,
      durationMs: Math.round(performance.now() - start),
      error: message,
    };
  }
}
