import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Contract template detail page — server component.
 *
 * Fetches the template by id and renders an overview card plus the body
 * (markdown, preformatted) and the variables list.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';

import {
    getContractTemplateById,
    type CrmContractTemplateStatus,
} from '@/app/actions/crm-contract-templates.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/contracts/templates';

const STATUS_TONE: Record<CrmContractTemplateStatus, StatusTone> = {
    draft: 'amber',
    active: 'green',
    archived: 'neutral',
};

function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

export default async function ContractTemplateDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const template = await getContractTemplateById(id);
    if (!template) notFound();

    const status = (template.status ?? 'draft') as CrmContractTemplateStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const variables = template.variables ?? [];

    return (
        <EntityDetailShell
            eyebrow="CONTRACT TEMPLATE"
            title={template.name}
            back={{ href: BASE, label: 'Templates' }}
            actions={
                <ZoruButton asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </ZoruButton>
            }
        >

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Overview
                    </div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    <ZoruBadge variant="ghost" className="uppercase font-mono">
                        {template.type}
                    </ZoruBadge>
                    {template.isActive ? (
                        <ZoruBadge variant="success">Available</ZoruBadge>
                    ) : (
                        <ZoruBadge variant="ghost">Hidden</ZoruBadge>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Default term</div>
                        <div className="font-mono text-zoru-ink">
                            {template.defaultTermMonths != null
                                ? `${template.defaultTermMonths} month(s)`
                                : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">
                            Default auto-renew
                        </div>
                        <div className="text-zoru-ink">
                            {template.defaultAutoRenew ? 'Yes' : 'No'}
                        </div>
                    </div>
                </div>
            </ZoruCard>

            {variables.length > 0 ? (
                <ZoruCard className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                        Variables
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {variables.map((v) => (
                            <ZoruBadge
                                key={v}
                                variant="ghost"
                                className="font-mono text-[12px]"
                            >
                                {`{{${v}}}`}
                            </ZoruBadge>
                        ))}
                    </div>
                </ZoruCard>
            ) : null}

            <ZoruCard className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                    Body (markdown)
                </div>
                {template.body ? (
                    <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-mono text-[12.5px] text-zoru-ink">
                        {template.body}
                    </pre>
                ) : (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No body content yet.
                    </div>
                )}
            </ZoruCard>
        </EntityDetailShell>
    );
}
