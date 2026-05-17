# SabFlow Integration Guide

Add a new forge block in ~50 lines of TypeScript.  This guide walks through
the shape, the patterns the existing blocks use, and the registry side-effect
that makes the block show up in the picker.

## 1. Anatomy of a forge block

Every block exports a default `ForgeBlock` and side-effect-registers itself:

```ts
import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';

async function myAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // 1. Pull credential + options
  // 2. Make the request
  // 3. Return { outputs, logs }
}

const block: ForgeBlock = {
  id: 'forge_myservice',           // must start with `forge_`
  name: 'MyService',
  description: 'One-line tagline.',
  iconName: 'LuPlug',                // any lucide-react / react-icons name
  category: 'Integration',           // 'Integration' | 'Logic' | 'Input' | 'Bubble'
  auth: { type: 'apiKey', credentialType: 'myservice' as never },
  actions: [
    {
      id: 'do_thing',
      label: 'Do thing',
      description: 'Single-sentence description of the action.',
      fields: [
        { id: 'target', label: 'Target', type: 'text', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: myAction,
    },
  ],
};

registerForgeBlock(block);
export default block;
```

Register the file in `src/lib/sabflow/forge/index.ts` so the side-effect import
runs at boot:

```ts
import './blocks/myservice';
```

## 2. The `ForgeActionContext`

```ts
type ForgeActionContext = {
  options: Record<string, unknown>;          // resolved field values
  variables: Record<string, unknown>;        // flow variables
  credential?: Record<string, string>;       // when auth.type !== 'none'
  userId?: string;                           // workspace owner (Step 15)
  callerStack?: string[];                    // for sub-workflow cycle guard
};
```

Always coerce option values with `String(...)` or the local `str` helper —
the picker may emit `{{ $node[...].json.field }}` tokens that resolve at
runtime to non-string values.

## 3. Field types

| Type | UI | Notes |
|---|---|---|
| `text` | single-line input | also supports `placeholder`, `required` |
| `textarea` | multi-line input | wraps with rows |
| `password` | masked input | masks UI only — value is still plain in storage |
| `number` | numeric input | coerces to `number` in `ctx.options` |
| `select` | dropdown | requires `options: Array<{ label, value }>` |
| `toggle` | on/off switch | resolves to `boolean` |
| `variable` | flow-variable picker | resolves to the variable's runtime value |
| `json` | code editor | resolves to a parsed JSON value (object/array) |
| `code` | code editor | resolves to a string |

## 4. Returning a result

```ts
return {
  outputs: { /* keyed values written into flow variables */ },
  logs: ['Human-readable log lines, one per array entry'],
};
```

Conventionally, if the action's first field is `outputVariable: 'text'`,
write the API response under both that variable name **and** a generic
`result` key so downstream blocks can pick from either.  See
`src/lib/sabflow/forge/blocks/shims/index.ts` `writeOutput()` helper.

## 5. Auth modes

| `auth.type` | What the runtime expects |
|---|---|
| `'none'` | No credential resolution. |
| `'apiKey'` | Credential bag is mapped to `ctx.credential` verbatim. |
| `'oauth'` | Credential bag includes `accessToken` (auto-refreshed via `oauth/refresh.ts`). |

The `credentialType` is a key in `CREDENTIAL_TYPES` (see
`src/lib/sabflow/credentials/types.ts`).  Add a new type there if you're
introducing a new provider — the credentials UI picks it up automatically.

## 6. Error handling

Throw an `Error` with a human-readable message — the engine catches it,
flips the block's status to `error`, fires Step 13 failure alerts (when
configured), and surfaces the message in the executions replay view.

Don't swallow errors silently: the test-node panel and live execution both
rely on thrown errors to mark a block as failed.

## 7. Stub-fallback map

If you're adding a block that's a richer replacement for a Rust stub,
register the mapping in `src/lib/sabflow/forge/stubFallbacks.ts`:

```ts
{ myService: {
    forgeType: 'forge_myservice',
    label: 'MyService (forge)',
    rationale: 'Concrete API support — auth, retries, response parsing.',
  },
}
```

The stub banner in `NodeSettings` will offer a one-click "Swap" to your block.

## 8. Tests + smoke

Smoke-test by running the file in `tsx` from inside the repo:

```sh
echo "import './src/lib/sabflow/forge/blocks/myservice'; console.log('loaded')" > /tmp/smoke.ts
NODE_OPTIONS="--max-old-space-size=4096" npx tsx /tmp/smoke.ts
```

For deeper unit tests, add a Vitest spec next to the block file: the
existing `*.test.ts` files in `forge/blocks/` are good templates.

## 9. Generator

`scripts/scaffold-forge-block.ts` generates the boilerplate.  From the
repo root:

```sh
npx tsx scripts/scaffold-forge-block.ts my-service "MyService"
```

It writes `src/lib/sabflow/forge/blocks/my-service.ts` with the action
skeleton, the registerForgeBlock call, and a TODO list of fields to fill
in.  Then add the corresponding import to `forge/index.ts`.

## 10. Vercel notes

SabNode runs on Vercel (Fluid Compute / Node.js).  Outbound HTTP calls
should set a 30s `AbortSignal.timeout(30_000)` to stay well within Function
limits.  Long-running integrations (anything that needs > 5 min) should
queue + poll instead of holding the request open.

When adding a credential with OAuth, fold the provider into the generic
`*_OAUTH_*` env-var convention in `.env.example` — the existing
`/api/sabflow/oauth/authorize` and `/api/sabflow/oauth/callback` handlers
pick it up automatically as long as the provider is registered in
`src/lib/sabflow/oauth/providers.ts`.

That's it — happy shipping.
