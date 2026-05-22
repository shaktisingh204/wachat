'use client';

import {
  Button,
  Input,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Eye,
  LoaderCircle } from 'lucide-react';

/**
 * Payslips — list page (Rust-backed).
 *
 * Columns: Employee, Pay Period, Gross, Net, Status, Issued at.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import { getPayslipsList } from '@/app/actions/crm-payslips.actions';
import type {
    CrmPayslipDoc,
    CrmPayslipStatus,
} from '@/lib/rust-client/crm-payslips';

const BASE = '/dashboard/hrm/payroll/payslips';

const STATUS_TONE: Record<CrmPayslipStatus, StatusTone> = {
    draft: 'amber',
    issued: 'blue',
    paid: 'green',
    archived: 'neutral',
};

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtPeriod(p: string | undefined): string {
    if (!p) return '—';
    // Accept either `YYYY-MM` or full ISO.
    const m = /^(\d{4})-(\d{2})/.exec(p);
    if (!m) return p;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return d.toLocaleString('default', { month: 'short', year: 'numeric' });
}

export default function PayslipsListPage() {
    const [rows, setRows] = React.useState<CrmPayslipDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmPayslipStatus | 'all'
    >('all');
    const [payPeriod, setPayPeriod] = React.useState<string>('');

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getPayslipsList({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                payPeriod: payPeriod || undefined,
                limit: 100,
            });
            setRows(res.items ?? []);
        } catch {
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, payPeriod]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    return (
        <EntityListShell
                title="Payslips"
                subtitle="Issued payslips by employee and pay period."
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search by employee…',
                }}
                filters={
                    <>
                        <EnumFilterField
                            enumName="payslipStatus"
                            value={statusFilter}
                            onChange={(v) =>
                                setStatusFilter(v as CrmPayslipStatus | 'all')
                            }
                            placeholder="All statuses"
                        />
                        <ZoruInput
                            type="month"
                            className="h-9 w-[160px]"
                            value={payPeriod}
                            onChange={(e) => setPayPeriod(e.target.value)}
                            placeholder="Pay period"
                        />
                    </>
                }
                loading={isLoading && rows.length === 0}
            >
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Pay period</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Gross</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Net</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Issued at</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={7} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : rows.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={7} className="h-24 text-center text-zoru-ink-muted">
                                        No payslips match this filter.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                rows.map((p) => {
                                    const status = (p.status ?? 'draft') as CrmPayslipStatus;
                                    const tone = STATUS_TONE[status] ?? 'neutral';
                                    return (
                                        <ZoruTableRow key={p._id} className="border-zoru-line">
                                            <ZoruTableCell className="font-medium text-zoru-ink">
                                                <Link href={`${BASE}/${p._id}`} className="hover:underline">
                                                    {p.employeeName ?? p.employeeId ?? '—'}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtPeriod(p.payPeriod)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                {inr.format(p.gross ?? 0)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                {inr.format(p.net ?? 0)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <StatusPill label={status} tone={tone} />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtDate(p.issuedAt)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton variant="ghost" size="icon" asChild>
                                                    <Link href={`${BASE}/${p._id}`}>
                                                        <Eye className="h-4 w-4" />
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
        </EntityListShell>
    );
}
