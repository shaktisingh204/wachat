# SabAI CPU‑Pilot — "Create a Lead" Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first working slice of SabNode's in‑house copilot — a user types "create a lead", the assistant asks for the missing details, then creates the lead via the existing CRM action — running fully self‑hosted on the CPU box (Path B), with the inference engine behind an abstraction so the later GPU/vLLM upgrade is a config swap.

**Architecture:** Deterministic dialog engine owns the control flow; a small local model (Ollama, CPU) is a *constrained cog* that only extracts slot values into schema‑valid JSON. A tool registry wraps existing server actions (RBAC + validation enforced inside the action). Intent matching is a trivial keyword matcher in this slice (replaced by an embeddings router in a later plan). Everything is pure/testable except two thin server wrappers (the LLM HTTP call and the live `addCrmLead` call), which are covered by a manual smoke test.

**Tech Stack:** TypeScript, Next.js (existing app), Ollama (local OpenAI‑style inference, CPU), Node built‑in test runner (`node:test`) via `tsx`, Zod (already in repo), the existing `addCrmLead` server action.

---

## Scope

This plan covers **P0 (local inference + client abstraction)**, **P1 (tool registry + `crm.createLead`)**, and **P2 (dialog + constrained extractor → the lead slice end‑to‑end)**. Out of scope (separate later plans): embeddings intent router + pgvector (P3), chat API + 20ui UI (P4), extractive RAG (P5), cross‑module tool packs (P6), hardening/observability/HA (P7), GPU/vLLM cutover.

## File structure

```
src/lib/sabai/
  types.ts                  # shared types: LlmClient, Tool, SlotDef, DialogState … (pure)
  llm/
    ollama.ts               # buildOllamaChatBody (pure) + makeOllamaLlmClient (thin fetch)
  tools/
    registry.ts             # ToolRegistry: register/get/list/manifest (pure)
    crm-lead.tool.ts         # crm.createLead: schema + argsToLeadFormData (pure) + run (server)
  dialog/
    slots.ts                # slot state machine: firstMissingSlot/mergeSlots/isComplete (pure)
    prompt.ts               # buildExtractionPrompt (pure)
  extract.ts                # extractSlots(llm, tool, text, known) — injected client (pure logic)
  runtime.ts                # handleTurn(...) orchestrator (pure logic; tools/llm injected)
  __tests__/
    registry.test.ts
    slots.test.ts
    prompt.test.ts
    extract.test.ts
    runtime.test.ts
    ollama.test.ts
    crm-lead.tool.test.ts
docs/sabai/SMOKE.md          # manual end-to-end smoke checklist
.env.example                # add SABAI_* vars (modify)
```

Design note: keep **control flow in `src/lib/sabai/` pure modules** (no `'use server'`, no `'server-only'`, no `@/` server imports) so they run under `node:test`+`tsx` — same pattern as `src/lib/sabcrm/scoring.ts`. The only server‑coupled file is `crm-lead.tool.ts` (it imports `addCrmLead`); its **pure** helper `argsToLeadFormData` is unit‑tested, its live `run` is smoke‑tested.

---

## Task 0: Branch

- [ ] **Step 1: Create a feature branch**

```bash
git checkout -b feat/sabai-lead-slice
```

---

## Task 1: P0 — Stand up local inference (Ollama, CPU) + env

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Install Ollama and pull the pilot model on the box**

Run (on the server that will host inference — for the pilot, the app box):
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:3b-instruct
```
Notes: `qwen2.5:3b-instruct` is the pragmatic CPU‑pilot pick (strong instruction‑following + JSON, available in Ollama). A function‑calling fine‑tune (e.g. xLAM) or a LoRA‑tuned Qwen is a later quality upgrade; the client abstraction makes swapping it a config change.

- [ ] **Step 2: Verify the model serves constrained JSON locally**

Run:
```bash
curl -s http://127.0.0.1:11434/api/chat -d '{
  "model":"qwen2.5:3b-instruct",
  "stream":false,
  "messages":[{"role":"user","content":"Extract name and phone: Rahul +919800000000"}],
  "format":{"type":"object","properties":{"name":{"type":"string"},"phone":{"type":"string"}},"required":["name","phone"]}
}'
```
Expected: a JSON body whose `message.content` is valid JSON like `{"name":"Rahul","phone":"+919800000000"}`.

- [ ] **Step 3: Add SabAI env to `.env.example`**

Append to `.env.example`:
```bash
# --- SabAI (in-house copilot) ---
# CPU pilot uses Ollama's native chat API with schema-constrained `format`.
# To upgrade to GPU/vLLM later, only these change (no app code changes).
SABAI_ENABLED=false
SABAI_LLM_PROVIDER=ollama            # ollama | vllm
SABAI_LLM_URL=http://127.0.0.1:11434 # ollama base (no trailing slash)
SABAI_MODEL=qwen2.5:3b-instruct
SABAI_LLM_TIMEOUT_MS=20000
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "feat(sabai): document local inference env (CPU pilot)"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/lib/sabai/types.ts`

- [ ] **Step 1: Write the types (no test — consumed by later tasks)**

```ts
// src/lib/sabai/types.ts
// Pure shared contracts for SabAI. No server imports — safe under node:test.

/** A JSON Schema object describing the slots a tool extracts. */
export type JsonSchema = Record<string, unknown>;

/** Provider-agnostic LLM call: take a system+user prompt and a schema,
 *  return parsed JSON. Implemented by the Ollama client now, vLLM later. */
export type LlmClient = (req: {
  system: string;
  user: string;
  schema: JsonSchema;
  maxTokens?: number;
}) => Promise<{ ok: true; json: unknown } | { ok: false; error: string }>;

export interface SlotDef {
  /** Key used in the action's input (must match the server action field). */
  name: string;
  required: boolean;
  /** Templated question asked when this slot is missing. */
  prompt: string;
}

export interface ToolContext {
  /** Active project/workspace; null = acting on the user's own account. */
  projectId: string | null;
}

export interface ToolResult {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface Tool {
  id: string; // e.g. 'crm.createLead'
  title: string;
  description: string;
  /** RBAC module key checked by the wrapped action. */
  rbacKey: string;
  slots: SlotDef[];
  /** JSON Schema for constrained slot extraction. */
  jsonSchema: JsonSchema;
  run: (args: Record<string, string>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface DialogState {
  toolId: string | null;
  slots: Record<string, string>;
  /** true once the user has confirmed and the tool ran. */
  done: boolean;
}

export function emptyDialogState(): DialogState {
  return { toolId: null, slots: {}, done: false };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/sabai/types.ts
git commit -m "feat(sabai): shared types (LlmClient, Tool, SlotDef, DialogState)"
```

---

## Task 3: Tool registry (pure)

**Files:**
- Create: `src/lib/sabai/tools/registry.ts`
- Test: `src/lib/sabai/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/sabai/__tests__/registry.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ToolRegistry } from '../tools/registry';
import type { Tool } from '../types';

const fakeTool: Tool = {
  id: 'demo.do', title: 'Do', description: 'demo', rbacKey: 'demo',
  slots: [{ name: 'x', required: true, prompt: 'x?' }],
  jsonSchema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] },
  run: async () => ({ ok: true, message: 'ok' }),
};

describe('ToolRegistry', () => {
  it('registers and gets a tool by id', () => {
    const r = new ToolRegistry();
    r.register(fakeTool);
    assert.equal(r.get('demo.do')?.title, 'Do');
    assert.equal(r.get('missing'), undefined);
  });
  it('lists tools and builds a manifest line per tool', () => {
    const r = new ToolRegistry();
    r.register(fakeTool);
    assert.equal(r.list().length, 1);
    assert.match(r.manifest(), /demo\.do — Do: demo/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/sabai/__tests__/registry.test.ts`
Expected: FAIL — cannot find module `../tools/registry`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sabai/tools/registry.ts
import type { Tool } from '../types';

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  register(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }
  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }
  list(): Tool[] {
    return [...this.tools.values()];
  }
  /** One line per tool — fed to the router / model for "what can I do". */
  manifest(): string {
    return this.list().map((t) => `${t.id} — ${t.title}: ${t.description}`).join('\n');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/sabai/__tests__/registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabai/tools/registry.ts src/lib/sabai/__tests__/registry.test.ts
git commit -m "feat(sabai): tool registry"
```

---

## Task 4: Slot state machine (pure)

**Files:**
- Create: `src/lib/sabai/dialog/slots.ts`
- Test: `src/lib/sabai/__tests__/slots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/sabai/__tests__/slots.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstMissingSlot, mergeSlots, isComplete } from '../dialog/slots';
import type { Tool } from '../types';

const tool: Tool = {
  id: 't', title: 'T', description: '', rbacKey: 'x',
  slots: [
    { name: 'title', required: true, prompt: 'Title?' },
    { name: 'phone', required: true, prompt: 'Phone?' },
    { name: 'email', required: false, prompt: 'Email?' },
  ],
  jsonSchema: {}, run: async () => ({ ok: true, message: '' }),
};

describe('slots', () => {
  it('mergeSlots ignores empty/whitespace values', () => {
    assert.deepEqual(mergeSlots({ title: 'A' }, { phone: ' ', email: 'e@x.com' }),
      { title: 'A', email: 'e@x.com' });
  });
  it('firstMissingSlot returns the first unfilled REQUIRED slot', () => {
    assert.equal(firstMissingSlot(tool, { title: 'A' })?.name, 'phone');
  });
  it('firstMissingSlot returns null when all required are filled', () => {
    assert.equal(firstMissingSlot(tool, { title: 'A', phone: 'p' }), null);
  });
  it('isComplete is true only when all required slots are present', () => {
    assert.equal(isComplete(tool, { title: 'A' }), false);
    assert.equal(isComplete(tool, { title: 'A', phone: 'p' }), true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/sabai/__tests__/slots.test.ts`
Expected: FAIL — cannot find module `../dialog/slots`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sabai/dialog/slots.ts
import type { SlotDef, Tool } from '../types';

export function mergeSlots(
  known: Record<string, string>,
  extracted: Record<string, unknown>,
): Record<string, string> {
  const out = { ...known };
  for (const [k, v] of Object.entries(extracted)) {
    if (typeof v === 'string' && v.trim() !== '') out[k] = v.trim();
    else if (typeof v === 'number') out[k] = String(v);
  }
  return out;
}

export function firstMissingSlot(tool: Tool, known: Record<string, string>): SlotDef | null {
  for (const s of tool.slots) {
    if (s.required && !known[s.name]) return s;
  }
  return null;
}

export function isComplete(tool: Tool, known: Record<string, string>): boolean {
  return firstMissingSlot(tool, known) === null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/sabai/__tests__/slots.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabai/dialog/slots.ts src/lib/sabai/__tests__/slots.test.ts
git commit -m "feat(sabai): slot-filling state machine"
```

---

## Task 5: Extraction prompt builder (pure)

**Files:**
- Create: `src/lib/sabai/dialog/prompt.ts`
- Test: `src/lib/sabai/__tests__/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/sabai/__tests__/prompt.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildExtractionPrompt } from '../dialog/prompt';
import type { Tool } from '../types';

const tool: Tool = {
  id: 'crm.createLead', title: 'Create lead', description: 'Create a CRM lead', rbacKey: 'crm_lead',
  slots: [
    { name: 'title', required: true, prompt: 'Title?' },
    { name: 'phone', required: true, prompt: 'Phone?' },
  ],
  jsonSchema: {}, run: async () => ({ ok: true, message: '' }),
};

describe('buildExtractionPrompt', () => {
  it('lists the slot names and includes the user text and known slots', () => {
    const { system, user } = buildExtractionPrompt(tool, 'Rahul, 9800000000', { title: 'Acme' });
    assert.match(system, /title/);
    assert.match(system, /phone/);
    assert.match(system, /only the fields you can find/i);
    assert.match(user, /Rahul, 9800000000/);
    assert.match(user, /"title":"Acme"/); // known slots passed so the model doesn't re-ask
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/sabai/__tests__/prompt.test.ts`
Expected: FAIL — cannot find module `../dialog/prompt`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sabai/dialog/prompt.ts
import type { Tool } from '../types';

export function buildExtractionPrompt(
  tool: Tool,
  userText: string,
  known: Record<string, string>,
): { system: string; user: string } {
  const fields = tool.slots.map((s) => `- ${s.name}${s.required ? ' (required)' : ''}`).join('\n');
  const system = [
    `You extract structured fields for the action "${tool.title}".`,
    `Return ONLY the fields you can find in the user's message, as JSON matching the schema.`,
    `Do not invent values. Omit fields you are unsure about.`,
    `Fields:`,
    fields,
  ].join('\n');
  const user = [
    `Already known: ${JSON.stringify(known)}`,
    `User message: ${userText}`,
  ].join('\n');
  return { system, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/sabai/__tests__/prompt.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabai/dialog/prompt.ts src/lib/sabai/__tests__/prompt.test.ts
git commit -m "feat(sabai): extraction prompt builder"
```

---

## Task 6: Slot extractor (pure logic, injected LLM)

**Files:**
- Create: `src/lib/sabai/extract.ts`
- Test: `src/lib/sabai/__tests__/extract.test.ts`

- [ ] **Step 1: Write the failing test (mock LlmClient — no network)**

```ts
// src/lib/sabai/__tests__/extract.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractSlots } from '../extract';
import type { LlmClient, Tool } from '../types';

const tool: Tool = {
  id: 'crm.createLead', title: 'Create lead', description: '', rbacKey: 'crm_lead',
  slots: [
    { name: 'title', required: true, prompt: 'Title?' },
    { name: 'phone', required: true, prompt: 'Phone?' },
  ],
  jsonSchema: { type: 'object', properties: { title: { type: 'string' }, phone: { type: 'string' } } },
  run: async () => ({ ok: true, message: '' }),
};

describe('extractSlots', () => {
  it('returns the model JSON as a string map', async () => {
    const llm: LlmClient = async () => ({ ok: true, json: { title: 'Acme', phone: '9800000000', junk: 1 } });
    const res = await extractSlots(llm, tool, 'Acme 9800000000', {});
    assert.deepEqual(res, { ok: true, slots: { title: 'Acme', phone: '9800000000' } });
  });
  it('drops keys that are not slots of the tool', async () => {
    const llm: LlmClient = async () => ({ ok: true, json: { title: 'Acme', notASlot: 'x' } });
    const res = await extractSlots(llm, tool, 'Acme', {});
    assert.deepEqual(res, { ok: true, slots: { title: 'Acme' } });
  });
  it('propagates llm errors', async () => {
    const llm: LlmClient = async () => ({ ok: false, error: 'engine down' });
    const res = await extractSlots(llm, tool, 'x', {});
    assert.deepEqual(res, { ok: false, error: 'engine down' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/sabai/__tests__/extract.test.ts`
Expected: FAIL — cannot find module `../extract`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sabai/extract.ts
import { buildExtractionPrompt } from './dialog/prompt';
import type { LlmClient, Tool } from './types';

/** Ask the model to extract slot values for `tool` from `userText`.
 *  Keeps only keys that are real slots; coerces to strings. */
export async function extractSlots(
  llm: LlmClient,
  tool: Tool,
  userText: string,
  known: Record<string, string>,
): Promise<{ ok: true; slots: Record<string, string> } | { ok: false; error: string }> {
  const { system, user } = buildExtractionPrompt(tool, userText, known);
  const res = await llm({ system, user, schema: tool.jsonSchema });
  if (!res.ok) return { ok: false, error: res.error };
  const raw = (res.json && typeof res.json === 'object') ? (res.json as Record<string, unknown>) : {};
  const allowed = new Set(tool.slots.map((s) => s.name));
  const slots: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!allowed.has(k)) continue;
    if (typeof v === 'string' && v.trim() !== '') slots[k] = v.trim();
    else if (typeof v === 'number') slots[k] = String(v);
  }
  return { ok: true, slots };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/sabai/__tests__/extract.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabai/extract.ts src/lib/sabai/__tests__/extract.test.ts
git commit -m "feat(sabai): slot extractor (injected LLM)"
```

---

## Task 7: Ollama client (pure body builder + thin fetch)

**Files:**
- Create: `src/lib/sabai/llm/ollama.ts`
- Test: `src/lib/sabai/__tests__/ollama.test.ts`

- [ ] **Step 1: Write the failing test (pure body builder only)**

```ts
// src/lib/sabai/__tests__/ollama.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOllamaChatBody } from '../llm/ollama';

describe('buildOllamaChatBody', () => {
  it('builds a non-streaming chat body with schema-constrained format', () => {
    const body = buildOllamaChatBody({
      model: 'qwen2.5:3b-instruct',
      system: 'SYS', user: 'USER',
      schema: { type: 'object', properties: { title: { type: 'string' } } },
    });
    assert.equal(body.model, 'qwen2.5:3b-instruct');
    assert.equal(body.stream, false);
    assert.deepEqual(body.messages, [
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USER' },
    ]);
    assert.deepEqual(body.format, { type: 'object', properties: { title: { type: 'string' } } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/sabai/__tests__/ollama.test.ts`
Expected: FAIL — cannot find module `../llm/ollama`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sabai/llm/ollama.ts
import type { JsonSchema, LlmClient } from '../types';

/** Pure: the request body for Ollama's native /api/chat with a JSON-schema
 *  `format` (structured output). Tested in isolation. */
export function buildOllamaChatBody(input: {
  model: string;
  system: string;
  user: string;
  schema: JsonSchema;
}): { model: string; stream: false; messages: { role: string; content: string }[]; format: JsonSchema } {
  return {
    model: input.model,
    stream: false,
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
    format: input.schema,
  };
}

/** Thin fetch wrapper → an LlmClient. Talks to Ollama on the CPU box.
 *  (Swapping to vLLM/GPU later = a different client behind the same type.) */
export function makeOllamaLlmClient(opts: { url: string; model: string; timeoutMs?: number }): LlmClient {
  return async ({ system, user, schema }) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), opts.timeoutMs ?? 20000);
    try {
      const r = await fetch(`${opts.url}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildOllamaChatBody({ model: opts.model, system, user, schema })),
        signal: ac.signal,
      });
      if (!r.ok) return { ok: false, error: `inference HTTP ${r.status}` };
      const data = (await r.json()) as { message?: { content?: string } };
      const content = data?.message?.content ?? '';
      try {
        return { ok: true, json: JSON.parse(content) };
      } catch {
        return { ok: false, error: 'model did not return valid JSON' };
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'inference call failed' };
    } finally {
      clearTimeout(t);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/sabai/__tests__/ollama.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabai/llm/ollama.ts src/lib/sabai/__tests__/ollama.test.ts
git commit -m "feat(sabai): ollama local llm client"
```

---

## Task 8: `crm.createLead` tool

**Files:**
- Create: `src/lib/sabai/tools/crm-lead.tool.ts`
- Test: `src/lib/sabai/__tests__/crm-lead.tool.test.ts`

- [ ] **Step 1: Write the failing test (pure arg→FormData mapping)**

```ts
// src/lib/sabai/__tests__/crm-lead.tool.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { argsToLeadFormData, crmCreateLeadTool } from '../tools/crm-lead.tool';

describe('crm.createLead tool', () => {
  it('declares title/contactName/phone as required slots', () => {
    const required = crmCreateLeadTool.slots.filter((s) => s.required).map((s) => s.name).sort();
    assert.deepEqual(required, ['contactName', 'phone', 'title']);
    assert.equal(crmCreateLeadTool.rbacKey, 'crm_lead');
  });
  it('argsToLeadFormData maps known args onto the action FormData fields', () => {
    const fd = argsToLeadFormData({ title: 'Acme', contactName: 'Rahul', phone: '9800000000', source: 'webinar' });
    assert.equal(fd.get('title'), 'Acme');
    assert.equal(fd.get('contactName'), 'Rahul');
    assert.equal(fd.get('phone'), '9800000000');
    assert.equal(fd.get('source'), 'webinar');
    assert.equal(fd.get('email'), null); // unset args are not added
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/sabai/__tests__/crm-lead.tool.test.ts`
Expected: FAIL — cannot find module `../tools/crm-lead.tool`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sabai/tools/crm-lead.tool.ts
import { addCrmLead } from '@/app/actions/crm-leads.actions';
import type { Tool } from '../types';

/** Slot name -> CRM action FormData field. Names match addCrmLead's reads. */
const LEAD_FIELDS = ['title', 'contactName', 'phone', 'email', 'company', 'source'] as const;

/** Pure: turn extracted args into the FormData addCrmLead expects. */
export function argsToLeadFormData(args: Record<string, string>): FormData {
  const fd = new FormData();
  for (const f of LEAD_FIELDS) {
    const v = args[f];
    if (typeof v === 'string' && v.trim() !== '') fd.set(f, v.trim());
  }
  return fd;
}

export const crmCreateLeadTool: Tool = {
  id: 'crm.createLead',
  title: 'Create lead',
  description: 'Create a new lead in the CRM',
  rbacKey: 'crm_lead',
  slots: [
    { name: 'title', required: true, prompt: 'What should the lead be called (a title)?' },
    { name: 'contactName', required: true, prompt: "What's the contact's name?" },
    { name: 'phone', required: true, prompt: "What's their phone number?" },
    { name: 'email', required: false, prompt: 'Email? (optional — say skip)' },
    { name: 'company', required: false, prompt: 'Company? (optional — say skip)' },
    { name: 'source', required: false, prompt: 'Where did this lead come from? (optional)' },
  ],
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' }, contactName: { type: 'string' }, phone: { type: 'string' },
      email: { type: 'string' }, company: { type: 'string' }, source: { type: 'string' },
    },
  },
  // RBAC + validation happen INSIDE addCrmLead (requirePermission('crm_lead','create') + zod).
  run: async (args) => {
    const res = await addCrmLead(null, argsToLeadFormData(args));
    if (res.error || !res.leadId) {
      return { ok: false, message: res.error ?? 'Could not create the lead.' };
    }
    return { ok: true, message: `Lead "${args.title}" created.`, data: { leadId: res.leadId } };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/sabai/__tests__/crm-lead.tool.test.ts`
Expected: PASS (2 tests). (Importing the tool pulls in `addCrmLead`; the test only calls the pure helper + reads metadata, never `run`, so no Mongo/session is touched.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabai/tools/crm-lead.tool.ts src/lib/sabai/__tests__/crm-lead.tool.test.ts
git commit -m "feat(sabai): crm.createLead tool wrapping addCrmLead"
```

---

## Task 9: Turn orchestrator (the vertical slice)

**Files:**
- Create: `src/lib/sabai/runtime.ts`
- Test: `src/lib/sabai/__tests__/runtime.test.ts`

- [ ] **Step 1: Write the failing test (full create-a-lead conversation, fake tool + mock llm)**

```ts
// src/lib/sabai/__tests__/runtime.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleTurn, matchIntent } from '../runtime';
import { ToolRegistry } from '../tools/registry';
import { emptyDialogState, type LlmClient, type Tool } from '../types';

function leadTool(onRun: (a: Record<string, string>) => void): Tool {
  return {
    id: 'crm.createLead', title: 'Create lead', description: 'Create a CRM lead', rbacKey: 'crm_lead',
    slots: [
      { name: 'title', required: true, prompt: 'Title?' },
      { name: 'phone', required: true, prompt: 'Phone?' },
    ],
    jsonSchema: { type: 'object', properties: { title: { type: 'string' }, phone: { type: 'string' } } },
    run: async (a) => { onRun(a); return { ok: true, message: 'Lead created.', data: { leadId: 'L1' } }; },
  };
}

describe('handleTurn', () => {
  it('matchIntent finds the lead tool from a "create a lead" message', () => {
    const r = new ToolRegistry(); r.register(leadTool(() => {}));
    assert.equal(matchIntent(r, 'please create a lead')?.id, 'crm.createLead');
    assert.equal(matchIntent(r, 'what is the weather'), null);
  });

  it('runs a full slot-filling conversation then executes the tool', async () => {
    let ran: Record<string, string> | null = null;
    const r = new ToolRegistry(); r.register(leadTool((a) => { ran = a; }));
    // The mock extractor returns whatever the latest user msg "contains".
    const llm: LlmClient = async ({ user }) => {
      const json: Record<string, string> = {};
      if (user.includes('Acme')) json.title = 'Acme';
      if (user.includes('98000')) json.phone = '9800000000';
      return { ok: true, json };
    };
    const ctx = { projectId: null };

    // Turn 1: intent only, no slots -> asks first missing required (title)
    let s = emptyDialogState();
    let out = await handleTurn({ state: s, message: 'create a lead', registry: r, llm, ctx });
    assert.equal(out.state.toolId, 'crm.createLead');
    assert.match(out.reply, /Title\?/);
    assert.equal(out.done, false);

    // Turn 2: user gives the title -> asks for phone
    out = await handleTurn({ state: out.state, message: 'call it Acme', registry: r, llm, ctx });
    assert.equal(out.state.slots.title, 'Acme');
    assert.match(out.reply, /Phone\?/);
    assert.equal(out.done, false);

    // Turn 3: user gives phone -> all required present -> executes tool
    out = await handleTurn({ state: out.state, message: 'phone 98000', registry: r, llm, ctx });
    assert.deepEqual(ran, { title: 'Acme', phone: '9800000000' });
    assert.equal(out.done, true);
    assert.match(out.reply, /Lead created/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/sabai/__tests__/runtime.test.ts`
Expected: FAIL — cannot find module `../runtime`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sabai/runtime.ts
import { extractSlots } from './extract';
import { firstMissingSlot, isComplete, mergeSlots } from './dialog/slots';
import type { ToolRegistry } from './tools/registry';
import type { DialogState, LlmClient, Tool, ToolContext } from './types';

/** Placeholder intent matcher (keyword). Replaced by an embeddings router
 *  in the P3 plan — handleTurn does not depend on how the tool is found. */
export function matchIntent(registry: ToolRegistry, message: string): Tool | null {
  const m = message.toLowerCase();
  for (const t of registry.list()) {
    const words = t.title.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.every((w) => m.includes(w))) return t;
  }
  return null;
}

export interface TurnInput {
  state: DialogState;
  message: string;
  registry: ToolRegistry;
  llm: LlmClient;
  ctx: ToolContext;
}
export interface TurnOutput {
  state: DialogState;
  reply: string;
  done: boolean;
}

export async function handleTurn(input: TurnInput): Promise<TurnOutput> {
  const { registry, llm, ctx } = input;
  let state: DialogState = { ...input.state, slots: { ...input.state.slots } };

  // 1. Resolve the active tool (continue current, else match intent).
  let tool = state.toolId ? registry.get(state.toolId) ?? null : null;
  if (!tool) {
    tool = matchIntent(registry, input.message);
    if (!tool) {
      return { state, reply: "I can't do that yet. Try: \"create a lead\".", done: false };
    }
    state.toolId = tool.id;
  }

  // 2. Extract any slot values present in this message.
  const ex = await extractSlots(llm, tool, input.message, state.slots);
  if (!ex.ok) {
    return { state, reply: `The assistant is unavailable right now (${ex.error}).`, done: false };
  }
  state.slots = mergeSlots(state.slots, ex.slots);

  // 3. Still missing a required slot? Ask for it.
  const missing = firstMissingSlot(tool, state.slots);
  if (missing) {
    return { state, reply: missing.prompt, done: false };
  }

  // 4. Complete -> execute the tool (RBAC + validation enforced inside run).
  if (isComplete(tool, state.slots)) {
    const result = await tool.run(state.slots, ctx);
    state.done = result.ok;
    return { state, reply: result.message, done: result.ok };
  }
  return { state, reply: 'Something went wrong assembling that action.', done: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/sabai/__tests__/runtime.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the whole SabAI suite**

Run: `npx tsx --test src/lib/sabai/__tests__/*.test.ts`
Expected: PASS — all tests across registry/slots/prompt/extract/ollama/crm-lead/runtime.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sabai/runtime.ts src/lib/sabai/__tests__/runtime.test.ts
git commit -m "feat(sabai): turn orchestrator + lead vertical slice (unit-tested)"
```

---

## Task 10: Manual end‑to‑end smoke (real Ollama + real CRM)

**Files:**
- Create: `docs/sabai/SMOKE.md`

- [ ] **Step 1: Write the smoke checklist**

```markdown
# SabAI lead-slice smoke test

Prereqs: Ollama running with `qwen2.5:3b-instruct` pulled; app `.env` has
`SABAI_LLM_URL=http://127.0.0.1:11434` and `SABAI_MODEL=qwen2.5:3b-instruct`;
a logged-in CRM user/project (RBAC `crm_lead:create`).

1. Drive the runtime against the REAL model + REAL action from a tsx scratch script:

   npx tsx -e "
   import { ToolRegistry } from './src/lib/sabai/tools/registry';
   import { crmCreateLeadTool } from './src/lib/sabai/tools/crm-lead.tool';
   import { makeOllamaLlmClient } from './src/lib/sabai/llm/ollama';
   import { handleTurn } from './src/lib/sabai/runtime';
   import { emptyDialogState } from './src/lib/sabai/types';
   const r = new ToolRegistry(); r.register(crmCreateLeadTool);
   const llm = makeOllamaLlmClient({ url: process.env.SABAI_LLM_URL, model: process.env.SABAI_MODEL });
   const ctx = { projectId: process.env.SMOKE_PROJECT_ID ?? null };
   let s = emptyDialogState();
   for (const msg of ['create a lead','title Acme Corp, contact Rahul','phone +919800000000']) {
     const out = await handleTurn({ state: s, message: msg, registry: r, llm, ctx });
     console.log('USER:', msg, '\\nBOT :', out.reply, '\\n');
     s = out.state;
   }
   "

   NOTE: `addCrmLead` reads the session cookie; run this inside an authenticated
   server context (or temporarily call with the apiUser path) — see the action.

2. Expected: the bot asks for any missing required field, then prints
   'Lead "Acme Corp" created.' and a lead appears in the CRM scoped to the project.
3. Confirm in Mongo / the CRM UI that the lead exists with title/contact/phone.
4. Latency note: record tokens/sec + turn latency on the CPU box for the capacity log.
```

- [ ] **Step 2: Run the smoke test** and confirm a lead is created (record latency).

- [ ] **Step 3: Commit**

```bash
git add docs/sabai/SMOKE.md
git commit -m "docs(sabai): lead-slice end-to-end smoke checklist"
```

---

## Self-review

- **Spec coverage:** P0 (Task 1 + Task 7 client), P1 (Tasks 3, 8), P2 (Tasks 4, 5, 6, 9). The "model as constrained cog + deterministic dialog + tool wraps existing action + RBAC inside action" design is realized. Router is intentionally a keyword stub (`matchIntent`) — embeddings router is the next plan, and `handleTurn` is decoupled from it. ✓
- **Placeholder scan:** every code step has complete code; commands have expected output; no TBDs. ✓
- **Type consistency:** `LlmClient`, `Tool`, `SlotDef`, `DialogState`, `ToolContext`, `ToolResult`, `emptyDialogState` defined in Task 2 and used unchanged in Tasks 3–9; `crmCreateLeadTool`/`argsToLeadFormData` names consistent between Task 8 and the smoke doc; `handleTurn`/`matchIntent` consistent between Task 9 and the smoke doc. ✓
- **GPU‑upgrade promise:** all call sites depend only on the `LlmClient` type; swapping `makeOllamaLlmClient` for a future `makeVllmClient` (or repointing `SABAI_LLM_URL`) requires no change to dialog/extract/runtime/tools. ✓

---

## Execution handoff

Plan complete and saved to `plans/2026-06-13-sabai-cpu-pilot-lead-slice.md`. Two execution options:

1. **Subagent‑Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
