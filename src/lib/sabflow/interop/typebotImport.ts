/**
 * Typebot v6 JSON → SabFlow doc converter.
 *
 * Accepts the JSON shape that Typebot's editor exports (an object with `name`,
 * `groups`, `edges`, `variables`, `theme`, `settings`, and an optional
 * `events` array).  Returns a partial `SabFlowDoc` that the API route uses to
 * seed a fresh flow.
 *
 * Mapping strategy:
 *
 *   1. Typebot's `groups[].blocks[]` map 1:1 onto SabFlow's `Group.blocks[]`.
 *      Most Typebot block types are identical to SabFlow's (text, image,
 *      text_input, condition, etc.) so we copy them through verbatim and
 *      only fall back to a `typebot_link` stub for unknown types.
 *   2. Variables, edges, theme, and settings shapes already match SabFlow's
 *      shape, so they pass through with minimal massaging.
 *   3. Typebot's `events[]` (start triggers) translate to SabFlow's
 *      `events[]` as `{ type: 'start' }`.
 *
 * Imports are best-effort: unsupported block types are preserved with their
 * original `options` so the user can fix them manually via the stub-fallback
 * "Swap" UI without losing data.
 */

import { createId } from '@paralleldrive/cuid2';
import type {
  Block,
  BlockItem,
  BlockOptions,
  BlockType,
  Edge,
  EdgeFrom,
  EdgeTo,
  Group,
  SabFlowDoc,
  SabFlowEvent,
  SabFlowTheme,
  FlowSettings,
  Variable,
  Coordinates,
} from '@/lib/sabflow/types';

/* ── Typebot v6 export shape (subset we actually consume) ───────────────── */

export type TypebotVariable = {
  id: string;
  name: string;
  value?: unknown;
  isSessionVariable?: boolean;
  isHidden?: boolean;
};

export type TypebotBlock = {
  id: string;
  type: string;
  options?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  outgoingEdgeId?: string;
};

export type TypebotGroup = {
  id: string;
  title?: string;
  graphCoordinates?: Coordinates;
  blocks?: TypebotBlock[];
};

export type TypebotEdgeEndpoint = {
  eventId?: string;
  groupId?: string;
  blockId?: string;
  itemId?: string;
  pinId?: string;
};

export type TypebotEdge = {
  id?: string;
  from: TypebotEdgeEndpoint;
  to: TypebotEdgeEndpoint;
};

export type TypebotEventLike = {
  id?: string;
  type?: string;
  graphCoordinates?: Coordinates;
  outgoingEdgeId?: string;
  options?: Record<string, unknown>;
};

export type TypebotExportJson = {
  name?: string;
  groups?: TypebotGroup[];
  edges?: TypebotEdge[];
  variables?: TypebotVariable[];
  events?: TypebotEventLike[];
  theme?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

/* ── Known SabFlow block types (1:1 with Typebot's catalog) ─────────────── */

const KNOWN_BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  // bubbles
  'text', 'image', 'video', 'embed', 'audio',
  // inputs
  'text_input', 'number_input', 'email_input', 'phone_input', 'url_input',
  'date_input', 'time_input', 'rating_input', 'file_input', 'payment_input',
  'choice_input', 'picture_choice_input',
  // logic
  'condition', 'set_variable', 'redirect', 'script', 'typebot_link',
  'wait', 'jump', 'ab_test', 'merge', 'switch', 'loop', 'filter', 'sort',
  'set', 'execute_workflow', 'respond_to_webhook',
  // integrations
  'webhook', 'send_email', 'google_sheets', 'google_analytics', 'open_ai',
  'zapier', 'make_com', 'pabbly_connect', 'chatwoot', 'pixel', 'segment',
  'cal_com', 'nocodb', 'elevenlabs', 'anthropic', 'together_ai', 'mistral',
]);

/* ── Public API ─────────────────────────────────────────────────────────── */

export type TypebotImportResult = {
  /** Partial flow doc the caller can hand off to `saveSabFlow`. */
  doc: Pick<
    SabFlowDoc,
    'name' | 'events' | 'groups' | 'edges' | 'variables' | 'theme' | 'settings'
  >;
  /** Total blocks processed across all groups. */
  blocks: number;
  /** Total edges processed. */
  edges: number;
  /** Total variables processed. */
  variables: number;
  /** Non-fatal issues encountered during the import. */
  warnings: string[];
};

export function importTypebotWorkflow(input: unknown): TypebotImportResult {
  const tb = validate(input);
  const warnings: string[] = [];

  /* ── Variables ── */
  const variables: Variable[] = (tb.variables ?? []).map((v) => {
    const sabVar: Variable = {
      id: v.id ?? createId(),
      name: v.name ?? '',
    };
    if (v.value !== undefined && v.value !== null) {
      sabVar.value =
        typeof v.value === 'string' ? v.value : JSON.stringify(v.value);
    }
    if (v.isSessionVariable) sabVar.isSessionVariable = v.isSessionVariable;
    if (v.isHidden) sabVar.isHidden = v.isHidden;
    return sabVar;
  });

  /* ── Groups + Blocks ── */
  let blockCount = 0;
  const groups: Group[] = (tb.groups ?? []).map((g, gIdx) => {
    const groupId = g.id ?? createId();
    const blocks: Block[] = (g.blocks ?? []).map((b) => {
      blockCount += 1;
      const resolved = resolveBlockType(b.type);
      if (resolved.stubbed) {
        warnings.push(
          `Block "${b.id}" of unknown Typebot type "${b.type}" was imported as a typebot_link stub`,
        );
      }
      const block: Block = {
        id: b.id ?? createId(),
        type: resolved.type,
        groupId,
        options: {
          ...(b.options ?? {}),
          ...(resolved.stubbed ? { _typebotOriginalType: b.type } : {}),
        } as BlockOptions,
      };
      if (Array.isArray(b.items) && b.items.length > 0) {
        block.items = b.items.map((it) => ({
          ...(it as Record<string, unknown>),
          id: (it as { id?: string }).id ?? createId(),
        })) as BlockItem[];
      }
      if (b.outgoingEdgeId) block.outgoingEdgeId = b.outgoingEdgeId;
      return block;
    });

    return {
      id: groupId,
      title: g.title ?? `Group ${gIdx + 1}`,
      graphCoordinates: g.graphCoordinates ?? { x: gIdx * 320, y: 0 },
      blocks,
    };
  });

  /* ── Edges ── */
  const edges: Edge[] = [];
  for (const e of tb.edges ?? []) {
    const from = normaliseEdgeFrom(e.from);
    const to = normaliseEdgeTo(e.to);
    if (!from || !to) {
      warnings.push(`Skipped edge ${e.id ?? '(unknown)'} — missing endpoint`);
      continue;
    }
    edges.push({
      id: e.id ?? createId(),
      from,
      to,
    });
  }

  /* ── Events (start triggers) ── */
  const events: SabFlowEvent[] = (tb.events ?? []).map((ev, idx) => {
    // Typebot historically only emits `start` events; anything else falls
    // back to `start` so the flow has at least one entry point.
    const evType: SabFlowEvent['type'] =
      ev.type === 'schedule' || ev.type === 'webhook' ||
      ev.type === 'manual' || ev.type === 'error' || ev.type === 'start'
        ? ev.type
        : 'start';
    const event: SabFlowEvent = {
      id: ev.id ?? createId(),
      type: evType,
      graphCoordinates: ev.graphCoordinates ?? { x: 0, y: idx * 80 },
    };
    if (ev.outgoingEdgeId) event.outgoingEdgeId = ev.outgoingEdgeId;
    if (ev.options) {
      event.options = ev.options as SabFlowEvent['options'];
    }
    return event;
  });

  /* ── Theme + settings pass through as-is ── */
  const theme = (tb.theme ?? {}) as SabFlowTheme;
  const settings = {
    description: 'Imported from a Typebot v6 export',
    ...((tb.settings ?? {}) as Record<string, unknown>),
  } as FlowSettings;

  return {
    doc: {
      name: tb.name ?? 'Imported from Typebot',
      events,
      groups,
      edges,
      variables,
      theme,
      settings,
    },
    blocks: blockCount,
    edges: edges.length,
    variables: variables.length,
    warnings,
  };
}

/* ── Internals ──────────────────────────────────────────────────────────── */

function validate(input: unknown): TypebotExportJson {
  if (!input || typeof input !== 'object') {
    throw new Error('Import payload must be an object');
  }
  const tb = input as TypebotExportJson;
  if (!Array.isArray(tb.groups)) {
    throw new Error('Import payload missing "groups" array');
  }
  return tb;
}

function resolveBlockType(
  rawType: string | undefined,
): { type: BlockType; stubbed: boolean } {
  if (typeof rawType === 'string' && (KNOWN_BLOCK_TYPES as ReadonlySet<string>).has(rawType)) {
    return { type: rawType as BlockType, stubbed: false };
  }
  return { type: 'typebot_link', stubbed: true };
}

function normaliseEdgeFrom(from: TypebotEdgeEndpoint | undefined): EdgeFrom | null {
  if (!from) return null;
  if (from.eventId) {
    return { eventId: from.eventId };
  }
  if (from.groupId && from.blockId && from.itemId) {
    return {
      groupId: from.groupId,
      blockId: from.blockId,
      itemId: from.itemId,
    };
  }
  if (from.groupId && from.blockId) {
    const out: EdgeFrom = {
      groupId: from.groupId,
      blockId: from.blockId,
    };
    if (from.pinId) {
      (out as { pinId?: string }).pinId = from.pinId;
    }
    return out;
  }
  if (from.groupId) {
    return { groupId: from.groupId };
  }
  return null;
}

function normaliseEdgeTo(to: TypebotEdgeEndpoint | undefined): EdgeTo | null {
  if (!to || !to.groupId) return null;
  const out: EdgeTo = { groupId: to.groupId };
  if (to.blockId) out.blockId = to.blockId;
  return out;
}
