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
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  Label,
  Skeleton,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  ArrowUpRight,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Workflow,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getFacebookFlows,
  saveFacebookFlow,
  deleteFlow,
  } from '@/app/actions/facebook-flow.actions';
import type { FacebookFlow } from '@/lib/definitions';
import type { WithId } from 'mongodb';

/**
 * /dashboard/facebook/flow-builder — Messenger flow drafts.
 *
 * Lists Facebook Messenger flows (name, status, message count, updatedAt)
 * with a "New flow" dialog that creates an empty draft via
 * `saveFacebookFlow` and routes into the existing SabFlow editor
 * (`/dashboard/sabflow?facebookFlowId=…`) — we don't reinvent the editor.
 *
 * Server actions are in `@/app/actions/facebook-flow.actions`.
 */

import * as React from 'react';

type FlowRow = WithId<FacebookFlow> & {
  status?: string;
  messageCount?: number;
  _id: { toString(): string };
};

function safeWhen(iso?: string | Date): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function statusVariant(s?: string): 'success' | 'warning' | 'ghost' | 'info' {
  if (!s) return 'ghost';
  const v = s.toLowerCase();
  if (v === 'published' || v === 'live' || v === 'active') return 'success';
  if (v === 'draft') return 'warning';
  if (v === 'archived') return 'ghost';
  return 'info';
}

function editorHref(flowId: string): string {
  return `/dashboard/sabflow?facebookFlowId=${encodeURIComponent(flowId)}`;
}

export default function FacebookFlowBuilderPage(): React.JSX.Element {
  const router = useRouter();
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, startSubmit] = useTransition();

  const [confirmDelete, setConfirmDelete] = useState<FlowRow | null>(null);
  const [deleting, startDelete] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      try {
        const res = await getFacebookFlows(projectId);
        setError(null);
        setFlows((res ?? []) as FlowRow[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load flows.');
        setFlows([]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCreate = () => {
    const name = newName.trim();
    if (!name || !projectId) return;
    startSubmit(async () => {
      const res = await saveFacebookFlow({
        projectId,
        name,
        nodes: [],
        edges: [],
        triggerKeywords: [],
      });
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success(res.message ?? 'Flow created.');
      setCreateOpen(false);
      setNewName('');
      if (res.flowId) {
        router.push(editorHref(res.flowId));
        return;
      }
      refresh();
    });
  };

  const onConfirmDelete = () => {
    if (!confirmDelete) return;
    const id = confirmDelete._id.toString();
    startDelete(async () => {
      const res = await deleteFlow(id);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success(res.message ?? 'Flow deleted.');
      setConfirmDelete(null);
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Workflow />}
          title="No project selected"
          description="Pick a project to manage its Messenger flows."
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
            <ZoruBreadcrumbPage>Flow Builder</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Flow Builder</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Messenger flows for the connected Page. Pick a flow to open it in
            the SabFlow editor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New flow
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load flows</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {loading && flows.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : flows.length === 0 ? (
        <EmptyState
          icon={<Workflow />}
          title="No flows yet"
          description="Create your first Messenger flow to automate replies and routing."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New flow
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {flows.map((f) => {
            const id = f._id.toString();
            const status = f.status ?? 'DRAFT';
            const msgCount = f.messageCount ?? f.nodes?.length ?? 0;
            return (
              <li key={id}>
                <Card className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => router.push(editorHref(id))}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                      <Workflow className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-base text-[var(--st-text)]">
                        {f.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                        <span>{msgCount} steps</span>
                        {f.triggerKeywords?.length ? (
                          <span>
                            {f.triggerKeywords.length} trigger keyword
                            {f.triggerKeywords.length === 1 ? '' : 's'}
                          </span>
                        ) : null}
                        {f.updatedAt ? (
                          <span>Updated {safeWhen(f.updatedAt)}</span>
                        ) : null}
                      </div>
                    </div>
                    <Badge variant={statusVariant(status)} className="capitalize">
                      {status.toLowerCase()}
                    </Badge>
                  </button>
                  <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Flow actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                      <ZoruDropdownMenuItem onSelect={() => router.push(editorHref(id))}>
                        <ArrowUpRight className="mr-2 h-4 w-4" /> Open in editor
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem
                        onSelect={() => setConfirmDelete(f)}
                        className="text-[var(--st-danger)]"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete flow
                      </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                  </DropdownMenu>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── New flow dialog ── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setNewName('');
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New flow</ZoruDialogTitle>
            <ZoruDialogDescription>
              We&apos;ll create an empty draft and open it in the SabFlow
              editor.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="flow-name">Name</Label>
            <Input
              id="flow-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. New customer welcome"
              autoFocus
            />
          </div>
          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCreate}
              disabled={submitting || !newName.trim()}
            >
              {submitting ? 'Creating…' : 'Create flow'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <ZoruAlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this flow?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              &quot;{confirmDelete?.name}&quot; and all of its steps will be
              permanently removed.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>Keep flow</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
