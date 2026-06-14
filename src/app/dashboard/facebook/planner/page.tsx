"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  GripVertical,
  Lightbulb,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { format, subDays } from "date-fns";

import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  Skeleton,
  cn,
  useToast,
} from "@/components/sabcrm/20ui";

import { useProject } from "@/context/project-context";
import { getDetailedPageInsights, getScheduledPosts } from "@/app/actions/facebook.actions";
import { PAGE_METRICS } from "@/lib/meta/insights-metrics";
import type { FacebookPost } from "@/lib/definitions";

/**
 * /dashboard/facebook/planner — Smart Scheduling & Approvals.
 *
 * A lightweight content pipeline: stage drafts, drag them Draft → Approved
 * (an approval workflow persisted per-page in localStorage), and hand an
 * approved draft to Create Post prefilled. A best-time-to-post panel derives
 * the most active weekdays from the v25 `page_media_view` series, and the
 * Scheduled column mirrors the real Graph scheduled queue.
 */

type DraftColumn = "draft" | "approved";

interface Draft {
  id: string;
  text: string;
  column: DraftColumn;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function storageKey(projectId: string) {
  return `meta-planner-drafts:${projectId}`;
}

/* ----------------------------------------------------------- draft card -- */

function DraftCard({
  draft,
  onSchedule,
  onDelete,
}: {
  draft: Draft;
  onSchedule?: (d: Draft) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draft.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2.5"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab text-[var(--st-text-tertiary)] active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label="Drag draft"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-[12.5px] leading-snug text-[var(--st-text)]">
          {draft.text}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        {onSchedule ? (
          <Button variant="outline" size="sm" iconRight={ArrowRight} onClick={() => onSchedule(draft)}>
            Schedule
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={() => onDelete(draft.id)} aria-label="Delete draft" />
      </div>
    </div>
  );
}

function Column({
  id,
  title,
  icon,
  tone,
  count,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  tone: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef}>
      <Card
        padding="none"
        className={cn(
          "flex min-h-[320px] flex-col transition-colors",
          isOver && "border-[var(--st-accent)] bg-[var(--st-accent-subtle,rgba(43,110,242,0.05))]",
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--st-border)] px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--st-text)]">
            <span style={{ color: tone }}>{icon}</span> {title}
          </span>
          <Badge variant="secondary">{count}</Badge>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">{children}</div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ page -- */

export default function FacebookPlannerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? "";

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const [scheduled, setScheduled] = useState<FacebookPost[]>([]);
  const [bestDays, setBestDays] = useState<{ day: string; views: number }[]>([]);
  const [loading, startLoading] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load persisted drafts for this page.
  useEffect(() => {
    if (!projectId) return;
    try {
      const raw = localStorage.getItem(storageKey(projectId));
      setDrafts(raw ? (JSON.parse(raw) as Draft[]) : []);
    } catch {
      setDrafts([]);
    }
  }, [projectId]);

  const persist = useCallback(
    (next: Draft[]) => {
      setDrafts(next);
      if (!projectId) return;
      try {
        localStorage.setItem(storageKey(projectId), JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    [projectId],
  );

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const until = new Date();
      const since = subDays(until, 56);
      const [schedRes, viewsRes] = await Promise.all([
        getScheduledPosts(projectId),
        getDetailedPageInsights(projectId, {
          metrics: PAGE_METRICS.views,
          period: "day",
          since: format(since, "yyyy-MM-dd"),
          until: format(until, "yyyy-MM-dd"),
        }),
      ]);
      setScheduled(schedRes.posts ?? []);

      // Best-time heuristic: total views per weekday across the window.
      const series = (viewsRes.insights ?? []) as {
        name: string;
        values?: { value: unknown; end_time?: string }[];
      }[];
      const viewsSeries = series.find((s) => s.name === PAGE_METRICS.views);
      const byDay = new Array(7).fill(0) as number[];
      for (const v of viewsSeries?.values ?? []) {
        if (!v.end_time) continue;
        const d = new Date(v.end_time);
        const n = typeof v.value === "number" ? v.value : Number(v.value);
        if (!Number.isNaN(n)) byDay[d.getDay()] += n;
      }
      const ranked = byDay
        .map((views, i) => ({ day: WEEKDAYS[i], views }))
        .sort((a, b) => b.views - a.views);
      setBestDays(ranked);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addDraft = useCallback(() => {
    const text = draftInput.trim();
    if (!text) return;
    const id = `d-${Date.now()}-${Math.round(performance.now())}`;
    persist([{ id, text, column: "draft" }, ...drafts]);
    setDraftInput("");
  }, [draftInput, drafts, persist]);

  const deleteDraft = useCallback(
    (id: string) => persist(drafts.filter((d) => d.id !== id)),
    [drafts, persist],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const overId = event.over?.id;
      if (overId !== "draft" && overId !== "approved") return;
      const id = String(event.active.id);
      persist(drafts.map((d) => (d.id === id ? { ...d, column: overId as DraftColumn } : d)));
    },
    [drafts, persist],
  );

  const scheduleDraft = useCallback(
    (d: Draft) => {
      try {
        sessionStorage.setItem("meta-studio-caption", d.text);
      } catch {
        /* ignore */
      }
      toast({ title: "Opening Create Post", description: "Draft copied into the composer." });
      router.push("/dashboard/facebook/create-post");
    },
    [router, toast],
  );

  const draftCol = useMemo(() => drafts.filter((d) => d.column === "draft"), [drafts]);
  const approvedCol = useMemo(() => drafts.filter((d) => d.column === "approved"), [drafts]);
  const topDays = bestDays.filter((d) => d.views > 0).slice(0, 2);
  const maxViews = Math.max(1, ...bestDays.map((d) => d.views));

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={CalendarClock}
          title="No page selected"
          description="Pick a Facebook page to plan and approve content."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-12">
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
            <BreadcrumbPage>Planner</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5" bordered={false}>
        <PageHeading>
          <PageEyebrow>Smart scheduling</PageEyebrow>
          <PageTitle>Content planner &amp; approvals</PageTitle>
          <PageDescription>
            Stage drafts, drag them through approval, and schedule at your audience&apos;s
            most active times.
          </PageDescription>
        </PageHeading>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} iconLeft={RefreshCw}>
          Refresh
        </Button>
      </PageHeader>

      {/* best time to post */}
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6"
      >
        <Card padding="lg" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            <span className="text-[13px] text-[var(--st-text)]">Best time to post</span>
            {topDays.length > 0 ? (
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                · Most active on{" "}
                <strong className="text-[var(--st-text)]">
                  {topDays.map((d) => d.day).join(" & ")}
                </strong>
              </span>
            ) : null}
          </div>
          {loading && bestDays.length === 0 ? (
            <Skeleton className="h-16 w-full" />
          ) : bestDays.every((d) => d.views === 0) ? (
            <p className="text-[12px] text-[var(--st-text-tertiary)]">
              Not enough Views data yet to recommend a time.
            </p>
          ) : (
            <div className="flex items-end gap-2">
              {bestDays
                .slice()
                .sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day))
                .map((d) => {
                  const h = Math.round((d.views / maxViews) * 56) + 4;
                  const isTop = topDays.some((t) => t.day === d.day);
                  return (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                      <m.div
                        initial={{ height: 0 }}
                        animate={{ height: h }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          "w-full rounded-t-[3px]",
                          isTop ? "bg-[var(--st-accent)]" : "bg-[var(--st-bg-muted)]",
                        )}
                        style={{ height: h }}
                      />
                      <span className="text-[10.5px] text-[var(--st-text-tertiary)]">{d.day}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </m.div>

      {/* add draft */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Input
          value={draftInput}
          onChange={(e) => setDraftInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addDraft();
          }}
          placeholder="Jot a post idea or paste a draft…"
          aria-label="New draft"
          className="min-w-[260px] flex-1"
        />
        <Button variant="primary" size="md" onClick={addDraft} disabled={!draftInput.trim()} iconLeft={Plus}>
          Add draft
        </Button>
        <Button variant="outline" size="md" asChild>
          <a href="/dashboard/facebook/studio">
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            Write with AI
          </a>
        </Button>
      </div>

      {/* approval board */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Column id="draft" title="Drafts" icon={<Clock className="h-4 w-4" />} tone="var(--st-text-tertiary)" count={draftCol.length}>
            {draftCol.length === 0 ? (
              <p className="px-1 py-6 text-center text-[12px] text-[var(--st-text-tertiary)]">
                Add a draft above to start planning.
              </p>
            ) : (
              draftCol.map((d) => <DraftCard key={d.id} draft={d} onDelete={deleteDraft} />)
            )}
          </Column>

          <Column
            id="approved"
            title="Approved"
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="var(--st-status-ok)"
            count={approvedCol.length}
          >
            {approvedCol.length === 0 ? (
              <p className="px-1 py-6 text-center text-[12px] text-[var(--st-text-tertiary)]">
                Drag drafts here once they&apos;re ready.
              </p>
            ) : (
              approvedCol.map((d) => (
                <DraftCard key={d.id} draft={d} onSchedule={scheduleDraft} onDelete={deleteDraft} />
              ))
            )}
          </Column>

          {/* scheduled (read-only mirror of the Graph queue) */}
          <Card padding="none" className="flex min-h-[320px] flex-col">
            <div className="flex items-center justify-between border-b border-[var(--st-border)] px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--st-text)]">
                <span style={{ color: "var(--st-warn,#d97706)" }}>
                  <CalendarClock className="h-4 w-4" />
                </span>{" "}
                Scheduled
              </span>
              <Badge variant="secondary">{scheduled.length}</Badge>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              {loading && scheduled.length === 0 ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : scheduled.length === 0 ? (
                <p className="px-1 py-6 text-center text-[12px] text-[var(--st-text-tertiary)]">
                  No scheduled posts on this Page.
                </p>
              ) : (
                scheduled.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2.5"
                  >
                    <p className="line-clamp-2 text-[12.5px] text-[var(--st-text)]">
                      {p.message || "Media post"}
                    </p>
                    {p.scheduled_publish_time ? (
                      <p className="mt-1 text-[11px] text-[var(--st-text-tertiary)]">
                        {format(new Date(p.scheduled_publish_time * 1000), "MMM d, p")}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </DndContext>
    </div>
  );
}
