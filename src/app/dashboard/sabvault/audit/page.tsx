import * as React from 'react';
import Link from 'next/link';
import {
    ShieldCheck,
    Eye,
    Copy,
    Share2,
    AlertTriangle,
    ScrollText,
    User,
    KeyRound,
    Globe,
    type LucideIcon,
} from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    Badge,
    StatCard,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import { listSabvaultAudit } from '@/app/actions/sabvault.actions';
import type { SabvaultAuditAction } from '@/lib/rust-client/sabvault-audit';

export const dynamic = 'force-dynamic';

type FilterValue = SabvaultAuditAction | undefined;

/** StatCard accent chips need hex values, never token vars. */
const ACCENT = {
    brand: '#3b7af5',
    neutral: '#64748b',
    violet: '#7c3aed',
    danger: '#e0484e',
} as const;

const ACTION_TONE: Record<string, BadgeTone> = {
    reveal: 'info',
    copy: 'neutral',
    share: 'accent',
    unlock_ok: 'success',
    unlock_fail: 'danger',
};

const ACTION_ICON: Record<string, LucideIcon> = {
    reveal: Eye,
    copy: Copy,
    share: Share2,
    unlock_ok: ShieldCheck,
    unlock_fail: AlertTriangle,
};

const ACTION_LABEL: Record<string, string> = {
    reveal: 'reveal',
    copy: 'copy',
    share: 'share',
    unlock_ok: 'unlock',
    unlock_fail: 'unlock failed',
};

export default async function SabvaultAuditPage(props: {
    searchParams: Promise<{ action?: string; secretId?: string; page?: string }>;
}) {
    const sp = await props.searchParams;
    const page = Math.max(0, Number(sp.page) || 0);
    const res = await listSabvaultAudit({
        action: sp.action as SabvaultAuditAction | undefined,
        secretId: sp.secretId,
        page,
        limit: 50,
    });

    const items = res.items;
    const reveals = items.filter((e) => e.action === 'reveal').length;
    const copies = items.filter((e) => e.action === 'copy').length;
    const shares = items.filter((e) => e.action === 'share').length;
    const failures = items.filter((e) => e.action === 'unlock_fail').length;

    return (
        <main className="20ui mx-auto flex max-w-5xl flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabVault</PageEyebrow>
                    <PageTitle>Audit log</PageTitle>
                    <PageDescription>
                        Every reveal, copy, share, and failed unlock recorded across your vault.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabvault">
                        <Button variant="outline">Back to vault</Button>
                    </Link>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Audit summary"
                className="grid grid-cols-2 gap-4 lg:grid-cols-4"
            >
                <StatCard label="Reveals" value={reveals} icon={Eye} accent={ACCENT.brand} />
                <StatCard label="Copies" value={copies} icon={Copy} accent={ACCENT.neutral} />
                <StatCard label="Shares" value={shares} icon={Share2} accent={ACCENT.violet} />
                <StatCard
                    label="Failed unlocks"
                    value={failures}
                    icon={AlertTriangle}
                    accent={ACCENT.danger}
                />
            </section>

            <Card padding="none">
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ScrollText className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                                Events
                            </CardTitle>
                            <CardDescription>
                                {sp.action ? `Filtered to "${ACTION_LABEL[sp.action] ?? sp.action}".` : 'All vault activity, newest first.'}
                            </CardDescription>
                        </div>
                        <nav aria-label="Filter events" className="flex flex-wrap gap-1.5">
                            <FilterChip current={sp.action} value={undefined} label="All" />
                            <FilterChip current={sp.action} value="reveal" label="Reveals" icon={Eye} />
                            <FilterChip current={sp.action} value="copy" label="Copies" icon={Copy} />
                            <FilterChip current={sp.action} value="share" label="Shares" icon={Share2} />
                            <FilterChip current={sp.action} value="unlock_fail" label="Failed" icon={AlertTriangle} />
                        </nav>
                    </div>
                </CardHeader>

                {items.length === 0 ? (
                    <div className="p-6">
                        <EmptyState
                            icon={ShieldCheck}
                            title="No events yet"
                            description="Audit events appear here as you reveal, copy, and share secrets."
                        />
                    </div>
                ) : (
                    <Table hover>
                        <THead>
                            <Tr>
                                <Th>Time</Th>
                                <Th>Action</Th>
                                <Th>Actor</Th>
                                <Th>Secret</Th>
                                <Th>IP</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {items.map((e) => {
                                const Icon = ACTION_ICON[e.action] ?? ShieldCheck;
                                return (
                                    <Tr key={e._id}>
                                        <Td className="font-mono text-xs tabular-nums text-[var(--st-text-secondary)]">
                                            {new Date(e.ts).toLocaleString()}
                                        </Td>
                                        <Td>
                                            <Badge tone={ACTION_TONE[e.action] ?? 'neutral'}>
                                                <Icon className="h-3 w-3" aria-hidden="true" />
                                                {ACTION_LABEL[e.action] ?? e.action}
                                            </Badge>
                                        </Td>
                                        <Td>
                                            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--st-text-secondary)]">
                                                <User className="h-3 w-3 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                                                {e.actorUserId}
                                            </span>
                                        </Td>
                                        <Td>
                                            {e.secretId ? (
                                                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--st-text-secondary)]">
                                                    <KeyRound className="h-3 w-3 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                                                    {e.secretId}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-[var(--st-text-tertiary)]">—</span>
                                            )}
                                        </Td>
                                        <Td>
                                            {e.ip ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-[var(--st-text-secondary)]">
                                                    <Globe className="h-3 w-3 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                                                    {e.ip}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-[var(--st-text-tertiary)]">—</span>
                                            )}
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </TBody>
                    </Table>
                )}
            </Card>

            {(page > 0 || res.hasMore) ? (
                <div className="flex items-center justify-between">
                    {page > 0 ? (
                        <Link
                            href={`/dashboard/sabvault/audit?page=${page - 1}${sp.action ? `&action=${sp.action}` : ''}`}
                        >
                            <Button variant="outline">Previous</Button>
                        </Link>
                    ) : (
                        <span />
                    )}
                    <span className="text-xs tabular-nums text-[var(--st-text-tertiary)]">Page {page + 1}</span>
                    {res.hasMore ? (
                        <Link
                            href={`/dashboard/sabvault/audit?page=${page + 1}${sp.action ? `&action=${sp.action}` : ''}`}
                        >
                            <Button variant="outline">Next</Button>
                        </Link>
                    ) : (
                        <span />
                    )}
                </div>
            ) : null}
        </main>
    );
}

function FilterChip({
    current,
    value,
    label,
    icon: Icon,
}: {
    current?: string;
    value?: FilterValue;
    label: string;
    icon?: LucideIcon;
}) {
    const active = (current ?? undefined) === value;
    const href = value
        ? `/dashboard/sabvault/audit?action=${value}`
        : '/dashboard/sabvault/audit';
    return (
        <Link href={href} aria-current={active ? 'true' : undefined}>
            <Button variant={active ? 'secondary' : 'ghost'} size="sm" {...(Icon ? { iconLeft: Icon } : {})}>
                {label}
            </Button>
        </Link>
    );
}
