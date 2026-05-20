'use client';

import { ZoruCard, ZoruButton, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
    BarChart3,
    BookOpen,
    CalendarCheck,
    CalendarX,
    DollarSign,
    Download,
    FileSpreadsheet,
    Receipt,
    TrendingDown,
    Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listPayrollRuns, type CrmPayrollRunDoc } from '@/app/actions/crm-payroll-runs.actions';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

const REPORT_CATEGORIES = [
    {
        href: '/dashboard/crm/hr-payroll/reports/attendance',
        icon: CalendarCheck,
        title: 'Attendance Report',
        description:
            'Track employee attendance, absences, late arrivals, WFH days, and half-days across any date range.',
        color: 'text-emerald-500',
        bg: 'bg-emerald-50',
    },
    {
        href: '/dashboard/crm/hr-payroll/reports/leave',
        icon: CalendarX,
        title: 'Leave Report',
        description:
            'View leave allocation, usage, pending requests, and remaining balances by employee and leave type.',
        color: 'text-amber-500',
        bg: 'bg-amber-50',
    },
    {
        href: '/dashboard/crm/hr-payroll/reports/payroll-summary',
        icon: FileSpreadsheet,
        title: 'Payroll Summary',
        description:
            'Monthly payroll breakdown with gross salary, PF, ESI, TDS, professional tax, and net pay per employee.',
        color: 'text-sky-500',
        bg: 'bg-sky-50',
    },
    {
        href: '/dashboard/crm/hr-payroll/reports/salary-register',
        icon: BookOpen,
        title: 'Salary Register',
        description:
            'Detailed salary component register — basic, HRA, allowances, and all deductions for any month.',
        color: 'text-accent-foreground',
        bg: 'bg-accent',
    },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function KpiCard({
    icon,
    label,
    value,
    hint,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <ZoruCard className="p-5">
            <div className="flex items-center gap-2 text-zoru-ink-muted">
                {icon}
                <p className="text-[12.5px] font-medium">{label}</p>
            </div>
            <div className="mt-2 truncate text-[22px] font-semibold text-zoru-ink">{value}</div>
            {hint ? (
                <p className="mt-1 truncate text-[11.5px] text-zoru-ink-muted" title={hint}>
                    {hint}
                </p>
            ) : null}
        </ZoruCard>
    );
}

function formatCurrency(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('en-IN');
}

export default function HrReportsIndexPage(): React.JSX.Element {
    const [year, setYear] = React.useState<string>(String(CURRENT_YEAR));
    const [runs, setRuns] = React.useState<CrmPayrollRunDoc[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        setLoading(true);
        listPayrollRuns({ year: Number(year), limit: 200 })
            .then((rows) => setRuns(rows))
            .catch(() => setRuns([]))
            .finally(() => setLoading(false));
    }, [year]);

    const totalRuns = runs.length;
    const totalGross = runs.reduce((s, r) => s + (r.total_gross ?? 0), 0);
    const totalNet = runs.reduce((s, r) => s + (r.total_net ?? 0), 0);
    const totalDeductions = runs.reduce((s, r) => s + (r.total_deductions ?? 0), 0);

    const handleExport = React.useCallback(() => {
        const rows = runs.map((r) => ({
            Year: r.period_year ?? year,
            Month: r.period_month ?? '',
            Status: r.status ?? '',
            Employees: r.total_employees ?? 0,
            GrossPay: r.total_gross ?? 0,
            Deductions: r.total_deductions ?? 0,
            NetPay: r.total_net ?? 0,
            RunDate: r.run_date ?? r.createdAt ?? '',
        }));
        const headers = ['Year', 'Month', 'Status', 'Employees', 'GrossPay', 'Deductions', 'NetPay', 'RunDate'];
        const csv = [
            headers.join(','),
            ...rows.map((r) =>
                headers.map((h) => JSON.stringify(r[h as keyof typeof r] ?? '')).join(','),
            ),
        ].join('\n');
        downloadCsv(csv, `payroll-runs-${year}-${dateStamp()}.csv`);
    }, [runs, year]);

    return (
        <EntityListShell
            title="Payroll Reports"
            subtitle="Generate and download detailed HR and payroll reports for your organisation."
            primaryAction={
                <div className="flex items-center gap-2">
                    <div className="w-32">
                        <ZoruSelect value={year} onValueChange={setYear}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {YEAR_OPTIONS.map((y) => (
                                    <ZoruSelectItem key={y} value={String(y)}>
                                        {y}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <ZoruButton variant="outline" onClick={handleExport} disabled={loading || runs.length === 0}>
                        <Download className="h-4 w-4" strokeWidth={1.75} />
                        Export CSV
                    </ZoruButton>
                </div>
            }
        >
            {/* KPI strip */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    icon={<BarChart3 className="h-4 w-4" />}
                    label="Payroll runs"
                    value={loading ? '…' : totalRuns.toLocaleString()}
                    hint={`Year ${year}`}
                />
                <KpiCard
                    icon={<DollarSign className="h-4 w-4" />}
                    label="Total gross"
                    value={loading ? '…' : formatCurrency(totalGross)}
                    hint="YTD gross salary"
                />
                <KpiCard
                    icon={<Receipt className="h-4 w-4" />}
                    label="Total net pay"
                    value={loading ? '…' : formatCurrency(totalNet)}
                    hint="YTD take-home"
                />
                <KpiCard
                    icon={<TrendingDown className="h-4 w-4" />}
                    label="YTD deductions"
                    value={loading ? '…' : formatCurrency(totalDeductions)}
                    hint="PF + ESI + TDS + PT"
                />
            </div>

            {/* Sub-report tiles */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {REPORT_CATEGORIES.map(({ href, icon: Icon, title, description, color, bg }) => (
                    <Link key={href} href={href} className="group block focus-visible:outline-none">
                        <ZoruCard className="h-full p-6 transition-shadow duration-150 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary/30">
                            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                                <Icon className={`h-5 w-5 ${color}`} strokeWidth={1.75} />
                            </div>
                            <h2 className="mb-1.5 text-[15px] text-zoru-ink">{title}</h2>
                            <p className="text-[12.5px] leading-relaxed text-zoru-ink-muted">
                                {description}
                            </p>
                            <p className={`mt-4 text-[12.5px] font-medium ${color}`}>
                                View report →
                            </p>
                        </ZoruCard>
                    </Link>
                ))}
            </div>
        </EntityListShell>
    );
}
