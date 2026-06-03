'use client';

/**
 * SabCRM — Audit Log settings (`/sabcrm/settings/audit`), Twenty-style.
 *
 * Read-only timeline of audit entries emitted by the SabCRM Rust engine. Each
 * row shows: an action chip colour-coded by verb (create / update / delete),
 * the affected object + a deep link to the record (when an id is present), a
 * short change summary, the actor, and a relative timestamp.
 *
 * Two lightweight filters (action type, object) re-query `listAuditTw`, which
 * re-runs the full session → project → RBAC → plan gate server-side, so the
 * page fails closed. The selects' option lists are derived from whatever the
 * engine returns so they stay in sync with the live object metadata.
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

import { TwentyPageHeader, TwentyAvatar } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { listAuditTw, type SabcrmRustAuditEntry } from '@/app/actions/sabcrm-audit.actions';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './audit.css';

// ---------------------------------------------------------------------------
// Action classification — maps a free-form action verb to a chip variant.
// ---------------------------------------------------------------------------

type ActionKind = 'create' | 'update' | 'delete' | 'other';

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
    <span className={`st-chip st-audit-chip st-audit-chip--${kind}`}>
      <span className="st-chip__dot" aria-hidden="true" />
      <span className="st-chip__label">{action || 'event'}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Relative time — "just now" / "5m ago" / "3d ago", with a precise title.
// ---------------------------------------------------------------------------

function toDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function relativeTime(value: string): { label: string; title: string } {
  const d = toDate(value);
  if (!d) return { label: '—', title: value };
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
    <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ALL = '__all__';

export default function SabcrmAuditSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

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
        const res = await listAuditTw({
          action: actionFilter === ALL ? undefined : actionFilter,
          object: objectFilter === ALL ? undefined : objectFilter,
        });
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
  }, [activeProjectId, isLoadingProject, actionFilter, objectFilter]);

  // Option lists derived from the returned entries so the selects mirror the
  // live data. (Server-side filtering already narrows results; these keep the
  // dropdowns populated with the verbs/objects actually present.)
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

  const hasFilter = actionFilter !== ALL || objectFilter !== ALL;

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Audit Log" icon={ScrollText} />
        <p className="st-settings__intro">
          A chronological record of changes made across this project&apos;s
          SabCRM objects — who did what, and when. Entries are emitted by the
          SabCRM engine and are read-only.
        </p>

        {/* Filters — always rendered (except in the no-project state) so the
            user can re-query even when the current filter yields nothing. */}
        {activeProjectId ? (
          <div className="st-audit-filters">
            <div className="st-audit-filter">
              <label className="st-audit-filter__label" htmlFor="audit-action">
                Action
              </label>
              <select
                id="audit-action"
                className="st-select"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                disabled={loading}
              >
                <option value={ALL}>All actions</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                {/* Preserve a custom filter value even if absent from the
                    current page of results. */}
                {actionFilter !== ALL && !actionOptions.includes(actionFilter) ? (
                  <option value={actionFilter}>{actionFilter}</option>
                ) : null}
              </select>
            </div>

            <div className="st-audit-filter">
              <label className="st-audit-filter__label" htmlFor="audit-object">
                Object
              </label>
              <select
                id="audit-object"
                className="st-select"
                value={objectFilter}
                onChange={(e) => setObjectFilter(e.target.value)}
                disabled={loading}
              >
                <option value={ALL}>All objects</option>
                {objectOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                {objectFilter !== ALL && !objectOptions.includes(objectFilter) ? (
                  <option value={objectFilter}>{objectFilter}</option>
                ) : null}
              </select>
            </div>

            <span className="st-audit-filters__spacer" />
            {!loading && !error ? (
              <span className="st-audit-filters__count">
                {entries.length} event{entries.length !== 1 ? 's' : ''}
                {hasFilter ? ' (filtered)' : ''}
              </span>
            ) : null}
          </div>
        ) : null}

        {isLoadingProject || loading ? (
          <AuditSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">Select a project to view its audit log.</p>
          </div>
        ) : error ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{error}</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              {hasFilter ? <Filter size={20} /> : <ScrollText size={20} />}
            </span>
            <h2 className="st-empty__title">
              {hasFilter ? 'No matching events' : 'No audit events yet'}
            </h2>
            <p className="st-empty__desc">
              {hasFilter
                ? 'No audit entries match the current filters. Try widening your selection.'
                : 'Changes made across this project will be recorded here as they happen.'}
            </p>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Object</th>
                  <th>Summary</th>
                  <th>Actor</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const rel = relativeTime(entry.createdAt);
                  const canLink = Boolean(entry.object && entry.recordId);
                  return (
                    <tr key={entry.id} className="st-row">
                      <td>
                        <ActionChip action={entry.action} />
                      </td>
                      <td>
                        {entry.object ? (
                          <div className="st-audit-target">
                            <span className="st-audit-object">{entry.object}</span>
                            {canLink ? (
                              <Link
                                href={`/sabcrm/${entry.object}/${entry.recordId}`}
                                className="st-audit-record-link"
                                title={entry.recordId}
                              >
                                <span>{entry.recordId}</span>
                                <ExternalLink size={11} aria-hidden="true" />
                              </Link>
                            ) : entry.recordId ? (
                              <span className="st-audit-record-id" title={entry.recordId}>
                                {entry.recordId}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="st-muted">—</span>
                        )}
                      </td>
                      <td>
                        {entry.summary ? (
                          <span className="st-audit-summary">{entry.summary}</span>
                        ) : (
                          <span className="st-audit-summary st-audit-summary--empty">
                            No details
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="st-audit-actor">
                          <TwentyAvatar name={entry.actorId || 'System'} size="sm" />
                          <span className="st-audit-actor__name">
                            {entry.actorId || 'System'}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="st-audit-time" title={rel.title}>
                          {rel.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
