import { Badge, type ZoruBadgeProps } from '@/components/sabcrm/20ui/compat';
import {
  ArrowLeft } from 'lucide-react';
import { type ReactNode } from 'react';

/**
 * <EntityDetailShell /> — reusable detail-page layout for any CRM entity
 * (per `docs/ecosystem/CRM_PLAN.md` §A8).
 *
 * Layout:
 *   ┌───────────────────────────────────────────────┐
 *   │  back · eyebrow · TITLE · status   [ actions ]│  header
 *   ├──────────────────────────────┬────────────────┤
 *   │  children                    │  rightRail     │  two-col body
 *   │                              │  (320px sticky)│
 *   └──────────────────────────────┴────────────────┘
 *   │  Activity (EntityAuditTimeline, if `audit`)   │  footer
 *
 * Server component — composes client islands via `actions` / `children`.
 * No business logic; pure presentation.
 */
import Link from 'next/link';

/* ─── Types ──────────────────────────────────────────────────────────── */

export type EntityStatusTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

export interface EntityDetailShellProps {
    /** Page title (e.g. "Invoice INV-001"). */
    title: string;
    /** Optional small label above the title (e.g. "INVOICE"). */
    eyebrow?: string;
    /** Status pill rendered next to the title. */
    status?: { label: string; tone?: EntityStatusTone };
    /** Top-right action area — e.g. edit / convert / delete buttons. */
    actions?: ReactNode;
    /** Main body content. */
    children: ReactNode;
    /** Right rail — related entities, lineage rail, etc. */
    rightRail?: ReactNode;
    /**
     * Footer activity slot. Pass `<EntityAuditTimeline />` directly (or any
     * other ReactNode). The shell does not import EntityAuditTimeline itself
     * so this file stays free of server-only deps and can be imported from
     * client components.
     */
    audit?: ReactNode;
    /** Back link rendered above the title. */
    back?: { href: string; label: string };
}

/* ─── Status tone mapping ────────────────────────────────────────────── */

const TONE_TO_VARIANT: Record<EntityStatusTone, ZoruBadgeProps['variant']> = {
    green: 'success' as ZoruBadgeProps['variant'],
    amber: 'warning' as ZoruBadgeProps['variant'],
    red: 'danger' as ZoruBadgeProps['variant'],
    blue: 'info' as ZoruBadgeProps['variant'],
    neutral: 'default' as ZoruBadgeProps['variant'],
};

/* ─── Component ──────────────────────────────────────────────────────── */

export function EntityDetailShell({
    title,
    eyebrow,
    status,
    actions,
    children,
    rightRail,
    audit,
    back,
}: EntityDetailShellProps) {
    const tone = status?.tone ?? 'neutral';
    const badgeVariant = TONE_TO_VARIANT[tone];

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Header */}
            <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                    {back ? (
                        <Link
                            href={back.href}
                            className="inline-flex items-center gap-1 text-xs text-[var(--st-text)] hover:text-[var(--st-text)] dark:hover:text-white"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            {back.label}
                        </Link>
                    ) : null}
                    {eyebrow ? (
                        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--st-text)]">
                            {eyebrow}
                        </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                        <h1 className="truncate text-2xl font-semibold text-[var(--st-text)] dark:text-white">
                            {title}
                        </h1>
                        {status ? (
                            <Badge variant={badgeVariant}>{status.label}</Badge>
                        ) : null}
                    </div>
                </div>
                {actions ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
                ) : null}
            </header>

            {/* Body: two-column desktop, stacked mobile */}
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <main className="min-w-0 flex-1 space-y-6">{children}</main>
                {rightRail ? (
                    <aside className="w-full md:w-80 md:shrink-0">
                        <div className="md:sticky md:top-4 space-y-4">{rightRail}</div>
                    </aside>
                ) : null}
            </div>

            {/* Footer: audit timeline. Caller passes the timeline (or any
                ReactNode) — keeps the shell client-safe. */}
            {audit ? (
                <section aria-label="Activity">{audit}</section>
            ) : null}
        </div>
    );
}
