import * as React from "react";

import { Card, Skeleton } from "@/components/sabcrm/20ui";

import "./wachat-motion.css";

/**
 * Content-shaped shimmer skeletons for WaChat route `loading.tsx` files.
 * Built on the 20ui `Skeleton` shimmer; rows/cards cascade in via the motion
 * kit's stagger class (reduced-motion → plain fade). Server-safe (no hooks).
 */

function staggerStyle(i: number): React.CSSProperties {
  return { ["--i" as string]: i } as React.CSSProperties;
}

function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton width={200} height={24} radius={6} />
        <Skeleton width={340} height={13} radius={5} />
      </div>
      {action ? <Skeleton width={140} height={36} radius={8} /> : null}
    </div>
  );
}

/** Dashboard / analytics: KPI strip + chart + side panel. */
export function WaDashboardSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="wachat-motion mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: kpis }).map((_, i) => (
          <Card key={i} className="wachat-stagger-item flex flex-col gap-3 p-4" style={staggerStyle(i)}>
            <Skeleton width={96} height={12} radius={5} />
            <Skeleton width={88} height={28} radius={6} />
            <Skeleton width={64} height={11} radius={5} />
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="wachat-stagger-item space-y-4 p-5 lg:col-span-2" style={staggerStyle(kpis)}>
          <Skeleton width={220} height={16} radius={6} />
          <Skeleton height={220} radius={10} />
        </Card>
        <Card className="wachat-stagger-item space-y-3 p-5" style={staggerStyle(kpis + 1)}>
          <Skeleton width={140} height={14} radius={6} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton circle width={28} />
              <div className="flex-1 space-y-1.5">
                <Skeleton width="50%" height={12} radius={5} />
                <Skeleton width="80%" height={10} radius={5} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/** Generic table page (contacts, templates, broadcasts list, logs). */
export function WaTableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="wachat-motion mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeaderSkeleton />
      <Card className="mt-6 overflow-hidden p-0">
        <div
          className="grid gap-3 border-b border-[var(--st-border)] px-4 py-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} width="60%" height={12} radius={5} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="wachat-stagger-item grid items-center gap-3 border-b border-[var(--st-border)] px-4 py-3 last:border-0"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ...staggerStyle(r) }}
          >
            <div className="flex items-center gap-2.5">
              <Skeleton circle width={32} />
              <Skeleton width="55%" height={13} radius={5} />
            </div>
            {Array.from({ length: cols - 1 }).map((_, c) => (
              <Skeleton key={c} width={`${50 + ((c * 17) % 35)}%`} height={12} radius={5} />
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}

/** Three-pane inbox: conversation list · thread · contact panel. */
export function WaInboxSkeleton() {
  return (
    <div className="wachat-motion grid h-[calc(100vh-3.5rem)] grid-cols-[minmax(300px,360px)_1fr_minmax(260px,320px)] gap-0">
      {/* conversation list */}
      <div className="space-y-2 border-r border-[var(--st-border)] p-3">
        <Skeleton height={36} radius={10} />
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="wachat-stagger-item flex items-center gap-3 rounded-lg px-2 py-2.5"
            style={staggerStyle(i)}
          >
            <Skeleton circle width={44} />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton width="45%" height={13} radius={5} />
                <Skeleton width={32} height={10} radius={5} />
              </div>
              <Skeleton width="80%" height={11} radius={5} />
            </div>
          </div>
        ))}
      </div>
      {/* thread */}
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--st-border)] px-5 py-3">
          <Skeleton circle width={40} />
          <div className="space-y-1.5">
            <Skeleton width={160} height={14} radius={5} />
            <Skeleton width={100} height={11} radius={5} />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-6">
          {[
            { side: "in", w: "55%" },
            { side: "in", w: "40%" },
            { side: "out", w: "62%" },
            { side: "in", w: "48%" },
            { side: "out", w: "50%" },
            { side: "out", w: "35%" },
          ].map((m, i) => (
            <div key={i} className={`flex ${m.side === "out" ? "justify-end" : "justify-start"}`}>
              <Skeleton width={m.w} height={44} radius={14} />
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--st-border)] p-4">
          <Skeleton height={44} radius={12} />
        </div>
      </div>
      {/* contact panel */}
      <div className="space-y-4 border-l border-[var(--st-border)] p-5">
        <div className="flex flex-col items-center gap-2">
          <Skeleton circle width={72} />
          <Skeleton width={140} height={15} radius={6} />
          <Skeleton width={100} height={11} radius={5} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton width={90} height={11} radius={5} />
            <Skeleton height={32} radius={8} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kanban board: columns of stacked cards. */
export function WaKanbanSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="wachat-motion h-[calc(100vh-7rem)] overflow-hidden p-4">
      <PageHeaderSkeleton />
      <div className="mt-4 grid h-full gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, c) => (
          <Card key={c} className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between">
              <Skeleton width="50%" height={13} radius={5} />
              <Skeleton width={24} height={18} radius={999} />
            </div>
            {Array.from({ length: 3 + (c % 2) }).map((_, i) => (
              <Card
                key={i}
                className="wachat-stagger-item space-y-2 p-3"
                style={staggerStyle(c * 3 + i)}
              >
                <Skeleton width="70%" height={12} radius={5} />
                <Skeleton width="90%" height={10} radius={5} />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton circle width={22} />
                  <Skeleton width={48} height={16} radius={999} />
                </div>
              </Card>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Builder / wizard (template builder, flow create, broadcast composer). */
export function WaBuilderSkeleton() {
  return (
    <div className="wachat-motion grid h-[calc(100vh-7rem)] grid-cols-[1fr_minmax(300px,360px)] gap-4 p-4">
      <Card className="space-y-5 p-6">
        <Skeleton width={220} height={18} radius={6} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="wachat-stagger-item space-y-2" style={staggerStyle(i)}>
            <Skeleton width={130} height={12} radius={5} />
            <Skeleton height={40} radius={8} />
          </div>
        ))}
      </Card>
      {/* live preview pane */}
      <Card className="flex flex-col items-center gap-4 p-6">
        <Skeleton width={120} height={12} radius={5} />
        <Skeleton width={260} height={460} radius={28} />
      </Card>
    </div>
  );
}
