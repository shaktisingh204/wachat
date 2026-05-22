'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Plus,
  Radar,
  RefreshCw,
  Trash2,
  } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useProject } from '@/context/project-context';
import {
  addCompetitor,
  getTrackedCompetitors,
  removeCompetitor,
  syncCompetitorData,
  } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/competitors — Tracked competitor Pages.
 *
 * Lists competitors with follower / 7-day-post / last-synced metrics,
 * an "Add competitor" dialog, and per-row sync + remove. The underlying
 * Rust action returns NOT_IMPL today — the UI surfaces a friendly empty
 * state and keeps the controls live so the page is ready when the BFF
 * lands.
 */

import * as React from 'react';

interface Competitor {
  _id?: string;
  id?: string;
  name?: string;
  pageId?: string;
  pageUrl?: string;
  followers?: number;
  posts7d?: number;
  lastSyncedAt?: string;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

/** Extract a page id or vanity slug from a Facebook URL. */
function parsePageRef(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const seg = u.pathname.split('/').filter(Boolean);
    return seg[0] ?? trimmed;
  } catch {
    return trimmed;
  }
}

export default function FacebookCompetitorsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');

  const [confirmRemove, setConfirmRemove] = useState<Competitor | null>(null);

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getTrackedCompetitors(projectId);
      if (res.error) {
        setError(res.error);
        setCompetitors([]);
        return;
      }
      setError(null);
      setCompetitors((res.competitors as Competitor[]) ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = () => {
    if (!projectId) return;
    const ref = parsePageRef(formUrl);
    if (!ref) {
      zoruSonnerToast.error('Page URL or ID is required.');
      return;
    }
    startSaving(async () => {
      const res = await addCompetitor(projectId, ref);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Failed to track competitor.');
        return;
      }
      zoruSonnerToast.success(
        formName.trim()
          ? `Tracking "${formName.trim()}".`
          : 'Competitor tracked.',
      );
      setDialogOpen(false);
      setFormName('');
      setFormUrl('');
      refresh();
    });
  };

  const handleSync = (c: Competitor) => {
    const id = c._id ?? c.id ?? '';
    if (!id) return;
    setSyncingId(id);
    (async () => {
      const res = await syncCompetitorData(id);
      setSyncingId(null);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Sync failed.');
        return;
      }
      zoruSonnerToast.success('Sync queued.');
      refresh();
    })();
  };

  const handleRemove = () => {
    if (!confirmRemove) return;
    const id = confirmRemove._id ?? confirmRemove.id ?? '';
    if (!id) return;
    (async () => {
      const res = await removeCompetitor(id);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Failed to remove.');
        return;
      }
      zoruSonnerToast.success('Competitor removed.');
      setConfirmRemove(null);
      refresh();
    })();
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Radar />}
          title="No project selected"
          description="Pick a Facebook page / project to track competitors."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Competitors</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Competitors</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Track competitor Pages and their public engagement signals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </ZoruButton>
          <ZoruButton onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Track competitor
          </ZoruButton>
        </div>
      </header>

      {error && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load competitors</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      <ZoruCard>
        <ZoruCardContent className="pt-6">
          {loading && competitors.length === 0 ? (
            <div className="flex flex-col gap-2">
              <ZoruSkeleton className="h-10 w-full" />
              <ZoruSkeleton className="h-10 w-full" />
              <ZoruSkeleton className="h-10 w-full" />
            </div>
          ) : competitors.length === 0 ? (
            <ZoruEmptyState
              icon={<Radar />}
              title="No competitors tracked"
              description='Add a competitor by Page URL or numeric ID. Use "Track competitor" above.'
            />
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Name</ZoruTableHead>
                  <ZoruTableHead>Page</ZoruTableHead>
                  <ZoruTableHead className="text-right">Followers</ZoruTableHead>
                  <ZoruTableHead className="text-right">Posts (7d)</ZoruTableHead>
                  <ZoruTableHead>Last synced</ZoruTableHead>
                  <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {competitors.map((c) => {
                  const id = c._id ?? c.id ?? '';
                  const isSyncing = syncingId === id;
                  return (
                    <ZoruTableRow key={id || c.pageId || c.name}>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        {c.name ?? c.pageId ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {c.pageUrl ? (
                          <a
                            href={c.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-zoru-ink-muted hover:underline"
                          >
                            {c.pageUrl.replace(/^https?:\/\/(www\.)?/, '')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : c.pageId ? (
                          <ZoruBadge variant="outline">{c.pageId}</ZoruBadge>
                        ) : (
                          '—'
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        {(c.followers ?? 0).toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        {(c.posts7d ?? 0).toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-xs text-zoru-ink-muted">
                        {fmtDate(c.lastSyncedAt) || 'never'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <ZoruButton
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleSync(c)}
                            disabled={isSyncing}
                            aria-label="Sync now"
                          >
                            <RefreshCw
                              className={
                                isSyncing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'
                              }
                            />
                          </ZoruButton>
                          <ZoruButton
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setConfirmRemove(c)}
                            aria-label="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ZoruButton>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Track a competitor</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste the competitor's Facebook Page URL or numeric Page ID.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="comp-name">Display name</ZoruLabel>
              <ZoruInput
                id="comp-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="comp-url">Page URL or ID</ZoruLabel>
              <ZoruInput
                id="comp-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://facebook.com/acmeinc"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleAdd} disabled={saving}>
              {saving ? 'Adding...' : 'Track'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <ZoruAlertDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Stop tracking this competitor?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {confirmRemove?.name ?? confirmRemove?.pageId ?? 'This competitor'} will
              be removed and historical snapshots may be lost.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleRemove}>
              Remove
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
