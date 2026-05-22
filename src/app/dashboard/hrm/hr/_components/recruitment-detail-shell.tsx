import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  Pencil,
  Printer,
  Mail,
  Copy,
  Trash2,
  Activity,
  ChevronRight,
  } from 'lucide-react';

/**
 * RecruitmentDetailShell — §1D.2 detail-page chrome shared by every HR
 * recruitment pillar. Wraps the shared `<EntityDetailShell>` with:
 *   • a header action group (7-8 buttons per spec — Edit / Print /
 *     Email / Duplicate / Activity / Delete plus per-entity actions)
 *   • a body composed of "DetailCard" sections rendering every field
 *   • a right rail composed of related-entity chips + audit summary
 *
 * Server-side (RSC) — receives data already loaded; emits only client
 * islands for status-pill dropdowns and confirm dialogs.
 *
 * Per-entity callers pass a `body` (e.g. <CandidateBody />) plus an
 * `actions` array describing the header buttons.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface DetailAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  /** primary | outline | ghost | destructive — defaults to ghost */
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

export interface RecruitmentDetailShellProps {
  title: string;
  eyebrow?: string;
  status?: { label: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral' };
  back: { href: string; label: string };
  /** Header action group — 7-8 actions recommended. */
  actions?: DetailAction[];
  /**
   * Optional pre-built action slot rendered after `actions`. Use this
   * to mount a client island (e.g. `<HrActionButtons />`) for wired
   * mutations alongside the static link-style buttons in `actions`.
   */
  actionsSlot?: React.ReactNode;
  /** Main body content (the per-entity field cards). */
  children: React.ReactNode;
  /** Right rail — related entities + quick stats. */
  rightRail?: React.ReactNode;
  /**
   * Footer activity slot. Either pass an object
   * `{ entityKind, entityId }` (the shell renders
   * `<EntityAuditTimeline>` for you — the common case) or pass any
   * `ReactNode` (escape hatch when a custom footer is needed).
   * Mirrors the union shape of `EntityDetailShell['audit']`.
   */
  audit?:
    | { entityKind: string; entityId: string }
    | React.ReactNode;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function RecruitmentDetailShell({
  title,
  eyebrow,
  status,
  back,
  actions,
  actionsSlot,
  children,
  rightRail,
  audit,
}: RecruitmentDetailShellProps) {
  const hasActions = (actions && actions.length > 0) || actionsSlot;
  // Resolve the audit prop locally so the object form renders the
  // shared `<EntityAuditTimeline>` and ReactNode forms pass through
  // for back-compat. Mirrors `EntityDetailShell`'s own handling.
  const auditNode: React.ReactNode = isAuditDescriptor(audit)
    ? (
        <EntityAuditTimeline
          entityKind={audit.entityKind}
          entityId={audit.entityId}
        />
      )
    : (audit as React.ReactNode);
  return (
    <EntityDetailShell
      title={title}
      eyebrow={eyebrow}
      status={status}
      back={back}
      audit={auditNode}
      actions={
        hasActions ? (
          <div className="flex flex-wrap items-center gap-1">
            {actions
              ? actions.map((a) => {
                  const variant = a.variant || 'ghost';
                  const cls =
                    variant === 'destructive'
                      ? 'text-zoru-danger-ink'
                      : undefined;
                  const inner = (
                    <>
                      {a.icon}
                      <span>{a.label}</span>
                    </>
                  );
                  if (a.href) {
                    return (
                      <Button
                        key={a.key}
                        variant={variant === 'destructive' ? 'ghost' : variant}
                        size="sm"
                        className={cls}
                        asChild
                      >
                        <Link href={a.href}>{inner}</Link>
                      </Button>
                    );
                  }
                  return (
                    <Button
                      key={a.key}
                      variant={variant === 'destructive' ? 'ghost' : variant}
                      size="sm"
                      className={cls}
                      type="button"
                    >
                      {inner}
                    </Button>
                  );
                })
              : null}
            {actionsSlot}
          </div>
        ) : null
      }
      rightRail={rightRail}
    >
      {children}
    </EntityDetailShell>
  );
}

function isAuditDescriptor(
  value: unknown,
): value is { entityKind: string; entityId: string } {
  if (!value || typeof value !== 'object') return false;
  if (React.isValidElement(value)) return false;
  const v = value as { entityKind?: unknown; entityId?: unknown };
  return typeof v.entityKind === 'string' && typeof v.entityId === 'string';
}

/* ─── DetailCard — section card with title + 2-col grid of rows ───── */
export interface DetailRow {
  label: string;
  value?: React.ReactNode;
}

export function DetailCard({
  title,
  rows,
  children,
}: {
  title: string;
  rows?: DetailRow[];
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-[15px]">{title}</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-2.5 text-[13px]">
        {rows ? (
          <dl className="grid gap-2.5 md:grid-cols-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <dt className="w-36 shrink-0 text-zoru-ink-muted">
                  {r.label}
                </dt>
                <dd className="min-w-0 flex-1 break-words text-zoru-ink">
                  {r.value === null ||
                  r.value === undefined ||
                  r.value === ''
                    ? '—'
                    : r.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {children}
      </ZoruCardContent>
    </Card>
  );
}

/* ─── RailCard — right-rail compact card with quick stats / chips ─── */
export function RailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-0">
      <ZoruCardHeader className="pb-2">
        <ZoruCardTitle className="text-[13px] font-medium uppercase tracking-wide text-zoru-ink-muted">
          {title}
        </ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-2 text-[13px]">
        {children}
      </ZoruCardContent>
    </Card>
  );
}

/* ─── RailLink — chip with arrow + count badge ────────────────────── */
export function RailLink({
  href,
  label,
  count,
  hint,
}: {
  href: string;
  label: string;
  count?: number;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-transparent px-2 py-1.5 text-zoru-ink hover:border-zoru-line hover:bg-zoru-surface-2"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{label}</span>
        {hint ? (
          <span className="text-[11px] text-zoru-ink-muted">{hint}</span>
        ) : null}
      </span>
      <span className="flex items-center gap-1 shrink-0 text-zoru-ink-muted">
        {typeof count === 'number' ? (
          <span className="rounded-full bg-zoru-surface-2 px-2 py-0.5 text-[11px]">
            {count}
          </span>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

/* ─── Standard action bundles ──────────────────────────────────────── */

export function makeStandardActions(opts: {
  editHref: string;
  activityHref: string;
  duplicateHref?: string;
  emailHref?: string;
  printHref?: string;
  extra?: DetailAction[];
}): DetailAction[] {
  const out: DetailAction[] = [
    {
      key: 'edit',
      label: 'Edit',
      icon: <Pencil className="h-3.5 w-3.5" />,
      href: opts.editHref,
      variant: 'outline',
    },
  ];
  if (opts.extra) out.push(...opts.extra);
  out.push({
    key: 'duplicate',
    label: 'Duplicate',
    icon: <Copy className="h-3.5 w-3.5" />,
    href: opts.duplicateHref,
  });
  if (opts.emailHref) {
    out.push({
      key: 'email',
      label: 'Email',
      icon: <Mail className="h-3.5 w-3.5" />,
      href: opts.emailHref,
    });
  }
  out.push({
    key: 'print',
    label: 'Print',
    icon: <Printer className="h-3.5 w-3.5" />,
    href: opts.printHref || '#',
  });
  out.push({
    key: 'activity',
    label: 'Activity',
    icon: <Activity className="h-3.5 w-3.5" />,
    href: opts.activityHref,
  });
  return out;
}

/* ─── Re-export helpers ───────────────────────────────────────────── */
export { StatusPill, statusToTone };
