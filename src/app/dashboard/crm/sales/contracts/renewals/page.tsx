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
import {
  ObjectId } from 'mongodb';
import { redirect } from 'next/navigation';
import { ArrowRight,
  FileSignature } from 'lucide-react';

/**
 * CRM Contract Renewals — read-only renewals view.
 *
 * Surfaces every active contract whose `expiryDate` is within the next 90
 * days, sorted by soonest expiry first. Read-only: no CRUD here — the
 * user clicks through to the contract detail to renew/extend.
 *
 * RBAC: `crm_contract`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';

export const dynamic = 'force-dynamic';

const CONTRACTS_BASE = '/dashboard/crm/sales/contracts';
const RENEWAL_WINDOW_DAYS = 90;

interface RenewalRow {
    _id: string;
    title?: string;
    partyB?: string;
    counterparty?: string;
    partyName?: string;
    contractType?: string;
    status?: string;
    effectiveDate?: string | Date;
    expiryDate?: string | Date;
    autoRenew?: boolean;
    value?: number;
    currency?: string;
}

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function daysBetween(now: Date, then: Date): number {
    const ms = then.getTime() - now.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function urgencyTone(daysLeft: number): StatusTone {
    if (daysLeft <= 14) return 'red';
    if (daysLeft <= 30) return 'amber';
    return 'blue';
}

function urgencyLabel(daysLeft: number): string {
    if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
    if (daysLeft === 0) return 'expires today';
    return `${daysLeft}d left`;
}

export default async function ContractRenewalsPage() {
    const session = await getSession();
    if (!session?.user?._id) redirect('/login');

    const guard = await requirePermission('crm_contract', 'view');
    if (!guard.ok) redirect('/dashboard/crm');

    const now = new Date();
    const horizon = new Date(
        now.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    let rows: RenewalRow[] = [];
    let loadError = false;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const docs = await db
            .collection('crm_contracts')
            .find({
                userId: userObjectId,
                status: 'active',
                expiryDate: { $gte: now, $lte: horizon },
            })
            .sort({ expiryDate: 1 })
            .limit(200)
            .toArray();
        rows = JSON.parse(JSON.stringify(docs)) as RenewalRow[];
    } catch (e) {
        console.error('[ContractRenewalsPage] failed to load:', e);
        loadError = true;
    }

    return (
        <EntityListShell
            title="Contract renewals"
            subtitle={`Active contracts expiring within ${RENEWAL_WINDOW_DAYS} days — soonest first.`}
            primaryAction={
                <ZoruButton variant="outline" asChild>
                    <Link href={CONTRACTS_BASE}>
                        <FileSignature className="mr-2 h-4 w-4" />
                        All contracts
                    </Link>
                </ZoruButton>
            }
        >

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-[15px] font-medium text-zoru-ink">
                            Renewal queue
                        </h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            Read-only view. Open the contract to renew, extend
                            or archive.
                        </p>
                    </div>
                    <div className="text-[12px] text-zoru-ink-muted">
                        Window:{' '}
                        <span className="font-mono text-zoru-ink">
                            {fmtDate(now)}
                        </span>{' '}
                        →{' '}
                        <span className="font-mono text-zoru-ink">
                            {fmtDate(horizon)}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Title
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Counterparty
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Type
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Expiry
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Days left
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Auto-renew
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">
                                    Action
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {loadError ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={7}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        Could not load renewals. Please try
                                        again.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : rows.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={7}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        Nothing expiring in the next{' '}
                                        {RENEWAL_WINDOW_DAYS} days. Clear queue.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                rows.map((c) => {
                                    const expiry = c.expiryDate
                                        ? new Date(c.expiryDate as string)
                                        : null;
                                    const daysLeft =
                                        expiry && !Number.isNaN(expiry.getTime())
                                            ? daysBetween(now, expiry)
                                            : 0;
                                    const counterparty =
                                        c.partyB ||
                                        c.counterparty ||
                                        c.partyName ||
                                        '—';
                                    return (
                                        <ZoruTableRow
                                            key={c._id}
                                            className="border-zoru-line"
                                        >
                                            <ZoruTableCell className="font-medium text-zoru-ink">
                                                <Link
                                                    href={`${CONTRACTS_BASE}/${c._id}`}
                                                    className="hover:underline"
                                                >
                                                    {c.title ||
                                                        'Untitled contract'}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {counterparty}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {c.contractType ?? '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtDate(c.expiryDate)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <StatusPill
                                                    label={urgencyLabel(
                                                        daysLeft,
                                                    )}
                                                    tone={urgencyTone(
                                                        daysLeft,
                                                    )}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {c.autoRenew ? (
                                                    <ZoruBadge variant="success">
                                                        On
                                                    </ZoruBadge>
                                                ) : (
                                                    <ZoruBadge variant="ghost">
                                                        Off
                                                    </ZoruBadge>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`${CONTRACTS_BASE}/${c._id}`}
                                                    >
                                                        Open
                                                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                                    </Link>
                                                </ZoruButton>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
