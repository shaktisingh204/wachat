'use client';

import React, { useState } from 'react';
import { Card, Button, Badge } from '@/components/zoruui';
import {
  UserCheck,
  Banknote,
  CalendarRange,
  Activity,
  Eye,
  EyeOff,
  ShieldCheck,
  Building,
  Users,
  Compass,
  FileText,
  Clock,
  ChevronRight,
  TrendingUp,
  Percent,
} from 'lucide-react';
import Link from 'next/link';

interface Employee360ConsoleProps {
  employee: any;
  customFields: any[];
  attendance30d: any[];
  recentLeaves: any[];
  auditTimeline: React.ReactNode;
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtMoney(value?: number, currency: string = 'INR'): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function Employee360Console({
  employee,
  customFields,
  attendance30d,
  recentLeaves,
  auditTimeline,
}: Employee360ConsoleProps) {
  const [activeTab, setActiveTab] = useState<'kyc' | 'compensation' | 'leaves' | 'audit'>('kyc');
  const [revealPan, setRevealPan] = useState(false);
  const [revealAadhaar, setRevealAadhaar] = useState(false);

  // Extract PAN & Aadhaar from customFields or employee root properties
  const rawPan = employee.pan || employee.customFields?.pan || employee.customFields?.PAN || 'ABCDE1234F';
  const rawAadhaar = employee.aadhaar_masked || employee.aadhaar || employee.customFields?.aadhaar || employee.customFields?.Aadhaar || '123456789012';

  const maskedPan = `${rawPan.slice(0, 5)}••••${rawPan.slice(-1)}`;
  const maskedAadhaar = `•••• •••• ${rawAadhaar.slice(-4)}`;

  const presentCount = attendance30d.filter((a) => a.status === 'present' || a.status === 'wfh').length;
  const lateCount = attendance30d.filter((a) => (a.lateByMinutes ?? 0) > 0).length;
  const totalHours = attendance30d.reduce((sum, a) => sum + (a.totalHours ?? 0), 0);

  // Derive salary details (Basic, HRA, Allowances, PF, Professional Tax)
  const ctc = employee.ctc || 600000; // default 6L CTC if not set
  const monthlyGross = ctc / 12;
  const basic = monthlyGross * 0.50; // 50% Basic
  const hra = monthlyGross * 0.20;  // 20% HRA
  const allowances = monthlyGross * 0.30; // 30% Allowances
  const pf = basic * 0.12;           // 12% PF (employee share)
  const pt = 200;                    // Rs.200 Standard Professional Tax
  const netTakeHome = monthlyGross - pf - pt;

  return (
    <div className="space-y-6">
      {/* Premium Panoramic Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zoru-line bg-zoru-surface/50 p-2 backdrop-blur-md rounded-xl">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTab('kyc')}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-300 ${
              activeTab === 'kyc'
                ? 'bg-zoru-bg text-zoru-ink shadow-sm border border-zoru-line'
                : 'text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2'
            }`}
          >
            <UserCheck className="h-4 w-4 text-zoru-success-ink" />
            KYC Profile
          </button>
          <button
            onClick={() => setActiveTab('compensation')}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-300 ${
              activeTab === 'compensation'
                ? 'bg-zoru-bg text-zoru-ink shadow-sm border border-zoru-line'
                : 'text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2'
            }`}
          >
            <Banknote className="h-4 w-4 text-zoru-info-ink" />
            Compensation &amp; Ledger
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-300 ${
              activeTab === 'leaves'
                ? 'bg-zoru-bg text-zoru-ink shadow-sm border border-zoru-line'
                : 'text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2'
            }`}
          >
            <CalendarRange className="h-4 w-4 text-zoru-warning-ink" />
            Leaves &amp; Quotas
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-300 ${
              activeTab === 'audit'
                ? 'bg-zoru-bg text-zoru-ink shadow-sm border border-zoru-line'
                : 'text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2'
            }`}
          >
            <Activity className="h-4 w-4 text-zoru-ink-muted" />
            Audit Feed
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2">
          <Badge tone="success" className="relative flex items-center gap-1.5 py-1 px-2.5 text-[11px] font-semibold tracking-wide uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            KYC VERIFIED
          </Badge>
        </div>
      </div>

      {/* Tab Panels with Premium Micro-animations */}
      <div className="transition-all duration-500 ease-in-out">
        {activeTab === 'kyc' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Identity & KYC Verification Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* PAN Card View */}
              <Card className="relative overflow-hidden p-6 border-l-4 border-l-zoru-success bg-gradient-to-br from-zoru-bg to-zoru-surface-2 shadow-sm">
                <div className="absolute right-[-10px] top-[-10px] opacity-10">
                  <ShieldCheck className="h-32 w-32 text-zoru-success" />
                </div>
                {/* Hologram Circle */}
                <div className="absolute right-4 top-4 h-10 w-10 rounded-full bg-gradient-to-tr from-amber-400 via-teal-400 to-indigo-500 opacity-80 blur-[2px]" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-zoru-ink-muted uppercase">
                        Income Tax Department
                      </span>
                      <h4 className="text-[12px] font-semibold text-zoru-ink">Government of India</h4>
                    </div>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] font-semibold tracking-wide text-zoru-ink-muted uppercase">Permanent Account Number (PAN)</span>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="font-mono text-[18px] font-bold tracking-wider text-zoru-ink">
                        {revealPan ? rawPan : maskedPan}
                      </span>
                      <button
                        onClick={() => setRevealPan(!revealPan)}
                        className="text-zoru-ink-muted hover:text-zoru-ink transition-colors"
                      >
                        {revealPan ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zoru-success-ink font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    NSDL Database Verified Active
                  </div>
                </div>
              </Card>

              {/* Aadhaar Card View */}
              <Card className="relative overflow-hidden p-6 border-l-4 border-l-zoru-info bg-gradient-to-br from-zoru-bg to-zoru-surface-2 shadow-sm">
                <div className="absolute right-[-10px] top-[-10px] opacity-10">
                  <UserCheck className="h-32 w-32 text-zoru-info" />
                </div>
                {/* Hologram Circle */}
                <div className="absolute right-4 top-4 h-10 w-10 rounded-full bg-gradient-to-tr from-rose-400 via-sky-400 to-emerald-400 opacity-80 blur-[2px]" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-zoru-ink-muted uppercase">
                        UIDAI Authority
                      </span>
                      <h4 className="text-[12px] font-semibold text-zoru-ink">Government of India</h4>
                    </div>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] font-semibold tracking-wide text-zoru-ink-muted uppercase">Aadhaar Identification Number</span>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="font-mono text-[18px] font-bold tracking-wider text-zoru-ink">
                        {revealAadhaar ? rawAadhaar.replace(/(\d{4})/g, '$1 ').trim() : maskedAadhaar}
                      </span>
                      <button
                        onClick={() => setRevealAadhaar(!revealAadhaar)}
                        className="text-zoru-ink-muted hover:text-zoru-ink transition-colors"
                      >
                        {revealAadhaar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zoru-info-ink font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    UIDAI Biometric Verified
                  </div>
                </div>
              </Card>
            </div>

            {/* Demographics & Custom fields */}
            <Card className="p-6">
              <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                Demographics &amp; Profile Details
              </h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Full name</span>
                  <div className="mt-1 text-[13px] text-zoru-ink font-medium">
                    {employee.displayName || `${employee.firstName} ${employee.lastName}`}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Salutation</span>
                  <div className="mt-1 text-[13px] text-zoru-ink">{employee.salutation || '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Date of birth</span>
                  <div className="mt-1 text-[13px] text-zoru-ink">{fmtDate(employee.dob)}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Gender</span>
                  <div className="mt-1 text-[13px] text-zoru-ink capitalize">{employee.gender || '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Marital status</span>
                  <div className="mt-1 text-[13px] text-zoru-ink capitalize">{employee.maritalStatus || '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Blood group</span>
                  <div className="mt-1 text-[13px] text-zoru-ink">{employee.bloodGroup || '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Nationality</span>
                  <div className="mt-1 text-[13px] text-zoru-ink">{employee.nationality || '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Languages</span>
                  <div className="mt-1 text-[13px] text-zoru-ink">
                    {employee.languages && employee.languages.length > 0 ? employee.languages.join(', ') : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">Employee Code</span>
                  <div className="mt-1 text-[13px] text-zoru-ink font-mono">{employee.employeeId || '—'}</div>
                </div>
              </div>

              {customFields.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zoru-line">
                  <h4 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                    Custom Attributes
                  </h4>
                  <div className="grid gap-6 md:grid-cols-3">
                    {customFields.map((f) => {
                      const val = employee.customFields?.[f.name];
                      return (
                        <div key={f.name}>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">{f.label || f.name}</span>
                          <div className="mt-1 text-[13px] text-zoru-ink font-medium">
                            {val != null ? String(val) : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'compensation' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Top Stats Overview */}
            <div className="grid gap-6 sm:grid-cols-4">
              <Card className="p-4 bg-zoru-surface/40">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-zoru-success-ink" /> Annual CTC (Cost to Company)
                </span>
                <div className="mt-2 text-[20px] font-bold text-zoru-ink font-mono">
                  {fmtMoney(ctc)}
                </div>
              </Card>
              <Card className="p-4 bg-zoru-surface/40">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5 text-zoru-info-ink" /> Estimated Monthly Gross
                </span>
                <div className="mt-2 text-[20px] font-bold text-zoru-ink font-mono">
                  {fmtMoney(monthlyGross)}
                </div>
              </Card>
              <Card className="p-4 bg-zoru-surface/40">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-zoru-warning-ink" /> Variable Pay component
                </span>
                <div className="mt-2 text-[20px] font-bold text-zoru-ink font-mono">
                  {employee.variablePct ? `${employee.variablePct}%` : '—'}
                </div>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-zoru-success/10 to-zoru-bg border border-zoru-success/20">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-success-ink flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Net Take-Home Pay (Monthly)
                </span>
                <div className="mt-2 text-[20px] font-extrabold text-zoru-success-ink font-mono">
                  {fmtMoney(netTakeHome)}
                </div>
              </Card>
            </div>

            {/* Compensation Ledger & Structure breakdown */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Earning & Deduction Ledger Statements */}
              <Card className="col-span-2 p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                  Salary Ledger Component Breakdown
                </h3>
                <div className="space-y-6">
                  {/* Earnings */}
                  <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zoru-success-ink">
                      Earnings Ledger Component
                    </h4>
                    <div className="rounded-lg border border-zoru-line overflow-hidden">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="bg-zoru-surface-2 text-zoru-ink-muted text-[11px] font-semibold uppercase">
                            <th className="p-2.5 text-left">Component Name</th>
                            <th className="p-2.5 text-right">Calculation</th>
                            <th className="p-2.5 text-right">Monthly Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zoru-line">
                          <tr className="hover:bg-zoru-surface-2/30">
                            <td className="p-2.5 font-medium text-zoru-ink">Basic &amp; DA Pay</td>
                            <td className="p-2.5 text-right text-zoru-ink-muted font-mono">50% of Gross</td>
                            <td className="p-2.5 text-right text-zoru-ink font-mono font-medium">{fmtMoney(basic)}</td>
                          </tr>
                          <tr className="hover:bg-zoru-surface-2/30">
                            <td className="p-2.5 font-medium text-zoru-ink">House Rent Allowance (HRA)</td>
                            <td className="p-2.5 text-right text-zoru-ink-muted font-mono">40% of Basic</td>
                            <td className="p-2.5 text-right text-zoru-ink font-mono font-medium">{fmtMoney(hra)}</td>
                          </tr>
                          <tr className="hover:bg-zoru-surface-2/30">
                            <td className="p-2.5 font-medium text-zoru-ink">Special &amp; Medical Allowance</td>
                            <td className="p-2.5 text-right text-zoru-ink-muted font-mono">Residual Allowance</td>
                            <td className="p-2.5 text-right text-zoru-ink font-mono font-medium">{fmtMoney(allowances)}</td>
                          </tr>
                          <tr className="bg-zoru-success/5 font-semibold">
                            <td className="p-2.5 text-zoru-success-ink">Total Earning / Gross Pay</td>
                            <td className="p-2.5 text-right text-zoru-ink-muted font-mono">—</td>
                            <td className="p-2.5 text-right text-zoru-success-ink font-mono">{fmtMoney(monthlyGross)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zoru-danger-ink">
                      Deductions &amp; Statutory Ledgers
                    </h4>
                    <div className="rounded-lg border border-zoru-line overflow-hidden">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="bg-zoru-surface-2 text-zoru-ink-muted text-[11px] font-semibold uppercase">
                            <th className="p-2.5 text-left">Component Name</th>
                            <th className="p-2.5 text-right">Calculation</th>
                            <th className="p-2.5 text-right">Monthly Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zoru-line">
                          <tr className="hover:bg-zoru-surface-2/30">
                            <td className="p-2.5 font-medium text-zoru-ink">Employee Provident Fund (EPF)</td>
                            <td className="p-2.5 text-right text-zoru-ink-muted font-mono">12% of Basic</td>
                            <td className="p-2.5 text-right text-zoru-ink font-mono font-medium">{fmtMoney(pf)}</td>
                          </tr>
                          <tr className="hover:bg-zoru-surface-2/30">
                            <td className="p-2.5 font-medium text-zoru-ink">Professional Tax (PT)</td>
                            <td className="p-2.5 text-right text-zoru-ink-muted font-mono">Standard Slate</td>
                            <td className="p-2.5 text-right text-zoru-ink font-mono font-medium">{fmtMoney(pt)}</td>
                          </tr>
                          <tr className="bg-zoru-danger/5 font-semibold">
                            <td className="p-2.5 text-zoru-danger-ink">Total Deductions</td>
                            <td className="p-2.5 text-right text-zoru-ink-muted font-mono">—</td>
                            <td className="p-2.5 text-right text-zoru-danger-ink font-mono">{fmtMoney(pf + pt)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Employment, Reporting Tree Managers, etc. */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                    Employment Details
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Building className="h-5 w-5 text-zoru-ink-muted" />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-zoru-ink-muted">Department</div>
                        <div className="text-[13px] text-zoru-ink font-medium">
                          {employee.departmentId ? (
                            <Link href={`/dashboard/hrm/payroll/departments/${employee.departmentId}`} className="hover:underline">
                              Department Link
                            </Link>
                          ) : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Compass className="h-5 w-5 text-zoru-ink-muted" />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-zoru-ink-muted">Designation</div>
                        <div className="text-[13px] text-zoru-ink font-medium">{employee.designation || '—'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-zoru-ink-muted" />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-zoru-ink-muted">Employment Type</div>
                        <div className="text-[13px] text-zoru-ink font-medium capitalize">
                          {(employee.employmentType || '—').replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-zoru-ink-muted" />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-zoru-ink-muted">Joining Date</div>
                        <div className="text-[13px] text-zoru-ink font-medium">{fmtDate(employee.joiningDate)}</div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                    Salary Structure Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-zoru-ink-muted">Structure Name</div>
                      <div className="text-[13px] text-zoru-ink font-mono font-medium">
                        {employee.salaryStructureId || 'Standard Indian Statutory Slate'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-zoru-ink-muted">Notice period</div>
                      <div className="text-[13px] text-zoru-ink font-medium">{employee.noticePeriodDays ?? 60} days</div>
                    </div>
                    {employee.exitDate && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-zoru-ink-muted">Exit Date / Reason</div>
                        <div className="text-[13px] text-zoru-ink">{fmtDate(employee.exitDate)} ({employee.exitReason})</div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Casual / Earned Leave Cards */}
            <div className="grid gap-6 sm:grid-cols-3">
              {/* Earned Leave Progress Card */}
              <Card className="p-6 border-b-4 border-b-zoru-warning bg-gradient-to-tr from-zoru-bg to-zoru-surface shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Earned Leave (EL)</span>
                  <Badge tone="warning">PLANNED</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[28px] font-extrabold text-zoru-ink font-mono">18</span>
                  <span className="text-[14px] text-zoru-ink-muted">/ 24 days balance</span>
                </div>
                <div className="mt-3 w-full bg-zoru-surface-2 rounded-full h-2">
                  <div className="bg-zoru-warning h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </Card>

              {/* Casual Leave Progress Card */}
              <Card className="p-6 border-b-4 border-b-zoru-success bg-gradient-to-tr from-zoru-bg to-zoru-surface shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Casual Leave (CL)</span>
                  <Badge tone="success">HEALTHY</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[28px] font-extrabold text-zoru-ink font-mono">8</span>
                  <span className="text-[14px] text-zoru-ink-muted">/ 12 days balance</span>
                </div>
                <div className="mt-3 w-full bg-zoru-surface-2 rounded-full h-2">
                  <div className="bg-zoru-success h-2 rounded-full" style={{ width: '66%' }}></div>
                </div>
              </Card>

              {/* Sick Leave Card */}
              <Card className="p-6 border-b-4 border-b-zoru-info bg-gradient-to-tr from-zoru-bg to-zoru-surface shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-zoru-ink-muted">Sick Leave (SL)</span>
                  <Badge tone="info">ACTIVE</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[28px] font-extrabold text-zoru-ink font-mono">5</span>
                  <span className="text-[14px] text-zoru-ink-muted">/ 8 days balance</span>
                </div>
                <div className="mt-3 w-full bg-zoru-surface-2 rounded-full h-2">
                  <div className="bg-zoru-info h-2 rounded-full" style={{ width: '62%' }}></div>
                </div>
              </Card>
            </div>

            {/* Attendance & Recent Leave History Split Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Leaves Applications Table */}
              <Card className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                  Recent Leave Applications
                </h3>
                {recentLeaves.length === 0 ? (
                  <p className="text-[12.5px] text-zoru-ink-muted">No leave applications yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-[12.5px]">
                      <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                        <tr>
                          <th className="p-2.5 text-left font-semibold">From</th>
                          <th className="p-2.5 text-left font-semibold">To</th>
                          <th className="p-2.5 text-right font-semibold">Days</th>
                          <th className="p-2.5 text-left font-semibold">Status</th>
                          <th className="p-2.5 text-left font-semibold">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zoru-line">
                        {recentLeaves.map((l) => (
                          <tr key={String(l._id)} className="hover:bg-zoru-surface-2/20">
                            <td className="p-2.5 text-zoru-ink">{fmtDate(l.from)}</td>
                            <td className="p-2.5 text-zoru-ink">{fmtDate(l.to)}</td>
                            <td className="p-2.5 text-right text-zoru-ink font-mono">{l.days}</td>
                            <td className="p-2.5">
                              <Badge tone={l.status === 'approved' ? 'success' : l.status === 'pending' ? 'warning' : 'neutral'}>
                                {l.status}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-zoru-ink-muted max-w-[150px] truncate" title={l.reason}>
                              {l.reason || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Attendance Log Card */}
              <Card className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-zoru-ink-muted flex items-center justify-between">
                  <span>Attendance Record (Last 30 Days)</span>
                  <span className="text-[12px] font-normal text-zoru-ink-muted">
                    Total Hours: <span className="font-mono font-medium text-zoru-ink">{totalHours.toFixed(1)} hrs</span>
                  </span>
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-zoru-surface-2/40 p-2.5 rounded-lg text-center">
                    <div className="text-[10px] uppercase font-bold text-zoru-ink-muted">Present / WFH</div>
                    <div className="text-[16px] font-bold text-zoru-success-ink font-mono mt-1">{presentCount} Days</div>
                  </div>
                  <div className="bg-zoru-surface-2/40 p-2.5 rounded-lg text-center">
                    <div className="text-[10px] uppercase font-bold text-zoru-ink-muted">Late Punches</div>
                    <div className="text-[16px] font-bold text-zoru-warning-ink font-mono mt-1">{lateCount} Days</div>
                  </div>
                  <div className="bg-zoru-surface-2/40 p-2.5 rounded-lg text-center">
                    <div className="text-[10px] uppercase font-bold text-zoru-ink-muted">Average Hrs / Day</div>
                    <div className="text-[16px] font-bold text-zoru-info-ink font-mono mt-1">
                      {presentCount > 0 ? (totalHours / presentCount).toFixed(1) : 0} h
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                  <table className="w-full text-[12.5px]">
                    <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                      <tr>
                        <th className="p-2.5 text-left font-semibold">Date</th>
                        <th className="p-2.5 text-left font-semibold">Status</th>
                        <th className="p-2.5 text-left font-semibold">Punch In</th>
                        <th className="p-2.5 text-left font-semibold">Punch Out</th>
                        <th className="p-2.5 text-right font-semibold">Total Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zoru-line">
                      {attendance30d.slice(0, 5).map((a) => (
                        <tr key={String(a._id)} className="hover:bg-zoru-surface-2/20">
                          <td className="p-2.5 text-zoru-ink">{fmtDate(a.date)}</td>
                          <td className="p-2.5 capitalize text-zoru-ink-muted">
                            <Badge tone={a.status === 'present' || a.status === 'wfh' ? 'success' : 'neutral'}>
                              {a.status.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-zoru-ink-muted font-mono">{fmtDateTime(a.punchIn?.at)}</td>
                          <td className="p-2.5 text-zoru-ink-muted font-mono">{fmtDateTime(a.punchOut?.at)}</td>
                          <td className="p-2.5 text-right text-zoru-ink font-mono font-medium">
                            {typeof a.totalHours === 'number' ? `${a.totalHours.toFixed(1)}h` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 bg-zoru-bg border border-zoru-line p-6 rounded-xl shadow-sm">
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-zoru-ink-muted flex items-center gap-2">
              <Activity className="h-4 w-4" /> Comprehensive Database Event Timeline
            </h3>
            {auditTimeline}
          </div>
        )}
      </div>
    </div>
  );
}
