'use client';

import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Badge,
  type BadgeTone,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  toast,
} from '@/components/sabcrm/20ui';
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
 * /dashboard/facebook/flow-builder - Messenger flow drafts.
 *
 * Lists Facebook Messenger flows (name, status, message count, updatedAt)
 * with a "New flow" dialog that creates an empty draft via
 * `saveFacebookFlow` and routes into the existing SabFlow editor
 * (`/dashboard/sabflow?facebookFlowId=...`) - we don't reinvent the editor.
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

function statusTone(s?: string): BadgeTone {
  if (!s) return 'neutral';
  const v = s.toLowerCase();
  if (v === 'published' || v === 'live' || v === 'active') return 'success';
  if (v === 'draft') return 'warning';
  if (v === 'archived') return 'neutral';
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
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? 'Flow created.');
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
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? 'Flow deleted.');
      setConfirmDelete(null);
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Workflow aria-hidden="true" />}
          title="No project selected"
          description="Pick a project to manage its Messenger flows."
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
            <BreadcrumbPage>Flow Builder</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Flow Builder</PageTitle>
          <PageDescription>
            Messenger flows for the connected Page. Pick a flow to open it in
            the SabFlow editor.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="ghost"
            onClick={refresh}
            disabled={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => setCreateOpen(true)}
            iconLeft={Plus}
          >
            New flow
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Could not load flows</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
          icon={<Workflow aria-hidden="true" />}
          title="No flows yet"
          description="Create your first Messenger flow to automate replies and routing."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)} iconLeft={Plus}>
              New flow
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
                  <Button
                    variant="ghost"
                    block
                    onClick={() => router.push(editorHref(id))}
                    className="!h-auto flex-1 !justify-start !px-0 text-left"
                  >
                    <span className="flex w-full items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                        <Workflow className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 block text-base text-[var(--st-text)]">
                          {f.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
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
                        </span>
                      </span>
                      <Badge tone={statusTone(status)} className="capitalize">
                        {status.toLowerCase()}
                      </Badge>
                    </span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={MoreHorizontal}
                        label="Flow actions"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => router.push(editorHref(id))}>
                        <ArrowUpRight className="mr-2 h-4 w-4" aria-hidden="true" /> Open in editor
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setConfirmDelete(f)}
                        className="text-[var(--st-danger)]"
                      >
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete flow
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* New flow dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setNewName('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New flow</DialogTitle>
            <DialogDescription>
              We&apos;ll create an empty draft and open it in the SabFlow
              editor.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name" id="flow-name">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. New customer welcome"
              autoFocus
            />
          </Field>
          <DialogFooter>
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
              variant="primary"
              onClick={onCreate}
              loading={submitting}
              disabled={!newName.trim()}
            >
              {submitting ? 'Creating...' : 'Create flow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flow?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{confirmDelete?.name}&quot; and all of its steps will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep flow</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
