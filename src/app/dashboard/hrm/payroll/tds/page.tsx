'use client';

import React, { useState, useTransition, Suspense, useCallback } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { startOfMonth, format } from 'date-fns';
import { LoaderCircle } from 'lucide-react';
import { TdsPeriodSelector } from './period-selector';
import { TdsDataView } from './tds-client-view';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' },
];

function fetchTdsData(year: number, month: number) {
    const period = startOfMonth(new Date(year, month));
    return Promise.all([
        getPayslips(period),
        getCrmEmployees(),
    ]).then(([payslipsData, employeesData]) => {
        const employeeMap = new Map(employeesData.map((e: any) => [e._id.toString(), e]));
        return payslipsData.map((slip: any) => {
            const emp = employeeMap.get(slip.employeeId.toString());
            const tds = slip.deductions.find((d: any) => d.name?.includes('Tax') || d.name?.includes('TDS'))?.amount ?? 0;
            return {
                ...slip,
                employee: emp,
                tds,
                pan: (emp as any)?.pan ?? '—',
                taxRegime: (emp as any)?.taxRegime ?? 'old',
                deductionDate: format(period, 'dd MMM yyyy'),
            };
        });
    });
}

export default function TdsPage() {
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(currentYear);
    const [isPending, startTransition] = useTransition();

    const [dataPromise, setDataPromise] = useState(() => fetchTdsData(year, month));

    const handleMonthChange = useCallback((val: number) => {
        setMonth(val);
        startTransition(() => {
            setDataPromise(fetchTdsData(year, val));
        });
    }, [year]);

    const handleYearChange = useCallback((val: number) => {
        setYear(val);
        startTransition(() => {
            setDataPromise(fetchTdsData(val, month));
        });
    }, [month]);

    const monthLabel = months.find(m => m.value === month)?.label ?? '';
    const periodLabel = `${monthLabel} ${year}`;

    return (
        <EntityListShell
            title="TDS Management"
            subtitle={`Tax Deducted at Source tracking for ${periodLabel}.`}
            primaryAction={
                <TdsPeriodSelector 
                    month={month} 
                    year={year} 
                    onMonthChange={handleMonthChange} 
                    onYearChange={handleYearChange}
                    months={months}
                    years={years}
                />
            }
        >
            <div className={isPending ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                <Suspense fallback={
                    <div className="flex justify-center p-24">
                        <LoaderCircle className="h-8 w-8 animate-spin text-zoru-brand" />
                    </div>
                }>
                    <TdsDataView dataPromise={dataPromise} periodLabel={periodLabel} />
                </Suspense>
            </div>
        </EntityListShell>
    );
}
