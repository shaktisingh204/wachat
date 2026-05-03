'use client';

import Link from 'next/link';
import { CalendarCheck, CalendarX, FileSpreadsheet, BookOpen, BarChart3 } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const REPORT_CATEGORIES = [
    {
        href: '/dashboard/hrm/payroll/reports/attendance',
        icon: CalendarCheck,
        title: 'Attendance Report',
        description: 'Track employee attendance, absences, late arrivals, WFH days, and half-days across any date range.',
        color: 'text-emerald-500',
        bg: 'bg-emerald-50',
    },
    {
        href: '/dashboard/hrm/payroll/reports/leave',
        icon: CalendarX,
        title: 'Leave Report',
        description: 'View leave allocation, usage, pending requests, and remaining balances by employee and leave type.',
        color: 'text-amber-500',
        bg: 'bg-amber-50',
    },
    {
        href: '/dashboard/hrm/payroll/reports/payroll-summary',
        icon: FileSpreadsheet,
        title: 'Payroll Summary',
        description: 'Monthly payroll breakdown with gross salary, PF, ESI, TDS, professional tax, and net pay per employee.',
        color: 'text-sky-500',
        bg: 'bg-sky-50',
    },
    {
        href: '/dashboard/hrm/payroll/reports/salary-register',
        icon: BookOpen,
        title: 'Salary Register',
        description: 'Detailed salary component register — basic, HRA, allowances, and all deductions for any month.',
        color: 'text-accent-foreground',
        bg: 'bg-accent',
    },
];

export default function HrReportsIndexPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Payroll Reports"
                subtitle="Generate and download detailed HR and payroll reports for your organisation."
                icon={BarChart3}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                {REPORT_CATEGORIES.map(({ href, icon: Icon, title, description, color, bg }) => (
                    <Link key={href} href={href} className="group block focus-visible:outline-none">
                        <ClayCard className="h-full transition-shadow duration-150 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary/30">
                            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                                <Icon className={`h-5 w-5 ${color}`} strokeWidth={1.75} />
                            </div>
                            <h2 className="mb-1.5 text-[15px] font-semibold text-foreground">{title}</h2>
                            <p className="text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
                            <p className={`mt-4 text-[12.5px] font-medium ${color}`}>View report →</p>
                        </ClayCard>
                    </Link>
                ))}
            </div>
        </div>
    );
}
