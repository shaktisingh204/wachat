/**
 * Create lead — `/dashboard/crm/leads/new`.
 *
 * Server component: fetches the tenant's lead custom-field definitions
 * once, then hands off to the shared `<LeadForm>` (also used by Edit).
 */

import * as React from 'react';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { LeadForm } from '../_components/lead-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import { PageHeader } from '@/components/ui/page-header';
import { UserPlus } from 'lucide-react';
import { SabnodeWaterLoader } from '@/components/ui/sabnode-water-loader';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NewLeadPage() {
    const customFields = (await getCustomFieldsFor('lead')) as WsCustomField[];

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader
                title="New lead"
                subtitle="Create a new prospective customer"
                icon={UserPlus}
                breadcrumb={
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link href="/dashboard/crm/leads" className="hover:text-foreground transition-colors">
                            Leads
                        </Link>
                        <span>/</span>
                        <span className="text-foreground font-medium">New</span>
                    </div>
                }
            />

            <main className="min-w-0 flex-1 space-y-6">
                <React.Suspense fallback={
                    <div className="flex justify-center p-12">
                        <SabnodeWaterLoader />
                    </div>
                }>
                    <LeadForm customFields={customFields} />
                </React.Suspense>
            </main>
        </div>
    );
}
