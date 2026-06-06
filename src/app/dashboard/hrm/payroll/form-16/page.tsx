'use client';

import { Card, Button, Badge } from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useTransition } from 'react';
import { Download,
  LoaderCircle,
  ChevronDown } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

const currentYear = new Date().getFullYear();

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
    if (status === 'generated') return <Badge variant="success">Generated</Badge>;
    if (status === 'pending') return <Badge variant="warning">Pending</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
}

export default function Form16Page() {
    const financialYears = getFinancialYears(5);
    const [selectedFY, setSelectedFY] = useState(financialYears[0]);
    const [expandedFY, setExpandedFY] = useState<string>(financialYears[0].label);
    const [isGenerating, startTransition] = useTransition();

    const handleGenerate = (_fyLabel: string) => {
        startTransition(async () => {
            await new Promise(r => setTimeout(r, 1000));
        });
    };

    const totalTaxDeducted = mockForm16Data.reduce((s, e) => s + e.taxDeducted, 0);
    const generated = mockForm16Data.filter(e => e.status === 'generated').length;

    return (
        <EntityListShell
            title="Form 16 Generation"
            subtitle="Download Annual Tax Certificates (Part A & Part B) for all employees."
            primaryAction={
                <Button
                    disabled={isGenerating}
                    onClick={() => handleGenerate(selectedFY.label)}
                >
                    {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Generate All — {selectedFY.label}
                </Button>
            }
        >

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6">
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">Total Tax Deducted (FY {selectedFY.label})</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">₹{totalTaxDeducted.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">Across {mockForm16Data.length} employees</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">Form 16 Generated</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">{generated} / {mockForm16Data.length}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">employees</p>
                </Card>
                <Card className="p-6">
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">Financial Year</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)]">FY {selectedFY.label}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">{selectedFY.period}</p>
                </Card>
            </div>

            <Card className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-[var(--st-text)]">Select Financial Year</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">Expand a year to view and download individual Form 16 certificates.</p>
                </div>
                <div className="space-y-2">
                    {financialYears.map(fy => (
                        <div key={fy.label} className="rounded-lg border border-[var(--st-border)] overflow-hidden">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedFY(fy);
                                    setExpandedFY(prev => prev === fy.label ? '' : fy.label);
                                }}
                                className="flex w-full items-center justify-between bg-[var(--st-bg-muted)] px-4 py-3 text-left hover:bg-[var(--st-bg)] transition-colors"
                            >
                                <div>
                                    <span className="text-[14px] text-[var(--st-text)]">Financial Year {fy.label}</span>
                                    <span className="ml-3 text-[12.5px] text-[var(--st-text-secondary)]">{fy.period}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {fy.label === financialYears[0].label && (
                                        <Badge variant="info">Current FY</Badge>
                                    )}
                                    <ChevronDown className={`h-4 w-4 text-[var(--st-text-secondary)] transition-transform ${expandedFY === fy.label ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {expandedFY === fy.label && (
                                <div className="border-t border-[var(--st-border)]">
                                    <table className="w-full text-left text-[13px]">
                                        <thead>
                                            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg)]">
                                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Employee</th>
                                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">PAN Number</th>
                                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Gross Salary</th>
                                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Total Deductions</th>
                                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Taxable Income</th>
                                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Tax Deducted</th>
                                                <th className="px-4 py-3 text-center text-[12px] uppercase text-[var(--st-text-secondary)]">Status</th>
                                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Download</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mockForm16Data.map(emp => (
                                                <tr key={emp.id} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="text-[var(--st-text)]">{emp.employeeName}</div>
                                                        <div className="text-[11.5px] text-[var(--st-text-secondary)]">{emp.designation}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--st-text)]">{emp.pan}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">₹{emp.grossSalary.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">₹{emp.totalDeductions.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">₹{emp.taxableIncome.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">₹{emp.taxDeducted.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-center">{statusBadge(emp.status)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={emp.status !== 'generated'}
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            Form 16
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                                <td colSpan={5} className="px-4 py-3 text-[12.5px] text-[var(--st-text)]">Total Tax Deducted</td>
                                                <td className="px-4 py-3 text-right font-mono text-[12.5px] text-[var(--st-text)]">₹{totalTaxDeducted.toLocaleString('en-IN')}</td>
                                                <td colSpan={2} />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-4 rounded-lg border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 text-center">
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                        Payroll data must be finalized for the complete financial year before generating Form 16.
                        Currently showing sample data — connect to live payroll actions to enable actual generation.
                    </p>
                </div>
            </Card>
        </EntityListShell>
    );
}
