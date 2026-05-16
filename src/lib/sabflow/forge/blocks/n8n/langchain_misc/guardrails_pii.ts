/**
 * Forge block: LangChain Guardrails (PII)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/guardrails/
 *
 * Regex-first PII detector for emails, phones and US SSNs. If `apiKey` is
 * supplied, also runs an LLM pass to catch addresses, full names and other
 * fuzzy PII the regex misses. Returns matches with redacted previews.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

type Match = { kind: string; value: string; redacted: string };

const PATTERNS: Array<{ kind: string; rx: RegExp }> = [
  { kind: 'email', rx: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { kind: 'phone', rx: /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g },
  { kind: 'ssn', rx: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'credit_card', rx: /\b(?:\d[ -]*?){13,16}\b/g },
];

function redact(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(1, value.length - 4))}${value.slice(-2)}`;
}

function regexScan(text: string): Match[] {
  const out: Match[] = [];
  const seen = new Set<string>();
  for (const { kind, rx } of PATTERNS) {
    for (const m of text.matchAll(rx)) {
      const v = m[0];
      const key = `${kind}:${v}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind, value: v, redacted: redact(v) });
    }
  }
  return out;
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function stripFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : s.trim();
}

async function llmScan(text: string, apiKey: string, baseUrl: string, model: string): Promise<Match[]> {
  const system =
    'You are a PII detector. Find any personally-identifying information in the text (names, addresses, dates of birth, government IDs, financial accounts, anything the regex would miss). Return strict JSON: { "matches": [{ "kind": string, "value": string }] }. JSON only.';
  const res = await apiRequest({
    service: 'Guardrails (PII)',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body?.choices?.[0]?.message?.content ?? '';
  const parsed = (tryParse(raw) ?? tryParse(stripFences(raw))) as
    | { matches?: Array<{ kind?: unknown; value?: unknown }> }
    | undefined;
  if (!parsed || !Array.isArray(parsed.matches)) return [];
  return parsed.matches
    .map((m) => ({ kind: asString(m.kind) || 'other', value: asString(m.value) }))
    .filter((m) => m.value.length > 0)
    .map((m) => ({ ...m, redacted: redact(m.value) }));
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Guardrails (PII): text is required');

  const matches = regexScan(text);
  const apiKey = asString(ctx.options.apiKey);
  if (apiKey) {
    const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = asString(ctx.options.model) || 'gpt-4o-mini';
    const llmMatches = await llmScan(text, apiKey, baseUrl, model);
    // De-dupe by `${kind}:${value}`.
    const seen = new Set(matches.map((m) => `${m.kind}:${m.value}`));
    for (const m of llmMatches) {
      const k = `${m.kind}:${m.value}`;
      if (!seen.has(k)) {
        seen.add(k);
        matches.push(m);
      }
    }
  }

  return {
    outputs: { has_pii: matches.length > 0, matches },
    logs: [`Guardrails (PII) → ${matches.length} match(es)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_guardrails_pii',
  name: 'LangChain Guardrails (PII)',
  description: 'Detect emails, phones, SSNs (regex) and optionally fuzzy PII (LLM).',
  iconName: 'LuEyeOff',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'check',
      label: 'Detect PII',
      fields: [
        { id: 'text', label: 'Text to scan', type: 'textarea', required: true },
        { id: 'apiKey', label: 'API key (optional, enables LLM pass)', type: 'password' },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
