'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
  ZoruAlert,
  ZoruAlertTitle,
  ZoruAlertDescription,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
  ArrowLeft,
  LoaderCircle,
  Save,
  Sparkles,
  Lock,
  Unlock,
  SlidersHorizontal,
  AlertTriangle,
  ChevronRight,
  Info,
} from 'lucide-react';

/**
 * <PayrollRunForm /> — create + edit form for the canonical payroll-run
 * entity (legacy-Mongo backed via `crm-payroll-runs.actions`).
 *
 * Upgraded to include a high-density, interactive simulation grid with a
 * Global Allowance Multiplier slider and a Lock & Approve safety toggle.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { savePayrollRun } from '@/app/actions/crm-payroll-runs.actions';
import { generatePayrollData, getPendingLeavesForPeriod } from '@/app/actions/crm-payroll.actions';
import type { CrmPayrollRunDoc } from '@/app/actions/crm-payroll-runs.actions.types';
import type { CrmPayrollRunStatus } from '@/app/actions/crm-payroll-runs.actions.types';
const BASE = '/dashboard/hrm/payroll/payroll';

const MONTHS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function toDateInput(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

interface PayrollRunFormProps {
  initialData?: CrmPayrollRunDoc | null;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i + 1);

export function PayrollRunForm({ initialData }: PayrollRunFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const isEditing = !!initialData?._id;

  const [state, formAction] = useActionState(savePayrollRun, INITIAL_STATE);

  // Form selections
  const [selectedMonth, setSelectedMonth] = useState(() => Number(initialData?.period_month ?? new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(() => Number(initialData?.period_year ?? currentYear));

  // Simulation state
  const [simulatedRows, setSimulatedRows] = useState<any[]>([]);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isApproved, setIsApproved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Wizard state
  const [wizardStep, setWizardStep] = useState<number>(isEditing ? 3 : 1);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [isCheckingLeaves, startCheckingLeaves] = useTransition();

  const handleNextToStep2 = () => {
    startCheckingLeaves(async () => {
      const res = await getPendingLeavesForPeriod(selectedMonth, selectedYear);
      setPendingLeaves(res.pendingLeaves || []);
      setWizardStep(2);
    });
  };

  const handleNextToStep3 = () => {
    setWizardStep(3);
  };

  // Load simulator data
  useEffect(() => {
    if (!isEditing && wizardStep === 3) {
      startTransition(async () => {
        try {
          const res = await generatePayrollData(selectedMonth, selectedYear);
          if (res.payrollData) {
            setSimulatedRows(res.payrollData);
          } else {
            setSimulatedRows([]);
          }
        } catch (e) {
          console.error('[Simulator] seed fetch failed:', e);
          setSimulatedRows([]);
        }
      });
    }
  }, [selectedMonth, selectedYear, isEditing, wizardStep]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      const id = state.id ?? initialData?._id;
      router.push(id ? `${BASE}/${id}` : BASE);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router, initialData?._id]);

  // Recalculated values for row preview
  const getScaledValues = (row: any) => {
    const earnings = (row.earnings ?? []).map((e: any) => {
      const nameLower = e.name.toLowerCase();
      if (nameLower.includes('hra') || nameLower.includes('allowance')) {
        return { ...e, amount: e.amount * multiplier };
      }
      return e;
    });
    const totalEarnings = earnings.reduce((sum: number, item: any) => sum + item.amount, 0);
    const totalDeductions = (row.deductions ?? []).reduce((sum: number, item: any) => sum + item.amount, 0);
    const netSalary = totalEarnings - totalDeductions;
    return { earnings, totalEarnings, totalDeductions, netSalary };
  };

  return (
    <Card className="p-6">
      <form action={formAction} className="flex flex-col gap-6">
        {isEditing ? (
          <>
            <input type="hidden" name="runId" value={initialData!._id} />
            <ZoruAlert className="bg-zoru-info/10 border-zoru-info/20 text-zoru-info-ink">
              <Info className="h-4 w-4 !text-zoru-info-ink" />
              <ZoruAlertTitle>Payslips are locked</ZoruAlertTitle>
              <ZoruAlertDescription>
                You can only update the run's metadata (status, date, notes). The generated payslips and totals for this run are immutable.
              </ZoruAlertDescription>
            </ZoruAlert>
          </>
        ) : null}

        {/* Hidden inputs to pass state */}
        <input type="hidden" name="multiplier" value={multiplier} />

        {/* Wizard Progress Bar */}
        {!isEditing && (
          <div className="flex items-center gap-2 text-[12px] font-medium text-zoru-ink-muted bg-zoru-surface-2/20 p-3 rounded-lg border border-zoru-line mb-2">
            <span className={`px-2 py-1 rounded-md ${wizardStep === 1 ? 'bg-zoru-surface-2 text-zoru-ink font-semibold' : ''}`}>1. Select Period</span>
            <ChevronRight className="h-4 w-4" />
            <span className={`px-2 py-1 rounded-md ${wizardStep === 2 ? 'bg-zoru-surface-2 text-zoru-ink font-semibold' : ''}`}>2. Resolve Leaves</span>
            <ChevronRight className="h-4 w-4" />
            <span className={`px-2 py-1 rounded-md ${wizardStep === 3 ? 'bg-zoru-surface-2 text-zoru-ink font-semibold' : ''}`}>3. Generate Run</span>
          </div>
        )}

        <div className={(!isEditing && wizardStep !== 1) ? 'hidden' : 'flex flex-col gap-6'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period_month">Period month *</Label>
              <Select
                name="period_month"
                defaultValue={String(selectedMonth)}
                onValueChange={(val) => setSelectedMonth(Number(val))}
                disabled={isEditing}
              >
                <ZoruSelectTrigger id="period_month">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {MONTHS.map((m) => (
                    <ZoruSelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="period_year">Period year *</Label>
              <Select
                name="period_year"
                defaultValue={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(Number(val))}
                disabled={isEditing}
              >
                <ZoruSelectTrigger id="period_year">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {YEARS.map((y) => (
                    <ZoruSelectItem key={y} value={String(y)}>
                      {y}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="run_date">Run date</Label>
              <Input
                id="run_date"
                name="run_date"
                type="date"
                defaultValue={toDateInput(initialData?.run_date)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <EnumFormField
                name="status"
                enumName="payrollRunStatus"
                initialId={initialData?.status ?? 'draft'}
                allowInlineCreate={false}
                placeholder="Status"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Anything notable about this run."
              defaultValue={initialData?.notes ?? ''}
            />
          </div>
        </div>

        {/* Dynamic Simulation Console / Wizard (Creation Path only) */}
        {!isEditing && (
          <div className="flex flex-col gap-6">
            {wizardStep === 1 && (
              <div className="flex justify-end pt-2">
                <Button type="button" onClick={handleNextToStep2} disabled={isCheckingLeaves}>
                  {isCheckingLeaves ? <LoaderCircle className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Next: Check Pending Leaves
                </Button>
              </div>
            )}

            {wizardStep === 2 && (
              <Card className={`border p-6 shadow-sm ${pendingLeaves.length > 0 ? 'border-zoru-warning/50 bg-zoru-warning/5' : 'border-zoru-success/50 bg-zoru-success/5'}`}>
                <div className="flex items-start gap-4">
                  {pendingLeaves.length > 0 ? (
                    <AlertTriangle className="h-6 w-6 text-zoru-warning-ink shrink-0 mt-1" />
                  ) : (
                    <Sparkles className="h-6 w-6 text-zoru-success-ink shrink-0 mt-1" />
                  )}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className={`text-sm font-semibold ${pendingLeaves.length > 0 ? 'text-zoru-warning-ink' : 'text-zoru-success-ink'}`}>
                        {pendingLeaves.length > 0 ? 'Pending Leaves Detected' : 'All clear! No pending leaves.'}
                      </h4>
                      <p className="text-xs text-zoru-ink-muted mt-1">
                        {pendingLeaves.length > 0 
                          ? `There are ${pendingLeaves.length} pending leave requests for the selected period. Processing payroll now might result in inaccurate deductions.`
                          : 'There are no pending leave requests for the selected period. You can safely proceed to simulation.'}
                      </p>
                    </div>
                    {pendingLeaves.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-zoru-line rounded bg-zoru-bg shadow-inner">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zoru-surface-2 text-zoru-ink-muted sticky top-0">
                            <tr>
                              <th className="p-2 font-medium">Employee</th>
                              <th className="p-2 font-medium">Dates</th>
                              <th className="p-2 font-medium">Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zoru-line">
                            {pendingLeaves.map(l => (
                              <tr key={l._id} className="hover:bg-zoru-surface/50">
                                <td className="p-2">{l.employeeName || 'Unknown'}</td>
                                <td className="p-2">{new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}</td>
                                <td className="p-2">{l.leaveType}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>
                        Back
                      </Button>
                      <Button type="button" onClick={handleNextToStep3} className={pendingLeaves.length > 0 ? 'bg-zoru-warning-ink hover:bg-zoru-warning-ink/90 text-white' : ''}>
                        {pendingLeaves.length > 0 ? 'Ignore & Continue' : 'Continue to Simulation'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {wizardStep === 3 && (
              <Card className="border border-zoru-line overflow-hidden p-0 bg-zoru-surface/20">
                {/* Simulation Controller Header */}
                <div className="flex flex-col gap-4 border-b border-zoru-line bg-zoru-surface/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-zoru-success-ink animate-pulse" />
                    <div>
                      <h4 className="text-[14px] font-semibold text-zoru-ink">Interactive Simulator Grid</h4>
                      <p className="text-[11px] text-zoru-ink-muted">Reactively adjust allowancing scales prior to payslip locks</p>
                    </div>
                  </div>

                  {/* Slider Controller */}
                  <div className="flex items-center gap-3 bg-zoru-bg border border-zoru-line px-3 py-1.5 rounded-lg">
                    <SlidersHorizontal className="h-4 w-4 text-zoru-ink-muted" />
                    <span className="text-[12px] font-semibold text-zoru-ink-muted uppercase">Multiplier</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={multiplier}
                      onChange={(e) => setMultiplier(Number(e.target.value))}
                      className="w-32 accent-zoru-ink h-1.5 bg-zoru-surface rounded-lg cursor-pointer"
                    />
                    <span className={`text-[12px] font-mono font-bold px-2 py-0.5 rounded ${
                      multiplier > 1.0 ? 'bg-zoru-success/15 text-zoru-success-ink' : multiplier < 1.0 ? 'bg-zoru-danger/15 text-zoru-danger-ink' : 'bg-zoru-surface-2 text-zoru-ink'
                    }`}>
                      {multiplier.toFixed(1)}x
                    </span>
                  </div>
                </div>

                {/* Simulated spreadsheet list */}
                {isPending ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-zoru-ink-muted">
                    <LoaderCircle className="h-8 w-8 animate-spin text-zoru-info-ink" />
                    <span className="text-[12px]">Computing live salary ledgers...</span>
                  </div>
                ) : simulatedRows.length === 0 ? (
                  <div className="text-center py-10 text-[12.5px] text-zoru-ink-muted">
                    No active employee salary structures available for the selected period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="bg-zoru-surface-2 text-zoru-ink-muted text-[11px] font-semibold uppercase">
                          <th className="p-3 text-left">Employee Name</th>
                          <th className="p-3 text-right">Base CTC Gross</th>
                          <th className="p-3 text-right">Basic Pay (50%)</th>
                          <th className="p-3 text-right">Simulated HRA</th>
                          <th className="p-3 text-right">Simulated Allowances</th>
                          <th className="p-3 text-right">Deductions</th>
                          <th className="p-3 text-right">Net Takehome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zoru-line">
                        {simulatedRows.map((row) => {
                          const { totalEarnings, totalDeductions, netSalary } = getScaledValues(row);
                          const baseGross = row.grossSalary || 0;
                          
                          // Pull raw component amounts
                          const basicAmt = (row.earnings ?? []).find((e: any) => e.name.toLowerCase().includes('basic'))?.amount || (baseGross * 0.5);
                          const hraAmt = ((row.earnings ?? []).find((e: any) => e.name.toLowerCase().includes('hra'))?.amount || (baseGross * 0.2)) * multiplier;
                          const allowanceAmt = ((row.earnings ?? []).find((e: any) => e.name.toLowerCase().includes('allowance'))?.amount || (baseGross * 0.3)) * multiplier;

                          return (
                            <tr key={row.employeeId} className="hover:bg-zoru-surface-2/10">
                              <td className="p-3">
                                <div className="font-medium text-zoru-ink">{row.employeeName}</div>
                                <div className="text-[10px] font-mono text-zoru-ink-muted mt-0.5">{row.employeeId}</div>
                              </td>
                              <td className="p-3 text-right font-mono text-zoru-ink-muted">{inrFormatter.format(baseGross / 12)}</td>
                              <td className="p-3 text-right font-mono text-zoru-ink">{inrFormatter.format(basicAmt)}</td>
                              <td className={`p-3 text-right font-mono font-medium transition-colors duration-300 ${multiplier !== 1.0 ? 'text-zoru-ink bg-zoru-ink/5' : 'text-zoru-ink'}`}>
                                {inrFormatter.format(hraAmt)}
                              </td>
                              <td className={`p-3 text-right font-mono font-medium transition-colors duration-300 ${multiplier !== 1.0 ? 'text-zoru-ink bg-zoru-ink/5' : 'text-zoru-ink'}`}>
                                {inrFormatter.format(allowanceAmt)}
                              </td>
                              <td className="p-3 text-right font-mono text-zoru-danger-ink">{inrFormatter.format(totalDeductions)}</td>
                              <td className="p-3 text-right">
                                <span className="inline-block px-2.5 py-1 rounded bg-zoru-success/10 text-zoru-success-ink font-mono font-bold shadow-sm">
                                  {inrFormatter.format(netSalary)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Safety Switch Box */}
                {simulatedRows.length > 0 && (
                  <div className="border-t border-zoru-line p-4 flex items-center justify-between gap-4 bg-zoru-surface-2/30">
                    <div className="flex items-center gap-2">
                      {isApproved ? (
                        <Lock className="h-4 w-4 text-zoru-success-ink" />
                      ) : (
                        <Unlock className="h-4 w-4 text-zoru-warning-ink" />
                      )}
                      <span className="text-[12.5px] font-medium text-zoru-ink">
                        {isApproved ? 'Parameters locked and ready' : 'Unlock run validation before processing'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isApproved}
                        onChange={(e) => setIsApproved(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zoru-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zoru-ink-muted after:border-zoru-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zoru-ink peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                )}
                
                {/* Back button for Step 3 */}
                <div className="p-4 border-t border-zoru-line flex justify-start bg-zoru-bg">
                  <Button type="button" variant="outline" onClick={() => setWizardStep(2)}>
                    Back
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <Button variant="ghost" asChild>
            <Link href={BASE}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to runs
            </Link>
          </Button>
          
          {(isEditing || wizardStep === 3) && (
            <Button
              type="submit"
              disabled={!isEditing && !isApproved}
              className={`shadow-sm transition-all duration-300 ${
                !isEditing && isApproved
                  ? 'bg-gradient-to-r from-zoru-ink to-zoru-ink hover:from-zoru-ink hover:to-zoru-ink text-white font-semibold ring-2 ring-zoru-line/20'
                  : ''
              }`}
            >
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Save changes' : 'Generate & lock run'}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
