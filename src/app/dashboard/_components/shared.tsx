"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button, Card, cn } from "@/components/zoruui";

export function BigStatCard({
  title,
  subtitle,
  metaLeft,
  metaRight,
  statusLabel,
  statusOk,
  tokens,
  ctaLabel,
  onCtaClick,
}: {
  title: string;
  subtitle: string;
  metaLeft: React.ReactNode;
  metaRight: React.ReactNode;
  statusLabel: string;
  statusOk?: boolean;
  tokens: string[];
  ctaLabel: string;
  onCtaClick: () => void;
}) {
  return (
    <Card className="min-w-[260px] p-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zoru-ink-muted">
        <span className="inline-flex items-center gap-1">{metaLeft}</span>
        <span className="text-zoru-ink-subtle">·</span>
        <span className="inline-flex items-center gap-1">{metaRight}</span>
        <span className="text-zoru-ink-subtle">·</span>
        <span className="inline-flex items-center gap-1">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              statusOk ? "bg-zoru-success" : "bg-zoru-ink-muted"
            )}
          />
          {statusLabel}
        </span>
      </div>

      <div className="mt-2.5">
        <h3 className="text-[18px] tracking-[-0.01em] text-zoru-ink leading-[1.1]">
          {title}
        </h3>
        <p className="mt-0.5 text-[12px] text-zoru-ink-muted leading-tight">
          {subtitle}
        </p>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <InitialsStack initials={tokens} />
        <Button size="sm" onClick={onCtaClick}>
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export function NotificationCard({
  icon,
  title,
  inverted,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  inverted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--zoru-radius)] border px-3 py-2.5 text-left transition-colors",
        inverted
          ? "border-zoru-ink bg-zoru-ink text-zoru-on-primary hover:bg-zoru-ink/90"
          : "border-zoru-line bg-zoru-bg text-zoru-ink hover:bg-zoru-surface",
        "focus-visible:outline-none"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          inverted
            ? "bg-zoru-on-primary/15 text-zoru-on-primary"
            : "bg-zoru-surface-2 text-zoru-ink-muted"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px]">{title}</span>
      <ArrowRight
        className={cn(
          "h-3 w-3 shrink-0",
          inverted ? "text-zoru-on-primary/70" : "text-zoru-ink-subtle"
        )}
      />
    </button>
  );
}

export function ModuleTile({
  icon,
  name,
  primary,
  secondary,
  href,
  status = "ok",
}: {
  icon: React.ReactNode;
  name: string;
  primary: string;
  secondary: string;
  href: string;
  status?: "ok" | "warn" | "off";
}) {
  const router = useRouter();
  const dotClass =
    status === "ok"
      ? "bg-zoru-success"
      : status === "warn"
      ? "bg-zoru-warning"
      : "bg-zoru-ink-subtle";

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="group flex flex-col gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4 text-left transition-shadow hover:shadow-[var(--zoru-shadow-md)] focus-visible:outline-none"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
          {icon}
        </span>
        <span className="inline-flex items-center gap-1 text-[10.5px] text-zoru-ink-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
          {status === "ok" ? "Live" : status === "warn" ? "Pending" : "Idle"}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
          {name}
        </p>
        <p className="text-[18px] tracking-tight text-zoru-ink leading-none">
          {primary}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
          {secondary}
        </p>
      </div>
    </button>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  delta,
  up,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  up?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4 transition-shadow hover:shadow-[var(--zoru-shadow-sm)]">
      <div className="flex items-start justify-between">
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
            {icon}
          </span>
        ) : (
          <span className="h-8 w-8" />
        )}
        {delta !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border px-2 py-1 text-[10px] leading-none",
              up
                ? "border-zoru-success/40 bg-zoru-success/5 text-zoru-success"
                : "border-zoru-danger/40 bg-zoru-danger/5 text-zoru-danger"
            )}
          >
            {up ? (
              <ArrowUpRight className="h-2.5 w-2.5" />
            ) : (
              <ArrowDownRight className="h-2.5 w-2.5" />
            )}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      <div className="mt-3.5 text-[11.5px] text-zoru-ink-muted leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] tracking-[-0.01em] text-zoru-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-zoru-ink-muted leading-tight">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function InitialsStack({
  initials,
  className,
}: {
  initials: string[];
  className?: string;
}) {
  if (initials.length === 0) return null;
  const visible = initials.slice(0, 4);
  const overflow = initials.length - visible.length;
  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {visible.map((s, i) => (
        <span
          key={`${s}-${i}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zoru-bg bg-zoru-surface-2 text-[10px] text-zoru-ink"
        >
          {s}
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zoru-bg bg-zoru-ink text-[10px] text-zoru-on-primary">
          +{overflow}
        </span>
      )}
    </div>
  );
}
