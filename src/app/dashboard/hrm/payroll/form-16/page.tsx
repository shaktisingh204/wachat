'use client';

import { useState, useTransition } from 'react';
import { FileText, Download, LoaderCircle, ChevronDown } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const currentYear = new Date().getFullYear();

// Financial years: April–March
function getFinancialYears(count = 5) {
    const years = [];
    for (let i = 0; i < count; i++) {
        const start = currentYear - i - 1;
        const end = currentYear - i;
        years.push({
            label: `${start}-${String(end).slice(-2)}`,
            startYear: start,
            endYear: end,
            period: `April ${start} – March ${end}`,
        });
    }
    return years;
}

// Static mock data — replace with real server action when available
const mockForm16Data = [
    {
        id: '1',
        employeeName: 'Priya Sharma',
        designation: 'Senior Engineer',
        pan: 'ABCPS1234D',
        grossSalary: 1440000,
        totalDeductions: 208000,
        taxableIncome: 1232000,
        taxDeducted: 108000,
        taxPaid: 108000,
        status: 'generated',
    },
    {
        id: '2',
        employeeName: 'Rahul Mehta',
        designation: 'Product Manager',
        pan: 'DEFPM5678G',
        grossSalary: 1800000,
        totalDeductions: 245000,
        taxableIncome: 1555000,
        taxDeducted: 185000,
        taxPaid: 185000,
        status: 'generated',
    },
    {
        id: '3',
        employeeName: 'Anjali Verma',
        designation: 'UX Designer',
        pan: 'GHIAV9012K',
        grossSalary: 960000,
        totalDeductions: 132000,
        taxableIncome: 828000,
        taxDeducted: 62400,
        taxPaid: 62400,
        status: 'pending',
    },
    {
        id: '4',
        employeeName: 'Suresh Nair',
        designation: 'Backend Developer',
        pan: 'JKLSN3456M',
        grossSalary: 1200000,
        totalDeductions: 172000,
        taxableIncome: 1028000,
        taxDeducted: 87200,
        taxPaid: 87200,
        status: 'generated',
    },
];

function statusBadge(status: string) {
    if (status === 'generated') return <ClayBadge tone="green" dot>Generated</ClayBadge>;
    if (status === 'pending') return <ClayBadge tone="amber" dot>Pending</ClayBadge>;
    return <ClayBadge tone="neutral">{status}</ClayBadge>;
}

export default function Form16Page() {
    const financialYears = getFinancialYears(5);
    const [selectedFY, setSelectedFY] = useState(financialYears[0]);
    const [expandedFY, setExpandedFY] = useState<string>(financialYears[0].label);
    const [isGenerating, startTransition] = useTransition();

    const handleGenerate = (fyLabel: string) => {
        startTransition(async () => {
            // Server action call would go here
            await new Promise(r => setTimeout(r, 1000));
        });
    };

    const totalTaxDeducted = mockForm16Data.reduce((s, e) => s + e.taxDeducted, 0);
    const generated = mockForm16Data.filter(e => e.status === 'generated').length;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Form 16 Generation"
                subtitle="Download Annual Tax Certificates (Part A & Part B) for all employees."
                icon={FileText}
                actions={
                    <ClayButton
                        variant="obsidian"
                        leading={isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        disabled={isGenerating}
                        onClick={() => handleGenerate(selectedFY.label)}
                    >
                        Generate All — {selectedFY.label}
                    </ClayButton>
                }
            />

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Total Tax Deducted (FY {selectedFY.label})</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">₹{totalTaxDeducted.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">Across {mockForm16Data.length} employees</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Form 16 Generated</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">{generated} / {mockForm16Data.length}</div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">employees</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Financial Year</p>
                    <div className="mt-2 text-2xl font-bold text-clay-ink">FY {selectedFY.label}</div>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">{selectedFY.period}</p>
                </ClayCard>
            </div>

            {/* FY selector accordion */}
            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Select Financial Year</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Expand a year to view and download individual Form 16 certificates.</p>
                </div>
                <div className="space-y-2">
                    {financialYears.map(fy => (
                        <div key={fy.label} className="rounded-clay-md border border-clay-border overflow-hidden">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedFY(fy);
                                    setExpandedFY(prev => prev === fy.label ? '' : fy.label);
                                }}
                                className="flex w-full items-center justify-between bg-clay-surface-2 px-4 py-3 text-left hover:bg-clay-surface transition-colors"
                            >
                                <div>
                                    <span className="text-[14px] font-semibold text-clay-ink">Financial Year {fy.label}</span>
                                    <span className="ml-3 text-[12.5px] text-clay-ink-muted">{fy.period}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {fy.label === financialYears[0].label && (
                                        <ClayBadge tone="blue">Current FY</ClayBadge>
                                    )}
                                    <ChevronDown className={`h-4 w-4 text-clay-ink-muted transition-transform ${expandedFY === fy.label ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {expandedFY === fy.label && (
                                <div className="border-t border-clay-border">
                                    <table className="w-full text-left text-[13px]">
                                        <thead>
                                            <tr className="border-b border-clay-border bg-clay-surface">
                                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Employee</th>
                                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">PAN Number</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Gross Salary</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Total Deductions</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Taxable Income</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Tax Deducted</th>
                                                <th className="px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Status</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Download</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mockForm16Data.map(emp => (
                                                <tr key={emp.id} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-clay-ink">{emp.employeeName}</div>
                                                        <div className="text-[11.5px] text-clay-ink-muted">{emp.designation}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-[12px] text-clay-ink">{emp.pan}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-clay-ink">₹{emp.grossSalary.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-clay-ink">₹{emp.totalDeductions.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-clay-ink">₹{emp.taxableIncome.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-semibold text-clay-ink">₹{emp.taxDeducted.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-center">{statusBadge(emp.status)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <ClayButton
                                                            variant="pill"
                                                            size="sm"
                                                            leading={<Download className="h-3.5 w-3.5" />}
                                                            disabled={emp.status !== 'generated'}
                                                        >
                                                            Form 16
                                                        </ClayButton>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-clay-border bg-clay-surface-2">
                                                <td colSpan={5} className="px-4 py-3 text-[12.5px] font-semibold text-clay-ink">Total Tax Deducted</td>
                                                <td className="px-4 py-3 text-right font-mono text-[12.5px] font-bold text-clay-ink">₹{totalTaxDeducted.toLocaleString('en-IN')}</td>
                                                <td colSpan={2} />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-4 rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 p-4 text-center">
                    <p className="text-[12.5px] text-clay-ink-muted">
                        Payroll data must be finalized for the complete financial year before generating Form 16.
                        Currently showing sample data — connect to live payroll actions to enable actual generation.
                    </p>
                </div>
            </ClayCard>
        </div>
    );
}
