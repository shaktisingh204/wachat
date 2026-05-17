'use client';

/**
 * DataPickerProvider — supplies upstream-output context to every settings
 * sub-panel rendered inside BlockSettingsPanel.
 *
 * Powers the n8n/Typebot-style data picker:
 *   - Reads the per-node execution store (useNodeDataStore) so the picker
 *     shows real values from the most recent test or live run, exactly like
 *     n8n's "Output" pane.
 *   - Pinned outputs (PinDataButton) take priority over the last live run.
 *   - Every upstream node is unique by (blockId, displayName); collisions
 *     between triggers and blocks are resolved by appending a counter.
 *
 * It memoises the expensive bits (upstream walk, name map) so individual
 * `<DataPickerInput>` instances can re-render cheaply.  When the flow's
 * groups/edges/events change the memo busts naturally.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import {
  buildBlockNameMap,
  collectUpstream,
  getDeclaredFields,
  FALLBACK_FIELDS,
  mergeWithLastRun,
  type UpstreamNode,
} from '@/lib/sabflow/nodeOutputs';
import { getBlockLabel } from '@/lib/sabflow/blocks';
import { useNodeDataStore } from '@/lib/sabflow/execution/nodeData';

type DataPickerCtx = {
  /** Stable display name for the current block, e.g. "OpenAI". */
  currentNodeName: string | null;
  /** Resolved upstream nodes (direct parents first). */
  upstream: UpstreamNode[];
  /** Trigger / event display name when the flow starts from one. */
  triggerName: string | null;
};

const Ctx = createContext<DataPickerCtx>({
  currentNodeName: null,
  upstream: [],
  triggerName: null,
});

type LastRunMap = Record<string, unknown>;

type Props = {
  flow: SabFlowDoc;
  /** The block whose settings panel is currently open. */
  currentBlockId: string | null;
  /**
   * Optional: external override for the per-block last-run map.  Most callers
   * should leave this unset — by default we read from `useNodeDataStore`,
   * which the TestNodePanel and engine both populate.  This prop is the
   * escape hatch for unit-tests or storybook previews.
   */
  lastRunByBlockId?: LastRunMap;
  children: ReactNode;
};

export function DataPickerProvider({
  flow,
  currentBlockId,
  lastRunByBlockId: externalLastRun,
  children,
}: Props) {
  /* ── Subscribe to the per-node execution store ──────────────────────── */
  // We pull pinnedOutput first (manually pinned via PinDataButton), then fall
  // back to the most recent successful run output.  This matches the priority
  // order n8n uses for its `$node["…"].json` data proxy.
  const storeLastRun = useNodeDataStore((s) => {
    const out: Record<string, unknown> = {};
    for (const [id, entry] of Object.entries(s.entries)) {
      if (entry.pinnedOutput !== undefined) out[id] = entry.pinnedOutput;
      else if (entry.lastOutput !== undefined) out[id] = entry.lastOutput;
    }
    return out;
  });

  const lastRunByBlockId = externalLastRun ?? storeLastRun;

  const value = useMemo<DataPickerCtx>(() => {
    if (!currentBlockId) {
      return { currentNodeName: null, upstream: [], triggerName: null };
    }

    const nameMap = buildBlockNameMap(flow.groups);
    const currentNodeName = nameMap.get(currentBlockId) ?? null;

    const blocksById = new Map(
      flow.groups.flatMap((g) => g.blocks.map((b) => [b.id, b] as const)),
    );

    const refs = collectUpstream(
      { groups: flow.groups, edges: flow.edges, events: flow.events },
      currentBlockId,
    );

    // Track display names already taken across both blocks and triggers so
    // we never emit two upstream entries with the same `$node["…"]` key.
    // Seeded with every block name so a trigger can't collide with a block.
    const takenNames = new Set<string>(nameMap.values());
    const seenBlockIds = new Set<string>();
    const upstream: UpstreamNode[] = [];
    let triggerName: string | null = null;

    for (const ref of refs) {
      // Skip if we've already added this node — defense-in-depth even though
      // collectUpstream's BFS dedupes by id.
      const refId = ref.kind === 'event' ? ref.eventId : ref.blockId;
      if (seenBlockIds.has(refId)) continue;
      seenBlockIds.add(refId);

      if (ref.kind === 'event') {
        const evtType = ref.appEvent ?? 'trigger';
        const lastRun = lastRunByBlockId[ref.eventId];
        const fields = mergeWithLastRun(getDeclaredFields(evtType), lastRun);
        const name = uniquifyName(humaniseTrigger(evtType), takenNames);
        triggerName = triggerName ?? name;
        upstream.push({
          blockId: ref.eventId,
          blockType: evtType,
          displayName: name,
          typeLabel: name,
          fields: fields.length > 0 ? fields : FALLBACK_FIELDS,
          lastRun,
          distance: ref.distance,
        });
        continue;
      }

      const block = blocksById.get(ref.blockId);
      if (!block) continue;
      const declared = getDeclaredFields(block.type);
      const lastRun = lastRunByBlockId[block.id];
      const fields = mergeWithLastRun(declared, lastRun);
      const baseName = nameMap.get(block.id) ?? block.id;
      // baseName already came from buildBlockNameMap which dedupes; we just
      // make sure we don't add the same name twice by other paths.
      upstream.push({
        blockId: block.id,
        blockType: block.type,
        displayName: baseName,
        typeLabel: getBlockLabel(block.type),
        fields: fields.length > 0 ? fields : FALLBACK_FIELDS,
        lastRun,
        distance: ref.distance,
      });
    }

    return { currentNodeName, upstream, triggerName };
  }, [flow.groups, flow.edges, flow.events, currentBlockId, lastRunByBlockId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataPicker(): DataPickerCtx {
  return useContext(Ctx);
}

/** Append a numeric suffix until `name` is unique within `taken`. */
function uniquifyName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  let i = 1;
  while (taken.has(`${name}${i}`)) i++;
  const next = `${name}${i}`;
  taken.add(next);
  return next;
}

function humaniseTrigger(appEvent: string): string {
  // "whatsapp_message_received" → "WhatsAppTrigger"
  const product = appEvent.split('_')[0] ?? 'Trigger';
  return `${product.charAt(0).toUpperCase()}${product.slice(1)}Trigger`;
}
