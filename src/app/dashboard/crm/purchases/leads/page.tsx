'use client';

import Link from 'next/link';
import { Plus, Target, PlayCircle, Upload } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function VendorLeadsPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Vendor Leads"
                subtitle="Manage potential vendors and suppliers. Track leads, assign to team members, and convert them to vendors."
                icon={Target}
            />

            <ClayCard variant="outline" className="border-dashed">
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                        <Target className="h-7 w-7 text-clay-rose-ink" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold text-clay-ink">Vendor Leads</h3>
                        <p className="mt-1 max-w-md text-[12.5px] text-clay-ink-muted">
                            Manage potential vendors and suppliers. Track leads, assign to team members, and convert them to vendors.
                        </p>
                    </div>
                    <ClayButton
                        variant="ghost"
                        leading={<PlayCircle className="h-4 w-4" strokeWidth={1.75} />}
                    >
                        Watch Demo Video
                    </ClayButton>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                        <Link href="/dashboard/crm/purchases/vendors/new">
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                                Add New Vendor Lead
                            </ClayButton>
                        </Link>
                        <ClayButton variant="pill" disabled leading={<Upload className="h-4 w-4" strokeWidth={1.75} />}>
                            Import Leads
                        </ClayButton>
                    </div>
                </div>
            </ClayCard>
        </div>
    );
}
