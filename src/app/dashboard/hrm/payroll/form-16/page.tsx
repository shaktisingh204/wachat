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
                    <p className="text-[12.5px] font-medium text-muted-foreground">Total Tax Deducted (FY {selectedFY.label})</p>
                    <div className="mt-2 text-2xl font-bold text-foreground">₹{totalTaxDeducted.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">Across {mockForm16Data.length} employees</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Form 16 Generated</p>
                    <div className="mt-2 text-2xl font-bold text-foreground">{generated} / {mockForm16Data.length}</div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">employees</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Financial Year</p>
                    <div className="mt-2 text-2xl font-bold text-foreground">FY {selectedFY.label}</div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">{selectedFY.period}</p>
                </ClayCard>
            </div>

            {/* FY selector accordion */}
            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Select Financial Year</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">Expand a year to view and download individual Form 16 certificates.</p>
                </div>
                <div className="space-y-2">
                    {financialYears.map(fy => (
                        <div key={fy.label} className="rounded-lg border border-border overflow-hidden">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedFY(fy);
                                    setExpandedFY(prev => prev === fy.label ? '' : fy.label);
                                }}
                                className="flex w-full items-center justify-between bg-secondary px-4 py-3 text-left hover:bg-card transition-colors"
                            >
                                <div>
                                    <span className="text-[14px] font-semibold text-foreground">Financial Year {fy.label}</span>
                                    <span className="ml-3 text-[12.5px] text-muted-foreground">{fy.period}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {fy.label === financialYears[0].label && (
                                        <ClayBadge tone="blue">Current FY</ClayBadge>
                                    )}
                                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedFY === fy.label ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {expandedFY === fy.label && (
                                <div className="border-t border-border">
                                    <table className="w-full text-left text-[13px]">
                                        <thead>
                                            <tr className="border-b border-border bg-card">
                                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Employee</th>
                                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">PAN Number</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Gross Salary</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Total Deductions</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Taxable Income</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Tax Deducted</th>
                                                <th className="px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Download</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mockForm16Data.map(emp => (
                                                <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-foreground">{emp.employeeName}</div>
                                                        <div className="text-[11.5px] text-muted-foreground">{emp.designation}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-[12px] text-foreground">{emp.pan}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-foreground">₹{emp.grossSalary.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-foreground">₹{emp.totalDeductions.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-foreground">₹{emp.taxableIncome.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">₹{emp.taxDeducted.toLocaleString('en-IN')}</td>
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
                                            <tr className="border-t-2 border-border bg-secondary">
                                                <td colSpan={5} className="px-4 py-3 text-[12.5px] font-semibold text-foreground">Total Tax Deducted</td>
                                                <td className="px-4 py-3 text-right font-mono text-[12.5px] font-bold text-foreground">₹{totalTaxDeducted.toLocaleString('en-IN')}</td>
                                                <td colSpan={2} />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary p-4 text-center">
                    <p className="text-[12.5px] text-muted-foreground">
                        Payroll data must be finalized for the complete financial year before generating Form 16.
                        Currently showing sample data — connect to live payroll actions to enable actual generation.
                    </p>
                </div>
            </ClayCard>
        </div>
    );
}
