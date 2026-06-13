import * as React from "react";

import { Card, Skeleton } from "@/components/sabcrm/20ui";

import "./sabmail-motion.css";

/**
 * Content-shaped shimmer skeletons for SabMail route `loading.tsx` files.
 * Built on the 20ui `Skeleton` shimmer; rows/cards cascade in via the motion
 * kit's stagger class (reduced-motion → plain fade). Server-safe.
 */

function staggerStyle(i: number): React.CSSProperties {
  return { ["--i" as string]: i } as React.CSSProperties;
}

function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton width={180} height={22} radius={6} />
        <Skeleton width={320} height={13} radius={5} />
      </div>
      {action ? <Skeleton width={132} height={34} radius={8} /> : null}
    </div>
  );
}

export function DashboardSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="sabmail-motion mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: kpis }).map((_, i) => (
          <Card
            key={i}
            className="sabmail-stagger-item flex flex-col gap-3 p-4"
            style={staggerStyle(i)}
          >
            <Skeleton width={90} height={12} radius={5} />
            <Skeleton width={80} height={26} radius={6} />
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="sabmail-stagger-item space-y-4 p-5 lg:col-span-2" style={staggerStyle(kpis)}>
          <Skeleton width={200} height={16} radius={6} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton circle width={32} />
              <div className="flex-1 space-y-1.5">
                <Skeleton width="40%" height={13} radius={5} />
                <Skeleton width="70%" height={11} radius={5} />
              </div>
            </div>
          ))}
        </Card>
        <Card className="sabmail-stagger-item space-y-3 p-5" style={staggerStyle(kpis + 1)}>
          <Skeleton width={140} height={14} radius={6} />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={28} radius={8} />
          ))}
        </Card>
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="sabmail-motion mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeaderSkeleton />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <Card
            key={i}
            className="sabmail-stagger-item flex flex-col gap-3 p-5"
            style={staggerStyle(i)}
          >
            <div className="flex items-center gap-2">
              <Skeleton circle width={36} />
              <Skeleton width="55%" height={15} radius={6} />
            </div>
            <Skeleton width="40%" height={11} radius={5} />
            <Skeleton height={34} radius={8} className="mt-auto" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="sabmail-motion mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeaderSkeleton />
      <Card className="mt-6 space-y-2 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="sabmail-stagger-item flex items-center justify-between gap-3 rounded-md border border-[var(--st-border)] px-3 py-2.5"
            style={staggerStyle(i)}
          >
            <div className="flex items-center gap-3">
              <Skeleton circle width={36} />
              <div className="space-y-1.5">
                <Skeleton width={200} height={13} radius={5} />
                <Skeleton width={140} height={11} radius={5} />
              </div>
            </div>
            <Skeleton width={70} height={22} radius={999} />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function WizardSkeleton() {
  return (
    <div className="sabmail-motion mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-2">
        <Skeleton width={140} height={12} radius={5} />
        <Skeleton width={260} height={22} radius={6} />
      </div>
      <div className="mb-6 flex items-center gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <React.Fragment key={i}>
            <Skeleton circle width={28} />
            {i < 2 ? <Skeleton width={48} height={2} radius={2} /> : null}
          </React.Fragment>
        ))}
      </div>
      <Card className="space-y-5 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sabmail-stagger-item space-y-2" style={staggerStyle(i)}>
            <Skeleton width={120} height={12} radius={5} />
            <Skeleton height={38} radius={8} />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton width={88} height={36} radius={8} />
          <Skeleton width={120} height={36} radius={8} />
        </div>
      </Card>
    </div>
  );
}

/** Three-pane inbox skeleton: account/folder rail · message list · reading pane. */
export function InboxSkeleton() {
  return (
    <div className="sabmail-motion grid h-[calc(100vh-7rem)] grid-cols-[220px_minmax(280px,360px)_1fr] gap-3 p-4">
      {/* rail */}
      <Card className="space-y-3 p-3">
        <Skeleton width="70%" height={14} radius={6} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="sabmail-stagger-item flex items-center gap-2"
            style={staggerStyle(i)}
          >
            <Skeleton circle width={18} />
            <Skeleton width={`${50 + ((i * 13) % 40)}%`} height={12} radius={5} />
          </div>
        ))}
      </Card>
      {/* list */}
      <Card className="space-y-2 p-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="sabmail-stagger-item space-y-1.5 rounded-md border-l-2 border-transparent px-3 py-2.5"
            style={staggerStyle(i)}
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton width="45%" height={13} radius={5} />
              <Skeleton width={36} height={10} radius={5} />
            </div>
            <Skeleton width="80%" height={12} radius={5} />
            <Skeleton width="95%" height={10} radius={5} />
          </div>
        ))}
      </Card>
      {/* reading pane */}
      <Card className="flex flex-col gap-4 p-6">
        <Skeleton width="60%" height={20} radius={6} />
        <div className="flex items-center gap-3">
          <Skeleton circle width={40} />
          <div className="space-y-1.5">
            <Skeleton width={180} height={13} radius={5} />
            <Skeleton width={120} height={11} radius={5} />
          </div>
        </div>
        <div className="mt-2 space-y-2.5">
          {[92, 86, 95, 70, 88, 60].map((w, i) => (
            <Skeleton key={i} width={`${w}%`} height={12} radius={5} />
          ))}
        </div>
      </Card>
    </div>
  );
}
