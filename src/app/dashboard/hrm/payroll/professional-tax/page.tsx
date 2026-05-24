'use client';

import {
  Badge,
  Card,
} from '@/components/zoruui';
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
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total PT Liability</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalPT.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">Current month across all employees</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">States Configured</p>
                    <div className="mt-2 text-2xl text-zoru-ink">{statesCount}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{slabs.length} total slabs defined</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Employees Applicable</p>
                    <div className="mt-2 text-2xl text-zoru-ink">{report.length}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">with matching state slab</p>
                </Card>
            </div>

            <Card className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Professional Tax Report</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                        Calculated PT based on employee salary and defined state slabs.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Employee</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">State</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Gross Salary</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Applicable Slab</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Calculated PT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </td>
                                </tr>
                            ) : report.length > 0 ? (
                                report.map((item, idx) => (
                                    <tr key={item.employeeId ?? idx} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-zoru-ink">{item.employeeName}</div>
                                            <div className="text-[11.5px] text-zoru-ink-muted">{item.designation ?? '—'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="secondary">{item.state}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.grossSalary)}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-zoru-ink-muted">
                                            ₹{item.slabMin?.toLocaleString('en-IN') ?? '—'} – ₹{item.slabMax?.toLocaleString('en-IN') ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.taxAmount)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No data. Add employees with salary and state info, then define slabs.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {report.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-zoru-line bg-zoru-surface-2">
                                    <td colSpan={4} className="px-4 py-3 text-[12.5px] text-zoru-ink">Total PT</td>
                                    <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">
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
