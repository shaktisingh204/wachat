import * as React from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    Copy,
    ShieldAlert,
    Clock,
    Activity,
    ShieldCheck,
    ChevronRight,
    type LucideIcon,
} from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    StatCard,
    Badge,
    EmptyState,
    Progress,
    Separator,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import { listSabvaultSecrets } from '@/app/actions/sabvault.actions';
import type { SabvaultSecretDoc } from '@/lib/rust-client/sabvault-secrets';

export const dynamic = 'force-dynamic';

/** StatCard accent chips need hex values, never token vars. */
const ACCENT = {
    danger: '#e0484e',
    warn: '#d68a1e',
    success: '#1f9d55',
    brand: '#3b7af5',
} as const;

/**
 * Health dashboard — weak / reused / breached / expiring secret counts.
 * Reads the server-side health flags the client populates after decryption
 * (`strength`, `reused`, `breached`).
 */
export default async function SabvaultHealthPage() {
    const res = await listSabvaultSecrets({ limit: 100, status: 'active' });
    const secrets = res.items;
    const total = secrets.length;

    const weak = secrets.filter((s) => s.strength === 'weak' || s.strength === 'fair');
    const reused = secrets.filter((s) => !!s.reused);
    const breached = secrets.filter((s) => !!s.breached);
    const now = Date.now();
    const expiring = secrets.filter((s) => {
        if (!s.expiresAt) return false;
        const t = new Date(s.expiresAt).getTime();
        return t > now && t - now < 30 * 24 * 60 * 60 * 1000;
    });

    // Health score: penalise each at-risk secret; 100 = nothing flagged.
    const flagged = new Set<string>();
    [...weak, ...reused, ...breached, ...expiring].forEach((s) => {
        if (s._id) flagged.add(s._id);
    });
    const healthy = Math.max(0, total - flagged.size);
    const score = total === 0 ? 100 : Math.round((healthy / total) * 100);
    const scoreTone: 'success' | 'warning' | 'danger' =
        score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';

    return (
        <main className="20ui mx-auto flex max-w-5xl flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabVault</PageEyebrow>
                    <PageTitle>Vault health</PageTitle>
                    <PageDescription>
                        A quick read on credential hygiene — weak, reused, breached, and expiring secrets.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabvault">
                        <Button variant="outline">Back to vault</Button>
                    </Link>
                </PageActions>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Overall health score
                    </CardTitle>
                    <CardDescription>
                        {healthy} of {total} secret{total === 1 ? '' : 's'} pass every check.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <div className="flex items-center gap-4">
                        <span className="text-3xl font-semibold tabular-nums text-[var(--st-text)]">
                            {score}%
                        </span>
                        <Progress value={score} tone={scoreTone} className="flex-1" />
                    </div>
                </CardBody>
            </Card>

            <section
                aria-label="Health breakdown"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <StatCard
                    label="Weak"
                    value={String(weak.length)}
                    icon={AlertTriangle}
                    accent={weak.length ? ACCENT.warn : ACCENT.success}
                />
                <StatCard
                    label="Reused"
                    value={String(reused.length)}
                    icon={Copy}
                    accent={reused.length ? ACCENT.warn : ACCENT.success}
                />
                <StatCard
                    label="Breached"
                    value={String(breached.length)}
                    icon={ShieldAlert}
                    accent={breached.length ? ACCENT.danger : ACCENT.success}
                />
                <StatCard
                    label="Expiring < 30d"
                    value={String(expiring.length)}
                    icon={Clock}
                    accent={expiring.length ? ACCENT.brand : ACCENT.success}
                />
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <HealthBucket
                    title="Breached"
                    description="Found in a known leak. Rotate immediately."
                    icon={ShieldAlert}
                    iconClass="text-[var(--st-danger)]"
                    badgeTone="danger"
                    items={breached}
                />
                <HealthBucket
                    title="Weak passwords"
                    description="Short or low-entropy. Strengthen these."
                    icon={AlertTriangle}
                    iconClass="text-[var(--st-warn)]"
                    badgeTone="warning"
                    items={weak}
                />
                <HealthBucket
                    title="Reused"
                    description="Shared across more than one entry."
                    icon={Copy}
                    iconClass="text-[var(--st-warn)]"
                    badgeTone="warning"
                    items={reused}
                />
                <HealthBucket
                    title="Expiring soon"
                    description="Lapses within the next 30 days."
                    icon={Clock}
                    iconClass="text-[var(--st-accent)]"
                    badgeTone="info"
                    items={expiring}
                />
            </div>
        </main>
    );
}

function HealthBucket({
    title,
    description,
    icon: Icon,
    iconClass,
    badgeTone,
    items,
}: {
    title: string;
    description: string;
    icon: LucideIcon;
    iconClass: string;
    badgeTone: BadgeTone;
    items: SabvaultSecretDoc[];
}) {
    return (
        <Card padding="none">
            <CardHeader>
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Icon className={`h-4 w-4 ${iconClass}`} aria-hidden="true" />
                        {title}
                    </CardTitle>
                    <Badge tone={items.length ? badgeTone : 'neutral'}>{items.length}</Badge>
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            {items.length === 0 ? (
                <div className="p-4">
                    <EmptyState
                        icon={ShieldCheck}
                        tone="success"
                        title="All clear"
                        description="No secrets fall into this bucket."
                    />
                </div>
            ) : (
                <ul className="divide-y divide-[var(--st-border)]">
                    {items.map((s) => (
                        <li key={s._id}>
                            <Link
                                href={`/dashboard/sabvault/${s._id}`}
                                className="group flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-[var(--st-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                            >
                                <span className="flex-1 truncate text-sm text-[var(--st-text)]">
                                    {s.name}
                                </span>
                                <ChevronRight
                                    className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)] transition-transform group-hover:translate-x-0.5"
                                    aria-hidden="true"
                                />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
