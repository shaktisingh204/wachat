'use client';

/**
 * FlowDiffView
 *
 * Full visual diff between two SabFlowDoc snapshots.
 *
 * Top banner: numeric summary (+N groups / -N groups / ~N modified).
 * Thumbnails: side-by-side FlowMiniPreview of `before` (left) and `after`
 * (right), with added/removed/modified elements colour-coded.
 * Body: accordion sections per domain (groups / edges / events / variables /
 * settings / theme). Each row uses DiffRow for consistent styling.
 *
 * Pure 20ui: design-system pieces come from "@/components/sabcrm/20ui",
 * icons from lucide-react. Sections use the 20ui Accordion so open/close
 * motion, ARIA, and the rotating chevron are built in.
 */

import { useMemo } from 'react';
import {
  X,
  LayoutGrid,
  ArrowRight,
  SlidersHorizontal,
  Palette,
  Variable,
  Play,
  Workflow,
  GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Badge,
  Card,
  EmptyState,
  IconButton,
} from '@/components/sabcrm/20ui';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import {
  computeFlowDiff,
  isFlowDiffEmpty,
  getFlowDiffTotalChanges,
  type FlowDiff,
} from '@/lib/sabflow/diff';
import { FlowMiniPreview } from './FlowMiniPreview';
import { DiffRow } from './DiffRow';

/* -- Props ---------------------------------------------------------------- */

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

/* -- Summary chip --------------------------------------------------------- */

interface SummaryChipProps {
  kind: 'added' | 'removed' | 'modified' | 'neutral';
  count: number;
  label: string;
}

function SummaryChip({ kind, count, label }: SummaryChipProps) {
  const prefix = kind === 'added' ? '+' : kind === 'removed' ? '-' : kind === 'modified' ? '~' : '';
  return (
    <Badge tone="neutral" kind="soft">
      <span className="tabular-nums font-semibold">
        {prefix}
        {count}
      </span>
      <span className="ml-1">{label}</span>
    </Badge>
  );
}

/* -- Accordion section wrapper -------------------------------------------- */

interface SectionProps {
  value: string;
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}

function Section({ value, title, icon, count, children }: SectionProps) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        <span className="flex w-full items-center gap-2.5">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)]">{title}</span>
          <Badge tone={count > 0 ? 'accent' : 'neutral'} kind="soft">
            <span className="tabular-nums">{count}</span>
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-1.5">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

/* -- Empty section placeholder ------------------------------------------- */

function EmptySectionMessage({ message }: { message: string }) {
  return (
    <p className="py-2 text-center text-[11.5px] text-[var(--st-text-tertiary)]">{message}</p>
  );
}

/* -- Per-section renderers ----------------------------------------------- */

function GroupsSection({ diff }: { diff: FlowDiff }) {
  const total =
    diff.groups.added.length + diff.groups.removed.length + diff.groups.modified.length;

  return (
    <Section
      value="groups"
      title="Groups"
      icon={<LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
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
      value="edges"
      title="Edges"
      icon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
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
  return `${fromPart} -> ${toPart}`;
}

function short(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

function EventsSection({ diff }: { diff: FlowDiff }) {
  const total = diff.events.added.length + diff.events.removed.length + diff.events.modified.length;
  return (
    <Section
      value="events"
      title="Events"
      icon={<Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
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
      value="variables"
      title="Variables"
      icon={<Variable className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
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
      value="settings"
      title="Settings"
      icon={<SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
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
      value="theme"
      title="Theme"
      icon={<Palette className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
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

/* -- Highlight set helpers ----------------------------------------------- */

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

/* -- Component ------------------------------------------------------------ */

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
        'flex flex-col gap-4 bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
        className,
      )}
    >
      {/* -- Summary banner --------------------------------------- */}
      <Card variant="outlined" padding="none">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
            aria-hidden="true"
          >
            <GitCompare className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-[var(--st-text)]">
              {isEmpty ? 'No changes' : `${totalChanges} change${totalChanges === 1 ? '' : 's'}`}
            </p>
            <p className="text-[11px] text-[var(--st-text-tertiary)] truncate">
              Comparing <span className="font-medium text-[var(--st-text-secondary)]">{beforeLabel}</span>
              {' -> '}
              <span className="font-medium text-[var(--st-text-secondary)]">{afterLabel}</span>
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
            <IconButton label="Close diff view" icon={X} variant="ghost" size="sm" onClick={onClose} />
          )}
        </div>
      </Card>

      {/* -- Thumbnails ------------------------------------------- */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card variant="outlined" padding="none">
          <div className="flex flex-col gap-1.5 p-3">
            <div className="flex items-center gap-2">
              <Badge tone="neutral" kind="soft">
                <Workflow className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
                <span className="ml-1 uppercase tracking-wide">{beforeLabel}</span>
              </Badge>
              <span className="truncate text-[11.5px] text-[var(--st-text-tertiary)]">
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
        </Card>

        <Card variant="outlined" padding="none">
          <div className="flex flex-col gap-1.5 p-3">
            <div className="flex items-center gap-2">
              <Badge tone="accent" kind="soft">
                <Workflow className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
                <span className="ml-1 uppercase tracking-wide">{afterLabel}</span>
              </Badge>
              <span className="truncate text-[11.5px] text-[var(--st-text-tertiary)]">
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
        </Card>
      </div>

      {/* -- Sections --------------------------------------------- */}
      {isEmpty ? (
        <Card variant="outlined" padding="lg">
          <EmptyState
            icon={GitCompare}
            title="No changes"
            description="These two versions are identical across every tracked domain."
          />
        </Card>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={['groups', 'edges', 'events', 'variables', 'settings', 'theme']}
        >
          <GroupsSection diff={diff} />
          <EdgesSection diff={diff} />
          <EventsSection diff={diff} />
          <VariablesSection diff={diff} />
          <SettingsSection diff={diff} />
          <ThemeSection diff={diff} />
        </Accordion>
      )}
    </div>
  );
}
