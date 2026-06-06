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
  DataTable,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import { useCallback, useEffect, useState, useTransition, useMemo } from 'react';
import { AlertCircle, ExternalLink, Plus, Radar, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { type ColumnDef } from '@tanstack/react-table';

import { useProject } from '@/context/project-context';
import {
  addCompetitor,
  getTrackedCompetitors,
  removeCompetitor,
  syncCompetitorData,
  analyzeCompetitorTrends,
} from '@/app/actions/facebook.actions';

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

export default function FacebookCompetitorsPage() {
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
  
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

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

  const handleAnalyze = (c: Competitor) => {
    const id = c._id ?? c.id ?? '';
    if (!id || !projectId) return;
    setAnalyzingId(id);
    setAnalysisResult(null);
    setAnalysisOpen(true);
    
    (async () => {
      const res = await analyzeCompetitorTrends(projectId, id);
      setAnalyzingId(null);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Analysis failed.');
        setAnalysisOpen(false);
        return;
      }
      setAnalysisResult(res.analysis ?? 'No analysis returned.');
    })();
  };

  const columns = useMemo<ColumnDef<Competitor>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium text-[var(--st-text)]">
          {row.original.name ?? row.original.pageId ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'page',
      header: 'Page',
      cell: ({ row }) => {
        const c = row.original;
        return c.pageUrl ? (
          <a
            href={c.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--st-text-secondary)] hover:underline"
          >
            {c.pageUrl.replace(/^https?:\/\/(www\.)?/, '')}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : c.pageId ? (
          <Badge variant="outline">{c.pageId}</Badge>
        ) : (
          '—'
        );
      },
    },
    {
      accessorKey: 'followers',
      header: 'Followers',
      cell: ({ row }) => (
        <div className="text-right">
          {(row.original.followers ?? 0).toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: 'posts7d',
      header: 'Posts (7d)',
      cell: ({ row }) => (
        <div className="text-right">
          {(row.original.posts7d ?? 0).toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: 'lastSyncedAt',
      header: 'Last synced',
      cell: ({ row }) => (
        <div className="text-xs text-[var(--st-text-secondary)]">
          {fmtDate(row.original.lastSyncedAt) || 'never'}
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const c = row.original;
        const id = c._id ?? c.id ?? '';
        const isSyncing = syncingId === id;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => handleAnalyze(c)}
              aria-label="Analyze Trends"
              title="Analyze Trends"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => handleSync(c)}
              disabled={isSyncing}
              aria-label="Sync now"
              title="Sync now"
            >
              <RefreshCw
                className={isSyncing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setConfirmRemove(c)}
              aria-label="Remove"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ], [syncingId]);

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Radar />}
          title="No project selected"
          description="Pick a Facebook page / project to track competitors."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
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
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Competitors</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Track competitor Pages and their public engagement signals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Track competitor
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load competitors</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      <Card>
        <ZoruCardContent className="pt-6">
          {loading && competitors.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={competitors}
              filterColumn="name"
              filterPlaceholder="Filter competitors..."
              empty={
                <EmptyState
                  icon={<Radar />}
                  title="No competitors tracked"
                  description='Add a competitor by Page URL or numeric ID. Use "Track competitor" above.'
                />
              }
            />
          )}
        </ZoruCardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Track a competitor</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste the competitor's Facebook Page URL or numeric Page ID.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comp-name">Display name</Label>
              <Input
                id="comp-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comp-url">Page URL or ID</Label>
              <Input
                id="comp-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://facebook.com/acmeinc"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? 'Adding...' : 'Track'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Competitor Trend Analysis</ZoruDialogTitle>
            <ZoruDialogDescription>
              Automated LLM insights for the selected competitor.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-4">
            {analyzingId ? (
              <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing recent trends and posts...
              </div>
            ) : (
              <div className="text-sm text-[var(--st-text)] bg-[var(--st-bg-muted)] p-4 rounded-md">
                {analysisResult}
              </div>
            )}
          </div>
          <ZoruDialogFooter>
            <Button onClick={() => setAnalysisOpen(false)}>Close</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

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
