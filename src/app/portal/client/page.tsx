/**
 * /portal/client — Client Portal Dashboard.
 *
 * Server Component. Renders the client's snapshot:
 *   - KPI strip (open tickets, unpaid invoices, active projects, pending estimates)
 *   - Recent Activity timeline (last 10 events across entities)
 *   - Quick Links grid (Create Ticket / View Projects / Pay Invoice)
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
    FileText,
    FolderKanban,
    LifeBuoy,
    Receipt,
} from 'lucide-react';

import {
    getClientPortalActivity,
    getClientPortalKpis,
} from '@/app/actions/client-portal.actions';
import {
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
}

export default async function ClientPortalDashboardPage() {
    const [kpis, activity] = await Promise.all([
        getClientPortalKpis(),
        getClientPortalActivity(10),
    ]);

    const tiles = [
        { label: 'Open Tickets', value: kpis.openTickets, icon: LifeBuoy, href: '/portal/client/tickets' },
        { label: 'Unpaid Invoices', value: kpis.unpaidInvoices, icon: Receipt, href: '/portal/client/invoices' },
        { label: 'Active Projects', value: kpis.activeProjects, icon: FolderKanban, href: '/portal/client/projects' },
        { label: 'Pending Estimates', value: kpis.pendingEstimates, icon: FileText, href: '/portal/client/estimates' },
    ];

    const quickLinks = [
        { label: 'Create Ticket', href: '/portal/client/tickets?new=1', icon: LifeBuoy },
        { label: 'View Projects', href: '/portal/client/projects', icon: FolderKanban },
        { label: 'Pay Invoice', href: '/portal/client/invoices', icon: Receipt },
    ];

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">Welcome back</h1>
                <p className="text-sm text-zoru-ink-muted">
                    A snapshot of your account.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                        <Link key={tile.label} href={tile.href}>
                            <ZoruCard className="transition-colors hover:bg-zoru-surface-2">
                                <ZoruCardContent className="flex items-center justify-between p-4">
                                    <div>
                                        <div className="text-xs text-zoru-ink-muted">{tile.label}</div>
                                        <div className="mt-1 text-2xl font-semibold text-zoru-ink">{tile.value}</div>
                                    </div>
                                    <Icon className="h-5 w-5 text-zoru-ink-muted" />
                                </ZoruCardContent>
                            </ZoruCard>
                        </Link>
                    );
                })}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <ZoruCard className="lg:col-span-2">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Recent Activity</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {activity.length === 0 ? (
                            <div className="py-6 text-center text-sm text-zoru-ink-muted">
                                No recent activity yet.
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {activity.map((it, idx) => (
                                    <li key={`${it.link}-${idx}`} className="flex items-start gap-3">
                                        <span
                                            aria-hidden
                                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zoru-ink-muted"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={it.link}
                                                className="block truncate text-sm text-zoru-ink hover:underline"
                                            >
                                                {it.title}
                                            </Link>
                                            <div className="text-[11px] text-zoru-ink-muted">
                                                {formatRelative(it.when)}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Quick Links</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="grid gap-2">
                            {quickLinks.map((q) => {
                                const Icon = q.icon;
                                return (
                                    <Link
                                        key={q.label}
                                        href={q.href}
                                        className="flex items-center gap-2 rounded-[var(--zoru-radius-sm)] border border-zoru-line px-3 py-2 text-sm text-zoru-ink transition-colors hover:bg-zoru-surface-2"
                                    >
                                        <Icon className="h-4 w-4 text-zoru-ink-muted" />
                                        <span>{q.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </div>
    );
}
