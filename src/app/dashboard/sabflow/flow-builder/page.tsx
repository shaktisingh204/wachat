"use client";

import {
  cn,
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
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
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  BarChart3,
  CirclePause,
  Copy,
  Download,
  GitBranch,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Workflow,
  Zap,
  } from "lucide-react";

/**
 * /dashboard/sabflow/flow-builder — flow list page.
 *
 * Full ZoruUI rewrite. Same server actions (`listSabFlows`, `createSabFlow`,
 * `deleteSabFlow`, `duplicateSabFlow`, `saveSabFlow`,
 * `getTodaySubmissionCounts`) and same `<FlowCard>` grid as before — only the
 * surrounding chrome (header, stats, toolbar, dialogs, list view) was rebuilt
 * on zoru primitives. No clay, no `@/components/ui/*`, no `@/hooks/use-toast`,
 * no `react-icons/lu`, no rainbow palette.
 */

import * as React from "react";

import {
  createSabFlow,
  deleteSabFlow,
  duplicateSabFlow,
  getTodaySubmissionCounts,
  listSabFlows,
  saveSabFlow,
  activateSabFlow,
  deactivateSabFlow,
} from "@/app/actions/sabflow";
import { FlowCard, type FlowItem } from "@/components/sabflow/FlowCard";
import { FlowImportExport } from "@/components/sabflow/FlowImportExport";
import { FlowTemplates } from "@/components/sabflow/FlowTemplates";
import { RecentActivityFeed } from "@/components/sabflow/RecentActivityFeed";

/* ── Component ─────────────────────────────────────────────────────────── */

type ViewMode = "grid" | "list";

export default function SabFlowListPage() {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, startCreating] = useTransition();

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  /* ── Data fetching ─────────────────────────────────────────────────── */

  const fetchFlows = useCallback(() => {
    startTransition(async () => {
      const data = await listSabFlows();
      if (Array.isArray(data)) {
        const items = data as FlowItem[];
        setFlows(items);
        const ids = items.map((f) => f._id);
        if (ids.length > 0) {
          getTodaySubmissionCounts(ids).then(setTodayCounts).catch(() => {});
        }
      } else if (data && "error" in data) {
        toast({
          title: "Error",
          description: data.error as string,
          variant: "destructive",
        });
      }
    });
  }, [toast]);

  useEffect(() => {
    router.refresh();
    fetchFlows();
  }, [fetchFlows, router]);

  /* ── Handlers ──────────────────────────────────────────────────────── */

  const handleCreate = () => {
    startCreating(async () => {
      const result = await createSabFlow(newName.trim() || "Untitled flow");
      if ("error" in result) {
        toast({
          title: "Error",
          description: result.error as string,
          variant: "destructive",
        });
        return;
      }
      setShowCreate(false);
      setNewName("");
      router.push(`/dashboard/sabflow/flow-builder/${result.id}`);
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    startDeleting(async () => {
      const result = await deleteSabFlow(id);
      setDeleteTarget(null);
      if ("error" in result) {
        toast({
          title: "Error",
          description: result.error as string,
          variant: "destructive",
        });
      } else {
        toast({ title: "Deleted", description: `"${name}" was deleted.` });
        fetchFlows();
      }
    });
  };

  const handleDuplicate = async (flowId: string) => {
    const result = await duplicateSabFlow(flowId);
    if ("error" in result) {
      toast({
        title: "Error",
        description: result.error as string,
        variant: "destructive",
      });
    } else {
      toast({ title: "Duplicated", description: "Flow was duplicated." });
      fetchFlows();
    }
  };

  const handleToggleActive = async (flow: FlowItem) => {
    const isPublished = flow.status === 'PUBLISHED';
    const result = isPublished ? await deactivateSabFlow(flow._id) : await activateSabFlow(flow._id);
    if ('error' in result) {
      toast({ title: 'Error', description: result.error as string, variant: 'destructive' });
    } else {
      setFlows((prev) => prev.map((f) =>
        f._id === flow._id ? { ...f, status: isPublished ? 'DRAFT' : 'PUBLISHED' } : f
      ));
    }
  };

  const handleRunNow = async (flowId: string) => {
    try {
      const r = await fetch(`/api/sabflow/${flowId}/trigger`, { method: 'POST' });
      const j = await r.json() as { executionId?: string; error?: string };
      if (j.error) throw new Error(j.error);
      toast({ title: 'Execution queued', description: `Run ${j.executionId?.slice(-8)} started.` });
      router.push(`/dashboard/sabflow/logs?flowId=${flowId}`);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to trigger', variant: 'destructive' });
    }
  };

  const handleRename = async (flowId: string, name: string) => {
    const result = await saveSabFlow(flowId, { name });
    if ("error" in result) {
      toast({
        title: "Error",
        description: result.error as string,
        variant: "destructive",
      });
    } else {
      setFlows((prev) =>
        prev.map((f) => (f._id === flowId ? { ...f, name } : f)),
      );
    }
  };

  /* ── Derived data ──────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    if (!query.trim()) return flows;
    const q = query.toLowerCase();
    return flows.filter((f) => f.name.toLowerCase().includes(q));
  }, [flows, query]);

  const stats = useMemo(
    () => ({
      total: flows.length,
      published: flows.filter((f) => f.status === "PUBLISHED").length,
      draft: flows.filter((f) => f.status === "DRAFT").length,
      groups: flows.reduce((acc, f) => acc + (f.groups?.length ?? 0), 0),
    }),
    [flows],
  );

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabflow/flow-builder">
              SabFlow
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Flow Builder</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>SabFlow</ZoruPageTitle>
          <ZoruPageDescription>
            Build visual conversational flows.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <FlowImportExport />
          <Button onClick={() => setShowCreate(true)}>
            <Plus />
            New Flow
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {/* ── Stats cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<Workflow />}
        />
        <StatCard
          label="Published"
          value={stats.published}
          icon={<Zap />}
        />
        <StatCard
          label="Drafts"
          value={stats.draft}
          icon={<CirclePause />}
        />
        <StatCard
          label="Groups"
          value={stats.groups}
          icon={<GitBranch />}
        />
      </div>

      {/* ── Recent activity / today's flows ─────────────────────────── */}
      {flows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <RecentActivityFeed />
          </div>
          <Card className="overflow-hidden lg:col-span-2 p-0">
            <ZoruCardHeader className="flex flex-row items-center gap-2.5 border-b border-zoru-line bg-zoru-surface py-3">
              <Zap className="h-4 w-4 text-zoru-ink-muted" />
              <ZoruCardTitle className="text-[13px]">
                Today&apos;s activity
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="px-4 py-3">
              {flows.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-zoru-ink-muted">
                  No flows yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {flows
                    .slice()
                    .sort(
                      (a, b) =>
                        (todayCounts[b._id] ?? 0) - (todayCounts[a._id] ?? 0),
                    )
                    .slice(0, 6)
                    .map((flow) => {
                      const count = todayCounts[flow._id] ?? 0;
                      return (
                        <li
                          key={flow._id}
                          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-zoru-surface"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/dashboard/sabflow/flow-builder/${flow._id}`,
                              )
                            }
                            className="flex-1 truncate text-left text-[12.5px] font-medium text-zoru-ink transition-colors hover:text-zoru-ink-strong"
                          >
                            {flow.name}
                          </button>
                          <Badge
                            variant={count > 0 ? "secondary" : "outline"}
                            className="tabular-nums"
                          >
                            {count} today
                          </Badge>
                        </li>
                      );
                    })}
                </ul>
              )}
            </ZoruCardContent>
          </Card>
        </div>
      )}

      {/* ── Templates section ───────────────────────────────────────── */}
      {flows.length === 0 && !isPending ? (
        <Card className="border-dashed bg-zoru-surface/40 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-zoru-ink-muted" />
            <span className="text-[13px] font-semibold text-zoru-ink">
              Get started quickly
            </span>
          </div>
          <FlowTemplates onFlowCreated={fetchFlows} />
        </Card>
      ) : flows.length > 0 ? (
        <FlowTemplates onFlowCreated={fetchFlows} />
      ) : null}

      {/* ── My Flows section ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-[15px] font-semibold text-zoru-ink-strong">
            My Flows
          </h2>

          <Input
            type="text"
            placeholder="Search flows…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leadingSlot={<Search />}
            className="w-48 sm:w-64"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={fetchFlows}
            disabled={isPending}
          >
            <RefreshCw className={cn(isPending && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* View toggle — segmented buttons (no tabs) */}
          <div className="flex items-center gap-1 rounded-[var(--zoru-radius-md)] border border-zoru-line p-0.5">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              <List />
            </Button>
          </div>
        </div>

        {/* Skeleton while first load */}
        {isPending && flows.length === 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden p-0">
                  <Skeleton className="h-[130px] w-full rounded-none" />
                  <div className="flex flex-col gap-2 p-3">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden p-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zoru-line px-4 py-4 last:border-0"
                >
                  <Skeleton className="h-3 w-44" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="ml-auto h-6 w-6 rounded-full" />
                </div>
              ))}
            </Card>
          )
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Workflow />}
            title={query ? "No matching flows" : "No flows yet"}
            description={
              query
                ? `Nothing matched "${query}". Try a different keyword.`
                : "Create your first SabFlow to build conversational bots."
            }
            action={
              !query ? (
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus />
                  Create your first flow
                </Button>
              ) : undefined
            }
          />
        ) : viewMode === "grid" ? (
          /* ── Grid view (shared FlowCard) ─────────────────────────── */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((flow) => (
              <FlowCard
                key={flow._id}
                flow={flow}
                onDelete={(f) =>
                  setDeleteTarget({ id: f._id, name: f.name })
                }
                onDuplicate={handleDuplicate}
                onRename={handleRename}
              />
            ))}
          </div>
        ) : (
          /* ── List view ───────────────────────────────────────────── */
          <Card className="overflow-hidden p-0">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Name</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead>Groups</ZoruTableHead>
                  <ZoruTableHead className="hidden sm:table-cell">
                    Created
                  </ZoruTableHead>
                  <ZoruTableHead>Updated</ZoruTableHead>
                  <ZoruTableHead className="hidden md:table-cell">
                    Today
                  </ZoruTableHead>
                  <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.map((flow) => {
                  const isPublished = flow.status === "PUBLISHED";
                  const todayCount = todayCounts[flow._id] ?? 0;
                  return (
                    <ZoruTableRow key={flow._id} className="group">
                      <ZoruTableCell>
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/sabflow/flow-builder/${flow._id}`,
                            )
                          }
                          className="text-left font-medium text-zoru-ink-strong transition-colors hover:text-zoru-ink"
                        >
                          {flow.name}
                        </button>
                      </ZoruTableCell>

                      <ZoruTableCell>
                        <Badge variant={isPublished ? "success" : "warning"}>
                          {isPublished ? "Published" : "Draft"}
                        </Badge>
                      </ZoruTableCell>

                      <ZoruTableCell className="tabular-nums text-zoru-ink-muted">
                        {flow.groups?.length ?? 0}
                      </ZoruTableCell>

                      <ZoruTableCell className="hidden text-[11.5px] text-zoru-ink-muted sm:table-cell">
                        {flow.createdAt
                          ? format(new Date(flow.createdAt), "MMM d, yyyy")
                          : "—"}
                      </ZoruTableCell>

                      <ZoruTableCell className="text-[11.5px] text-zoru-ink-muted">
                        {flow.updatedAt
                          ? format(
                              new Date(flow.updatedAt),
                              "MMM d, yyyy · HH:mm",
                            )
                          : "—"}
                      </ZoruTableCell>

                      <ZoruTableCell className="hidden md:table-cell">
                        {todayCount > 0 ? (
                          <Badge variant="secondary" className="tabular-nums">
                            +{todayCount}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-zoru-ink-muted">
                            —
                          </span>
                        )}
                      </ZoruTableCell>

                      <ZoruTableCell className="text-right">
                        <DropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Flow actions"
                            >
                              <MoreHorizontal />
                            </Button>
                          </ZoruDropdownMenuTrigger>
                          <ZoruDropdownMenuContent align="end" className="w-44">
                            <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
                            <ZoruDropdownMenuSeparator />
                            <ZoruDropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/dashboard/sabflow/flow-builder/${flow._id}`,
                                )
                              }
                            >
                              <Pencil />
                              Edit
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/dashboard/sabflow/logs?flowId=${flow._id}`,
                                )
                              }
                            >
                              <BarChart3 />
                              Results
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem onClick={() => handleRunNow(flow._id)}>
                              <Play />
                              Run now
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem onClick={() => handleToggleActive(flow)}>
                              {flow.status === 'PUBLISHED' ? <ToggleRight /> : <ToggleLeft />}
                              {flow.status === 'PUBLISHED' ? 'Deactivate' : 'Activate'}
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem
                              onClick={() => handleDuplicate(flow._id)}
                            >
                              <Copy />
                              Duplicate
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = `/api/sabflow/export/${flow._id}`;
                                a.download = `flow-${flow._id}.json`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                            >
                              <Download />
                              Export
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuSeparator />
                            <ZoruDropdownMenuItem
                              onClick={() =>
                                setDeleteTarget({
                                  id: flow._id,
                                  name: flow.name,
                                })
                              }
                            >
                              <Trash2 />
                              Delete
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </DropdownMenu>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })}
              </ZoruTableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* ── Create flow dialog ────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <ZoruDialogContent className="max-w-sm">
          <ZoruDialogHeader>
            <ZoruDialogTitle>New SabFlow</ZoruDialogTitle>
            <ZoruDialogDescription>
              Give your flow a name. You can change it later in the editor.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-2">
            <Input
              placeholder="Flow name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating…
                </>
              ) : (
                "Create"
              )}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ─────────────────────────────────────── */}
      <ZoruAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <ZoruAlertDialogContent className="max-w-sm">
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete flow?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              <strong className="font-medium text-zoru-ink-strong">
                &ldquo;{deleteTarget?.name}&rdquo;
              </strong>{" "}
              will be permanently deleted. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
