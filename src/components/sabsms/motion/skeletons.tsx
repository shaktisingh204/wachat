import * as React from "react";

import { Card, Skeleton } from "@/components/sabcrm/20ui";

import "./sabsms-motion.css";

/**
 * Content-shaped shimmer skeletons for SabSMS route `loading.tsx` files.
 * Built on the 20ui `Skeleton` shimmer; rows/cards cascade in via the
 * motion kit's stagger class (reduced-motion → plain fade). Server-safe.
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

export function TableSkeleton({
  rows = 8,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="sabsms-motion">
      <PageHeaderSkeleton />
      {/* toolbar */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <Skeleton width={260} height={34} radius={8} />
        <div className="flex gap-2">
          <Skeleton width={92} height={34} radius={8} />
          <Skeleton width={92} height={34} radius={8} />
        </div>
      </div>
      <Card className="overflow-hidden p-0">
        {/* head */}
        <div className="flex items-center gap-4 border-b border-[var(--st-border)] px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} width={i === 0 ? "30%" : "18%"} height={12} radius={5} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="sabsms-stagger-item flex items-center gap-4 border-b border-[var(--st-border)] px-4 py-3 last:border-0"
            style={staggerStyle(r)}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                width={c === 0 ? "30%" : "18%"}
                height={14}
                radius={6}
              />
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}

export function DashboardSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="sabsms-motion">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: kpis }).map((_, i) => (
          <Card
            key={i}
            className="sabsms-stagger-item flex flex-col gap-3 p-4"
            style={staggerStyle(i)}
          >
            <Skeleton width={90} height={12} radius={5} />
            <Skeleton width={120} height={26} radius={6} />
            <Skeleton width={70} height={11} radius={5} />
          </Card>
        ))}
      </div>
      <Card
        className="sabsms-stagger-item mt-6 p-5"
        style={staggerStyle(kpis)}
      >
        <Skeleton width={160} height={16} radius={6} />
        <div className="mt-4 flex items-end gap-2" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton
              key={i}
              width={`${100 / 18}%`}
              height={40 + ((i * 37) % 120)}
              radius={4}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="sabsms-motion">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton circle width={44} />
        <div className="space-y-2">
          <Skeleton width={220} height={20} radius={6} />
          <Skeleton width={140} height={12} radius={5} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="sabsms-stagger-item flex items-center justify-between gap-4"
              style={staggerStyle(i)}
            >
              <Skeleton width={120} height={13} radius={5} />
              <Skeleton width="45%" height={13} radius={5} />
            </div>
          ))}
        </Card>
        <Card className="space-y-3 p-5">
          <Skeleton width={120} height={14} radius={6} />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="sabsms-stagger-item"
              style={staggerStyle(i)}
              height={32}
              radius={8}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="sabsms-motion mx-auto max-w-2xl">
      <PageHeaderSkeleton action={false} />
      <Card className="space-y-5 p-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div
            key={i}
            className="sabsms-stagger-item space-y-2"
            style={staggerStyle(i)}
          >
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

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="sabsms-motion">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <Card
            key={i}
            className="sabsms-stagger-item flex flex-col gap-3 p-5"
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

export function InboxSkeleton() {
  return (
    <div className="sabsms-motion grid h-[70vh] grid-cols-[300px_1fr] gap-4">
      <Card className="space-y-3 p-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="sabsms-stagger-item flex items-center gap-3"
            style={staggerStyle(i)}
          >
            <Skeleton circle width={34} />
            <div className="flex-1 space-y-1.5">
              <Skeleton width="70%" height={12} radius={5} />
              <Skeleton width="90%" height={10} radius={5} />
            </div>
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton width={180} height={16} radius={6} />
        <div className="mt-2 flex-1 space-y-3">
          {[60, 80, 50, 72].map((w, i) => (
            <div
              key={i}
              className={i % 2 ? "flex justify-end" : ""}
            >
              <Skeleton width={`${w}%`} height={40} radius={12} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function WizardSkeleton() {
  return (
    <div className="sabsms-motion mx-auto max-w-3xl">
      <div className="mb-6 space-y-2">
        <Skeleton width={140} height={12} radius={5} />
        <Skeleton width={260} height={22} radius={6} />
      </div>
      <div className="mb-6 flex items-center gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <React.Fragment key={i}>
            <Skeleton circle width={28} />
            {i < 4 ? <Skeleton width={28} height={2} radius={2} /> : null}
          </React.Fragment>
        ))}
      </div>
      <Card className="space-y-5 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="sabsms-stagger-item space-y-2"
            style={staggerStyle(i)}
          >
            <Skeleton width={120} height={12} radius={5} />
            <Skeleton height={38} radius={8} />
          </div>
        ))}
        <div className="flex justify-between pt-2">
          <Skeleton width={84} height={36} radius={8} />
          <Skeleton width={110} height={36} radius={8} />
        </div>
      </Card>
    </div>
  );
}
