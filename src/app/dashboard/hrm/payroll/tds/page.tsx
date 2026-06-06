'use client';

import React, { useState, useTransition, Suspense, useCallback, useEffect } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { startOfMonth, format } from 'date-fns';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { TdsPeriodSelector } from './period-selector';
import { TdsDataView } from './tds-client-view';
import { EmptyState, Button } from '@/components/sabcrm/20ui/compat';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' },
];

function fetchTdsData(year: number, month: number) {
    const period = startOfMonth(new Date(Date.UTC(year, month, 1))); // Use UTC to prevent hydration mismatch for dates
    return Promise.all([
        getPayslips(period),
        getCrmEmployees(),
    ]).then(([payslipsData, employeesData]) => {
        const employeeMap = new Map(employeesData.map((e: any) => [e._id.toString(), e]));
        return payslipsData.map((slip: any) => {
            const emp = employeeMap.get(slip.employeeId.toString());
            const tds = slip.deductions?.find((d: any) => d.name?.includes('Tax') || d.name?.includes('TDS'))?.amount ?? 0;
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

class TdsErrorBoundary extends React.Component<{ children: React.ReactNode, onReset: () => void }, { hasError: boolean, error: Error | null }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex justify-center p-24">
                    <EmptyState
                        icon={AlertCircle}
                        title="Error Loading TDS Data"
                        description={this.state.error?.message || "Something went wrong while fetching data."}
                        action={
                            <Button onClick={() => {
                                this.setState({ hasError: false, error: null });
                                this.props.onReset();
                            }}>
                                Retry
                            </Button>
                        }
                    />
                </div>
            );
        }
        return this.props.children;
    }
}

export default function TdsPage() {
    const [isMounted, setIsMounted] = useState(false);
    
    // We keep state local but initialize with a fixed default or handle after mount
    // to prevent hydration issues with new Date()
    const [month, setMonth] = useState(0); 
    const [year, setYear] = useState(currentYear);
    const [isPending, startTransition] = useTransition();

    const [dataPromise, setDataPromise] = useState<Promise<any[]> | null>(null);

    useEffect(() => {
        const currentMonth = new Date().getMonth();
        const currentY = new Date().getFullYear();
        setMonth(currentMonth);
        setYear(currentY);
        setDataPromise(fetchTdsData(currentY, currentMonth));
        setIsMounted(true);
    }, []);

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
    
    const handleReset = useCallback(() => {
        setDataPromise(fetchTdsData(year, month));
    }, [year, month]);

    const monthLabel = months.find(m => m.value === month)?.label ?? '';
    const periodLabel = `${monthLabel} ${year}`;

    if (!isMounted) {
        return (
            <EntityListShell title="TDS Management" subtitle="Tax Deducted at Source tracking">
                <div className="flex justify-center p-24">
                    <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-accent)]" />
                </div>
            </EntityListShell>
        );
    }

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
                <TdsErrorBoundary onReset={handleReset}>
                    <Suspense fallback={
                        <div className="flex justify-center p-24">
                            <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-accent)]" />
                        </div>
                    }>
                        {dataPromise && <TdsDataView dataPromise={dataPromise} periodLabel={periodLabel} />}
                    </Suspense>
                </TdsErrorBoundary>
            </div>
        </EntityListShell>
    );
}
