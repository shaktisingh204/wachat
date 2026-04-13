import { FileText } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function Form16Page() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Form 16 Generation"
                subtitle="Download Annual Tax Statements (Part A & Part B) for your employees."
                icon={FileText}
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Generate Form 16</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Select Financial Year to generate reports.</p>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center gap-4 rounded-clay-md border border-clay-border bg-clay-surface-2 p-4">
                        <div className="flex-1">
                            <h3 className="text-[14px] font-semibold text-clay-ink">Financial Year 2024-2025</h3>
                            <p className="text-[12.5px] text-clay-ink-muted">Period: April 2024 - March 2025</p>
                        </div>
                        <ClayButton variant="obsidian" disabled>Generate All</ClayButton>
                    </div>

                    <div className="py-8 text-center text-[13px] text-clay-ink-muted">
                        <p>Payroll data must be finalized for the complete financial year to generate Form 16.</p>
                        <p className="mt-2 text-[12.5px]">Currently showing sample/placeholder as full FY data is pending.</p>
                    </div>
                </div>
            </ClayCard>
        </div>
    )
}
