import { Card } from '@/components/zoruui';
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
import { HubKpiGrid, type HubKpi } from '../_components/hub-kpi-grid';
import { formatDate } from '../_components/hub-data';
import { ImportWizardShell } from './_components/import-wizard-shell';

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

async function getImportJobStats(): Promise<ImportJobStats> {
    const empty: ImportJobStats = { total: 0, completed: 0, failed: 0, lastImportDate: null };
    try {
        const session = await getSession();
        if (!session?.user?._id) return empty;
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);

        const result = await db
            .collection('crm_audit_log')
            .aggregate([
                { $match: { userId, action: { $regex: '^bulk_import_' } } },
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
        return empty;
    }
}

export default async function ImportExportLandingPage(): Promise<React.ReactElement> {
    const [stats, recentJobs] = await Promise.all([
        getImportJobStats(),
        listImportJobs(),
    ]);

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
        <div className="flex w-full flex-col gap-5">
            <header className="flex items-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-zoru-accent" />
                <div>
                    <h1 className="text-lg font-semibold text-zoru-ink">
                        Import &amp; Export
                    </h1>
                    <p className="text-sm text-zoru-ink-muted">
                        Bulk-load data from CSV or export a snapshot of an
                        entity. The same field schema is used in both
                        directions so an export can be re-imported losslessly.
                    </p>
                </div>
            </header>

            <HubKpiGrid kpis={kpis} />

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
                                <ZoruCard className="flex flex-col gap-2 p-4 transition-colors hover:border-zoru-accent">
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
                                </ZoruCard>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
