'use client';

/**
 * FlowPreviewPanel — client-side chat simulator for the SabFlow builder.
 *
 * Walks the flow graph locally (no server calls). Supports:
 *   - Bubble blocks (text, image, video, audio, embed)
 *   - Input blocks (text, number, email, phone, url, date, time, rating, file)
 *   - Choice / picture-choice inputs (rendered as clickable buttons)
 *   - Condition blocks (evaluates first matching branch)
 *   - Set-variable blocks
 *   - Wait blocks (silent skip)
 *   - Jump blocks
 *   - Redirect blocks (shown as a link message)
 *   - Collapsible variables panel
 *   - Drag-to-resize left border
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type FormEvent,
} from 'react';
import type {
  SabFlowDoc,
  Block,
  Edge,
  Group,
  Variable,
  InputBlockType,
} from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  LuX,
  LuRefreshCw,
  LuSend,
  LuChevronDown,
  LuChevronRight,
  LuGripVertical,
} from 'react-icons/lu';

/* ═══════════════════════════════════════════════════════════
   Internal message model
═══════════════════════════════════════════════════════════ */

type HostMsg =
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string; alt?: string }
  | { kind: 'video'; url: string }
  | { kind: 'audio'; url: string }
  | { kind: 'embed'; url: string }
  | { kind: 'redirect'; url: string };

type ChatMsg =
  | { role: 'host'; msg: HostMsg }
  | { role: 'guest'; text: string };

/* ═══════════════════════════════════════════════════════════
   Flow-engine helpers
═══════════════════════════════════════════════════════════ */

/** Resolve a value that may contain {{variableName}} references. */
function resolveVars(
  text: string | undefined | null,
  vars: Record<string, string>,
): string {
  if (!text) return '';
  return text.replace(/\{\{([^}]+)\}\}/g, (_, name: string) => {
    const trimmed = name.trim();
    return Object.prototype.hasOwnProperty.call(vars, trimmed)
      ? vars[trimmed]
      : `{{${trimmed}}}`;
  });
}

/** Find the group that the start-event connects to. */
function findStartGroup(flow: SabFlowDoc): Group | null {
  const startEvent = flow.events.find((e) => e.type === 'start');
  if (!startEvent?.outgoingEdgeId) return null;
  const edge = flow.edges.find((e) => e.id === startEvent.outgoingEdgeId);
  if (!edge) return null;
  return flow.groups.find((g) => g.id === edge.to.groupId) ?? null;
}

/** Find the next group/block edge from a given source. */
function findEdgeFrom(
  edges: Edge[],
  source:
    | { eventId: string }
    | { groupId: string; blockId?: string; itemId?: string },
): Edge | undefined {
  return edges.find((e) => {
    if ('eventId' in source) {
      return 'eventId' in e.from && e.from.eventId === source.eventId;
    }
    if (source.itemId) {
      return (
        'groupId' in e.from &&
        e.from.groupId === source.groupId &&
        e.from.blockId === source.blockId &&
        e.from.itemId === source.itemId
      );
    }
    if (source.blockId) {
      return (
        'groupId' in e.from &&
        e.from.groupId === source.groupId &&
        e.from.blockId === source.blockId &&
        !e.from.itemId
      );
    }
    return (
      'groupId' in e.from &&
      e.from.groupId === source.groupId &&
      !e.from.blockId
    );
  });
}

/** Evaluate a single condition item. Returns true if the condition passes. */
function evalConditionItem(
  item: Record<string, unknown>,
  vars: Record<string, string>,
): boolean {
  const variableId = item.variableId as string | undefined;
  const operator = (item.operator as string | undefined) ?? 'EQUAL';
  const value = resolveVars(item.value as string | undefined, vars);

  // find the variable value by id
  const varValue = variableId !== undefined ? (vars[variableId] ?? '') : '';

  switch (operator.toUpperCase()) {
    case 'EQUAL':
    case 'IS_EQUAL_TO':
      return varValue === value;
    case 'NOT_EQUAL':
    case 'IS_NOT_EQUAL_TO':
      return varValue !== value;
    case 'CONTAINS':
      return varValue.toLowerCase().includes(value.toLowerCase());
    case 'NOT_CONTAINS':
      return !varValue.toLowerCase().includes(value.toLowerCase());
    case 'GREATER_THAN':
      return parseFloat(varValue) > parseFloat(value);
    case 'LESS_THAN':
      return parseFloat(varValue) < parseFloat(value);
    case 'IS_SET':
    case 'IS_DEFINED':
      return varValue !== '' && varValue !== undefined;
    case 'IS_EMPTY':
    case 'IS_NOT_DEFINED':
      return varValue === '' || varValue === undefined;
    case 'STARTS_WITH':
      return varValue.toLowerCase().startsWith(value.toLowerCase());
    case 'ENDS_WITH':
      return varValue.toLowerCase().endsWith(value.toLowerCase());
    case 'MATCHES_REGEX':
      try {
        return new RegExp(value).test(varValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/** Evaluate a condition block and return the matching item id (or undefined for else). */
function evalConditionBlock(
  block: Block,
  vars: Record<string, string>,
): string | undefined {
  const items = (block.items ?? []) as Array<Record<string, unknown>>;
  for (const item of items) {
    const conditions = (item.conditions as Array<Record<string, unknown>>) ?? [];
    const logicalOperator = (item.logicalOperator as string | undefined) ?? 'AND';
    const pass =
      logicalOperator.toUpperCase() === 'OR'
        ? conditions.some((c) => evalConditionItem(c, vars))
        : conditions.every((c) => evalConditionItem(c, vars));
    if (pass) return item.id as string;
  }
  return undefined; // else branch — will fall through to outgoingEdgeId
}

/* ═══════════════════════════════════════════════════════════
   Simulator state machine
═══════════════════════════════════════════════════════════ */

type PendingInput = {
  blockId: string;
  inputType: InputBlockType;
  variableId?: string;
  choices?: { id: string; label: string; value?: string }[];
};

type SimulatorState = {
  messages: ChatMsg[];
  /** null = flow ended, string = current group */
  currentGroupId: string | null;
  currentBlockIndex: number;
  variables: Record<string, string>;
  pendingInput: PendingInput | null;
  isTyping: boolean;
  isCompleted: boolean;
};

function buildInitialState(): SimulatorState {
  return {
    messages: [],
    currentGroupId: null,
    currentBlockIndex: 0,
    variables: {},
    pendingInput: null,
    isTyping: false,
    isCompleted: false,
  };
}

/* ═══════════════════════════════════════════════════════════
   Engine: process blocks until we hit an input or end
═══════════════════════════════════════════════════════════ */

interface EngineResult {
  newMessages: ChatMsg[];
  pendingInput: PendingInput | null;
  nextGroupId: string | null;
  nextBlockIndex: number;
  updatedVars: Record<string, string>;
  isCompleted: boolean;
}

/**
 * Run the flow synchronously from (groupId, blockIndex) until we
 * hit an input block that needs user interaction, or reach the end.
 * Returns accumulated outgoing messages + next pause point.
 */
function runFlowEngine(
  flow: SabFlowDoc,
  startGroupId: string | null,
  startBlockIndex: number,
  vars: Record<string, string>,
  userInput?: string,
  pendingInput?: PendingInput | null,
): EngineResult {
  const newMessages: ChatMsg[] = [];
  let currentVars = { ...vars };
  let currentGroupId = startGroupId;
  let blockIndex = startBlockIndex;
  const MAX_STEPS = 200; // prevent infinite loops
  let steps = 0;

  // Helper: follow edge to next group/block
  const followEdge = (edge: Edge | undefined): boolean => {
    if (!edge) {
      currentGroupId = null;
      return false;
    }
    const nextGroup = flow.groups.find((g) => g.id === edge.to.groupId);
    if (!nextGroup) {
      currentGroupId = null;
      return false;
    }
    currentGroupId = nextGroup.id;
    blockIndex = edge.to.blockId
      ? nextGroup.blocks.findIndex((b) => b.id === edge.to.blockId)
      : 0;
    if (blockIndex < 0) blockIndex = 0;
    return true;
  };

  while (currentGroupId !== null && steps < MAX_STEPS) {
    steps++;
    const group = flow.groups.find((g) => g.id === currentGroupId);
    if (!group) { currentGroupId = null; break; }

    if (blockIndex >= group.blocks.length) {
      // End of group — follow group-level edge if any
      const groupEdge = findEdgeFrom(flow.edges, { groupId: group.id });
      if (!followEdge(groupEdge)) break;
      continue;
    }

    const block = group.blocks[blockIndex];

    /* ── Bubble blocks ─────────────────────────────────── */
    if (
      block.type === 'text' ||
      block.type === 'image' ||
      block.type === 'video' ||
      block.type === 'audio' ||
      block.type === 'embed'
    ) {
      if (block.type === 'text') {
        const content = resolveVars(
          (block.options?.content as string | undefined) ??
          (block.options?.text as string | undefined) ??
          '',
          currentVars,
        );
        if (content) {
          newMessages.push({ role: 'host', msg: { kind: 'text', text: content } });
        }
      } else if (block.type === 'image') {
        const url = resolveVars(block.options?.url as string | undefined, currentVars);
        if (url) newMessages.push({ role: 'host', msg: { kind: 'image', url, alt: block.options?.alt as string | undefined } });
      } else if (block.type === 'video') {
        const url = resolveVars(block.options?.url as string | undefined, currentVars);
        if (url) newMessages.push({ role: 'host', msg: { kind: 'video', url } });
      } else if (block.type === 'audio') {
        const url = resolveVars(block.options?.url as string | undefined, currentVars);
        if (url) newMessages.push({ role: 'host', msg: { kind: 'audio', url } });
      } else if (block.type === 'embed') {
        const url = resolveVars(block.options?.url as string | undefined, currentVars);
        if (url) newMessages.push({ role: 'host', msg: { kind: 'embed', url } });
      }

      // Advance
      const blockEdge = findEdgeFrom(flow.edges, { groupId: group.id, blockId: block.id });
      if (blockEdge) {
        followEdge(blockEdge);
      } else {
        blockIndex++;
      }
      continue;
    }

    /* ── Logic: set_variable ───────────────────────────── */
    if (block.type === 'set_variable') {
      const varId = block.options?.variableId as string | undefined;
      const value = resolveVars(block.options?.value as string | undefined ?? block.options?.expressionValue as string | undefined, currentVars);
      if (varId) {
        // Store by id AND by name for easy lookup
        const varDef = flow.variables.find((v) => v.id === varId);
        currentVars = { ...currentVars, [varId]: value };
        if (varDef) currentVars = { ...currentVars, [varDef.name]: value };
      }
      const blockEdge = findEdgeFrom(flow.edges, { groupId: group.id, blockId: block.id });
      if (blockEdge) { followEdge(blockEdge); } else { blockIndex++; }
      continue;
    }

    /* ── Logic: condition ──────────────────────────────── */
    if (block.type === 'condition') {
      const matchedItemId = evalConditionBlock(block, currentVars);
      let edgeFound = false;
      if (matchedItemId) {
        const itemEdge = findEdgeFrom(flow.edges, {
          groupId: group.id,
          blockId: block.id,
          itemId: matchedItemId,
        });
        if (itemEdge) { followEdge(itemEdge); edgeFound = true; }
      }
      if (!edgeFound) {
        // else / fallthrough
        const blockEdge = findEdgeFrom(flow.edges, { groupId: group.id, blockId: block.id });
        if (blockEdge) { followEdge(blockEdge); } else { blockIndex++; }
      }
      continue;
    }

    /* ── Logic: wait ───────────────────────────────────── */
    if (block.type === 'wait') {
      const blockEdge = findEdgeFrom(flow.edges, { groupId: group.id, blockId: block.id });
      if (blockEdge) { followEdge(blockEdge); } else { blockIndex++; }
      continue;
    }

    /* ── Logic: redirect ───────────────────────────────── */
    if (block.type === 'redirect') {
      const url = resolveVars(block.options?.url as string | undefined, currentVars);
      if (url) newMessages.push({ role: 'host', msg: { kind: 'redirect', url } });
      currentGroupId = null;
      break;
    }

    /* ── Logic: jump ───────────────────────────────────── */
    if (block.type === 'jump') {
      const targetGroupId = block.options?.groupId as string | undefined;
      const targetBlockId = block.options?.blockId as string | undefined;
      if (targetGroupId) {
        const targetGroup = flow.groups.find((g) => g.id === targetGroupId);
        if (targetGroup) {
          currentGroupId = targetGroupId;
          blockIndex = targetBlockId
            ? targetGroup.blocks.findIndex((b) => b.id === targetBlockId)
            : 0;
          if (blockIndex < 0) blockIndex = 0;
          continue;
        }
      }
      currentGroupId = null;
      break;
    }

    /* ── Logic: typebot_link / ab_test / script ────────── */
    if (
      block.type === 'typebot_link' ||
      block.type === 'ab_test' ||
      block.type === 'script'
    ) {
      // Skip unsupported logic blocks in preview
      const blockEdge = findEdgeFrom(flow.edges, { groupId: group.id, blockId: block.id });
      if (blockEdge) { followEdge(blockEdge); } else { blockIndex++; }
      continue;
    }

    /* ── Integration blocks ────────────────────────────── */
    if (
      block.type === 'webhook' ||
      block.type === 'send_email' ||
      block.type === 'google_sheets' ||
      block.type === 'google_analytics' ||
      block.type === 'open_ai' ||
      block.type === 'zapier' ||
      block.type === 'make_com' ||
      block.type === 'pabbly_connect' ||
      block.type === 'chatwoot' ||
      block.type === 'pixel' ||
      block.type === 'segment' ||
      block.type === 'cal_com' ||
      block.type === 'nocodb' ||
      block.type === 'elevenlabs' ||
      block.type === 'anthropic' ||
      block.type === 'together_ai' ||
      block.type === 'mistral'
    ) {
      // Silently skip integrations in local preview
      const blockEdge = findEdgeFrom(flow.edges, { groupId: group.id, blockId: block.id });
      if (blockEdge) { followEdge(blockEdge); } else { blockIndex++; }
      continue;
    }

    /* ── Input blocks ──────────────────────────────────── */
    if (
      block.type === 'text_input' ||
      block.type === 'number_input' ||
      block.type === 'email_input' ||
      block.type === 'phone_input' ||
      block.type === 'url_input' ||
      block.type === 'date_input' ||
      block.type === 'time_input' ||
      block.type === 'rating_input' ||
      block.type === 'file_input' ||
      block.type === 'payment_input' ||
      block.type === 'choice_input' ||
      block.type === 'picture_choice_input'
    ) {
      if (userInput !== undefined && pendingInput != null && pendingInput.blockId === block.id) {
        // User has provided input — store it and advance
        if (pendingInput.variableId) {
          const varDef = flow.variables.find((v) => v.id === pendingInput!.variableId);
          currentVars = { ...currentVars, [pendingInput.variableId]: userInput };
          if (varDef) currentVars = { ...currentVars, [varDef.name]: userInput };
        }

        // For choice_input: find the item edge matching the chosen item id
        let choiceItemEdge: Edge | undefined;
        if (
          (block.type === 'choice_input' || block.type === 'picture_choice_input') &&
          pendingInput.choices
        ) {
          const chosen = pendingInput.choices.find((c) => c.id === userInput || c.label === userInput);
          if (chosen) {
            choiceItemEdge = findEdgeFrom(flow.edges, {
              groupId: group.id,
              blockId: block.id,
              itemId: chosen.id,
            });
          }
        }

        const blockEdge =
          choiceItemEdge ??
          findEdgeFrom(flow.edges, { groupId: group.id, blockId: block.id });
        if (blockEdge) { followEdge(blockEdge); } else { blockIndex++; }
        // Continue processing with no pending input
        userInput = undefined;
        pendingInput = null;
        continue;
      }

      // No input yet — build choice list for choice blocks
      let choices: PendingInput['choices'] | undefined;
      if (block.type === 'choice_input' || block.type === 'picture_choice_input') {
        choices = (block.items ?? []).map((item) => ({
          id: item.id,
          label: resolveVars(item.content as string | undefined ?? '', currentVars),
          value: resolveVars(item.content as string | undefined ?? '', currentVars),
        }));
      }

      return {
        newMessages,
        pendingInput: {
          blockId: block.id,
          inputType: block.type,
          variableId: block.options?.variableId as string | undefined,
          choices,
        },
        nextGroupId: currentGroupId,
        nextBlockIndex: blockIndex,
        updatedVars: currentVars,
        isCompleted: false,
      };
    }

    // Unknown block — skip
    blockIndex++;
  }

  return {
    newMessages,
    pendingInput: null,
    nextGroupId: currentGroupId,
    nextBlockIndex: blockIndex,
    updatedVars: currentVars,
    isCompleted: currentGroupId === null,
  };
}

/* ═══════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════ */

/* ── Typing indicator ─────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm px-4 py-3 w-fit shadow-sm bg-[#f0f0f0]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#555] animate-bounce"
          style={{ animationDelay: `${i * 130}ms` }}
        />
      ))}
    </div>
  );
}

/* ── Host message bubble ──────────────────────────────── */
function HostBubble({ msg }: { msg: HostMsg }) {
  if (msg.kind === 'text') {
    return (
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed shadow-sm bg-[#f0f0f0] text-[#161616] animate-in fade-in-0 slide-in-from-left-2 duration-200">
        {msg.text}
      </div>
    );
  }
  if (msg.kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={msg.url}
        alt={msg.alt ?? ''}
        className="max-w-[240px] rounded-2xl rounded-tl-sm shadow-sm object-cover animate-in fade-in-0 duration-200"
      />
    );
  }
  if (msg.kind === 'video') {
    return (
      <video
        src={msg.url}
        controls
        className="max-w-[240px] rounded-2xl rounded-tl-sm shadow-sm animate-in fade-in-0 duration-200"
      />
    );
  }
  if (msg.kind === 'audio') {
    return (
      <audio
        src={msg.url}
        controls
        className="max-w-[240px] animate-in fade-in-0 duration-200"
      />
    );
  }
  if (msg.kind === 'embed') {
    return (
      <iframe
        src={msg.url}
        title="Embedded content"
        className="max-w-[280px] h-[180px] rounded-2xl border-none shadow-sm animate-in fade-in-0 duration-200"
      />
    );
  }
  if (msg.kind === 'redirect') {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--gray-9)] italic px-1 animate-in fade-in-0 duration-200">
        <LuChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <span>
          Redirect to{' '}
          <a
            href={msg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#f76808]"
          >
            {msg.url}
          </a>
        </span>
      </div>
    );
  }
  return null;
}

/* ── Guest message bubble ─────────────────────────────── */
function GuestBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-relaxed shadow-sm self-end bg-[#f76808] text-white animate-in fade-in-0 slide-in-from-right-2 duration-200">
      {text}
    </div>
  );
}

/* ── Choice buttons ───────────────────────────────────── */
function ChoiceButtons({
  choices,
  onChoose,
}: {
  choices: NonNullable<PendingInput['choices']>;
  onChoose: (idOrLabel: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-1 self-start max-w-[90%] animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      {choices.map((c) => (
        <button
          key={c.id}
          onClick={() => onChoose(c.id)}
          className="rounded-xl border border-[#f76808] px-3 py-1.5 text-[12.5px] font-medium text-[#f76808] transition-colors hover:bg-[#fff4ee] active:scale-95"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* ── Variables panel ──────────────────────────────────── */
function VariablesPanel({
  variables,
  runtimeVars,
  flowVariables,
}: {
  variables: Record<string, string>;
  runtimeVars: Record<string, string>;
  flowVariables: Variable[];
}) {
  const [open, setOpen] = useState(false);

  const rows = flowVariables.map((v) => ({
    name: v.name,
    value: runtimeVars[v.id] ?? runtimeVars[v.name] ?? variables[v.id] ?? variables[v.name] ?? '',
  }));

  return (
    <div className="shrink-0 border-t border-[var(--gray-4)] bg-[var(--gray-2)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-4 py-2 text-[12px] font-medium text-[var(--gray-9)] hover:text-[var(--gray-12)] transition-colors"
      >
        {open ? (
          <LuChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        ) : (
          <LuChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        )}
        Variables
        <span className="ml-auto text-[11px] tabular-nums text-[var(--gray-8)]">
          {rows.filter((r) => r.value !== '').length}/{rows.length}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 max-h-[140px] overflow-y-auto flex flex-col gap-1.5">
          {rows.length === 0 ? (
            <p className="text-[11.5px] italic text-[var(--gray-8)]">No variables defined.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.name}
                className="flex items-baseline gap-2 text-[11.5px]"
              >
                <code className="text-violet-600 dark:text-violet-400 shrink-0 font-mono">
                  {row.name}
                </code>
                <span className="text-[var(--gray-7)] shrink-0">=</span>
                <span className="text-[var(--gray-11)] truncate font-mono min-w-0">
                  {row.value === '' ? (
                    <span className="italic text-[var(--gray-7)]">—</span>
                  ) : (
                    row.value
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Input-type helpers (re-used from SabFlowChat)
═══════════════════════════════════════════════════════════ */

function getInputType(inputType: InputBlockType | undefined): string {
  switch (inputType) {
    case 'email_input':   return 'email';
    case 'number_input':  return 'number';
    case 'url_input':     return 'url';
    case 'phone_input':   return 'tel';
    case 'date_input':    return 'date';
    case 'time_input':    return 'time';
    default:              return 'text';
  }
}

function getInputPlaceholder(inputType: InputBlockType | undefined): string {
  switch (inputType) {
    case 'email_input':   return 'Your email address…';
    case 'number_input':  return 'Enter a number…';
    case 'url_input':     return 'https://…';
    case 'phone_input':   return 'Your phone number…';
    case 'date_input':    return 'Select a date…';
    case 'time_input':    return 'Select a time…';
    case 'rating_input':  return 'Your rating (1–10)…';
    case 'file_input':    return 'File URL…';
    default:              return 'Type your answer…';
  }
}

/* ═══════════════════════════════════════════════════════════
   FlowPreviewPanel
═══════════════════════════════════════════════════════════ */

interface Props {
  flow: SabFlowDoc & { _id: string };
  onClose: () => void;
}

export function FlowPreviewPanel({ flow, onClose }: Props) {
  /* ── Resize state ───────────────────────────────────── */
  const [width, setWidth] = useState(380);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDragMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.max(300, Math.min(700, dragStartWidth.current + delta));
      setWidth(newWidth);
    };
    const onMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  /* ── Simulator state ────────────────────────────────── */
  const [state, setState] = useState<SimulatorState>(buildInitialState);
  const [textValue, setTextValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runningRef = useRef(false);

  /* ── Auto-scroll on new messages ────────────────────── */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages, state.isTyping]);

  /* ── Start / restart the simulator ─────────────────── */
  const startSimulator = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    setState(buildInitialState());
    setTextValue('');

    const startGroup = findStartGroup(flow);
    if (!startGroup) {
      setState((prev) => ({
        ...prev,
        messages: [
          {
            role: 'host',
            msg: { kind: 'text', text: '⚠ No Start event connected. Connect the Start block to a group first.' },
          },
        ],
        isCompleted: true,
      }));
      runningRef.current = false;
      return;
    }

    // Show typing indicator briefly then render first batch
    setState((prev) => ({ ...prev, isTyping: true, currentGroupId: startGroup.id }));

    const timer = setTimeout(() => {
      const result = runFlowEngine(flow, startGroup.id, 0, {});
      setState({
        messages: result.newMessages,
        currentGroupId: result.nextGroupId,
        currentBlockIndex: result.nextBlockIndex,
        variables: result.updatedVars,
        pendingInput: result.pendingInput,
        isTyping: false,
        isCompleted: result.isCompleted,
      });
      runningRef.current = false;
      requestAnimationFrame(() => inputRef.current?.focus());
    }, 600);

    return () => clearTimeout(timer);
  }, [flow]);

  // Auto-start on mount
  useEffect(() => {
    startSimulator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Submit user input ──────────────────────────────── */
  const submitInput = useCallback(
    (inputValue: string) => {
      if (!inputValue.trim() && state.pendingInput?.inputType !== 'choice_input') return;
      if (!state.pendingInput) return;
      if (runningRef.current) return;
      runningRef.current = true;

      const userText =
        state.pendingInput.inputType === 'choice_input' ||
        state.pendingInput.inputType === 'picture_choice_input'
          ? (state.pendingInput.choices?.find((c) => c.id === inputValue)?.label ?? inputValue)
          : inputValue;

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: 'guest', text: userText }],
        pendingInput: null,
        isTyping: true,
        isCompleted: false,
      }));
      setTextValue('');

      const capturedState = state;
      const timer = setTimeout(() => {
        const result = runFlowEngine(
          flow,
          capturedState.currentGroupId,
          capturedState.currentBlockIndex,
          capturedState.variables,
          inputValue,
          capturedState.pendingInput,
        );
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, ...result.newMessages],
          currentGroupId: result.nextGroupId,
          currentBlockIndex: result.nextBlockIndex,
          variables: result.updatedVars,
          pendingInput: result.pendingInput,
          isTyping: false,
          isCompleted: result.isCompleted,
        }));
        runningRef.current = false;
        requestAnimationFrame(() => inputRef.current?.focus());
      }, 400);

      return () => clearTimeout(timer);
    },
    [flow, state],
  );

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitInput(textValue);
  };

  const showTextInput =
    !state.isCompleted &&
    !state.isTyping &&
    state.pendingInput !== null &&
    state.pendingInput.inputType !== 'choice_input' &&
    state.pendingInput.inputType !== 'picture_choice_input';

  const showChoices =
    !state.isCompleted &&
    !state.isTyping &&
    state.pendingInput !== null &&
    (state.pendingInput.inputType === 'choice_input' ||
      state.pendingInput.inputType === 'picture_choice_input');

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div
      className="shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-white z-20 overflow-hidden relative"
      style={{ width: `${width}px` }}
    >
      {/* ── Drag handle (left border) ─────────────────── */}
      <div
        onMouseDown={handleDragMouseDown}
        className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize z-30 group/resize hover:bg-[#f76808]/20 transition-colors"
        title="Drag to resize"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-0 group-hover/resize:opacity-100 transition-opacity pointer-events-none">
          <LuGripVertical className="h-5 w-5 text-[var(--gray-7)]" strokeWidth={1.5} />
        </div>
      </div>

      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">Preview</span>

        {/* Restart */}
        <button
          onClick={startSimulator}
          title="Restart preview"
          className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-white bg-[#f76808] hover:bg-[#e25c00] transition-colors active:scale-95"
        >
          <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Restart
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          title="Close preview"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuX className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* ── Chat area ─────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2.5 bg-white"
      >
        {state.messages.map((m, i) =>
          m.role === 'host' ? (
            <div key={i} className="flex justify-start">
              <HostBubble msg={m.msg} />
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <GuestBubble text={m.text} />
            </div>
          ),
        )}

        {/* Typing indicator */}
        {state.isTyping && (
          <div className="flex justify-start animate-in fade-in-0 duration-150">
            <TypingDots />
          </div>
        )}

        {/* Choice buttons */}
        {showChoices && state.pendingInput?.choices && (
          <ChoiceButtons
            choices={state.pendingInput.choices}
            onChoose={submitInput}
          />
        )}

        {/* Completed state */}
        {state.isCompleted && !state.isTyping && (
          <div className="flex flex-col items-center gap-2.5 py-6 text-center animate-in fade-in-0 duration-200">
            <span className="text-[12.5px] text-[var(--gray-9)]">Flow completed</span>
            <button
              onClick={startSimulator}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--gray-5)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
            >
              <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              Restart
            </button>
          </div>
        )}
      </div>

      {/* ── Text input bar ────────────────────────────── */}
      {showTextInput && (
        <form
          onSubmit={handleFormSubmit}
          className="shrink-0 flex items-center gap-2 border-t border-[var(--gray-5)] px-3 py-2.5 bg-white"
        >
          <input
            ref={inputRef}
            type={getInputType(state.pendingInput?.inputType)}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder={getInputPlaceholder(state.pendingInput?.inputType)}
            autoFocus
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--gray-7)] text-[var(--gray-12)]"
          />
          <button
            type="submit"
            disabled={!textValue.trim()}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors active:scale-95',
              textValue.trim()
                ? 'bg-[#f76808] text-white hover:bg-[#e25c00]'
                : 'bg-[var(--gray-4)] text-[var(--gray-8)] cursor-not-allowed',
            )}
          >
            <LuSend className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </form>
      )}

      {/* ── Variables panel ───────────────────────────── */}
      <VariablesPanel
        variables={{}}
        runtimeVars={state.variables}
        flowVariables={flow.variables}
      />
    </div>
  );
}
