'use client';

import { Badge, Card } from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useEffect,
  useCallback,
  useTransition,
} from 'react';
import { LoaderCircle } from 'lucide-react';

import { getCrmPtSlabs, generateProfessionalTaxReport } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmProfessionalTaxSlab } from '@/lib/definitions';
import { PtNavigation } from './_components/pt-navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function ProfessionalTaxPage() {
    const [slabs, setSlabs] = useState<WithId<CrmProfessionalTaxSlab>[]>([]);
    const [report, setReport] = useState<any[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const [slabsData, reportData] = await Promise.all([
                getCrmPtSlabs(),
                generateProfessionalTaxReport(),
            ]);
            setSlabs(slabsData);
            setReport(reportData);
        });
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalPT = report.reduce((s, r) => s + (r.taxAmount ?? 0), 0);
    const statesCount = [...new Set(slabs.map(s => s.state))].length;

    return (
        <EntityListShell
            title="Professional Tax"
            subtitle="Manage state-wise PT slabs and view calculated tax for employees."
            viewSwitcher={<PtNavigation />}
        >
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">Total PT Liability</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">₹{totalPT.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">Current month across all employees</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">States Configured</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">{statesCount}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">{slabs.length} total slabs defined</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">Employees Applicable</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">{report.length}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">with matching state slab</p>
                </Card>
            </div>

            <Card className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-[var(--st-text)]">Professional Tax Report</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                        Calculated PT based on employee salary and defined state slabs.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Employee</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">State</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Gross Salary</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Applicable Slab</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Calculated PT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                    </td>
                                </tr>
                            ) : report.length > 0 ? (
                                report.map((item, idx) => (
                                    <tr key={item.employeeId ?? idx} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-[var(--st-text)]">{item.employeeName}</div>
                                            <div className="text-[11.5px] text-[var(--st-text-secondary)]">{item.designation ?? '—'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="secondary">{item.state}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.grossSalary)}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-[var(--st-text-secondary)]">
                                            ₹{item.slabMin?.toLocaleString('en-IN') ?? '—'} – ₹{item.slabMax?.toLocaleString('en-IN') ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.taxAmount)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                                        No data. Add employees with salary and state info, then define slabs.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {report.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                    <td colSpan={4} className="px-4 py-3 text-[12.5px] text-[var(--st-text)]">Total PT</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-[var(--st-text)]">
                                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalPT)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </Card>
        </EntityListShell>
    );
}
