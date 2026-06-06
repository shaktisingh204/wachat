import { Suspense } from 'react';
import { Badge, Card, cn, Skeleton } from '@/components/sabcrm/20ui';
import { AlertTriangle, Link2, Link2Off, Plus } from 'lucide-react';
import Link from 'next/link';

import { getIntegrationTypes, getCustomIntegrations } from '@/app/actions/crm-integrations.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { HubKpiGrid, type HubKpi } from '../_components/hub-kpi-grid';
import { BUILT_IN_INTEGRATIONS, type IntegrationStatusKey } from './_components/integrations.config';
import { IntegrationsSearch } from './_components/integrations-search';
import { IntegrationsList } from './_components/integrations-list';

export const dynamic = 'force-dynamic';

const btnBase =
    'inline-flex h-9 w-full items-center justify-center gap-2 rounded-full px-4 text-[13px] font-medium leading-none transition-colors';
const btnObsidian = 'bg-[var(--st-text)] text-white hover:bg-[var(--st-text)]/90';
const btnRoseSoft =
    'bg-[var(--st-bg-muted)] text-[var(--st-text)] border border-accent hover:brightness-[0.97]';
const btnDisabled =
    'bg-[var(--st-bg)] text-[var(--st-text-secondary)] border border-[var(--st-border)] opacity-60 pointer-events-none';

function fmtDateTime(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC', // Ensure deterministic dates for hydration
    }).format(d);
}

function DashboardSkeleton() {
    return (
        <div className="w-full">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
            
            <div className="mb-6 h-10 w-full max-w-sm">
                <Skeleton className="h-full w-full rounded-md" />
            </div>
            
            <div className="mb-8">
                <Skeleton className="h-6 w-48 mb-4 rounded" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 w-full rounded-xl" />
                    ))}
                </div>
            </div>
            
            <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-6 w-48 rounded" />
                <Skeleton className="h-9 w-32 rounded-full" />
            </div>
            
            <Skeleton className="h-24 w-full rounded-xl" />
        </div>
    );
}

async function IntegrationsDashboard({ q }: { q?: string }) {
    const [status, customIntegrations] = await Promise.all([
        getIntegrationTypes(),
        getCustomIntegrations(),
    ]);

    const mappedBuiltIn = BUILT_IN_INTEGRATIONS.map((integration) => {
        const typeStatus = status[integration.id];
        const isConnected = typeStatus?.connected;
        const currentStatus = isConnected 
            ? 'connected' 
            : integration.isAvailable 
                ? 'available' 
                : 'coming_soon';
        
        return {
            ...integration,
            status: currentStatus,
            lastSyncAt: typeStatus?.lastSyncAt,
            syncStatus: typeStatus?.syncStatus,
        };
    });

    const filteredBuiltIn = mappedBuiltIn.filter(i => 
        !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.description.toLowerCase().includes(q.toLowerCase())
    );

    const filteredCustom = customIntegrations.filter(i => 
        !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.provider.toLowerCase().includes(q.toLowerCase())
    );

    const totalCount = BUILT_IN_INTEGRATIONS.length + customIntegrations.length;
    const connectedCount = mappedBuiltIn.filter((i) => i.status === 'connected').length + customIntegrations.filter(i => i.isActive).length;
    const availableCount = mappedBuiltIn.filter((i) => i.status === 'available').length + customIntegrations.filter(i => !i.isActive).length;
    const comingSoonCount = mappedBuiltIn.filter((i) => i.status === 'coming_soon').length;

    const kpis: HubKpi[] = [
        { label: 'Total integrations', value: totalCount, icon: Link2 },
        { label: 'Connected', value: connectedCount, icon: Link2, tone: connectedCount > 0 ? 'success' : 'default' },
        { label: 'Available to connect', value: availableCount, icon: Link2Off },
        { label: 'Coming soon', value: comingSoonCount, icon: AlertTriangle },
    ];

    return (
        <>
            <HubKpiGrid kpis={kpis} />

            <IntegrationsSearch />

            {filteredBuiltIn.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-[var(--st-text)]">Built-in Integrations</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredBuiltIn.map((integration) => {
                            const Icon = integration.icon;
                            const connected = integration.status === 'connected';

                            return (
                                <Card key={integration.name} className="flex h-full flex-col p-6">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={
                                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ' +
                                                (connected
                                                    ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                                    : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]')
                                            }
                                        >
                                            <Icon className="h-5 w-5" strokeWidth={1.75} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-[14.5px] font-semibold text-[var(--st-text)]">
                                                    {integration.name}
                                                </h3>
                                                {connected ? (
                                                    <Badge variant="success">Connected</Badge>
                                                ) : null}
                                            </div>
                                            <p className="mt-1 text-[12.5px] leading-snug text-[var(--st-text-secondary)]">
                                                {integration.description}
                                            </p>
                                        </div>
                                    </div>

                                    {connected && (integration.lastSyncAt || integration.syncStatus) ? (
                                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--st-text-secondary)]">
                                            {integration.syncStatus ? <span>sync: {integration.syncStatus}</span> : null}
                                            {integration.lastSyncAt ? <span suppressHydrationWarning>last sync: {fmtDateTime(integration.lastSyncAt)}</span> : null}
                                        </div>
                                    ) : null}

                                    <div className="mt-5 flex-1" />

                                    {connected ? (
                                        <Link href={integration.link || '#'} className={cn(btnBase, btnRoseSoft)}>
                                            Manage
                                        </Link>
                                    ) : integration.status === 'available' ? (
                                        <Link href={integration.link || '#'} className={cn(btnBase, btnObsidian)}>
                                            Connect
                                        </Link>
                                    ) : (
                                        <span className={cn(btnBase, btnDisabled)}>Coming Soon</span>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--st-text)]">Custom Integrations</h2>
                <Link href="/dashboard/crm/integrations/new" className={cn(btnBase, btnObsidian, "w-auto")}>
                    <Plus className="mr-1 h-4 w-4" /> Add Custom
                </Link>
            </div>
            
            {(filteredCustom.length > 0 || q) ? (
                <IntegrationsList items={filteredCustom} />
            ) : (
                <div className="text-sm text-[var(--st-text-secondary)]">No custom integrations configured.</div>
            )}
        </>
    );
}

export default async function IntegrationsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const q = typeof params?.q === 'string' ? params.q : undefined;

    return (
        <EntityListShell
            title="Integrations"
            subtitle="Connect your CRM to other tools and services to streamline your workflow."
        >
            <Suspense fallback={<DashboardSkeleton />}>
                <IntegrationsDashboard q={q} />
            </Suspense>
        </EntityListShell>
    );
}
