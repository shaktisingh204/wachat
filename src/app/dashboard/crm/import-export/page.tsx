import { Suspense } from 'react';
import { Card } from '@/components/sabcrm/20ui/compat';
import {
    AlertCircle,
    ArrowRight,
    Building2,
    Clock,
    FileCheck2,
    FileSpreadsheet,
    Package,
    UserCheck,
    Users,
} from 'lucide-react';

/**
 * Import / Export landing — `/dashboard/crm/import-export`.
 *
 * Server component. Lists the entity kinds supported by the §5.9 bulk
 * pipeline and links into the per-entity wizard at
 * `/dashboard/crm/import-export/[entityKind]`.
 *
 * KPI strip: total import jobs, completed, failed, last import date.
 * Reads from `crm_audit_log` where action starts with 'bulk_import_'.
 */

import Link from 'next/link';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { listImportJobs } from '@/app/actions/crm-import.actions';
import { hasPermissionGroup } from '@/lib/permission-groups/check';
import {
    Breadcrumb,
    ZoruBreadcrumbItem,
    ZoruBreadcrumbLink,
    ZoruBreadcrumbList,
    ZoruBreadcrumbPage,
    ZoruBreadcrumbSeparator,
    Skeleton,
    PageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    ZoruPageDescription,
} from '@/components/sabcrm/20ui/compat';
import { HubKpiGrid, type HubKpi } from '../_components/hub-kpi-grid';
import { formatDate } from '../_components/hub-data';
import { ImportWizardShell } from './_components/import-wizard-shell';
import { KpiDateFilter } from './_components/kpi-date-filter';

export const dynamic = 'force-dynamic';

const TILES: Array<{
    entityKind: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        entityKind: 'contact',
        label: 'Contacts',
        description: 'People in your CRM. Dedup defaults to email.',
        icon: Users,
    },
    {
        entityKind: 'lead',
        label: 'Leads',
        description: 'Prospects in your sales pipeline. Dedup defaults to email.',
        icon: UserCheck,
    },
    {
        entityKind: 'account',
        label: 'Accounts / Companies',
        description: 'Customer accounts. Dedup defaults to GSTIN or company name.',
        icon: Building2,
    },
    {
        entityKind: 'item',
        label: 'Items / Products',
        description: 'Inventory items and services. Dedup defaults to SKU.',
        icon: Package,
    },
];

interface ImportJobStats {
    total: number;
    completed: number;
    failed: number;
    lastImportDate: Date | null;
}

async function getImportJobStats(start?: Date, end?: Date): Promise<ImportJobStats | { error: string }> {
    const empty: ImportJobStats = { total: 0, completed: 0, failed: 0, lastImportDate: null };
    try {
        const session = await getSession();
        if (!session?.user?._id) return empty;
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);

        const matchQuery: Record<string, any> = { userId, action: { $regex: '^bulk_import_' } };
        if (start || end) {
            matchQuery.createdAt = {};
            if (start) matchQuery.createdAt.$gte = start;
            if (end) matchQuery.createdAt.$lte = end;
        }

        const result = await db
            .collection('crm_audit_log')
            .aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        completed: {
                            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
                        },
                        failed: {
                            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
                        },
                        lastDate: { $max: '$createdAt' },
                    },
                },
            ])
            .toArray();

        if (!result[0]) return empty;
        return {
            total: result[0].total ?? 0,
            completed: result[0].completed ?? 0,
            failed: result[0].failed ?? 0,
            lastImportDate: result[0].lastDate ?? null,
        };
    } catch {
        return { error: 'Failed to fetch import job stats.' };
    }
}

async function KpiStatsGridWrapper({ searchParams }: { searchParams?: Promise<{ start?: string; end?: string }> }) {
    const params = await searchParams;
    const start = params?.start ? new Date(params.start) : undefined;
    const end = params?.end ? new Date(params.end) : undefined;
    const stats = await getImportJobStats(start, end);

    if ('error' in stats) {
        return (
            <div className="flex items-center justify-center p-6 text-sm text-zoru-danger border border-zoru-danger/20 rounded-xl bg-zoru-danger/5">
                <AlertCircle className="w-4 h-4 mr-2" />
                {stats.error}
            </div>
        );
    }

    const kpis: HubKpi[] = [
        {
            label: 'Total import jobs',
            value: stats.total.toLocaleString(),
            icon: FileSpreadsheet,
        },
        {
            label: 'Completed',
            value: stats.completed.toLocaleString(),
            icon: FileCheck2,
            tone: 'success',
        },
        {
            label: 'Failed',
            value: stats.failed.toLocaleString(),
            icon: AlertCircle,
            tone: stats.failed > 0 ? 'danger' : 'default',
        },
        {
            label: 'Last import',
            value: stats.lastImportDate ? formatDate(stats.lastImportDate) : '—',
            icon: Clock,
        },
    ];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex justify-end">
                <KpiDateFilter />
            </div>
            <HubKpiGrid kpis={kpis} />
        </div>
    );
}

export default async function ImportExportLandingPage(props: { searchParams?: Promise<{ start?: string; end?: string }> }): Promise<React.ReactElement> {
    const canView = await hasPermissionGroup('import_export', 'view');
    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle className="h-8 w-8 text-zoru-ink-muted mb-4" />
                <h2 className="text-lg font-semibold text-zoru-ink">Access Denied</h2>
                <p className="text-sm text-zoru-ink-muted">You do not have permission to view Import & Export.</p>
            </div>
        );
    }

    const recentJobs = await listImportJobs();

    return (
        <div className="flex w-full flex-col gap-5">
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/crm">CRM</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Import &amp; Export</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>
            
            <PageHeader>
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
                        <FileSpreadsheet className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
                    </div>
                    <ZoruPageHeading>
                        <ZoruPageTitle>
                            Import &amp; Export
                        </ZoruPageTitle>
                        <ZoruPageDescription>
                            Bulk-load data from CSV or export a snapshot of an
                            entity. The same field schema is used in both
                            directions so an export can be re-imported losslessly.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </div>
            </PageHeader>

            <Suspense fallback={<div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}>
                <KpiStatsGridWrapper searchParams={props.searchParams} />
            </Suspense>

            <ImportWizardShell initialJobs={recentJobs} />

            <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-zoru-ink">
                    Per-entity wizards
                </h2>
                <p className="text-[12.5px] text-zoru-ink-muted">
                    Specialised legacy importers with entity-specific dedupe
                    rules. The generic wizard above replaces these for most
                    workflows.
                </p>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TILES.map((t) => {
                    const Icon = t.icon;
                    return (
                        <li key={t.entityKind}>
                            <Link
                                href={`/dashboard/crm/import-export/${t.entityKind}`}
                                className="block"
                            >
                                <Card className="flex flex-col gap-2 p-4 transition-colors hover:border-zoru-accent">
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-5 w-5 text-zoru-accent" />
                                        <h2 className="text-sm font-medium text-zoru-ink">
                                            {t.label}
                                        </h2>
                                        <ArrowRight className="ml-auto h-4 w-4 text-zoru-ink-muted" />
                                    </div>
                                    <p className="text-[12.5px] text-zoru-ink-muted">
                                        {t.description}
                                    </p>
                                </Card>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
