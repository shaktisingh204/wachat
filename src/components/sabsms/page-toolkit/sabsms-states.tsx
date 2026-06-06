"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Inbox } from "lucide-react";

import {
  Button,
  EmptyState,
  Skeleton,
} from "@/components/zoruui";

export interface SabsmsEmptyProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function SabsmsEmpty({ icon, title, description, action }: SabsmsEmptyProps) {
  return (
    <div className="rounded-md border border-dashed border-[var(--st-border)] bg-white p-10">
      <EmptyState
        icon={icon ?? <Inbox />}
        title={title}
        description={description}
        action={
          action ? (
            action.href ? (
              <Button asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button onClick={action.onClick}>{action.label}</Button>
            )
          ) : undefined
        }
      />
    </div>
  );
}

export interface SabsmsErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function SabsmsErrorState({ message, onRetry }: SabsmsErrorStateProps) {
  return (
    <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--st-text)]" />
        <div className="flex-1">
          <div className="font-medium text-[var(--st-text)]">Something went wrong</div>
          <div className="mt-1 text-sm text-[var(--st-text)]">{message}</div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface SabsmsTableSkeletonProps {
  columns: number;
  rows?: number;
}

export function SabsmsTableSkeleton({ columns, rows = 10 }: SabsmsTableSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--st-border)] bg-white">
      <div className="grid bg-[var(--st-bg-muted)] p-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-3/4" />
        ))}
      </div>
      <div className="divide-y divide-[var(--st-border)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid p-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-2/3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
