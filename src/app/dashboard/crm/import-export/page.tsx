import { ZoruCard } from '@/components/zoruui';
import { ArrowRight, Building2, FileSpreadsheet, Package, UserCheck, Users, } from 'lucide-react';

/**
 * Import / Export landing — `/dashboard/crm/import-export`.
 *
 * Server component. Lists the entity kinds supported by the §5.9 bulk
 * pipeline and links into the per-entity wizard at
 * `/dashboard/crm/import-export/[entityKind]`.
 */

import Link from 'next/link';

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

export default function ImportExportLandingPage(): React.ReactElement {
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
