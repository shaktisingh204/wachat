'use client';

import { UserPlus, Star } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function HireVendorsPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Hire The Best Vendors"
                subtitle="Coming Soon: A marketplace to find and hire top-rated vendors and service providers for your business needs."
                icon={UserPlus}
            />

            <ClayCard variant="outline" className="border-dashed">
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                        <Star className="h-7 w-7 text-clay-rose-ink" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold text-clay-ink">Hire The Best Vendors</h3>
                        <p className="mt-1 max-w-md text-[12.5px] text-clay-ink-muted">
                            Coming Soon: A marketplace to find and hire top-rated vendors and service providers for your business needs.
                        </p>
                    </div>
                    <p className="text-[12.5px] text-clay-ink-muted">This feature is under development.</p>
                </div>
            </ClayCard>
        </div>
    );
}
