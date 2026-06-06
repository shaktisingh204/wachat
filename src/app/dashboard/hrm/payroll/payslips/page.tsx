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
  Popover,
  PopoverTrigger,
  PopoverContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/sabcrm/20ui/compat';
import {
  Eye,
  LoaderCircle,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';

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



function fmtPeriod(p: string | undefined): string {
    if (!p) return '—';
    try {
        const parts = p.split('-');
        if (parts.length >= 2) {
             const y = parseInt(parts[0], 10);
             const m = parseInt(parts[1], 10);
             if (!Number.isNaN(y) && !Number.isNaN(m)) {
                 const d = new Date(y, m - 1, 1);
                 return d.toLocaleString('default', { month: 'short', year: 'numeric' });
             }
        }
        return p;
    } catch {
        return p;
    }
}

function MonthPickerCalendar({
    value,
    onChange,
    onClose
}: {
    value: string;
    onChange: (v: string) => void;
    onClose: () => void;
}) {
    const [year, setYear] = React.useState(() => {
        if (!value) return new Date().getFullYear();
        const parts = value.split('-');
        const y = parseInt(parts[0], 10);
        return Number.isNaN(y) ? new Date().getFullYear() : y;
    });

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return (
        <div className="p-3 w-[220px]">
            <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setYear(year - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">{year}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setYear(year + 1)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {months.map((m, i) => {
                    const monthStr = String(i + 1).padStart(2, '0');
                    const period = `${year}-${monthStr}`;
                    const isSelected = value === period;
                    return (
                        <Button
                            key={m}
                            variant={isSelected ? "default" : "outline"}
                            className="h-8 text-xs"
                            onClick={() => {
                                onChange(period);
                                onClose();
                            }}
                        >
                            {m}
                        </Button>
                    );
                })}
            </div>
            <div className="mt-4 flex justify-center">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { onChange(''); onClose(); }}>
                    Clear Filter
                </Button>
            </div>
        </div>
    );
}

function BulkExportDialog({ rows }: { rows: CrmPayslipDoc[] }) {
    const [open, setOpen] = React.useState(false);
    const [department, setDepartment] = React.useState('');

    const handleExport = () => {
        const headers = ['Employee', 'Pay Period', 'Gross', 'Net', 'Status', 'Department Filter'];
        const csvRows = rows.map(r => [
            `"${(r.employeeName ?? r.employeeId ?? '').replace(/"/g, '""')}"`,
            `"${r.payPeriod}"`,
            r.gross.toString(),
            r.net.toString(),
            r.status,
            `"${department || 'All'}"`
        ].join(','));
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `payslips_export_${department ? department.replace(/\s+/g, '_').toLowerCase() : 'all'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Bulk Export
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bulk Export Payslips</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-zoru-ink-muted">
                        Export payslips for a specific department.
                    </p>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Department</label>
                        <Input
                            placeholder="e.g. Engineering"
                            value={department}
                            onChange={e => setDepartment(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleExport}>Export CSV</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function PayslipsListPage() {
    const [rows, setRows] = React.useState<CrmPayslipDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmPayslipStatus | 'all'
    >('all');
    const [payPeriod, setPayPeriod] = React.useState<string>('');
    const [isMonthPickerOpen, setIsMonthPickerOpen] = React.useState(false);

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
                primaryAction={<BulkExportDialog rows={rows} />}
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
                        <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={`h-9 w-[160px] justify-start text-left font-normal ${!payPeriod ? "text-zoru-ink-muted" : ""}`}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {payPeriod ? fmtPeriod(payPeriod) : "Pay period"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <MonthPickerCalendar
                                    value={payPeriod}
                                    onChange={setPayPeriod}
                                    onClose={() => setIsMonthPickerOpen(false)}
                                />
                            </PopoverContent>
                        </Popover>
                    </>
                }
                loading={isLoading && rows.length === 0}
            >
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <Table>
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
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`${BASE}/${p._id}`}>
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
        </EntityListShell>
    );
}
