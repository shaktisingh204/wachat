'use client';

/**
 * Print-friendly single-column view used when the lead detail page is
 * loaded with `?print=1`. Auto-fires `window.print()` once mounted.
 */

import * as React from 'react';
import type { CrmLead, WithId } from '@/lib/definitions';

function formatMoney(value: number | undefined, currency: string | undefined): string {
    const ccy = currency || 'INR';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: ccy,
            maximumFractionDigits: 2,
        }).format(value ?? 0);
    } catch {
        return `${ccy} ${(value ?? 0).toLocaleString('en-IN')}`;
    }
}

export function LeadsPrintView({ lead }: { lead: WithId<CrmLead> }) {
    React.useEffect(() => {
        const t = window.setTimeout(() => window.print(), 250);
        return () => window.clearTimeout(t);
    }, []);

    const status = (lead.status as string) || 'New';
    const probability = (lead as any).probabilityPct ?? 0;
    const expectedClose = (lead as any).expectedClose
        ? new Date((lead as any).expectedClose)
        : null;

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6 print:p-2">
            <header className="border-b border-[var(--st-border)] pb-3">
                <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Lead
                </p>
                <h1 className="text-2xl font-semibold">
                    {lead.title || lead.contactName || 'Untitled lead'}
                </h1>
                <p className="text-sm text-[var(--st-text-secondary)]">Status: {status}</p>
            </header>
            <PrintSection title="Contact">
                <PrintRow label="Name" value={lead.contactName} />
                <PrintRow label="Email" value={lead.email || '—'} />
                <PrintRow label="Phone" value={lead.phone || '—'} />
                <PrintRow label="Company" value={lead.company || '—'} />
                <PrintRow label="Website" value={lead.website || '—'} />
                <PrintRow label="Country" value={lead.country || '—'} />
            </PrintSection>
            <PrintSection title="Pipeline">
                <PrintRow label="Pipeline" value={lead.pipelineId || '—'} />
                <PrintRow label="Stage" value={lead.stage || '—'} />
                <PrintRow label="Source" value={lead.source || '—'} />
                <PrintRow label="Owner" value={String(lead.assignedTo ?? '—')} />
            </PrintSection>
            <PrintSection title="Money">
                <PrintRow
                    label="Estimated value"
                    value={formatMoney(lead.value, lead.currency)}
                />
                <PrintRow label="Probability" value={`${probability}%`} />
                <PrintRow
                    label="Expected close"
                    value={expectedClose ? expectedClose.toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—'}
                />
            </PrintSection>
            {lead.description ? (
                <PrintSection title="Notes">
                    <p className="whitespace-pre-line text-sm">{lead.description}</p>
                </PrintSection>
            ) : null}
        </div>
    );
}

function PrintSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="border-b border-[var(--st-border)] pb-3">
            <h2 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
                {title}
            </h2>
            <div className="space-y-1">{children}</div>
        </section>
    );
}

function PrintRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-3 text-sm">
            <span className="text-[var(--st-text-secondary)]">{label}</span>
            <span className="text-right text-[var(--st-text)]">{value}</span>
        </div>
    );
}

export default LeadsPrintView;
