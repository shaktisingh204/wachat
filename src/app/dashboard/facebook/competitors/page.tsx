'use client';

import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, Skeleton, DataTable, toast, type DataTableColumn } from '@/components/sabcrm/20ui';
import { useCallback, useEffect, useState, useTransition, useMemo } from 'react';
import { AlertCircle, Download, ExternalLink, Plus, Radar, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { m } from 'motion/react';

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
      toast.error('Page URL or ID is required.');
      return;
    }
    startSaving(async () => {
      const res = await addCompetitor(projectId, ref);
      if (!res.success) {
        toast.error(res.error ?? 'Failed to track competitor.');
        return;
      }
      toast.success(
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
        toast.error(res.error ?? 'Sync failed.');
        return;
      }
      toast.success('Sync queued.');
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
        toast.error(res.error ?? 'Failed to remove.');
        return;
      }
      toast.success('Competitor removed.');
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
        toast.error(res.error ?? 'Analysis failed.');
        setAnalysisOpen(false);
        return;
      }
      setAnalysisResult(res.analysis ?? 'No analysis returned.');
    })();
  };

  const columns = useMemo<DataTableColumn<Competitor>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span className="font-medium text-[var(--st-text)]">
          {row.name ?? row.pageId ?? '—'}
        </span>
      ),
    },
    {
      key: 'page',
      header: 'Page',
      render: (row) => {
        const c = row;
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
      key: 'followers',
      header: 'Followers',
      render: (row) => (
        <div className="text-right">
          {(row.followers ?? 0).toLocaleString()}
        </div>
      ),
    },
    {
      key: 'posts7d',
      header: 'Posts (7d)',
      render: (row) => (
        <div className="text-right">
          {(row.posts7d ?? 0).toLocaleString()}
        </div>
      ),
    },
    {
      key: 'lastSyncedAt',
      header: 'Last synced',
      render: (row) => (
        <div className="text-xs text-[var(--st-text-secondary)]">
          {fmtDate(row.lastSyncedAt) || 'never'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <div className="text-right">Actions</div>,
      render: (row) => {
        const c = row;
        const id = c._id ?? c.id ?? '';
        const isSyncing = syncingId === id;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAnalyze(c)}
              aria-label="Analyze Trends"
              title="Analyze Trends"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
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
              size="sm"
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

  const exportCsv = () => {
    if (competitors.length === 0) return;
    const rows = ['name,pageId,followers,posts7d,lastSyncedAt'];
    for (const c of competitors) {
      rows.push(
        [
          JSON.stringify(c.name ?? ''),
          c.pageId ?? '',
          c.followers ?? 0,
          c.posts7d ?? 0,
          c.lastSyncedAt ?? '',
        ].join(','),
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'facebook-competitors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Competitors</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Competitors</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Track competitor Pages and their public engagement signals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={competitors.length === 0} iconLeft={Download}>
            CSV
          </Button>
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
          <AlertTitle>Could not load competitors</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
      <Card>
        <CardBody className="pt-6">
          {loading && competitors.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={competitors}
              getRowId={(row, index) => row._id ?? row.id ?? String(index)}
              empty={
                <EmptyState
                  icon={<Radar />}
                  title="No competitors tracked"
                  description='Add a competitor by Page URL or numeric ID. Use "Track competitor" above.'
                />
              }
            />
          )}
        </CardBody>
      </Card>
      </m.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Track a competitor</DialogTitle>
            <DialogDescription>
              Paste the competitor's Facebook Page URL or numeric Page ID.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Competitor Trend Analysis</DialogTitle>
            <DialogDescription>
              Automated LLM insights for the selected competitor.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button onClick={() => setAnalysisOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking this competitor?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.name ?? confirmRemove?.pageId ?? 'This competitor'} will
              be removed and historical snapshots may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
