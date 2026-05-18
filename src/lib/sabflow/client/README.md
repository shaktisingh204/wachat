# SabFlow Client SDK

Minimum-viable consumer guide for the React-side SabFlow runtime.

Import everything from the barrel — never reach into sibling files directly:

```ts
import { SabFlowProvider, useSabFlowDoc } from '@/lib/sabflow/client';
```

---

## Quickstart

```tsx
'use client';
import { SabFlowProvider, useSabFlowContext } from '@/lib/sabflow/client';

function FlowEditor({ flowId }: { flowId: string }) {
  const { status, doc } = useSabFlowContext();
  return <pre>{status}: {doc?.name}</pre>;
}

export default function Page({ flowId }: { flowId: string }) {
  return (
    <SabFlowProvider flowId={flowId} fetchToken={async () => (await fetch('/api/sabflow/token')).text()}>
      <FlowEditor flowId={flowId} />
    </SabFlowProvider>
  );
}
```

---

## Status state machine

`ConnectionStatus` transitions exposed via `useSabFlowContext().status`:

```
                  fetchToken ok          first ack
  [idle] ───────────────────────▶ [connecting] ─────────▶ [live]
     ▲                                │                    │
     │                                │ token / ws error   │ ws close
     │                                ▼                    ▼
     │                          [reconnecting] ◀──── [degraded]
     │                                │
     │                                │ giveUpAfter
     │                                ▼
     └────────────────────────── [offline]
                  unmount / explicit dispose
```

- `live` — writes commit straight through, presence broadcasts every keystroke.
- `degraded` — server reachable but at least one op was NACK'd (`NackReason`); reads still flow.
- `reconnecting` — exponential backoff; `OfflineQueue` is buffering writes.
- `offline` — local-only via `OptimisticBuffer`; reconciliation runs on next `live`.

---

## Common pitfalls

- **Forgetting `fetchToken`.** The provider needs a fresh JWT per session. Without it the socket auths as anon and every write NACKs with `seat_limit`. Always pass an async `fetchToken` that hits your auth route.
- **Importing the SDK from a Server Component.** Everything in this barrel pulls React + browser-only deps (IndexedDB, BroadcastChannel). Mark the consuming file `'use client'`, or import dynamically with `{ ssr: false }`.
- **Not unmounting on route change.** `<SabFlowProvider>` holds a websocket + presence channel. If you mount it above a layout that survives navigation, scope it to the route segment that owns the flow, or dispose it manually in a `useEffect` cleanup. Leaked providers double-count seats and burn presence quota.
- **Calling `useSabFlowDoc` outside the provider.** It throws synchronously. Use `useSabFlowDocOrNull` from non-guaranteed subtrees (modals, portals, async-rendered panels).
- **Skipping `runMigrations` before mount.** Persisted IndexedDB caches from older schema versions will crash hydration. Run migrations in your app shell before the first `SabFlowProvider` mounts.

---

## Foundation ADRs

Background and design rationale live in the SabFlow foundation ADR set:

- `docs/ecosystem/slices/05-sabflow-expansion.md` — module-level scope and roadmap.
- `src/lib/sabflow/docs/` — per-node documentation and sample payloads.

For deeper protocol questions (NACK semantics, presence transport, undo coalescing), see the ADRs referenced from the slice document above.
