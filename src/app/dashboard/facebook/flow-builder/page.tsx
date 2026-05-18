'use client';

import {
  ZoruAlert,
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
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  zoruSonnerToast,
} from '@/components/zoruui';
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
        <ZoruEmptyState
          icon={<Workflow />}
          title="No project selected"
          description="Pick a project to manage its Messenger flows."
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
            <ZoruBreadcrumbPage>Flow Builder</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Flow Builder</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Messenger flows for the connected Page. Pick a flow to open it in
            the SabFlow editor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </ZoruButton>
          <ZoruButton onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New flow
          </ZoruButton>
        </div>
      </header>

      {error && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load flows</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      {loading && flows.length === 0 ? (
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-16 w-full" />
          <ZoruSkeleton className="h-16 w-full" />
          <ZoruSkeleton className="h-16 w-full" />
        </div>
      ) : flows.length === 0 ? (
        <ZoruEmptyState
          icon={<Workflow />}
          title="No flows yet"
          description="Create your first Messenger flow to automate replies and routing."
          action={
            <ZoruButton onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New flow
            </ZoruButton>
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
                <ZoruCard className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => router.push(editorHref(id))}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zoru-surface-2 text-zoru-ink-muted">
                      <Workflow className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-base text-zoru-ink">
                        {f.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zoru-ink-muted">
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
                    <ZoruBadge variant={statusVariant(status)} className="capitalize">
                      {status.toLowerCase()}
                    </ZoruBadge>
                  </button>
                  <ZoruDropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                      <ZoruButton variant="ghost" size="icon-sm" aria-label="Flow actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </ZoruButton>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                      <ZoruDropdownMenuItem onSelect={() => router.push(editorHref(id))}>
                        <ArrowUpRight className="mr-2 h-4 w-4" /> Open in editor
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem
                        onSelect={() => setConfirmDelete(f)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete flow
                      </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                  </ZoruDropdownMenu>
                </ZoruCard>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── New flow dialog ── */}
      <ZoruDialog
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
            <ZoruLabel htmlFor="flow-name">Name</ZoruLabel>
            <ZoruInput
              id="flow-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. New customer welcome"
              autoFocus
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              type="button"
              onClick={onCreate}
              disabled={submitting || !newName.trim()}
            >
              {submitting ? 'Creating…' : 'Create flow'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

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
