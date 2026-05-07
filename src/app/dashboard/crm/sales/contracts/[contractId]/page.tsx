/**
 * Contract detail page.
 *
 * Server component sibling of the contracts list page. Renders the
 * contract header (title + status badge), counterparty / type /
 * effective / expiry / e-sign provider in a 2-col metadata grid, and
 * an optional signers table when signatures have been collected.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, FileSignature } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getContractById } from '@/app/actions/crm-services.actions';
import { getSession } from '@/app/actions/user.actions';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusVariant(status?: string): 'ghost' | 'success' | 'warning' | 'danger' {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'completed' || s === 'signed') return 'success';
    if (s === 'paused' || s === 'draft') return 'ghost';
    if (s === 'cancelled' || s === 'voided' || s === 'expired') return 'danger';
    return 'warning';
}

interface Signer {
    name?: string;
    email?: string;
    status?: string;
    signedAt?: string | Date;
}

export default async function ContractDetailPage({
    params,
}: {
    params: Promise<{ contractId: string }>;
}) {
    const { contractId } = await params;

    const session = await getSession();
    if (!session?.user) notFound();
    if (!ObjectId.isValid(contractId)) notFound();

    const contract = (await getContractById(contractId)) as
        | (Record<string, unknown> & { _id?: unknown })
        | null;

    if (!contract) {
        notFound();
    }

    const title = ((contract as any).title as string) || 'Untitled contract';
    const status = ((contract as any).status as string) || 'draft';
    const partyA = ((contract as any).partyA as string) || '—';
    const partyB =
        ((contract as any).partyB as string) ||
        ((contract as any).counterparty as string) ||
        '—';
    const contractType = ((contract as any).contractType as string) || '—';
    const effectiveDate = (contract as any).effectiveDate;
    const expiryDate = (contract as any).expiryDate;
    const esignProvider = ((contract as any).esignProvider as string) || '—';
    const signers: Signer[] = Array.isArray((contract as any).signers)
        ? ((contract as any).signers as Signer[])
        : [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={title}
                subtitle="Contract detail"
                icon={FileSignature}
                actions={
                    <Link href="/dashboard/crm/sales/contracts">
                        <ZoruButton variant="outline">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">{title}</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            {contractType !== '—' ? `${contractType} • ` : ''}
                            Effective {fmtDate(effectiveDate)}
                        </p>
                    </div>
                    <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Counterparty</div>
                        <div className="text-zoru-ink">{partyB}</div>
                        {partyA !== '—' && (
                            <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                vs {partyA}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Type</div>
                        <div className="text-zoru-ink">{contractType}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Effective</div>
                        <div className="text-zoru-ink">{fmtDate(effectiveDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Expiry</div>
                        <div className="text-zoru-ink">{fmtDate(expiryDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">E-sign provider</div>
                        <div className="text-zoru-ink">{esignProvider}</div>
                    </div>
                </div>

                {signers.length > 0 && (
                    <div className="mt-6">
                        <div className="mb-2 text-[12.5px] text-zoru-ink-muted">Signers</div>
                        <div className="overflow-x-auto rounded-lg border border-zoru-line">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                        <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">Email</ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">Signed at</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {signers.map((s, idx) => (
                                        <ZoruTableRow
                                            key={`${s.email || s.name || 'signer'}-${idx}`}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="text-zoru-ink">
                                                {s.name || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {s.email || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant={statusVariant(s.status)}>
                                                    {s.status || 'pending'}
                                                </ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtDateTime(s.signedAt)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))}
                                </ZoruTableBody>
                            </ZoruTable>
                        </div>
                    </div>
                )}
            </ZoruCard>
        </div>
    );
}
