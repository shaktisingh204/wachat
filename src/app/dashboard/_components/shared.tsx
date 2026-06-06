"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button, Card, Dot, Badge, cn } from "@/components/sabcrm/20ui";

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
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[var(--st-text-secondary)]">
        <span className="inline-flex items-center gap-1">{metaLeft}</span>
        <span className="text-[var(--st-text-tertiary)]" aria-hidden="true">
          ·
        </span>
        <span className="inline-flex items-center gap-1">{metaRight}</span>
        <span className="text-[var(--st-text-tertiary)]" aria-hidden="true">
          ·
        </span>
        <span className="inline-flex items-center gap-1">
          <Dot tone={statusOk ? "success" : "neutral"} aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <div className="mt-2.5">
        <h3 className="text-[18px] tracking-[-0.01em] text-[var(--st-text)] leading-[1.1]">
          {title}
        </h3>
        <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)] leading-tight">
          {subtitle}
        </p>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <InitialsStack initials={tokens} />
        <Button size="sm" variant="primary" iconRight={ArrowRight} onClick={onCtaClick}>
          {ctaLabel}
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
    <Button
      variant={inverted ? "primary" : "secondary"}
      block
      onClick={onClick}
      className={cn(
        "[&.u-btn]:h-auto [&.u-btn]:justify-start [&.u-btn]:gap-2 [&.u-btn]:px-3 [&.u-btn]:py-2.5 [&.u-btn]:text-left",
        "[&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:items-center [&_.u-btn__label]:gap-2"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          inverted
            ? "bg-[var(--st-text-inverted)]/15 text-[var(--st-text-inverted)]"
            : "bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px]">{title}</span>
      <ArrowRight
        aria-hidden="true"
        className={cn(
          "h-3 w-3 shrink-0",
          inverted ? "text-[var(--st-text-inverted)]/70" : "text-[var(--st-text-tertiary)]"
        )}
      />
    </Button>
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
  const dotTone = status === "ok" ? "success" : status === "warn" ? "warning" : "neutral";

  return (
    <Button
      variant="secondary"
      block
      onClick={() => router.push(href)}
      className={cn(
        "group [&.u-btn]:h-auto [&.u-btn]:flex-col [&.u-btn]:items-stretch [&.u-btn]:gap-3 [&.u-btn]:rounded-[var(--st-radius-lg)] [&.u-btn]:p-4 [&.u-btn]:text-left",
        "[&.u-btn]:transition-shadow hover:[&.u-btn]:shadow-[var(--st-shadow-md)]",
        "[&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:flex-col [&_.u-btn__label]:gap-3 [&_.u-btn__label]:overflow-visible"
      )}
    >
      <span className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] [&_svg]:size-4">
          {icon}
        </span>
        <span className="inline-flex items-center gap-1 text-[10.5px] text-[var(--st-text-secondary)]">
          <Dot tone={dotTone} aria-hidden="true" />
          {status === "ok" ? "Live" : status === "warn" ? "Pending" : "Idle"}
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
          {name}
        </span>
        <span className="text-[18px] tracking-tight text-[var(--st-text)] leading-none">
          {primary}
        </span>
        <span className="mt-0.5 truncate text-[11.5px] text-[var(--st-text-secondary)]">
          {secondary}
        </span>
      </span>
    </Button>
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
    <Card
      padding="none"
      className="p-4 transition-shadow hover:shadow-[var(--st-shadow-sm)]"
    >
      <div className="flex items-start justify-between">
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] [&_svg]:size-4">
            {icon}
          </span>
        ) : (
          <span className="h-8 w-8" />
        )}
        {delta !== undefined ? (
          <Badge tone={up ? "success" : "danger"} kind="outline" className="gap-0.5">
            {up ? (
              <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="h-2.5 w-2.5" aria-hidden="true" />
            )}
            {Math.abs(delta)}%
          </Badge>
        ) : null}
      </div>
      <div className="mt-3.5 text-[11.5px] text-[var(--st-text-secondary)] leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] tracking-[-0.01em] text-[var(--st-text)] leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-[var(--st-text-secondary)] leading-tight">
          {hint}
        </div>
      ) : null}
    </Card>
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
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--st-bg)] bg-[var(--st-bg-muted)] text-[10px] text-[var(--st-text)]"
        >
          {s}
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--st-bg)] bg-[var(--st-text)] text-[10px] text-[var(--st-text-inverted)]">
          +{overflow}
        </span>
      )}
    </div>
  );
}
