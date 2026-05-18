import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { FileText,
  ArrowLeft,
  Plus } from 'lucide-react';

/**
 * Contract detail page.
 *
 * Server component detail view for a single CRM contract document from the
 * `crm_contracts` collection. Mirrors the subscription detail page pattern:
 * getSession guard (inside getContractById) + ObjectId.isValid check +
 * scoped findOne by _id and userId, then renders a ZoruCard "Contract
 * Details" 2-column grid with all spec fields.
 *
 * Loader: `getContractById` from `@/app/actions/crm-contracts.actions`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getContractById } from '@/app/actions/crm-contracts.actions';

export const dynamic = 'force-dynamic';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function fmtMoney(n: unknown, currency = 'INR'): string {
    const num = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
    if (isNaN(num)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(num);
    } catch {
        return `${currency} ${num}`;
    }
}

function capitalizeWords(s: unknown): string {
    if (!s) return '—';
    return String(s)
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── status badge variant ─────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'ghost' | 'success' | 'warning' | 'danger'> = {
    draft: 'ghost',
    active: 'success',
    completed: 'success',
    expired: 'danger',
    voided: 'danger',
    pending: 'warning',
    sent: 'warning',
};

function statusVariant(status: string): 'ghost' | 'success' | 'warning' | 'danger' {
    return STATUS_VARIANT[status.toLowerCase()] ?? 'ghost';
}

// ─── field helper ─────────────────────────────────────────────────────────────

function Field({
    label,
    children,
    fullWidth,
}: {
    label: string;
    children: React.ReactNode;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'sm:col-span-2' : undefined}>
            <div className="text-[11.5px] text-zoru-ink-muted">{label}</div>
            <div className="mt-0.5 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function ContractDetailPage({
    params,
}: {
    params: Promise<{ contractId: string }>;
}) {
    const { contractId } = await params;

    // getContractById already applies getSession + ObjectId.isValid guards;
    // null means either unauthenticated, invalid id, or record not owned by user.
    const contract = await getContractById(contractId);

    if (!contract) {
        redirect('/dashboard/crm/sales/contracts');
    }

    const title = (contract.title as string) || 'Untitled Contract';
    const type = (contract.type as string) || '';
    const partyName = (contract.partyName as string) || '—';
    const partyEmail = (contract.partyEmail as string) || '';
    const effectiveDate = contract.effectiveDate;
    const expiryDate = contract.expiryDate;
    const contractValue = contract.value;
    const autoRenew = contract.autoRenew;
    const renewalNoticeDays = contract.renewalNoticeDays;
    const esignProvider = (contract.esignProvider as string) || '';
    const status = (contract.status as string) || 'draft';
    const notes = (contract.notes as string) || '';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={title}
                subtitle="Contract detail"
                icon={FileText}
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/crm/sales/contracts">
                            <ZoruButton variant="outline">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </ZoruButton>
                        </Link>
                        <Link href="/dashboard/crm/sales/contracts/new">
                            <ZoruButton variant="default">
                                <Plus className="h-4 w-4" />
                                New Contract
                            </ZoruButton>
                        </Link>
                    </div>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-[16px] font-medium text-zoru-ink">{title}</h2>
                    <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Title">{title}</Field>

                    <Field label="Type">{capitalizeWords(type)}</Field>

                    <Field label="Counter-party">{partyName}</Field>

                    <Field label="Email">{partyEmail || '—'}</Field>

                    <Field label="Effective Date">{fmtDate(effectiveDate)}</Field>

                    <Field label="Expiry Date">{fmtDate(expiryDate)}</Field>

                    <Field label="Contract Value">{fmtMoney(contractValue)}</Field>

                    <Field label="Auto-renew">
                        {autoRenew === true || autoRenew === 'true' ? 'Yes' : 'No'}
                    </Field>

                    <Field label="Renewal Notice">
                        {renewalNoticeDays != null ? `${renewalNoticeDays} days` : '—'}
                    </Field>

                    <Field label="E-Sign Provider">{capitalizeWords(esignProvider) || '—'}</Field>

                    <Field label="Status">
                        <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                    </Field>

                    {notes ? (
                        <Field label="Notes" fullWidth>
                            {notes}
                        </Field>
                    ) : null}
                </div>
            </ZoruCard>
        </div>
    );
}
