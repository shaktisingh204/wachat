"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Inbox } from "lucide-react";

import { Alert, Button, Card, EmptyState, Skeleton } from "@/components/sabcrm/20ui";

export interface SabsmsEmptyProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function SabsmsEmpty({ icon, title, description, action }: SabsmsEmptyProps) {
  const router = useRouter();
  const actionNode = action ? (
    <Button
      onClick={() => {
        if (action.href) router.push(action.href);
        else action.onClick?.();
      }}
    >
      {action.label}
    </Button>
  ) : undefined;

  return (
    <Card padding="none" className="border-dashed p-10">
      <EmptyState
        icon={icon ?? <Inbox />}
        title={title}
        description={description}
        action={actionNode}
      />
    </Card>
  );
}

export interface SabsmsErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function SabsmsErrorState({ message, onRetry }: SabsmsErrorStateProps) {
  return (
    <Alert tone="danger" icon={AlertTriangle} title="Something went wrong">
      <div className="text-sm text-[var(--st-text-secondary)]">{message}</div>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </Alert>
  );
}

export interface SabsmsTableSkeletonProps {
  columns: number;
  rows?: number;
}

export function SabsmsTableSkeleton({ columns, rows = 10 }: SabsmsTableSkeletonProps) {
  const gridTemplateColumns = `repeat(${columns}, minmax(0,1fr))`;
  return (
    <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
      <div className="grid bg-[var(--st-bg-secondary)] p-3" style={{ gridTemplateColumns }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-3/4" />
        ))}
      </div>
      <div className="divide-y divide-[var(--st-border)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid p-3" style={{ gridTemplateColumns }}>
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-2/3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
