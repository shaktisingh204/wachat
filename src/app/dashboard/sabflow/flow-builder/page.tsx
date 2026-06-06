"use client";

import * as React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
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

import {
  cn,
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  IconButton,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Skeleton,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";

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

/**
 * /dashboard/sabflow/flow-builder - flow list page.
 *
 * Pure 20ui rewrite. Same server actions (listSabFlows, createSabFlow,
 * deleteSabFlow, duplicateSabFlow, saveSabFlow, getTodaySubmissionCounts) and
 * the same shared FlowCard grid; the surrounding chrome (header, stats, toolbar,
 * dialogs, list view) is built on 20ui primitives and tokens only.
 */

/* Component */

type ViewMode = "grid" | "list";

export default function SabFlowListPage() {
  const router = useRouter();
  const { toast } = useToast();

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

  /* Data fetching */

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
        toast.error({ title: "Error", description: data.error as string });
      }
    });
  }, [toast]);

  useEffect(() => {
    router.refresh();
    fetchFlows();
  }, [fetchFlows, router]);

  /* Handlers */

  const handleCreate = () => {
    startCreating(async () => {
      const result = await createSabFlow(newName.trim() || "Untitled flow");
      if ("error" in result) {
        toast.error({ title: "Error", description: result.error as string });
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
        toast.error({ title: "Error", description: result.error as string });
      } else {
        toast.success({ title: "Deleted", description: `"${name}" was deleted.` });
        fetchFlows();
      }
    });
  };

  const handleDuplicate = async (flowId: string) => {
    const result = await duplicateSabFlow(flowId);
    if ("error" in result) {
      toast.error({ title: "Error", description: result.error as string });
    } else {
      toast.success({ title: "Duplicated", description: "Flow was duplicated." });
      fetchFlows();
    }
  };

  const handleToggleActive = async (flow: FlowItem) => {
    const isPublished = flow.status === "PUBLISHED";
    const result = isPublished
      ? await deactivateSabFlow(flow._id)
      : await activateSabFlow(flow._id);
    if ("error" in result) {
      toast.error({ title: "Error", description: result.error as string });
    } else {
      setFlows((prev) =>
        prev.map((f) =>
          f._id === flow._id ? { ...f, status: isPublished ? "DRAFT" : "PUBLISHED" } : f,
        ),
      );
    }
  };

  const handleRunNow = async (flowId: string) => {
    try {
      const r = await fetch(`/api/sabflow/${flowId}/trigger`, { method: "POST" });
      const j = (await r.json()) as { executionId?: string; error?: string };
      if (j.error) throw new Error(j.error);
      toast.success({
        title: "Execution queued",
        description: `Run ${j.executionId?.slice(-8)} started.`,
      });
      router.push(`/dashboard/sabflow/logs?flowId=${flowId}`);
    } catch (e) {
      toast.error({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to trigger",
      });
    }
  };

  const handleRename = async (flowId: string, name: string) => {
    const result = await saveSabFlow(flowId, { name });
    if ("error" in result) {
      toast.error({ title: "Error", description: result.error as string });
    } else {
      setFlows((prev) => prev.map((f) => (f._id === flowId ? { ...f, name } : f)));
    }
  };

  /* Derived data */

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

  /* Render */

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabflow/flow-builder">
              SabFlow
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Flow Builder</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>SabFlow</PageTitle>
          <PageDescription>Build visual conversational flows.</PageDescription>
        </PageHeading>
        <PageActions>
          <FlowImportExport />
          <Button variant="primary" iconLeft={Plus} onClick={() => setShowCreate(true)}>
            New Flow
          </Button>
        </PageActions>
      </PageHeader>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={Workflow} />
        <StatCard label="Published" value={stats.published} icon={Zap} />
        <StatCard label="Drafts" value={stats.draft} icon={CirclePause} />
        <StatCard label="Groups" value={stats.groups} icon={GitBranch} />
      </div>

      {/* Recent activity / today's flows */}
      {flows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <RecentActivityFeed />
          </div>
          <Card padding="none" className="overflow-hidden lg:col-span-2">
            <CardHeader className="flex flex-row items-center gap-2.5 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] py-3">
              <Zap className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              <CardTitle className="text-[13px]">Today&apos;s activity</CardTitle>
            </CardHeader>
            <CardBody className="px-4 py-3">
              {flows.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-[var(--st-text-secondary)]">
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
                          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--st-bg-secondary)]"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/dashboard/sabflow/flow-builder/${flow._id}`,
                              )
                            }
                            className="min-w-0 flex-1 justify-start truncate text-left"
                          >
                            {flow.name}
                          </Button>
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
            </CardBody>
          </Card>
        </div>
      )}

      {/* Templates section */}
      {flows.length === 0 && !isPending ? (
        <Card padding="lg" className="border-dashed bg-[var(--st-bg-secondary)]/40">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-[var(--st-text)]">
              Get started quickly
            </span>
          </div>
          <FlowTemplates onFlowCreated={fetchFlows} />
        </Card>
      ) : flows.length > 0 ? (
        <FlowTemplates onFlowCreated={fetchFlows} />
      ) : null}

      {/* My Flows section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-[15px] font-semibold text-[var(--st-text)]">
            My Flows
          </h2>

          <Input
            type="text"
            placeholder="Search flows"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            iconLeft={Search}
            aria-label="Search flows"
            className="w-48 sm:w-64"
          />

          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={fetchFlows}
            disabled={isPending}
            className={cn(isPending && "[&_svg]:animate-spin")}
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* View toggle: segmented icon buttons */}
          <div
            role="group"
            aria-label="View mode"
            className="flex items-center gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] p-0.5"
          >
            <IconButton
              icon={LayoutGrid}
              label="Grid view"
              size="sm"
              variant={viewMode === "grid" ? "primary" : "ghost"}
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
            />
            <IconButton
              icon={List}
              label="List view"
              size="sm"
              variant={viewMode === "list" ? "primary" : "ghost"}
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            />
          </div>
        </div>

        {/* Skeleton while first load */}
        {isPending && flows.length === 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} padding="none" className="overflow-hidden">
                  <Skeleton height={130} width="100%" radius={0} />
                  <div className="flex flex-col gap-2 p-3">
                    <Skeleton height={12} width="75%" />
                    <Skeleton height={10} width="50%" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card padding="none" className="overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-[var(--st-border)] px-4 py-4 last:border-0"
                >
                  <Skeleton height={12} width={176} />
                  <Skeleton height={12} width={64} />
                  <Skeleton circle width={24} className="ml-auto" />
                </div>
              ))}
            </Card>
          )
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title={query ? "No matching flows" : "No flows yet"}
            description={
              query
                ? `Nothing matched "${query}". Try a different keyword.`
                : "Create your first SabFlow to build conversational bots."
            }
            action={
              !query ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setShowCreate(true)}>
                  Create your first flow
                </Button>
              ) : undefined
            }
          />
        ) : viewMode === "grid" ? (
          /* Grid view (shared FlowCard) */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((flow) => (
              <FlowCard
                key={flow._id}
                flow={flow}
                onDelete={(f) => setDeleteTarget({ id: f._id, name: f.name })}
                onDuplicate={handleDuplicate}
                onRename={handleRename}
              />
            ))}
          </div>
        ) : (
          /* List view */
          <Card padding="none" className="overflow-hidden">
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Groups</Th>
                  <Th className="hidden sm:table-cell">Created</Th>
                  <Th>Updated</Th>
                  <Th className="hidden md:table-cell">Today</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.map((flow) => {
                  const isPublished = flow.status === "PUBLISHED";
                  const todayCount = todayCounts[flow._id] ?? 0;
                  return (
                    <Tr key={flow._id} className="group">
                      <Td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/dashboard/sabflow/flow-builder/${flow._id}`,
                            )
                          }
                          className="justify-start text-left font-medium"
                        >
                          {flow.name}
                        </Button>
                      </Td>

                      <Td>
                        <Badge variant={isPublished ? "success" : "warning"}>
                          {isPublished ? "Published" : "Draft"}
                        </Badge>
                      </Td>

                      <Td className="tabular-nums text-[var(--st-text-secondary)]">
                        {flow.groups?.length ?? 0}
                      </Td>

                      <Td className="hidden text-[11.5px] text-[var(--st-text-secondary)] sm:table-cell">
                        {flow.createdAt
                          ? format(new Date(flow.createdAt), "MMM d, yyyy")
                          : "-"}
                      </Td>

                      <Td className="text-[11.5px] text-[var(--st-text-secondary)]">
                        {flow.updatedAt
                          ? format(new Date(flow.updatedAt), "MMM d, yyyy, HH:mm")
                          : "-"}
                      </Td>

                      <Td className="hidden md:table-cell">
                        {todayCount > 0 ? (
                          <Badge variant="secondary" className="tabular-nums">
                            +{todayCount}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-[var(--st-text-secondary)]">
                            -
                          </span>
                        )}
                      </Td>

                      <Td align="right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              icon={MoreHorizontal}
                              label="Flow actions"
                              size="sm"
                              variant="ghost"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              iconLeft={Pencil}
                              onClick={() =>
                                router.push(
                                  `/dashboard/sabflow/flow-builder/${flow._id}`,
                                )
                              }
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              iconLeft={BarChart3}
                              onClick={() =>
                                router.push(
                                  `/dashboard/sabflow/logs?flowId=${flow._id}`,
                                )
                              }
                            >
                              Results
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              iconLeft={Play}
                              onClick={() => handleRunNow(flow._id)}
                            >
                              Run now
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              iconLeft={isPublished ? ToggleRight : ToggleLeft}
                              onClick={() => handleToggleActive(flow)}
                            >
                              {isPublished ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              iconLeft={Copy}
                              onClick={() => handleDuplicate(flow._id)}
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              iconLeft={Download}
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = `/api/sabflow/export/${flow._id}`;
                                a.download = `flow-${flow._id}.json`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                            >
                              Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="danger"
                              iconLeft={Trash2}
                              onClick={() =>
                                setDeleteTarget({ id: flow._id, name: flow.name })
                              }
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Create flow dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New SabFlow</DialogTitle>
            <DialogDescription>
              Give your flow a name. You can change it later in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Flow name"
              aria-label="Flow name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Creating
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flow?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="font-medium text-[var(--st-text)]">
                &ldquo;{deleteTarget?.name}&rdquo;
              </strong>{" "}
              will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              intent="danger"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Deleting
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
