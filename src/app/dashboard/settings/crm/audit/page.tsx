'use client';

/**
 * SabCRM - Audit Log settings (`/dashboard/settings/crm/audit`).
 *
 * Read-only timeline of audit entries emitted by the SabCRM Rust engine. Each
 * row shows: an action badge colour-coded by verb (create / update / delete),
 * the affected object plus a deep link to the record (when an id is present), a
 * short change summary, the actor, and a relative timestamp.
 *
 * Two lightweight filters narrow the log. The object filter is honoured
 * server-side (`listAuditTw({ object })`, which re-runs the full
 * session -> project -> RBAC -> plan gate so the page fails closed). The
 * action filter is applied client-side over the returned page, because the
 * audit engine only filters by object / record / limit - the action verb is
 * free-form and classified in the UI. The selects' option lists are derived
 * from whatever the engine returns so they stay in sync with the live data.
 *
 * States: skeleton while data loads, empty log, error banner (engine down /
 * forbidden), and a graceful "no project" notice. The page degrades to the
 * error banner rather than throwing if the engine is unreachable.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ScrollText,
  AlertTriangle,
  ExternalLink,
  Filter,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  type BadgeTone,
  Avatar,
  Alert,
  EmptyState,
  Skeleton,
  Card,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { listAuditTw, type SabcrmRustAuditEntry } from '@/app/actions/sabcrm-audit.actions';

// ---------------------------------------------------------------------------
// Action classification - maps a free-form action verb to a badge tone.
// ---------------------------------------------------------------------------

type ActionKind = 'create' | 'update' | 'delete' | 'other';

const ACTION_TONE: Record<ActionKind, BadgeTone> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  other: 'neutral',
};

function classifyAction(action: string): ActionKind {
  const a = action.toLowerCase();
  if (/(create|add|insert|new)/.test(a)) return 'create';
  if (/(delete|remove|destroy|archiv)/.test(a)) return 'delete';
  if (/(update|edit|change|modif|patch|set|move)/.test(a)) return 'update';
  return 'other';
}

function ActionChip({ action }: { action: string }): React.JSX.Element {
  const kind = classifyAction(action);
  return (
    <Badge tone={ACTION_TONE[kind]} dot>
      {action || 'event'}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Relative time - "just now" / "5m ago" / "3d ago", with a precise title.
// ---------------------------------------------------------------------------

function toDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function relativeTime(value: string): { label: string; title: string } {
  const d = toDate(value);
  if (!d) return { label: '-', title: value };
  const title = d.toLocaleString();
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return { label: 'just now', title };
  const min = Math.round(sec / 60);
  if (min < 60) return { label: `${min}m ago`, title };
  const hr = Math.round(min / 60);
  if (hr < 24) return { label: `${hr}h ago`, title };
  const day = Math.round(hr / 24);
  if (day < 30) return { label: `${day}d ago`, title };
  const mon = Math.round(day / 30);
  if (mon < 12) return { label: `${mon}mo ago`, title };
  return { label: `${Math.round(mon / 12)}y ago`, title };
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function AuditSkeleton(): React.JSX.Element {
  return (
    <Card padding="md" className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} height={18} radius={6} />
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ALL = '__all__';

export default function SabcrmAuditSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  // `entries` holds the server page (already narrowed by the object filter when
  // set). The action filter is applied client-side below - the audit engine
  // doesn't filter on the free-form action verb.
  const [entries, setEntries] = React.useState<SabcrmRustAuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [actionFilter, setActionFilter] = React.useState<string>(ALL);
  const [objectFilter, setObjectFilter] = React.useState<string>(ALL);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Only the object filter is server-supported; pass the active project
        // explicitly for parity with the sibling settings pages.
        const res = await listAuditTw(
          { object: objectFilter === ALL ? undefined : objectFilter },
          activeProjectId,
        );
        if (cancelled) return;
        if (res.ok) {
          setEntries(res.data);
        } else {
          setError(res.error);
        }
      } catch {
        if (!cancelled) {
          setError('The audit log could not be loaded. The SabCRM engine may be unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isLoadingProject, objectFilter]);

  // Action options are derived from the full server page (before the client
  // action filter) so the dropdown always lists every verb present.
  const actionOptions = React.useMemo(
    () =>
      Array.from(new Set(entries.map((e) => e.action).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [entries],
  );
  const objectOptions = React.useMemo(
    () =>
      Array.from(
        new Set(entries.map((e) => e.object).filter((o): o is string => Boolean(o))),
      ).sort((a, b) => a.localeCompare(b)),
    [entries],
  );

  // Apply the action filter on the client - the engine returns by object only.
  const visibleEntries = React.useMemo(
    () =>
      actionFilter === ALL
        ? entries
        : entries.filter((e) => e.action === actionFilter),
    [entries, actionFilter],
  );

  const hasFilter = actionFilter !== ALL || objectFilter !== ALL;

  return (
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Audit Log</PageTitle>
          <PageDescription>
            A chronological record of changes made across this project&apos;s SabCRM
            objects - who did what, and when. Entries are emitted by the SabCRM engine
            and are read-only.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* Filters - always rendered (except in the no-project state) so the
          user can re-query even when the current filter yields nothing. */}
      {activeProjectId ? (
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Action" id="audit-action" className="min-w-[12rem]">
            <Select
              value={actionFilter}
              onValueChange={setActionFilter}
              disabled={loading}
            >
              <SelectTrigger id="audit-action" aria-label="Filter by action">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {actionOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
                {/* Preserve a custom filter value even if absent from the
                    current page of results. */}
                {actionFilter !== ALL && !actionOptions.includes(actionFilter) ? (
                  <SelectItem value={actionFilter}>{actionFilter}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Object" id="audit-object" className="min-w-[12rem]">
            <Select
              value={objectFilter}
              onValueChange={setObjectFilter}
              disabled={loading}
            >
              <SelectTrigger id="audit-object" aria-label="Filter by object">
                <SelectValue placeholder="All objects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All objects</SelectItem>
                {objectOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
                {objectFilter !== ALL && !objectOptions.includes(objectFilter) ? (
                  <SelectItem value={objectFilter}>{objectFilter}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </Field>

          <span className="flex-1" />
          {!loading && !error ? (
            <span className="pb-2 text-[0.8125rem] text-[var(--st-text-secondary)]">
              {visibleEntries.length} event{visibleEntries.length !== 1 ? 's' : ''}
              {hasFilter ? ' (filtered)' : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      {isLoadingProject || loading ? (
        <AuditSkeleton />
      ) : !activeProjectId ? (
        <EmptyState
          icon={AlertTriangle}
          tone="warning"
          title="No project selected"
          description="Select a project to view its audit log."
        />
      ) : error ? (
        <Alert tone="danger" icon={AlertTriangle} title="Audit log unavailable">
          {error}
        </Alert>
      ) : visibleEntries.length === 0 ? (
        <EmptyState
          icon={hasFilter ? Filter : ScrollText}
          title={hasFilter ? 'No matching events' : 'No audit events yet'}
          description={
            hasFilter
              ? 'No audit entries match the current filters. Try widening your selection.'
              : 'Changes made across this project will be recorded here as they happen.'
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th>Action</Th>
                <Th>Object</Th>
                <Th>Summary</Th>
                <Th>Actor</Th>
                <Th>When</Th>
              </Tr>
            </THead>
            <TBody>
              {visibleEntries.map((entry) => {
                const rel = relativeTime(entry.createdAt);
                const canLink = Boolean(entry.object && entry.recordId);
                return (
                  <Tr key={entry.id}>
                    <Td>
                      <ActionChip action={entry.action} />
                    </Td>
                    <Td>
                      {entry.object ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-[var(--st-text)]">
                            {entry.object}
                          </span>
                          {canLink ? (
                            <Link
                              href={`/sabcrm/${entry.object}/${entry.recordId}`}
                              className="inline-flex w-fit items-center gap-1 text-[0.75rem] text-[var(--st-accent)] hover:underline"
                              title={entry.recordId}
                            >
                              <span className="max-w-[16ch] truncate">{entry.recordId}</span>
                              <ExternalLink size={11} aria-hidden="true" />
                            </Link>
                          ) : entry.recordId ? (
                            <span
                              className="max-w-[16ch] truncate text-[0.75rem] text-[var(--st-text-tertiary)]"
                              title={entry.recordId}
                            >
                              {entry.recordId}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--st-text-tertiary)]">-</span>
                      )}
                    </Td>
                    <Td>
                      {entry.summary ? (
                        <span className="text-[var(--st-text)]">{entry.summary}</span>
                      ) : (
                        <span className="italic text-[var(--st-text-tertiary)]">
                          No details
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={entry.actorId || 'System'} size="sm" />
                        <span className="text-[var(--st-text)]">
                          {entry.actorId || 'System'}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[var(--st-text-secondary)]" title={rel.title}>
                        {rel.label}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
