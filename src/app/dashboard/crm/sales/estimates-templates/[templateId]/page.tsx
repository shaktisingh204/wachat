import { Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Estimate template detail page.
 *
 * Renders the body, the default line items table, and the default terms.
 * Async `params` per Next.js 15+.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import {
    getEstimateTemplateById,
    type CrmEstimateTemplateStatus,
} from '@/app/actions/crm-estimate-templates.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/estimates-templates';

const STATUS_TONE: Record<CrmEstimateTemplateStatus, StatusTone> = {
    draft: 'amber',
    published: 'green',
    archived: 'neutral',
};

function fmt(n: unknown): string {
    const num = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
    return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

export default async function EstimateTemplateDetailPage({
    params,
}: {
    params: Promise<{ templateId: string }>;
}) {
    const { templateId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const tpl = await getEstimateTemplateById(templateId);
    if (!tpl) notFound();

    const status =
        (tpl.status as CrmEstimateTemplateStatus | undefined) ?? 'draft';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const items = Array.isArray(tpl.defaultItems)
        ? (tpl.defaultItems as Array<{
              description?: string;
              quantity?: number;
              rate?: number;
          }>)
        : [];

    const subtotal = items.reduce((sum, it) => {
        const q =
            typeof it.quantity === 'number'
                ? it.quantity
                : parseFloat(String(it.quantity ?? '0')) || 0;
        const r =
            typeof it.rate === 'number'
                ? it.rate
                : parseFloat(String(it.rate ?? '0')) || 0;
        return sum + q * r;
    }, 0);

    return (
        <EntityDetailShell
            eyebrow="ESTIMATE TEMPLATE"
            title={(tpl.name as string) || 'Estimate template'}
            back={{ href: BASE, label: 'Estimate Templates' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${templateId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            {/* Summary */}
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">
                        Overview
                    </div>
                    <StatusPill label={status} tone={tone} />
                    {tpl.isActive === false ? (
                        <StatusPill label="Inactive" tone="neutral" />
                    ) : (
                        <StatusPill label="Active" tone="green" />
                    )}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Name</div>
                        <div className="text-[var(--st-text)]">
                            {(tpl.name as string) || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Category</div>
                        <div className="capitalize text-[var(--st-text)]">
                            {(tpl.category as string) || '—'}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Body */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                    Template body
                </div>
                {tpl.templateBody ? (
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 font-sans text-[13px] text-[var(--st-text)]">
                        {String(tpl.templateBody)}
                    </pre>
                ) : (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No template body. Add markdown when editing.
                    </div>
                )}
            </Card>

            {/* Line items */}
            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                    Default line items
                </div>
                {items.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No default line items configured.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-[var(--zoru-radius)] border border-[var(--st-border)]">
                        <table className="w-full text-[13px]">
                            <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Description
                                    </th>
                                    <th className="w-24 px-3 py-2 text-right font-medium">
                                        Qty
                                    </th>
                                    <th className="w-32 px-3 py-2 text-right font-medium">
                                        Rate
                                    </th>
                                    <th className="w-32 px-3 py-2 text-right font-medium">
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it, idx) => {
                                    const q =
                                        typeof it.quantity === 'number'
                                            ? it.quantity
                                            : parseFloat(
                                                  String(it.quantity ?? '0'),
                                              ) || 0;
                                    const r =
                                        typeof it.rate === 'number'
                                            ? it.rate
                                            : parseFloat(
                                                  String(it.rate ?? '0'),
                                              ) || 0;
                                    return (
                                        <tr
                                            key={idx}
                                            className="border-t border-[var(--st-border)]"
                                        >
                                            <td className="px-3 py-2 text-[var(--st-text)]">
                                                {it.description || '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-[var(--st-text)]">
                                                {fmt(q)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-[var(--st-text)]">
                                                {fmt(r)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-[var(--st-text)]">
                                                {fmt(q * r)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                    <td
                                        colSpan={3}
                                        className="px-3 py-2 text-right text-[var(--st-text-secondary)]"
                                    >
                                        Subtotal
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-medium text-[var(--st-text)]">
                                        {fmt(subtotal)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Default terms */}
            {tpl.defaultTerms ? (
                <Card className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
                        Default terms
                    </div>
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 font-sans text-[13px] text-[var(--st-text)]">
                        {String(tpl.defaultTerms)}
                    </pre>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
