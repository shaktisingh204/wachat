'use client';

/**
 * FlowDiffView
 *
 * Full visual diff between two SabFlowDoc snapshots.
 *
 * Top banner: numeric summary (+N groups / -N groups / ~N modified / ±N edges).
 * Thumbnails: side-by-side FlowMiniPreview of `before` (left) and `after`
 * (right), with added/removed/modified elements colour-coded.
 * Body: accordion sections per domain (groups / edges / events / variables /
 * settings / theme).  Each row uses DiffRow for consistent styling.
 *
 * Uses react-icons/lu only.  No lucide-react.
 */

import { useMemo, useState } from 'react';
import {
  LuX,
  LuChevronDown,
  LuChevronRight,
  LuLayoutGrid,
  LuArrowRight,
  LuSlidersHorizontal,
  LuPalette,
  LuVariable,
  LuPlay,
  LuWorkflow,
  LuGitCompare,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import {
  computeFlowDiff,
  isFlowDiffEmpty,
  getFlowDiffTotalChanges,
  type FlowDiff,
} from '@/lib/sabflow/diff';
import { FlowMiniPreview } from './FlowMiniPreview';
import { DiffRow } from './DiffRow';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface FlowDiffViewProps {
  before: SabFlowDoc;
  after: SabFlowDoc;
  /**
   * Optional label rendered above the left (before) thumbnail.
   * Defaults to "Before".
   */
  beforeLabel?: string;
  /**
   * Optional label rendered above the right (after) thumbnail.
   * Defaults to "After".
   */
  afterLabel?: string;
  onClose?: () => void;
  className?: string;
}

/* ── Summary banner ─────────────────────────────────────────────────────── */

interface SummaryChipProps {
  kind: 'added' | 'removed' | 'modified' | 'neutral';
  count: number;
  label: string;
}

function SummaryChip({ kind, count, label }: SummaryChipProps) {
  const palette = {
    added: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900/60',
    removed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60',
    modified: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60',
    neutral: 'bg-[var(--gray-2)] text-[var(--gray-11)] border-[var(--gray-5)]',
  }[kind];

  const prefix = kind === 'added' ? '+' : kind === 'removed' ? '−' : kind === 'modified' ? '~' : '';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium',
        palette,
      )}
    >
      <span className="tabular-nums font-semibold">
        {prefix}
        {count}
      </span>
      <span className="text-[11.5px]">{label}</span>
    </div>
  );
}

/* ── Accordion section wrapper ──────────────────────────────────────────── */

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  /** Initial open state — defaults to `count > 0`. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon, count, defaultOpen, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen ?? count > 0);

  return (
    <section className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[var(--gray-2)] transition-colors"
        aria-expanded={isOpen}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--gray-3)] text-[var(--gray-10)]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">{title}</span>
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
            count > 0
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-[var(--gray-3)] text-[var(--gray-9)]',
          )}
        >
          {count}
        </span>
        {isOpen
          ? <LuChevronDown className="h-4 w-4 text-[var(--gray-9)]" strokeWidth={2} />
          : <LuChevronRight className="h-4 w-4 text-[var(--gray-9)]" strokeWidth={2} />}
      </button>
      {isOpen && (
        <div className="border-t border-[var(--gray-5)] bg-[var(--gray-1)] px-3.5 py-3 space-y-1.5">
          {children}
        </div>
      )}
    </section>
  );
}

/* ── Empty section placeholder ──────────────────────────────────────────── */

function EmptySectionMessage({ message }: { message: string }) {
  return (
    <p className="py-2 text-center text-[11.5px] text-[var(--gray-9)]">{message}</p>
  );
}

/* ── Per-section renderers ──────────────────────────────────────────────── */

function GroupsSection({ diff }: { diff: FlowDiff }) {
  const total =
    diff.groups.added.length + diff.groups.removed.length + diff.groups.modified.length;

  return (
    <Section
      title="Groups"
      icon={<LuLayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />}
      count={total}
    >
      {total === 0 ? (
        <EmptySectionMessage message="No group changes" />
      ) : (
        <>
          {diff.groups.added.map((g) => (
            <DiffRow
              key={`add-${g.id}`}
              kind="added"
              typeLabel="Group"
              label={g.title || '(untitled group)'}
              subtext={`${g.blocks?.length ?? 0} block${(g.blocks?.length ?? 0) === 1 ? '' : 's'}`}
            />
          ))}
          {diff.groups.removed.map((g) => (
            <DiffRow
              key={`del-${g.id}`}
              kind="removed"
              typeLabel="Group"
              label={g.title || '(untitled group)'}
              subtext={`${g.blocks?.length ?? 0} block${(g.blocks?.length ?? 0) === 1 ? '' : 's'}`}
            />
          ))}
          {diff.groups.modified.map((m) => (
            <DiffRow
              key={`mod-${m.after.id}`}
              kind="modified"
              typeLabel="Group"
              label={m.after.title || m.before.title || '(untitled group)'}
              details={m.changes}
            />
          ))}
        </>
      )}
    </Section>
  );
}

function EdgesSection({ diff }: { diff: FlowDiff }) {
  const total = diff.edges.added.length + diff.edges.removed.length;
  return (
    <Section
      title="Edges"
      icon={<LuArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
      count={total}
    >
      {total === 0 ? (
        <EmptySectionMessage message="No edge changes" />
      ) : (
        <>
          {diff.edges.added.map((e) => (
            <DiffRow
              key={`add-${e.id}`}
              kind="added"
              typeLabel="Edge"
              label={edgeLabel(e)}
              subtext={e.id}
            />
          ))}
          {diff.edges.removed.map((e) => (
            <DiffRow
              key={`del-${e.id}`}
              kind="removed"
              typeLabel="Edge"
              label={edgeLabel(e)}
              subtext={e.id}
            />
          ))}
        </>
      )}
    </Section>
  );
}

function edgeLabel(edge: { from: { eventId?: string; groupId?: string }; to: { groupId: string; blockId?: string } }): string {
  const fromPart = edge.from.eventId
    ? `Event:${short(edge.from.eventId)}`
    : edge.from.groupId
      ? `Group:${short(edge.from.groupId)}`
      : 'unknown';
  const toPart = `Group:${short(edge.to.groupId)}${edge.to.blockId ? `/${short(edge.to.blockId)}` : ''}`;
  return `${fromPart} → ${toPart}`;
}

function short(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function EventsSection({ diff }: { diff: FlowDiff }) {
  const total = diff.events.added.length + diff.events.removed.length + diff.events.modified.length;
  return (
    <Section
      title="Events"
      icon={<LuPlay className="h-3.5 w-3.5" strokeWidth={2} />}
      count={total}
    >
      {total === 0 ? (
        <EmptySectionMessage message="No event changes" />
      ) : (
        <>
          {diff.events.added.map((ev) => (
            <DiffRow
              key={`add-${ev.id}`}
              kind="added"
              typeLabel="Event"
              label={ev.type}
              subtext={ev.id}
            />
          ))}
          {diff.events.removed.map((ev) => (
            <DiffRow
              key={`del-${ev.id}`}
              kind="removed"
              typeLabel="Event"
              label={ev.type}
              subtext={ev.id}
            />
          ))}
          {diff.events.modified.map((m) => (
            <DiffRow
              key={`mod-${m.after.id}`}
              kind="modified"
              typeLabel="Event"
              label={m.after.type}
              subtext={m.after.id}
              details={m.changes}
            />
          ))}
        </>
      )}
    </Section>
  );
}

function VariablesSection({ diff }: { diff: FlowDiff }) {
  const total =
    diff.variables.added.length + diff.variables.removed.length + diff.variables.modified.length;
  return (
    <Section
      title="Variables"
      icon={<LuVariable className="h-3.5 w-3.5" strokeWidth={2} />}
      count={total}
    >
      {total === 0 ? (
        <EmptySectionMessage message="No variable changes" />
      ) : (
        <>
          {diff.variables.added.map((v) => (
            <DiffRow
              key={`add-${v.id}`}
              kind="added"
              typeLabel="Variable"
              label={v.name}
              subtext={v.value ? `= ${String(v.value)}` : undefined}
            />
          ))}
          {diff.variables.removed.map((v) => (
            <DiffRow
              key={`del-${v.id}`}
              kind="removed"
              typeLabel="Variable"
              label={v.name}
              subtext={v.value ? `= ${String(v.value)}` : undefined}
            />
          ))}
          {diff.variables.modified.map((m) => (
            <DiffRow
              key={`mod-${m.after.id}`}
              kind="modified"
              typeLabel="Variable"
              label={m.after.name || m.before.name}
              details={m.changes}
            />
          ))}
        </>
      )}
    </Section>
  );
}

function SettingsSection({ diff }: { diff: FlowDiff }) {
  return (
    <Section
      title="Settings"
      icon={<LuSlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />}
      count={diff.settings.length}
    >
      {diff.settings.length === 0 ? (
        <EmptySectionMessage message="No settings changes" />
      ) : (
        diff.settings.map((key) => (
          <DiffRow
            key={`settings-${key}`}
            kind="modified"
            typeLabel="Setting"
            label={key}
            details={[`Value changed for "${key}"`]}
          />
        ))
      )}
    </Section>
  );
}

function ThemeSection({ diff }: { diff: FlowDiff }) {
  return (
    <Section
      title="Theme"
      icon={<LuPalette className="h-3.5 w-3.5" strokeWidth={2} />}
      count={diff.theme.length}
    >
      {diff.theme.length === 0 ? (
        <EmptySectionMessage message="No theme changes" />
      ) : (
        diff.theme.map((key) => (
          <DiffRow
            key={`theme-${key}`}
            kind="modified"
            typeLabel="Theme"
            label={key}
            details={[`Value changed for "${key}"`]}
          />
        ))
      )}
    </Section>
  );
}

/* ── Highlight set helpers ──────────────────────────────────────────────── */

function buildHighlightSets(diff: FlowDiff) {
  const addedGroupIds = new Set<string>(diff.groups.added.map((g) => g.id));
  const removedGroupIds = new Set<string>(diff.groups.removed.map((g) => g.id));
  const modifiedGroupIds = new Set<string>(diff.groups.modified.map((m) => m.after.id));

  const addedEventIds = new Set<string>(diff.events.added.map((e) => e.id));
  const removedEventIds = new Set<string>(diff.events.removed.map((e) => e.id));
  const modifiedEventIds = new Set<string>(diff.events.modified.map((m) => m.after.id));

  const beforeModifiedGroupIds = new Set<string>(diff.groups.modified.map((m) => m.before.id));
  const beforeModifiedEventIds = new Set<string>(diff.events.modified.map((m) => m.before.id));

  const addedEdgeIds = new Set<string>(diff.edges.added.map((e) => e.id));
  const removedEdgeIds = new Set<string>(diff.edges.removed.map((e) => e.id));

  return {
    // Left (before) preview highlights: removed + modified(before)
    beforeAdded: new Set<string>(),
    beforeRemoved: new Set<string>([...removedGroupIds, ...removedEventIds]),
    beforeModified: new Set<string>([...beforeModifiedGroupIds, ...beforeModifiedEventIds]),
    beforeEdgeAdded: new Set<string>(),
    beforeEdgeRemoved: removedEdgeIds,

    // Right (after) preview highlights: added + modified(after)
    afterAdded: new Set<string>([...addedGroupIds, ...addedEventIds]),
    afterRemoved: new Set<string>(),
    afterModified: new Set<string>([...modifiedGroupIds, ...modifiedEventIds]),
    afterEdgeAdded: addedEdgeIds,
    afterEdgeRemoved: new Set<string>(),
  };
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function FlowDiffView({
  before,
  after,
  beforeLabel = 'Before',
  afterLabel = 'After',
  onClose,
  className,
}: FlowDiffViewProps) {
  const diff = useMemo(() => computeFlowDiff(before, after), [before, after]);
  const isEmpty = isFlowDiffEmpty(diff);
  const totalChanges = getFlowDiffTotalChanges(diff);
  const highlights = useMemo(() => buildHighlightSets(diff), [diff]);

  return (
    <div
      className={cn(
        'flex flex-col gap-4 bg-[var(--gray-2)] text-[var(--gray-12)]',
        className,
      )}
    >
      {/* ── Summary banner ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] px-4 py-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          aria-hidden="true"
        >
          <LuGitCompare className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">
            {isEmpty ? 'No changes' : `${totalChanges} change${totalChanges === 1 ? '' : 's'}`}
          </p>
          <p className="text-[11px] text-[var(--gray-9)] truncate">
            Comparing <span className="font-medium text-[var(--gray-11)]">{beforeLabel}</span>
            {' → '}
            <span className="font-medium text-[var(--gray-11)]">{afterLabel}</span>
          </p>
        </div>

        {!isEmpty && (
          <div className="flex flex-wrap items-center gap-1.5">
            <SummaryChip kind="added" count={diff.groups.added.length} label="groups" />
            <SummaryChip kind="removed" count={diff.groups.removed.length} label="groups" />
            <SummaryChip kind="modified" count={diff.groups.modified.length} label="modified" />
            <SummaryChip kind="added" count={diff.edges.added.length} label="edges" />
            <SummaryChip kind="removed" count={diff.edges.removed.length} label="edges" />
          </div>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close diff view"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          >
            <LuX className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* ── Thumbnails ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 items-center gap-1 rounded-md bg-[var(--gray-3)] px-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-11)]">
              <LuWorkflow className="h-2.5 w-2.5" strokeWidth={2.5} />
              {beforeLabel}
            </span>
            <span className="truncate text-[11.5px] text-[var(--gray-9)]">
              {before.name}
            </span>
          </div>
          <FlowMiniPreview
            groups={before.groups ?? []}
            events={before.events ?? []}
            edges={before.edges ?? []}
            addedIds={highlights.beforeAdded}
            removedIds={highlights.beforeRemoved}
            modifiedIds={highlights.beforeModified}
            width={480}
            height={240}
            className="w-full"
            label={`${beforeLabel} preview`}
          />
        </div>

        <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 items-center gap-1 rounded-md bg-amber-100 px-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <LuWorkflow className="h-2.5 w-2.5" strokeWidth={2.5} />
              {afterLabel}
            </span>
            <span className="truncate text-[11.5px] text-[var(--gray-9)]">
              {after.name}
            </span>
          </div>
          <FlowMiniPreview
            groups={after.groups ?? []}
            events={after.events ?? []}
            edges={after.edges ?? []}
            addedIds={highlights.afterAdded}
            removedIds={highlights.afterRemoved}
            modifiedIds={highlights.afterModified}
            width={480}
            height={240}
            className="w-full"
            label={`${afterLabel} preview`}
          />
        </div>
      </div>

      {/* ── Sections ───────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--gray-5)] bg-[var(--gray-1)] py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
            <LuGitCompare className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-[var(--gray-11)]">No changes</p>
          <p className="max-w-sm text-[11.5px] text-[var(--gray-9)]">
            These two versions are identical across every tracked domain.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <GroupsSection diff={diff} />
          <EdgesSection diff={diff} />
          <EventsSection diff={diff} />
          <VariablesSection diff={diff} />
          <SettingsSection diff={diff} />
          <ThemeSection diff={diff} />
        </div>
      )}
    </div>
  );
}
