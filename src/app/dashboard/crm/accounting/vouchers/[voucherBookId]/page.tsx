import { Button, Card, Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import { Edit,
  History,
  Printer,
  Archive,
  Plus } from 'lucide-react';

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill } from '@/components/crm/status-pill';
import { format } from 'date-fns';

import {
    getVoucherBookById,
    getVoucherEntriesByBook,
} from '@/app/actions/crm-vouchers.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import { ExportCsvButton } from './export-csv-button';

export default async function VoucherBookDetailPage(props: {
    params: Promise<{ voucherBookId: string }>;
}) {
    const { voucherBookId } = await props.params;

    const [book, entries] = await Promise.all([
        getVoucherBookById(voucherBookId),
        getVoucherEntriesByBook(voucherBookId, 50),
    ]);
    if (!book) notFound();

    const meta = book as typeof book & {
        prefix?: string;
        suffix?: string;
        startingNumber?: number;
        padding?: number;
        resetFrequency?: 'none' | 'yearly' | 'monthly';
        approvalRequired?: boolean;
        isActive?: boolean;
    };

    return (
        <EntityDetailShell
            back={{ href: '/dashboard/crm/accounting/vouchers', label: 'Back to Voucher Books' }}
            eyebrow={`VOUCHER BOOK · ${book.type.toUpperCase()}`}
            title={book.name}
            status={{
                label: meta.isActive === false ? 'Inactive' : 'Active',
                tone: meta.isActive === false ? 'neutral' : 'green',
            }}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/vouchers/${voucherBookId}/edit`}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/vouchers/${voucherBookId}`}>
                            View entries
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/vouchers/${voucherBookId}?print=1`}>
                            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                        <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/accounting/vouchers/${voucherBookId}/activity`}>
                            <History className="mr-1.5 h-3.5 w-3.5" /> Activity
                        </Link>
                    </Button>
                    <Button asChild size="sm">
                        <Link href={`/dashboard/crm/accounting/vouchers/new?mode=entry&bookId=${voucherBookId}`}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New entry
                        </Link>
                    </Button>
                </div>
            }
            rightRail={
                <div className="flex flex-col gap-4">
                    <Card className="p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Numbering
                        </p>
                        <dl className="mt-2 space-y-1.5 text-[13px]">
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Prefix</dt>
                                <dd className="font-mono text-right">{meta.prefix || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Suffix</dt>
                                <dd className="font-mono text-right">{meta.suffix || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Starting #</dt>
                                <dd className="font-mono text-right">{meta.startingNumber ?? 1}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Padding</dt>
                                <dd className="font-mono text-right">{meta.padding ?? 0}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Reset</dt>
                                <dd className="text-right capitalize">{meta.resetFrequency ?? 'none'}</dd>
                            </div>
                        </dl>
                    </Card>
                    <Card className="p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Flags
                        </p>
                        <dl className="mt-2 space-y-1.5 text-[13px]">
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Default for type</dt>
                                <dd>{book.isDefault ? <StatusPill label="Default" tone="blue" /> : <span className="text-[12px] text-zoru-ink-muted">No</span>}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-zoru-ink-muted">Approval required</dt>
                                <dd>
                                    {meta.approvalRequired ? (
                                        <StatusPill label="Required" tone="amber" />
                                    ) : (
                                        <span className="text-[12px] text-zoru-ink-muted">No</span>
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </Card>
                </div>
            }
            audit={<EntityAuditTimeline entityKind="voucher_book" entityId={voucherBookId} />}
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <SummaryCell label="Total entries" value={(book.entryCount ?? entries.length).toLocaleString()} />
                        <SummaryCell
                            label="Last entry"
                            value={book.lastEntryDate ? format(new Date(book.lastEntryDate), 'dd MMM yyyy') : '—'}
                        />
                        <SummaryCell label="Type" value={book.type} />
                    </div>
                </Card>
                <Card className="p-0">
                    <div className="flex items-start justify-between px-4 py-3">
                        <div>
                            <p className="text-[13px] font-semibold text-zoru-ink">Recent entries</p>
                            <p className="text-[11.5px] text-zoru-ink-muted">
                                Last 50 voucher entries posted under this book.
                            </p>
                        </div>
                        <ExportCsvButton data={entries} filename={`voucher-entries-${voucherBookId}`} />
                    </div>
                    <div className="overflow-x-auto border-t border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Voucher #</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Note</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">Total Debit</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">Total Credit</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {entries.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={5} className="h-24 text-center text-zoru-ink-muted">
                                            No entries posted yet.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    entries.map((entry) => (
                                        <ZoruTableRow key={entry._id.toString()} className="border-zoru-line">
                                            <ZoruTableCell className="text-zoru-ink">
                                                {format(new Date(entry.date), 'dd MMM yyyy')}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                {entry.voucherNumber}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                                                {entry.note}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                {entry.totalDebit?.toLocaleString('en-IN', {
                                                    style: 'currency',
                                                    currency: 'INR',
                                                })}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                {entry.totalCredit?.toLocaleString('en-IN', {
                                                    style: 'currency',
                                                    currency: 'INR',
                                                })}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </EntityDetailShell>
    );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-3">
            <p className="text-[11.5px] text-zoru-ink-muted">{label}</p>
            <p className="mt-1 text-[18px] font-semibold text-zoru-ink">{value}</p>
        </div>
    );
}
