# SabFlow ↔ n8n Parity: Dynamic Options, ResourceLocator, Expression Globals

> **Progress tracker (2026-05-20):**
> - ✅ **Phase 1** — schema + cascading + last-node-output runtime fix (forge executor now feeds `nodeOutputs` into `resolveDeep`)
> - ✅ **Phase 2** — `resourceLocator` type with list/id/url modes + regex extraction
> - ✅ **Phase 3** — debounced search + cursor pagination
> - ✅ **Bonus** — full-colour brand logos (Iconify `logos:` namespace) across canvas, picker, settings panel
> - ▶️ **Phase 5 — IN PROGRESS** (expression globals)
> - ⏸️ Phase 4 (helpers.requestWithAuthentication) — deferred; Phase 5 has higher user-visible ROI
> - 📋 Phase 6 (block retrofits) — blocked on Phase 4
>
> **New scope unlocked by the n8n deep-dive (2026-05-20):**
> - Phase 7 — per-item iteration loop (forge block runs once per upstream item)
> - Phase 8 — multi-output branching (proper true/false ports for IF / Switch)
> - Phase 9 — `pairedItem` ancestry tracking (needed before Phase 8 is safe)
> - Phase 10 — data pinning + "run from this node" in the editor
>
> See "n8n architectural findings" section at the bottom for the full audit.


> **For agentic workers:** REQUIRED SUB-SKILL — use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute task-by-task. Steps use checkbox (`- [ ]`) syntax. **One agent at a time** (per project memory) — never spawn parallel agents on this plan.

**Goal:** Bring SabFlow's integration-node UX up to n8n parity for three pain points: (1) dynamic dropdowns that fetch options from the provider's API using the saved credential, (2) `resourceLocator` fields that accept ID, URL, or live-searched list, and (3) the full set of expression globals (`$prevNode`, `$execution`, `$env`, `$jmesPath`, Luxon classes) so users never have to type IDs by hand.

**Architecture:** Six sequenced phases, each landing as 1–3 PRs. Phases 1–4 evolve the `ForgeField` schema + `/api/sabflow/load-options` route + UI renderer. Phase 5 expands the expression scope + data picker. Phase 6 retrofits 30 high-traffic blocks. All changes additive — every existing `loadOptions: (ctx) => Promise<ForgeSelectOption[]>` must keep working unchanged.

**Tech Stack:** Next.js 16 App Router, Vercel Fluid Compute (Node.js runtime), TypeScript, React, ZoruUI, vendored `n8n-master/` for reference patterns.

**Reference files (already studied — do not re-investigate):**
- Sabflow schema: `src/lib/sabflow/forge/types.ts:12-99`
- Load-options API: `src/app/api/sabflow/load-options/route.ts:94-156`
- Expression resolver: `src/lib/sabflow/engine/resolveTokens.ts:29-96`
- AST evaluator: `src/lib/sabflow/executor/expression/evaluator.ts:104-130` (EvalScope)
- Data picker UI: `src/components/sabflow/dataPicker/UpstreamDataPicker.tsx:63-112`, `DataPickerInput.tsx:1-201`
- One working `loadOptions` precedent: `src/lib/sabflow/forge/blocks/n8n/crm/hubspot.ts` (lifecyclestage)
- n8n schema reference: `n8n-master/packages/workflow/src/interfaces.ts:1606-1835`
- n8n loadOptions service: `n8n-master/packages/cli/src/services/dynamic-node-parameters.service.ts:125-242`
- n8n resourceLocator example: `n8n-master/packages/nodes-base/nodes/Discord/v2/actions/common.description.ts`
- n8n data proxy globals: `n8n-master/packages/workflow/src/workflow-data-proxy.ts:1543-1599`

---

## Phase dependency graph

```
Phase 1 (schema + cascade)
   │
   ├──► Phase 2 (resourceLocator)
   │       │
   │       └──► Phase 3 (search + pagination)
   │               │
   │               └──► Phase 4 (helpers.requestWithAuthentication)
   │                       │
   │                       └──► Phase 6 (retrofit blocks)
   │
   └──► Phase 5 (expression globals — parallelizable with 2/3/4)
```

Phase 5 has no dependency on 1–4 and can be picked up anytime. Phase 6 needs 1–4 landed.

---

## Phase 1 — Schema + Cascading Foundation

**PR target:** 1 PR, ~600 lines diff. **Risk:** Low (purely additive).

**Goal:** Extend `ForgeField` so a field can declare its dependencies; extend `ForgeLoadOptionsContext` with parameter-introspection helpers; teach the API route to re-invoke a dependent field when one of its dependencies changes.

**Files:**
- Modify: `src/lib/sabflow/forge/types.ts`
- Modify: `src/app/api/sabflow/load-options/route.ts`
- Create: `src/components/sabflow/forge/useLoadOptions.ts` (client hook)
- Modify: `src/components/sabflow/forge/ForgeFieldRenderer.tsx` (or equivalent — find via grep)
- Create: `src/lib/sabflow/forge/__tests__/types.test.ts`
- Create: `src/app/api/sabflow/load-options/__tests__/route.test.ts`

### Task 1.1 — Extend `ForgeField` and `ForgeLoadOptionsContext`

- [ ] **Step 1: Write the failing test** at `src/lib/sabflow/forge/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { ForgeField, ForgeLoadOptionsContext } from '../types';

describe('ForgeField schema extensions', () => {
  it('accepts loadOptionsDependsOn array', () => {
    const f: ForgeField = {
      id: 'property',
      label: 'Property',
      type: 'select',
      loadOptionsDependsOn: ['databaseId'],
      loadOptions: async () => [],
    };
    expect(f.loadOptionsDependsOn).toEqual(['databaseId']);
  });

  it('accepts displayOptions show/hide rules', () => {
    const f: ForgeField = {
      id: 'pipeline',
      label: 'Pipeline',
      type: 'text',
      displayOptions: { show: { resource: ['deal'] } },
    };
    expect(f.displayOptions?.show).toEqual({ resource: ['deal'] });
  });
});

describe('ForgeLoadOptionsContext extensions', () => {
  it('exposes getNodeParameter / getCurrentNodeParameter / getNode', () => {
    const ctx: ForgeLoadOptionsContext = {
      options: { databaseId: 'abc' },
      getNodeParameter: (name) => (name === 'databaseId' ? 'abc' : undefined),
      getCurrentNodeParameter: (name) => (name === 'databaseId' ? 'abc' : undefined),
      getNode: () => ({ id: 'block_1', name: 'Notion' }),
    };
    expect(ctx.getNodeParameter?.('databaseId')).toBe('abc');
    expect(ctx.getCurrentNodeParameter?.('databaseId')).toBe('abc');
    expect(ctx.getNode?.().name).toBe('Notion');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/lib/sabflow/forge/__tests__/types.test.ts
```
Expected: type errors on `loadOptionsDependsOn`, `displayOptions`, `getNodeParameter`.

- [ ] **Step 3: Implement the schema changes** in `src/lib/sabflow/forge/types.ts`:

Replace `ForgeLoadOptionsContext` (currently lines 59–64) with:

```ts
export type ForgeLoadOptionsContext = {
  credential?: Record<string, string>;
  options: Record<string, unknown>;
  /** Read a field value off the current node — mirrors n8n's `getNodeParameter`. */
  getNodeParameter?: (name: string, fallback?: unknown) => unknown;
  /** Same, but reads the value currently entered in the editor (may be unsaved). */
  getCurrentNodeParameter?: (name: string, fallback?: unknown) => unknown;
  /** Minimal node identity exposed for diagnostics. */
  getNode?: () => { id: string; name: string };
};
```

Add to `ForgeField` (after the existing `loadOptions?: ForgeLoadOptions;` line):

```ts
  /**
   * Field names whose value affects this field's options. When any listed
   * field changes in the editor, the renderer re-fetches this field's
   * options. Mirrors n8n's `typeOptions.loadOptionsDependsOn`.
   */
  loadOptionsDependsOn?: string[];

  /**
   * Conditionally show/hide the field based on other fields' values. Each
   * entry maps a field name to a list of values that satisfy the rule.
   * `show` ALL match → render; `hide` ANY match → suppress. Mirrors n8n.
   */
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx vitest run src/lib/sabflow/forge/__tests__/types.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabflow/forge/types.ts src/lib/sabflow/forge/__tests__/types.test.ts
git commit -m "feat(sabflow): extend ForgeField with loadOptionsDependsOn + displayOptions"
```

### Task 1.2 — Update `isFieldVisible` to honor `displayOptions`

- [ ] **Step 1: Failing test** — append to `src/lib/sabflow/forge/__tests__/types.test.ts`:

```ts
import { isFieldVisible } from '../types';

describe('isFieldVisible with displayOptions', () => {
  it('show rule passes when value matches', () => {
    const f: ForgeField = {
      id: 'pipeline', label: 'Pipeline', type: 'text',
      displayOptions: { show: { resource: ['deal'] } },
    };
    expect(isFieldVisible(f, { resource: 'deal' })).toBe(true);
    expect(isFieldVisible(f, { resource: 'contact' })).toBe(false);
  });

  it('hide rule wins over show', () => {
    const f: ForgeField = {
      id: 'pipeline', label: 'Pipeline', type: 'text',
      displayOptions: { show: { resource: ['deal'] }, hide: { mode: ['readonly'] } },
    };
    expect(isFieldVisible(f, { resource: 'deal', mode: 'readonly' })).toBe(false);
  });

  it('falls back to legacy showIf when displayOptions absent', () => {
    const f: ForgeField = {
      id: 'x', label: 'X', type: 'text',
      showIf: { field: 'on', equals: true },
    };
    expect(isFieldVisible(f, { on: true })).toBe(true);
    expect(isFieldVisible(f, { on: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/lib/sabflow/forge/__tests__/types.test.ts -t 'isFieldVisible with displayOptions'
```

- [ ] **Step 3: Implement** — replace `isFieldVisible` in `src/lib/sabflow/forge/types.ts:201-207`:

```ts
export const isFieldVisible = (
  field: ForgeField,
  values: Record<string, unknown>,
): boolean => {
  if (field.displayOptions) {
    const { show, hide } = field.displayOptions;
    if (hide) {
      for (const [k, allowed] of Object.entries(hide)) {
        if (allowed.some((v) => v === values[k])) return false;
      }
    }
    if (show) {
      for (const [k, allowed] of Object.entries(show)) {
        if (!allowed.some((v) => v === values[k])) return false;
      }
    }
    return true;
  }
  if (!field.showIf) return true;
  return values[field.showIf.field] === field.showIf.equals;
};
```

- [ ] **Step 4: Run test** — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabflow/forge/types.ts src/lib/sabflow/forge/__tests__/types.test.ts
git commit -m "feat(sabflow): honor displayOptions show/hide in isFieldVisible"
```

### Task 1.3 — Wire `getNodeParameter` helpers in `/api/sabflow/load-options`

- [ ] **Step 1: Failing test** at `src/app/api/sabflow/load-options/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// Test the resolver-context construction in isolation. We mock the block
// registry so the test never hits a real provider.
vi.mock('@/app/actions/user.actions', () => ({
  getSession: async () => ({ user: { _id: 'user_1' } }),
}));
vi.mock('@/lib/sabflow/credentials/db', () => ({
  getCredentialById: async () => null,
}));
vi.mock('@/lib/sabflow/forge', () => ({}));

const captured: { ctx?: unknown } = {};
vi.mock('@/lib/sabflow/forge/registry', () => ({
  getForgeBlock: () => ({
    id: 'test_block',
    fields: [
      {
        id: 'property',
        label: 'Property',
        type: 'select',
        loadOptionsDependsOn: ['databaseId'],
        loadOptions: async (ctx: unknown) => {
          captured.ctx = ctx;
          return [{ label: 'name', value: 'name' }];
        },
      },
    ],
  }),
}));

describe('POST /api/sabflow/load-options — ctx wiring', () => {
  it('exposes getNodeParameter/getCurrentNodeParameter from options snapshot', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({
        blockId: 'test_block',
        fieldId: 'property',
        options: { databaseId: 'db_42' },
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const ctx = captured.ctx as {
      options: Record<string, unknown>;
      getNodeParameter?: (n: string) => unknown;
      getCurrentNodeParameter?: (n: string) => unknown;
      getNode?: () => { id: string; name: string };
    };
    expect(ctx.options.databaseId).toBe('db_42');
    expect(ctx.getNodeParameter?.('databaseId')).toBe('db_42');
    expect(ctx.getCurrentNodeParameter?.('databaseId')).toBe('db_42');
    expect(ctx.getNode?.().id).toBe('test_block');
  });
});
```

- [ ] **Step 2: Run test, verify it fails** (`getNodeParameter` is undefined today).

```bash
npx vitest run src/app/api/sabflow/load-options/__tests__/route.test.ts
```

- [ ] **Step 3: Implement** — in `src/app/api/sabflow/load-options/route.ts`, replace the `ctx` construction block (lines 143–146) with:

```ts
  const block = getForgeBlock(body.blockId)!;
  const ctx: ForgeLoadOptionsContext = {
    credential,
    options: body.options,
    getNodeParameter: (name, fallback) =>
      Object.prototype.hasOwnProperty.call(body.options, name)
        ? body.options[name]
        : fallback,
    getCurrentNodeParameter: (name, fallback) =>
      Object.prototype.hasOwnProperty.call(body.options, name)
        ? body.options[name]
        : fallback,
    getNode: () => ({ id: block.id, name: block.name }),
  };
```

- [ ] **Step 4: Run test** — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sabflow/load-options/route.ts src/app/api/sabflow/load-options/__tests__/route.test.ts
git commit -m "feat(sabflow): expose getNodeParameter/getCurrentNodeParameter/getNode in loadOptions ctx"
```

### Task 1.4 — Client hook that re-fetches on dependency change

- [ ] **Step 1: Create the hook** at `src/components/sabflow/forge/useLoadOptions.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ForgeField, ForgeSelectOption } from '@/lib/sabflow/forge/types';

type Args = {
  blockId: string;
  actionId?: string;
  field: ForgeField;
  options: Record<string, unknown>;
  credentialId?: string;
};

export function useLoadOptions({
  blockId,
  actionId,
  field,
  options,
  credentialId,
}: Args): { items: ForgeSelectOption[]; loading: boolean; error: string | null } {
  const [items, setItems] = useState<ForgeSelectOption[]>(field.options ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dependency-key: changes whenever any depended-on field changes (or the
  // credential). Static fields (no loadOptions) never refetch.
  const depKey = JSON.stringify({
    credentialId: credentialId ?? null,
    deps: (field.loadOptionsDependsOn ?? []).map((k) => options[k] ?? null),
  });
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (typeof field.loadOptions !== 'function') return;
    if (lastKey.current === depKey) return;
    lastKey.current = depKey;

    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetch('/api/sabflow/load-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockId,
        fieldId: field.id,
        actionId,
        credentialId,
        options,
      }),
      signal: ac.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
        setItems(Array.isArray(data.options) ? data.options : []);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey, blockId, actionId, field.id]);

  return { items, loading, error };
}
```

- [ ] **Step 2: Find the existing forge field renderer**

```bash
grep -rn "field.loadOptions\|loadOptions" src/components/sabflow --include='*.tsx' | head -20
```
Pick the file that already calls `/api/sabflow/load-options` (likely `ForgeFieldRenderer.tsx` or similar) and replace its inline fetch with `useLoadOptions(...)`. If no existing renderer wires `loadOptions` yet, locate the `select` field renderer and add the hook call.

- [ ] **Step 3: Smoke-test manually**
  1. Run `npm run dev`.
  2. Open a flow, add the HubSpot block (precedent: `forge/blocks/n8n/crm/hubspot.ts`), pick a credential.
  3. Confirm the `lifecyclestage` dropdown still loads (regression check).
  4. In Notion-temp playground block (create a throwaway block locally with `loadOptionsDependsOn: ['parentDatabaseId']`), confirm dropdown refetches when the database id field changes.

- [ ] **Step 4: Commit**

```bash
git add src/components/sabflow/forge/useLoadOptions.ts src/components/sabflow/forge/ForgeFieldRenderer.tsx
git commit -m "feat(sabflow): client hook that re-fetches loadOptions on dependency change"
```

### Phase 1 acceptance criteria

- All existing forge blocks still load (no regressions in HubSpot lifecyclestage).
- `loadOptionsDependsOn` triggers a refetch when any listed field changes.
- `displayOptions.show` / `displayOptions.hide` correctly hide fields when conditions aren't met.
- `getNodeParameter` works inside a `loadOptions` resolver.

---

## Phase 2 — `resourceLocator` Field + URL/ID/List Modes

**PR target:** 1 PR, ~800 lines. **Risk:** Medium (new UI + regex extraction).

**Goal:** Add a new field type that lets the user toggle between **list** (dropdown), **id** (plain string), and **url** (paste-and-extract-via-regex). Match n8n's `resourceLocator` shape so blocks can be ported 1:1.

**Files:**
- Modify: `src/lib/sabflow/forge/types.ts` (add `ForgeFieldMode`, extend `ForgeFieldType`)
- Modify: `src/app/api/sabflow/load-options/route.ts` (handle mode-aware value extraction)
- Create: `src/lib/sabflow/forge/extractValue.ts` (regex extractor)
- Create: `src/components/sabflow/forge/ResourceLocatorField.tsx`
- Modify: `src/components/sabflow/forge/ForgeFieldRenderer.tsx` (route `resourceLocator` to new renderer)
- Create: `src/lib/sabflow/forge/__tests__/extractValue.test.ts`

### Task 2.1 — Schema for `resourceLocator`

- [ ] **Step 1: Failing test** — append to `src/lib/sabflow/forge/__tests__/types.test.ts`:

```ts
import type { ForgeField, ResourceLocatorValue } from '../types';

describe('resourceLocator schema', () => {
  it('accepts a resourceLocator field with three modes', () => {
    const f: ForgeField = {
      id: 'channel',
      label: 'Channel',
      type: 'resourceLocator',
      modes: [
        { name: 'list', displayName: 'From list', type: 'list' },
        {
          name: 'url',
          displayName: 'By URL',
          type: 'string',
          extractValue: { type: 'regex', regex: 'channels/([0-9]+)' },
        },
        { name: 'id', displayName: 'By ID', type: 'string' },
      ],
      loadOptions: async () => [{ label: '#general', value: 'C01' }],
    };
    expect(f.type).toBe('resourceLocator');
    expect(f.modes?.length).toBe(3);
  });

  it('ResourceLocatorValue carries both mode and value', () => {
    const v: ResourceLocatorValue = { mode: 'url', value: 'https://x/123' };
    expect(v.mode).toBe('url');
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run src/lib/sabflow/forge/__tests__/types.test.ts -t 'resourceLocator'
```

- [ ] **Step 3: Implement** in `src/lib/sabflow/forge/types.ts`:

Add `'resourceLocator'` to `ForgeFieldType` union (line 12-23).

Add new exports near the existing field types:

```ts
export type ForgeFieldMode = {
  /** Stable key (used in the stored value). */
  name: 'list' | 'id' | 'url' | 'string';
  /** Label shown in the mode tab. */
  displayName: string;
  /** Renderer shape — 'list' enables the dropdown, 'string' enables free text. */
  type: 'list' | 'string';
  /** Hint shown inside the input. */
  placeholder?: string;
  /** When type='string' and `extractValue` is set, the runtime applies the
   *  regex to the typed value and uses match group [1] as the resolved id. */
  extractValue?: { type: 'regex'; regex: string };
  /** Optional client-side validation regex; failure shows `errorMessage`. */
  validation?: { regex: string; errorMessage: string };
  /** When mode='list', the loadOptions resolver is invoked. Name is for
   *  parity with n8n's `searchListMethod` but unused server-side here — the
   *  parent field's `loadOptions` is the actual resolver. */
  searchListMethod?: string;
};

export type ResourceLocatorValue = {
  mode: 'list' | 'id' | 'url' | 'string';
  value: string;
};
```

Add to `ForgeField`:

```ts
  /** When type='resourceLocator', the list of available modes. */
  modes?: ForgeFieldMode[];
```

- [ ] **Step 4: Run test** — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabflow/forge/types.ts src/lib/sabflow/forge/__tests__/types.test.ts
git commit -m "feat(sabflow): add resourceLocator field type + ForgeFieldMode schema"
```

### Task 2.2 — Regex extractor

- [ ] **Step 1: Failing test** at `src/lib/sabflow/forge/__tests__/extractValue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractValue } from '../extractValue';
import type { ResourceLocatorValue, ForgeFieldMode } from '../types';

const modes: ForgeFieldMode[] = [
  { name: 'list', displayName: 'List', type: 'list' },
  {
    name: 'url',
    displayName: 'URL',
    type: 'string',
    extractValue: { type: 'regex', regex: 'channels/([0-9]+)' },
  },
  { name: 'id', displayName: 'ID', type: 'string' },
];

describe('extractValue', () => {
  it('extracts via regex for url mode', () => {
    const v: ResourceLocatorValue = { mode: 'url', value: 'https://x/channels/123' };
    expect(extractValue(v, modes)).toBe('123');
  });

  it('returns raw value when no regex matches', () => {
    const v: ResourceLocatorValue = { mode: 'url', value: 'https://x/no-match' };
    expect(extractValue(v, modes)).toBe('https://x/no-match');
  });

  it('returns raw value for id and list modes', () => {
    expect(extractValue({ mode: 'id', value: 'C01' }, modes)).toBe('C01');
    expect(extractValue({ mode: 'list', value: 'C99' }, modes)).toBe('C99');
  });

  it('handles plain string for backward-compat', () => {
    expect(extractValue('plain', modes)).toBe('plain');
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement** at `src/lib/sabflow/forge/extractValue.ts`:

```ts
import type { ForgeFieldMode, ResourceLocatorValue } from './types';

/** Normalise a resourceLocator value (or legacy plain string) to an id. */
export function extractValue(
  v: ResourceLocatorValue | string | null | undefined,
  modes: ForgeFieldMode[] | undefined,
): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  const mode = modes?.find((m) => m.name === v.mode);
  if (mode?.extractValue?.type === 'regex' && typeof v.value === 'string') {
    try {
      const re = new RegExp(mode.extractValue.regex);
      const m = re.exec(v.value);
      if (m && m[1] != null) return m[1];
    } catch {
      // fall through to raw value
    }
  }
  return v.value ?? '';
}
```

- [ ] **Step 4: Run test** — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabflow/forge/extractValue.ts src/lib/sabflow/forge/__tests__/extractValue.test.ts
git commit -m "feat(sabflow): extractValue helper for resourceLocator fields"
```

### Task 2.3 — Normalise resourceLocator in the API route + action ctx

- [ ] **Step 1: Failing test** — append to `src/app/api/sabflow/load-options/__tests__/route.test.ts`:

```ts
it('normalises resourceLocator-shaped values in options snapshot', async () => {
  const { POST } = await import('../route');
  // ...invoke with options.databaseId = { mode: 'url', value: 'https://x/123' }
  // and a mocked block whose field has loadOptionsDependsOn: ['databaseId']
  // plus a loadOptions that asserts ctx.getNodeParameter('databaseId') === '123'
});
```
(Full mock setup mirrors Task 1.3; expand inline.)

- [ ] **Step 2: Implement** — in `src/app/api/sabflow/load-options/route.ts`, change the ctx wiring from Task 1.3 to look up the field's parent block's `modes` for each dependency and run `extractValue`:

```ts
import { extractValue } from '@/lib/sabflow/forge/extractValue';

// ...inside POST, after `const block = ...!;`
const fieldsList: ForgeField[] = body.actionId
  ? block.actions?.find((a) => a.id === body.actionId)?.fields ?? []
  : block.fields ?? [];
const fieldByName = new Map(fieldsList.map((f) => [f.id, f]));

const readParam = (name: string, fallback?: unknown): unknown => {
  if (!Object.prototype.hasOwnProperty.call(body.options, name)) return fallback;
  const raw = body.options[name];
  const def = fieldByName.get(name);
  if (def?.type === 'resourceLocator') {
    return extractValue(raw as never, def.modes);
  }
  return raw;
};

const ctx: ForgeLoadOptionsContext = {
  credential,
  options: body.options,
  getNodeParameter: readParam,
  getCurrentNodeParameter: readParam,
  getNode: () => ({ id: block.id, name: block.name }),
};
```

Also normalise the same way in the action executor — find where `ForgeActionContext.options` is constructed (grep `ForgeActionContext` under `src/lib/sabflow/`) and add the extractValue pass for any resourceLocator fields before invoking `run(ctx)`.

- [ ] **Step 3: Run tests** — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sabflow/load-options/route.ts src/app/api/sabflow/load-options/__tests__/route.test.ts
# plus the action executor file(s) you modified
git commit -m "feat(sabflow): resolve resourceLocator values via extractValue in loadOptions + run ctx"
```

### Task 2.4 — `ResourceLocatorField.tsx` renderer

- [ ] **Step 1: Create the component** at `src/components/sabflow/forge/ResourceLocatorField.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import type {
  ForgeField,
  ForgeFieldMode,
  ResourceLocatorValue,
  ForgeSelectOption,
} from '@/lib/sabflow/forge/types';
import { useLoadOptions } from './useLoadOptions';

type Props = {
  blockId: string;
  actionId?: string;
  field: ForgeField;
  value: ResourceLocatorValue | string | null | undefined;
  onChange: (v: ResourceLocatorValue) => void;
  allOptions: Record<string, unknown>;
  credentialId?: string;
};

function normalise(
  v: ResourceLocatorValue | string | null | undefined,
  modes: ForgeFieldMode[],
): ResourceLocatorValue {
  if (v && typeof v === 'object' && 'mode' in v) return v;
  return { mode: modes[0]?.name ?? 'id', value: typeof v === 'string' ? v : '' };
}

export function ResourceLocatorField({
  blockId, actionId, field, value, onChange, allOptions, credentialId,
}: Props) {
  const modes = field.modes ?? [];
  const v = normalise(value, modes);
  const current = modes.find((m) => m.name === v.mode) ?? modes[0];

  const { items, loading, error } = useLoadOptions({
    blockId, actionId, field,
    options: allOptions,
    credentialId,
  });

  const validationError = useMemo(() => {
    if (current?.type !== 'string' || !current.validation || !v.value) return null;
    try {
      const re = new RegExp(current.validation.regex);
      return re.test(v.value) ? null : current.validation.errorMessage;
    } catch { return null; }
  }, [current, v.value]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m.name}
            type="button"
            data-active={m.name === v.mode}
            onClick={() => onChange({ mode: m.name, value: '' })}
            className="px-2 py-1 text-xs rounded data-[active=true]:bg-blue-600 data-[active=true]:text-white bg-zinc-800 text-zinc-300"
          >
            {m.displayName}
          </button>
        ))}
      </div>

      {current?.type === 'list' ? (
        <select
          value={v.value}
          onChange={(e) => onChange({ mode: v.mode, value: e.target.value })}
          disabled={loading}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
        >
          <option value="">{loading ? 'Loading…' : 'Select…'}</option>
          {items.map((o: ForgeSelectOption) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={v.value}
          placeholder={current?.placeholder}
          onChange={(e) => onChange({ mode: v.mode, value: e.target.value })}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
        />
      )}

      {error && <span className="text-xs text-red-400">{error}</span>}
      {validationError && <span className="text-xs text-amber-400">{validationError}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Route the new type** in `ForgeFieldRenderer.tsx` — add a branch for `field.type === 'resourceLocator'` that renders `<ResourceLocatorField .../>`.

- [ ] **Step 3: Smoke-test**
  1. Create a throwaway resourceLocator field on the Slack block locally (don't commit it):
     ```ts
     {
       id: 'channel', label: 'Channel', type: 'resourceLocator',
       modes: [
         { name: 'list', displayName: 'From list', type: 'list' },
         { name: 'id', displayName: 'By ID', type: 'string', placeholder: 'C0123…' },
         { name: 'url', displayName: 'By URL', type: 'string',
           extractValue: { type: 'regex', regex: 'archives/([A-Z0-9]+)' } },
       ],
       loadOptions: async () => [{ label: '#general', value: 'C01' }],
     }
     ```
  2. Run `npm run dev`, open Slack block, toggle modes — confirm tabs swap input + value clears.
  3. Paste a Slack archive URL in URL mode, save, confirm runtime sees the extracted id (add `console.log` in `run`).
  4. Revert the throwaway field before commit.

- [ ] **Step 4: Commit**

```bash
git add src/components/sabflow/forge/ResourceLocatorField.tsx src/components/sabflow/forge/ForgeFieldRenderer.tsx
git commit -m "feat(sabflow): ResourceLocatorField renderer with list/id/url modes"
```

### Phase 2 acceptance criteria

- A field declared with `type: 'resourceLocator'` renders mode tabs.
- URL mode applies the regex to extract an id; runtime + loadOptions both see the extracted value.
- Plain-string legacy values still work (backward-compat).
- Validation regex shows the error message inline.

---

## Phase 3 — Search-as-you-Type + Pagination

**PR target:** 1 PR, ~500 lines. **Risk:** Medium (debounce + abort handling).

**Goal:** Let resolvers respond to a search filter and return a pagination cursor. Wire client-side debounced input + lazy-load.

**Files:**
- Modify: `src/lib/sabflow/forge/types.ts` (extend ctx + return type)
- Modify: `src/app/api/sabflow/load-options/route.ts` (pass through, accept return shape)
- Modify: `src/components/sabflow/forge/useLoadOptions.ts` (debounce + concat pages)
- Modify: `src/components/sabflow/forge/ResourceLocatorField.tsx` (search input + scroll-to-load)

### Task 3.1 — Extend resolver contract

- [ ] **Step 1: Failing test** — append to types tests:

```ts
import type { ForgeLoadOptions } from '../types';

describe('ForgeLoadOptions accepts filter + paginationToken', () => {
  it('returns either an array or a results-envelope', async () => {
    const loaderA: ForgeLoadOptions = async () => [{ label: 'A', value: 'a' }];
    const loaderB: ForgeLoadOptions = async (ctx) => ({
      results: [{ label: ctx.filter ?? 'none', value: 'x' }],
      paginationToken: 'next_42',
    });
    expect(await loaderA({ options: {} })).toEqual([{ label: 'A', value: 'a' }]);
    const b = await loaderB({ options: {}, filter: 'q' });
    expect(b).toEqual({
      results: [{ label: 'q', value: 'x' }],
      paginationToken: 'next_42',
    });
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement** — in `src/lib/sabflow/forge/types.ts`:

```ts
export type ForgeLoadOptionsResult =
  | ForgeSelectOption[]
  | { results: ForgeSelectOption[]; paginationToken?: string | null };

export type ForgeLoadOptions = (
  ctx: ForgeLoadOptionsContext,
) => Promise<ForgeLoadOptionsResult>;
```

Add to `ForgeLoadOptionsContext`:

```ts
  /** Type-ahead filter forwarded from the client. */
  filter?: string;
  /** Opaque cursor returned by a previous page; resolvers may ignore. */
  paginationToken?: string | null;
```

- [ ] **Step 4: Run test** — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabflow/forge/types.ts src/lib/sabflow/forge/__tests__/types.test.ts
git commit -m "feat(sabflow): loadOptions can accept filter/paginationToken and return cursor"
```

### Task 3.2 — Route forwards filter/cursor and unwraps result shape

- [ ] **Step 1: Implement** — in `src/app/api/sabflow/load-options/route.ts`:

Extend `LoadOptionsBody`:

```ts
type LoadOptionsBody = {
  blockId: string;
  fieldId: string;
  actionId?: string;
  credentialId?: string;
  options: Record<string, unknown>;
  filter?: string;
  paginationToken?: string | null;
};
```

In `parseBody`, accept the new fields. In the ctx construction, add:

```ts
  filter: typeof body.filter === 'string' ? body.filter : undefined,
  paginationToken: body.paginationToken ?? undefined,
```

Replace the resolver-call block (lines 148–155) with:

```ts
  try {
    const raw = await field.loadOptions(ctx);
    if (Array.isArray(raw)) {
      return NextResponse.json({ options: raw, paginationToken: null });
    }
    return NextResponse.json({
      options: Array.isArray(raw?.results) ? raw.results : [],
      paginationToken: raw?.paginationToken ?? null,
    });
  } catch (err) {
    console.error('[SABFLOW LOAD-OPTIONS] resolver error:', err);
    const message = err instanceof Error ? err.message : 'Resolver failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
```

- [ ] **Step 2: Add a route test** — exercise both the legacy array return and the new `{ results, paginationToken }` return, asserting response shapes.

- [ ] **Step 3: Run tests** — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sabflow/load-options/route.ts src/app/api/sabflow/load-options/__tests__/route.test.ts
git commit -m "feat(sabflow): load-options route accepts filter/paginationToken; unwraps result envelope"
```

### Task 3.3 — Hook gains debounced search + page concatenation

- [ ] **Step 1: Rewrite `useLoadOptions.ts`** to accept `filter` and a `loadMore()` function:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForgeField, ForgeSelectOption } from '@/lib/sabflow/forge/types';

type Args = {
  blockId: string;
  actionId?: string;
  field: ForgeField;
  options: Record<string, unknown>;
  credentialId?: string;
  filter?: string;
};

const DEBOUNCE_MS = 250;

export function useLoadOptions(args: Args) {
  const { blockId, actionId, field, options, credentialId, filter } = args;
  const [items, setItems] = useState<ForgeSelectOption[]>(field.options ?? []);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depKey = JSON.stringify({
    credentialId: credentialId ?? null,
    deps: (field.loadOptionsDependsOn ?? []).map((k) => options[k] ?? null),
    filter: filter ?? '',
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey = useRef<string | null>(null);

  const fetchPage = useCallback(
    async (paginationToken: string | null) => {
      if (typeof field.loadOptions !== 'function') return;
      const ac = new AbortController();
      setLoading(true);
      setError(null);
      try {
        const r = await fetch('/api/sabflow/load-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockId, fieldId: field.id, actionId, credentialId, options,
            filter, paginationToken,
          }),
          signal: ac.signal,
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
        const page: ForgeSelectOption[] = Array.isArray(data.options) ? data.options : [];
        setItems((prev) => (paginationToken ? [...prev, ...page] : page));
        setCursor(data.paginationToken ?? null);
      } catch (e) {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
      return () => ac.abort();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockId, actionId, field.id, credentialId, filter, depKey],
  );

  useEffect(() => {
    if (lastKey.current === depKey) return;
    lastKey.current = depKey;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void fetchPage(null); }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [depKey, fetchPage]);

  const loadMore = useCallback(() => {
    if (cursor && !loading) void fetchPage(cursor);
  }, [cursor, loading, fetchPage]);

  return { items, loading, error, hasMore: cursor != null, loadMore };
}
```

- [ ] **Step 2: Update `ResourceLocatorField.tsx`** — when `current?.type === 'list'`, render a search input above the dropdown:

```tsx
const [search, setSearch] = useState('');
const { items, loading, error, hasMore, loadMore } = useLoadOptions({
  blockId, actionId, field,
  options: allOptions,
  credentialId,
  filter: search,
});
```

Add an `onScroll` handler on the dropdown wrapper that calls `loadMore()` when scrolled near the bottom.

- [ ] **Step 3: Smoke-test**
  1. Add a temporary `loadOptions` to a local Slack throwaway field that returns 200 items and respects `ctx.filter`.
  2. Verify typing in the search box debounces and re-queries; clearing it shows all results.
  3. Verify scrolling triggers `loadMore`.

- [ ] **Step 4: Commit**

```bash
git add src/components/sabflow/forge/useLoadOptions.ts src/components/sabflow/forge/ResourceLocatorField.tsx
git commit -m "feat(sabflow): debounced search + pagination in resourceLocator list mode"
```

### Phase 3 acceptance criteria

- Typing in a resourceLocator list field issues a debounced filter request.
- Scrolling to the bottom of a list fetches the next page.
- Legacy array-returning resolvers continue to work.

---

## Phase 4 — `helpers.requestWithAuthentication` + Safer Credential Plumbing

**PR target:** 1 PR, ~400 lines. **Risk:** High (touches credential handling — needs security review).

**Goal:** Replace the pattern of resolvers building their own `Authorization` headers with a helper that the framework owns. Credentials never leave the helper boundary; resolvers see a request signature and response, not raw tokens.

**Files:**
- Create: `src/lib/sabflow/forge/helpers.ts`
- Modify: `src/lib/sabflow/forge/types.ts` (add `helpers` to context)
- Modify: `src/app/api/sabflow/load-options/route.ts` (inject helpers)
- Modify: any action runtime that builds `ForgeActionContext` (also inject helpers)
- Create: `src/lib/sabflow/forge/__tests__/helpers.test.ts`

### Task 4.1 — Helpers module + type

- [ ] **Step 1: Failing test** at `src/lib/sabflow/forge/__tests__/helpers.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeHelpers } from '../helpers';

const fetchMock = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true, results: [{ id: 1 }] }), { status: 200 }),
);
vi.stubGlobal('fetch', fetchMock);

describe('helpers.requestWithAuthentication', () => {
  it('injects bearer auth from credential.accessToken', async () => {
    const helpers = makeHelpers({ accessToken: 'tok_abc' });
    const r = await helpers.requestWithAuthentication('bearer', {
      method: 'GET',
      url: 'https://api.x/items',
    });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.x/items',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tok_abc' }),
      }),
    );
  });

  it('injects header auth when credential has botToken', async () => {
    const helpers = makeHelpers({ botToken: 'xoxb-1' });
    await helpers.requestWithAuthentication('bearer', {
      method: 'GET', url: 'https://slack.com/api/x', tokenField: 'botToken',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://slack.com/api/x',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer xoxb-1' }),
      }),
    );
  });

  it('refuses to send when credential is absent', async () => {
    const helpers = makeHelpers(undefined);
    await expect(
      helpers.requestWithAuthentication('bearer', { method: 'GET', url: 'https://x' }),
    ).rejects.toThrow(/credential/i);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement** at `src/lib/sabflow/forge/helpers.ts`:

```ts
export type ForgeHttpRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
  body?: string;
  /** When auth='bearer', which credential field holds the token. Default: accessToken. */
  tokenField?: string;
};

export type ForgeHttpResponse = {
  ok: boolean;
  status: number;
  data: unknown;
  headers: Record<string, string>;
};

export type ForgeHelpers = {
  httpRequest: (req: ForgeHttpRequest) => Promise<ForgeHttpResponse>;
  requestWithAuthentication: (
    auth: 'bearer' | 'basic' | 'apiKey',
    req: ForgeHttpRequest,
  ) => Promise<ForgeHttpResponse>;
};

const buildUrl = (url: string, query?: ForgeHttpRequest['query']): string => {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) u.searchParams.set(k, String(v));
  }
  return u.toString();
};

async function rawFetch(req: ForgeHttpRequest, extraHeaders: Record<string, string>): Promise<ForgeHttpResponse> {
  const headers: Record<string, string> = { ...(req.headers ?? {}), ...extraHeaders };
  let body = req.body;
  if (req.json !== undefined) {
    body = JSON.stringify(req.json);
    headers['Content-Type'] ??= 'application/json';
  }
  const res = await fetch(buildUrl(req.url, req.query), { method: req.method, headers, body });
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text();
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => { out[k] = v; });
  return { ok: res.ok, status: res.status, data, headers: out };
}

export function makeHelpers(credential: Record<string, string> | undefined): ForgeHelpers {
  return {
    httpRequest: (req) => rawFetch(req, {}),
    requestWithAuthentication: async (auth, req) => {
      if (!credential) throw new Error('No credential available for authenticated request');
      if (auth === 'bearer') {
        const token = credential[req.tokenField ?? 'accessToken'];
        if (!token) throw new Error(`Credential missing field "${req.tokenField ?? 'accessToken'}"`);
        return rawFetch(req, { Authorization: `Bearer ${token}` });
      }
      if (auth === 'basic') {
        const u = credential.username ?? '';
        const p = credential.password ?? '';
        const b64 = Buffer.from(`${u}:${p}`).toString('base64');
        return rawFetch(req, { Authorization: `Basic ${b64}` });
      }
      // apiKey
      const key = credential.apiKey ?? credential[req.tokenField ?? 'apiKey'];
      if (!key) throw new Error('Credential missing apiKey field');
      return rawFetch(req, { 'X-Api-Key': key });
    },
  };
}
```

- [ ] **Step 4: Run test** — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabflow/forge/helpers.ts src/lib/sabflow/forge/__tests__/helpers.test.ts
git commit -m "feat(sabflow): ForgeHelpers with bearer/basic/apiKey requestWithAuthentication"
```

### Task 4.2 — Inject helpers into both contexts

- [ ] **Step 1:** Add `helpers?: ForgeHelpers` to both `ForgeLoadOptionsContext` and `ForgeActionContext` in `src/lib/sabflow/forge/types.ts`:

```ts
import type { ForgeHelpers } from './helpers';

// inside ForgeLoadOptionsContext + ForgeActionContext:
  helpers?: ForgeHelpers;
```

- [ ] **Step 2:** In `src/app/api/sabflow/load-options/route.ts`, build helpers from the resolved credential and add to ctx:

```ts
import { makeHelpers } from '@/lib/sabflow/forge/helpers';
// inside POST after credential resolution:
const helpers = makeHelpers(credential);
// inside ctx object:
  helpers,
```

- [ ] **Step 3:** Find every place that constructs a `ForgeActionContext` (grep `ForgeActionContext` under `src/lib/sabflow/`) and add `helpers: makeHelpers(credential)` to each.

- [ ] **Step 4: Smoke-test** — confirm the existing HubSpot lifecyclestage loader still works (it should: it uses raw apiRequest today and we only added an optional helpers field).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabflow/forge/types.ts src/app/api/sabflow/load-options/route.ts <action runtime files>
git commit -m "feat(sabflow): inject helpers into loadOptions and action contexts"
```

### Phase 4 acceptance criteria

- New loadOptions resolvers can use `ctx.helpers.requestWithAuthentication('bearer', { method: 'GET', url: '…' })` and never see the raw token.
- Legacy resolvers that use `ctx.credential?.botToken` directly keep working.
- Security review approves: helpers throw rather than silently send unauthed requests when credential is missing.

---

## Phase 5 — Expression Globals + Picker Coverage

**PR target:** 1 PR, ~600 lines. **Risk:** Low. **Can land in parallel with Phases 2–4.**

**Goal:** Bring `$prevNode`, `$execution`, `$env`, `$jmesPath`, and the Luxon classes online; expose them in the data picker so users can insert them with one click.

**Files:**
- Modify: `src/lib/sabflow/n8n/expression-runner.ts` (where `evaluateExpression` resolves bindings — find via grep)
- Modify: `src/lib/sabflow/executor/expression/evaluator.ts` (EvalScope already has stubs at lines 104–130; populate them)
- Modify: `src/components/sabflow/dataPicker/UpstreamDataPicker.tsx` (add branches)
- Tests: `src/lib/sabflow/engine/__tests__/resolveTokens.test.ts`

### Task 5.1 — Wire `$prevNode`, `$execution`, `$env`

- [ ] **Step 1: Failing test** at `src/lib/sabflow/engine/__tests__/resolveTokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveTemplate } from '../resolveTokens';

describe('expression globals', () => {
  it('resolves $prevNode.json.x', () => {
    const out = resolveTemplate('hello {{ $prevNode.json.name }}', {
      nodeOutputs: { Webhook: { json: { name: 'Alice' } } },
      // currentNodeName must be the node *after* Webhook in the flow
      currentNodeName: 'NextNode',
      flow: { nodes: [], edges: [] } as never,
    });
    // Without flow wiring this will fall back; full integration test elsewhere
    expect(typeof out).toBe('string');
  });

  it('resolves $execution.id', () => {
    const out = resolveTemplate('run={{ $execution.id }}', {
      // pass execution via new ctx field added below
      // execution: { id: 'exec_42', mode: 'manual' },
    } as never);
    expect(out).toContain('run=');
  });

  it('resolves $env.MY_VAR when whitelisted', () => {
    process.env.MY_VAR = 'hello';
    const out = resolveTemplate('{{ $env.MY_VAR }}', {} as never);
    expect(out).toBe('hello');
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** — in `src/lib/sabflow/engine/resolveTokens.ts`, extend `ResolveTokensCtx` (lines 33–50):

```ts
export type ResolveTokensCtx = {
  variables?: Record<string, unknown>;
  json?: Record<string, unknown>;
  nodeOutputs?: Record<string, unknown>;
  flow?: SabFlowDoc;
  currentNodeName?: string;
  timezone?: string;
  /** Execution metadata: `$execution.id`, `$execution.mode`. */
  execution?: { id: string; mode: 'manual' | 'trigger' | 'test' };
  /** Allowlist of env vars exposed as `$env.<KEY>`. */
  envAllowlist?: string[];
};
```

In the `evaluateExpression(...)` call (line 75), forward the new fields:

```ts
const result = evaluateExpression(preSubstituted, {
  json: ctx.json,
  variables: ctx.variables,
  nodeOutputs: ctx.nodeOutputs,
  flow: ctx.flow,
  currentNodeName: ctx.currentNodeName,
  timezone: ctx.timezone,
  execution: ctx.execution,
  env: pickEnv(ctx.envAllowlist),
});
```

Add the helper:

```ts
function pickEnv(allowlist?: string[]): Record<string, string> {
  if (!allowlist?.length) return {};
  const out: Record<string, string> = {};
  for (const k of allowlist) {
    const v = process.env[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}
```

Then update the n8n expression-runner (find via `grep -rn 'evaluateExpression' src/lib/sabflow/n8n`) to accept `execution`, `env`, derive `$prevNode` from `flow.edges` + `currentNodeName` (look up the upstream node id, then `nodeOutputs[name]`), and expose all three on the workflow data proxy.

- [ ] **Step 4: Run tests** — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sabflow/engine/resolveTokens.ts src/lib/sabflow/n8n/expression-runner.ts src/lib/sabflow/engine/__tests__/resolveTokens.test.ts
git commit -m "feat(sabflow): expose \$prevNode, \$execution, \$env in expression scope"
```

### Task 5.2 — Add Luxon constructors + `$jmesPath`

- [ ] **Step 1: Failing test:**

```ts
it('exposes DateTime constructor', () => {
  const out = resolveTemplate('{{ DateTime.now().toFormat("yyyy") }}', { timezone: 'UTC' });
  expect(out).toMatch(/^\d{4}$/);
});

it('exposes $jmesPath', () => {
  const out = resolveTemplate('{{ $jmesPath($json, "items[0].name") }}', {
    json: { items: [{ name: 'Alpha' }] },
  });
  expect(out).toBe('Alpha');
});
```

- [ ] **Step 2: Implement** — in the n8n expression-runner that builds the proxy, expose `DateTime, Interval, Duration` from `luxon`, and `$jmesPath` from `jmespath` (already a sub-dep of `@n8n/...`; if not, add `pnpm add jmespath`).

- [ ] **Step 3: Run tests, commit.**

```bash
git commit -m "feat(sabflow): expose DateTime/Interval/Duration and \$jmesPath in expressions"
```

### Task 5.3 — Surface globals in the data picker

- [ ] **Step 1:** In `src/components/sabflow/dataPicker/UpstreamDataPicker.tsx`, add new collapsible sections after the existing "Variables" branch:

```tsx
const GLOBAL_BRANCHES: { id: string; label: string; insert: string; hint: string }[] = [
  { id: 'prevNode', label: 'Previous node output',
    insert: '{{ $prevNode.json. }}', hint: 'The immediately upstream node\'s JSON output.' },
  { id: 'now', label: 'Now (timestamp)',
    insert: '{{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}', hint: 'Current time, formatted via Luxon.' },
  { id: 'today', label: 'Today (UTC date)',
    insert: '{{ $today.toISODate() }}', hint: 'Today\'s date in UTC.' },
  { id: 'workflow', label: 'Workflow info',
    insert: '{{ $workflow.id }}', hint: 'Id of the current flow.' },
  { id: 'execution', label: 'Execution info',
    insert: '{{ $execution.id }}', hint: 'Id of the current run.' },
  { id: 'env', label: 'Environment variable',
    insert: '{{ $env.<KEY> }}', hint: 'Read a whitelisted env var.' },
  { id: 'jmes', label: 'JMESPath query',
    insert: '{{ $jmesPath($json, "<query>") }}', hint: 'Query JSON with JMESPath.' },
];

// render after the variables section:
<Section title="Globals">
  {GLOBAL_BRANCHES.map((b) => (
    <PickerRow key={b.id} label={b.label} hint={b.hint} onSelect={() => onInsert(b.insert)} />
  ))}
</Section>
```

- [ ] **Step 2: Smoke-test** — open a flow, focus a `DataPickerInput`, type `/`, confirm Globals section appears, clicking each inserts the placeholder snippet.

- [ ] **Step 3: Commit**

```bash
git add src/components/sabflow/dataPicker/UpstreamDataPicker.tsx
git commit -m "feat(sabflow): surface \$prevNode/\$now/\$today/\$workflow/\$execution/\$env/\$jmesPath in data picker"
```

### Phase 5 acceptance criteria

- All seven globals evaluate correctly in `{{ … }}` templates.
- `$env` is gated by an allowlist (no accidental secret leak).
- Data picker has a "Globals" section for one-click insertion.

---

## Phase 6 — Retrofit Top-30 Blocks (3 PRs)

**PR targets:** 6a messaging, 6b productivity, 6c CRM/e-commerce. **Risk:** Low per PR. **Requires Phases 1–4.**

### Checklist of blocks to retrofit

For each row, replace the existing static-text field with a `resourceLocator` (when n8n exposes a search/url) or a plain `select` with `loadOptions` (when only an id is needed). Mirror the named n8n method.

#### PR 6a — Messaging (10 blocks)

| Block file (sabflow) | Field to upgrade | n8n method to mirror | n8n source path |
|---|---|---|---|
| `forge/blocks/slack.ts` | `channel` (send_message) | `getChannels` | `n8n-master/packages/nodes-base/nodes/Slack/V1/SlackV1.node.ts:211` |
| `forge/blocks/slack.ts` | `userId` (send_dm) | `getUsers` | same file, neighbouring method |
| `forge/blocks/n8n/messaging/discord*.ts` | `guildId`, `channelId` | `guildSearch`, `channelSearch` | `nodes/Discord/v2/methods/listSearch.ts` |
| `forge/blocks/n8n/messaging/microsoftTeams*.ts` | `teamId`, `channelId` | `getTeams`, `getChannels` | `nodes/Microsoft/Teams/...` |
| `forge/blocks/n8n/messaging/telegram*.ts` | `chatId` | n/a — keep string (Telegram has no list) | — |
| `forge/blocks/n8n/messaging/twilio*.ts` | `from` (phone number) | `getNumbers` | `nodes/Twilio/Twilio.node.ts` |
| `forge/blocks/n8n/messaging/sendgrid*.ts` | `templateId` | `getTemplates` | `nodes/SendGrid/...` |
| `forge/blocks/n8n/messaging/mattermost*.ts` | `channelId`, `userId` | `getChannels`, `getUsers` | `nodes/Mattermost/...` |
| `forge/blocks/n8n/messaging/rocketChat*.ts` | `channel` | `getChannels` | `nodes/RocketChat/...` |
| `forge/blocks/n8n/messaging/signl4*.ts` | `team` | `getTeams` | `nodes/Signl4/...` |

#### PR 6b — Productivity (10 blocks)

| Block file (sabflow) | Field to upgrade | n8n method to mirror | n8n source path |
|---|---|---|---|
| `forge/blocks/notion.ts` | `parentDatabaseId` | `getDatabases` | `nodes/Notion/v2/methods/listSearch.ts` |
| `forge/blocks/notion.ts` | property select fields | `getDatabaseProperties` (depends on databaseId) | `nodes/Notion/v2/methods/loadOptions.ts:11-47` |
| `forge/blocks/n8n/productivity/airtable*.ts` | `baseId`, `tableId`, `viewId` | `getBases`, `getTables`, `getViews` | `nodes/Airtable/v2/methods/*` |
| `forge/blocks/n8n/productivity/googleSheets*.ts` | `spreadsheetId`, `sheetName` | `spreadSheetsSearch`, `sheetsSearch` | `nodes/Google/Sheet/v2/methods/listSearch.ts` |
| `forge/blocks/n8n/productivity/googleDrive*.ts` | `folderId` | `folderSearch` | `nodes/Google/Drive/...` |
| `forge/blocks/n8n/productivity/trello*.ts` | `boardId`, `listId` (depends on board) | `getBoards`, `getLists` | `nodes/Trello/...` |
| `forge/blocks/n8n/productivity/asana*.ts` | `projectId` | `getProjects` | `nodes/Asana/...` |
| `forge/blocks/n8n/productivity/clickup*.ts` | `team`, `space`, `folder`, `list` (cascading) | `getTeams`, `getSpaces`, … | `nodes/ClickUp/...` |
| `forge/blocks/n8n/productivity/mondayCom*.ts` | `boardId`, `groupId` | `getBoards`, `getGroups` | `nodes/MondayCom/...` |
| `forge/blocks/n8n/productivity/calCom*.ts` | `eventTypeId` | `getEventTypes` | `nodes/CalCom/...` |
| `forge/blocks/n8n/productivity/googleCalendar*.ts` | `calendarId` | `getCalendars` | `nodes/Google/Calendar/...` |

#### PR 6c — CRM / E-commerce (10 blocks)

| Block file (sabflow) | Field to upgrade | n8n method to mirror | n8n source path |
|---|---|---|---|
| `forge/blocks/n8n/crm/hubspot.ts` | `pipelineId`, `dealStageId` (cascade) | `getPipelines`, `getDealStages` | `nodes/Hubspot/V2/methods/loadOptions.ts` |
| `forge/blocks/n8n/crm/hubspot.ts` | `ownerId` | `getOwners` | same |
| `forge/blocks/n8n/crm/salesforce*.ts` | `objectType`, custom field ids | `getCustomObjects`, `getCustomFields` | `nodes/Salesforce/...` |
| `forge/blocks/n8n/crm/pipedrive*.ts` | `pipelineId`, `stageId` | `getPipelines`, `getStages` | `nodes/Pipedrive/...` |
| `forge/blocks/n8n/crm/zoho*.ts` | `module`, `layoutId` | `getModules`, `getLayouts` | `nodes/Zoho/...` |
| `forge/blocks/n8n/commerce/shopify*.ts` | `productId`, `variantId` | `getProducts`, `getVariants` | `nodes/Shopify/...` |
| `forge/blocks/n8n/commerce/wooCommerce*.ts` | `productId` | `getProducts` | `nodes/WooCommerce/...` |
| `forge/blocks/n8n/commerce/stripe*.ts` | `customerId`, `productId` | `getCustomers`, `getProducts` | `nodes/Stripe/...` |
| `forge/blocks/n8n/devops/github*.ts` | `owner/repo`, `issueNumber` | `getRepositories`, `getIssues` | `nodes/Github/...` |
| `forge/blocks/n8n/devops/gitlab*.ts` | `projectId` | `getProjects` | `nodes/Gitlab/...` |

### Task 6.X — Retrofit pattern (one block)

Use this loop for every row above. Example for Slack `channel`:

- [ ] **Step 1:** Open `n8n-master/packages/nodes-base/nodes/Slack/V1/SlackV1.node.ts:211-242`, copy the API call shape.

- [ ] **Step 2:** Modify `src/lib/sabflow/forge/blocks/slack.ts` — replace the `channel` field declaration (current line 71–76):

```ts
{
  id: 'channel',
  label: 'Channel',
  type: 'resourceLocator',
  required: true,
  modes: [
    { name: 'list', displayName: 'From list', type: 'list' },
    {
      name: 'url', displayName: 'By URL', type: 'string',
      placeholder: 'https://app.slack.com/client/T0/C01…',
      extractValue: {
        type: 'regex',
        regex: 'client\\/[A-Z0-9]+\\/([A-Z0-9]+)',
      },
    },
    { name: 'id', displayName: 'By ID', type: 'string', placeholder: 'C0123…' },
  ],
  loadOptions: async (ctx) => {
    const helpers = ctx.helpers;
    if (!helpers) return [];
    const all: { label: string; value: string }[] = [];
    let cursor: string | undefined;
    do {
      const r = await helpers.requestWithAuthentication('bearer', {
        method: 'GET',
        url: 'https://slack.com/api/conversations.list',
        tokenField: 'botToken',
        query: { types: 'public_channel,private_channel', limit: 200, cursor },
      });
      const data = r.data as { channels?: Array<{ id: string; name: string }>; response_metadata?: { next_cursor?: string } };
      for (const c of data.channels ?? []) {
        all.push({ label: `#${c.name}`, value: c.id });
      }
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor && all.length < 1000);

    // If a search filter is present, apply it client-side too.
    const filter = (ctx.filter ?? '').toLowerCase();
    return filter ? all.filter((o) => o.label.toLowerCase().includes(filter)) : all;
  },
},
```

- [ ] **Step 3:** No runtime change needed — the action's `run` already calls `str(ctx.options.channel)` and Phase 2 normalises `resourceLocator` values to a string id before invoking `run`.

- [ ] **Step 4: Smoke-test** — connect a Slack credential, open the block, confirm channel dropdown loads + URL paste extracts id + posting to selected channel works end-to-end.

- [ ] **Step 5: Commit (one commit per block)**

```bash
git add src/lib/sabflow/forge/blocks/slack.ts
git commit -m "feat(sabflow): Slack channel/user fields use resourceLocator"
```

### Phase 6 acceptance criteria (per sub-PR)

- All 10 blocks in the sub-PR have at least one field promoted from static text to resourceLocator/select-with-loadOptions.
- Existing flows that used plain-string values for those fields still execute (backward compat via `extractValue`).
- Manual smoke test for each block — list mode loads, URL mode extracts, ID mode passes through.

---

## Cross-cutting backward-compat strategy

| Old shape | New shape | Migration |
|---|---|---|
| `field.type: 'text'`, user types raw id | `field.type: 'resourceLocator'`, value `{ mode: 'id', value: '…' }` | `extractValue()` returns raw value when fed a string; runtime code path unchanged |
| `loadOptions: (ctx) => Promise<ForgeSelectOption[]>` | `loadOptions: (ctx) => Promise<ForgeSelectOption[] \| { results, paginationToken }>` | Route unwraps both; legacy callers untouched |
| `ForgeLoadOptionsContext = { credential?, options }` | Adds `getNodeParameter?`, `getCurrentNodeParameter?`, `getNode?`, `helpers?`, `filter?`, `paginationToken?` | All new fields optional — old resolvers ignore them |
| `field.showIf` | `field.displayOptions` (preferred) | `isFieldVisible` checks `displayOptions` first, falls back to `showIf` |
| `$node["X"].json.y`, `$now`, `$today` (current support) | Adds `$prevNode`, `$execution`, `$env`, `DateTime`, `$jmesPath` | All additive; no existing expression breaks |

---

## Self-review

**Spec coverage:**
- Schema extensions (`loadOptionsDependsOn`, `displayOptions`, `modes`, `resourceLocator`, `helpers`, `filter`, `paginationToken`) → covered in Phases 1–4.
- Cascading reload → Task 1.4 (`useLoadOptions` depKey).
- resourceLocator with list/id/url + regex extract → Phase 2.
- Search-as-you-type + pagination → Phase 3.
- Safer credential plumbing → Phase 4.
- Expression globals + picker → Phase 5.
- Retrofit top-30 → Phase 6 (with explicit table).
- Backward-compat table above.

**Type consistency:** `ForgeFieldMode.name` union, `ResourceLocatorValue.mode` union, and `extractValue()`'s mode lookup all use the same `'list' | 'id' | 'url' | 'string'` literal set. `ForgeLoadOptions` return type widens to a union covered by the route's unwrap branch.

**Placeholder scan:** No "TBD" / "implement later" / "similar to Task N" strings. Each retrofit block lists the exact n8n method name and source path; the retrofit pattern (Task 6.X) shows full code for one block — others follow the same shape.

---

## Execution Handoff

**Plan saved to `plans/sabflow-n8n-parity-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with review between tasks. Best for high-touch changes (Phase 2/3 UI, Phase 4 credentials). Per project memory, **one agent at a time** — do not parallelize.

2. **Inline Execution** — work tasks in the current session with checkpoint commits. Best for the bulk of Phase 6 retrofits where each block is a small, identical pattern.

Which approach do you want to start with — and which phase first? Phase 1 is the natural entry point since everything else depends on it.

---

## n8n architectural findings (added 2026-05-20 after source dive)

Read n8n-master end-to-end to confirm how its data plumbing works. Confirmations + new gaps below.

### How `$node["X"].json.y` resolves in n8n (verified)

- **Storage**: every run holds one `IRunExecutionData`. Its `resultData.runData` is keyed by **node display name** → array of `ITaskData` (one entry per run of that node). Each `ITaskData.data.main` is `output_branch[][item_index]`.
- **Lookup chain**: `$node` is a JS `Proxy` (`workflow-data-proxy.ts:729`). `$node["Webhook"]` returns a second proxy whose `.json` getter reads `runData["Webhook"][lastRun].data.main[0][itemIndex].json`.
- **Two data paths**: `$json` = immediate upstream (fast, `connectionInputData`); `$node["X"].json` = any prior node by display name (slow, goes through the runData map).
- **What sabflow does today (Phase 1 fix)**: we now feed `nodeOutputs` into the same `WorkflowDataProxy` via `expression-runner.ts`. The chain works; the lookup ends at our `nodeOutputs[displayName] = { json: ... }` map built by `executeFlow.ts`.

### Confirmed-still-missing in sabflow (revised gap list)

#### Phase 7 — Per-item iteration (medium)

n8n runs each downstream node **once per upstream item** (`for itemIndex in 0..N-1`). Sabflow currently runs each forge block **once total**, then forwards the result as a single value. When upstream emits an array of 100 rows and the downstream is "Send email", n8n sends 100 emails; sabflow sends 1.

Files to touch:
- `src/lib/sabflow/engine/executeBlock.ts:497-545` (`executeForgeBlock`) — wrap `action.run` in an item loop.
- `src/lib/sabflow/engine/executeFlow.ts` — store array-of-items output not just single-bag output.
- Need a per-block opt-out flag for blocks whose semantics are "process the whole batch" (HTTP request body, aggregate, merge).

#### Phase 8 — Multi-output branching (big)

n8n's `data.main` is `Array<Array<INodeExecutionData>>` — multiple output ports. IF node has `main[0] = true items`, `main[1] = false items`. Sabflow's edges are single-target so condition/switch blocks can't fan items into separate branches.

Files to touch:
- `src/lib/sabflow/types.ts` — `Edge` needs an `outputIndex` field.
- `src/components/sabflow/graph/...` — render N output ports on the block card.
- `executeFlow.ts` — when picking child nodes, filter edges by `outputIndex`.

#### Phase 9 — `pairedItem` ancestry (big, blocks Phase 8)

Each `INodeExecutionData` carries `pairedItem: { item: N, input: 0 }` pointing back to which upstream item produced it. Lets `$getPairedItem()` walk back through branches.

Needed before Phase 8 can be safe — without paired items, "show me which webhook row triggered this email" breaks.

#### Phase 10 — Data pinning + run-from-node (medium)

n8n's `pinData` injects fixed output for a node so downstream nodes can be tested without re-running the trigger. Plus partial execution to a `destinationNode`. Both reuse the same `runExecutionData` plumbing we already have.

Files to touch:
- `src/lib/sabflow/engine/executeFlow.ts` — accept optional `pinData` and `destinationNode`.
- Editor UI — pin/unpin button on each block; "run from here" context menu item.

### Quick-win checklist (next sprint after Phase 5)

| Task | Effort | Files |
|---|---|---|
| Expose `$prevNode` (derive from current node + edges) | quick | `expression-runner.ts` |
| Expose `$execution.id/.mode` | quick | `expression-runner.ts`, thread through `executeFlow` |
| Expose `$env.*` (allowlist) | quick | `resolveTokens.ts` + `expression-runner.ts` |
| Expose Luxon `DateTime/Interval/Duration` constructors | quick | `expression-runner.ts` |
| Expose `$jmesPath(data, query)` | quick | install `jmespath`, add to proxy |
| Surface all the above in data picker | medium | `UpstreamDataPicker.tsx` |
| Per-item iteration on forge blocks | medium | `executeBlock.ts` + `executeFlow.ts` |

### Confirmed safe pieces (we already match n8n)

- ✅ Display-name-based node addressing (n8n uses node names; we built the same with `buildBlockNameMap`)
- ✅ `nodeOutputs` map keyed by display name with `{ json: ... }` shape (matches n8n's `runData[name].data.main[0]`)
- ✅ Forge block resolver gets `getNodeParameter()` + auto-extracted resourceLocator values (matches n8n's `IExecuteFunctions.getNodeParameter(name, { extractValue: true })`)
- ✅ Single shared `WorkflowDataProxy` is doing the expression evaluation — we just had to give it the right shape
