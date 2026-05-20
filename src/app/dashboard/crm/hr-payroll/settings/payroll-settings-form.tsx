'use client';

import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSwitch,
    useZoruToast,
} from '@/components/zoruui';
import { useActionState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';

import { savePayrollSettings, type PayrollSettings } from '@/app/actions/crm-payroll-settings.actions';

const PAY_FREQUENCIES = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'biweekly', label: 'Bi-weekly' },
    { value: 'weekly', label: 'Weekly' },
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'];

const TAX_REGIMES = [
    { value: 'new', label: 'New regime (FY 2024+)' },
    { value: 'old', label: 'Old regime' },
];

const PAYSLIP_TEMPLATES = [
    { value: 'standard', label: 'Standard' },
    { value: 'detailed', label: 'Detailed (itemised)' },
    { value: 'compact', label: 'Compact' },
];

function SectionHeader({
    title,
    description,
}: {
    title: string;
    description?: string;
}) {
    return (
        <div className="mb-5 border-b border-zoru-line pb-3">
            <h2 className="text-[15px] font-medium text-zoru-ink">{title}</h2>
            {description ? (
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{description}</p>
            ) : null}
        </div>
    );
}

function Field({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <ZoruLabel className="text-[13px] text-zoru-ink">{label}</ZoruLabel>
            {description ? (
                <p className="text-[11.5px] text-zoru-ink-muted">{description}</p>
            ) : null}
            <div className="mt-0.5">{children}</div>
        </div>
    );
}

function SwitchRow({
    label,
    name,
    defaultChecked,
    description,
}: {
    label: string;
    name: string;
    defaultChecked: boolean;
    description?: string;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <p className="text-[13px] text-zoru-ink">{label}</p>
                {description ? (
                    <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">{description}</p>
                ) : null}
            </div>
            <ZoruSwitch name={name} defaultChecked={defaultChecked} value="true" />
        </div>
    );
}

type SaveState = { message?: string; error?: string } | undefined;

export function PayrollSettingsForm({
    settings,
}: {
    settings: PayrollSettings;
}): React.JSX.Element {
    const { toast } = useZoruToast();
    const [state, formAction, isPending] = useActionState<SaveState, FormData>(
        async (prev, formData) => {
            const result = await savePayrollSettings(prev, formData);
            if (result.message) {
                toast({ title: 'Saved', description: result.message });
            } else if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
            return result;
        },
        undefined,
    );

    return (
        <form action={formAction} className="flex flex-col gap-4">
            {/* Pay cycle */}
            <ZoruCard className="p-6">
                <SectionHeader
                    title="Pay cycle"
                    description="How frequently payroll is processed and in which currency."
                />
                <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Pay frequency">
                        <ZoruSelect name="payFrequency" defaultValue={settings.payFrequency}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {PAY_FREQUENCIES.map((f) => (
                                    <ZoruSelectItem key={f.value} value={f.value}>
                                        {f.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                    <Field label="Currency">
                        <ZoruSelect name="currency" defaultValue={settings.currency}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {CURRENCIES.map((c) => (
                                    <ZoruSelectItem key={c} value={c}>
                                        {c}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                    <Field label="Working days per week">
                        <ZoruInput
                            name="workingDaysPerWeek"
                            type="number"
                            min={1}
                            max={7}
                            defaultValue={settings.workingDaysPerWeek}
                        />
                    </Field>
                </div>
            </ZoruCard>

            {/* Tax configuration */}
            <ZoruCard className="p-6">
                <SectionHeader
                    title="Tax configuration"
                    description="Income tax regime and statutory deduction settings for India."
                />
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tax regime">
                        <ZoruSelect name="taxRegime" defaultValue={settings.taxRegime}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {TAX_REGIMES.map((r) => (
                                    <ZoruSelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                    <SwitchRow
                        label="Enable TDS"
                        name="tdsEnabled"
                        defaultChecked={settings.tdsEnabled}
                        description="Deduct income tax at source on salary payments."
                    />
                    <SwitchRow
                        label="Enable professional tax (PT)"
                        name="ptEnabled"
                        defaultChecked={settings.ptEnabled}
                        description="State-level professional tax on salary income."
                    />
                </div>
            </ZoruCard>

            {/* Statutory deductions — PF */}
            <ZoruCard className="p-6">
                <SectionHeader
                    title="Provident Fund (PF)"
                    description="Employee and employer contribution rates and wage ceiling."
                />
                <div className="mb-4">
                    <SwitchRow
                        label="Enable PF"
                        name="pfEnabled"
                        defaultChecked={settings.pfEnabled}
                    />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Employee rate (%)">
                        <ZoruInput
                            name="pfEmployeeRate"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            defaultValue={settings.pfEmployeeRate}
                        />
                    </Field>
                    <Field label="Employer rate (%)">
                        <ZoruInput
                            name="pfEmployerRate"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            defaultValue={settings.pfEmployerRate}
                        />
                    </Field>
                    <Field
                        label="Wage ceiling"
                        description="PF contribution is capped at this basic wage."
                    >
                        <ZoruInput
                            name="pfWageCeiling"
                            type="number"
                            min={0}
                            defaultValue={settings.pfWageCeiling}
                        />
                    </Field>
                </div>
            </ZoruCard>

            {/* ESI */}
            <ZoruCard className="p-6">
                <SectionHeader
                    title="Employee State Insurance (ESI)"
                    description="Contribution rates and eligibility wage ceiling."
                />
                <div className="mb-4">
                    <SwitchRow
                        label="Enable ESI"
                        name="esiEnabled"
                        defaultChecked={settings.esiEnabled}
                    />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Employee rate (%)">
                        <ZoruInput
                            name="esiEmployeeRate"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            defaultValue={settings.esiEmployeeRate}
                        />
                    </Field>
                    <Field label="Employer rate (%)">
                        <ZoruInput
                            name="esiEmployerRate"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            defaultValue={settings.esiEmployerRate}
                        />
                    </Field>
                    <Field
                        label="Wage ceiling"
                        description="Employees earning above this are excluded from ESI."
                    >
                        <ZoruInput
                            name="esiWageCeiling"
                            type="number"
                            min={0}
                            defaultValue={settings.esiWageCeiling}
                        />
                    </Field>
                </div>
            </ZoruCard>

            {/* Attendance & late marking */}
            <ZoruCard className="p-6">
                <SectionHeader
                    title="Attendance & overtime"
                    description="How attendance exceptions and overtime are handled during pay processing."
                />
                <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <Field
                        label="Late-marking grace (minutes)"
                        description="Arrivals within this window are not marked late."
                    >
                        <ZoruInput
                            name="lateMarkingGraceMins"
                            type="number"
                            min={0}
                            defaultValue={settings.lateMarkingGraceMins}
                        />
                    </Field>
                </div>
                <SwitchRow
                    label="Enable overtime"
                    name="overtimeEnabled"
                    defaultChecked={settings.overtimeEnabled}
                    description="Hours beyond the working-day cap are eligible for overtime pay."
                />
            </ZoruCard>

            {/* Approvals & notifications */}
            <ZoruCard className="p-6">
                <SectionHeader
                    title="Approvals & notifications"
                    description="Payroll run approval workflow and payslip notification settings."
                />
                <div className="flex flex-col gap-4">
                    <SwitchRow
                        label="Require approval before processing"
                        name="approvalRequired"
                        defaultChecked={settings.approvalRequired}
                        description="A designated approver must sign off on each payroll run."
                    />
                    {settings.approvalRequired ? (
                        <Field
                            label="Approver user id"
                            description="Leave blank to use the account owner."
                        >
                            <ZoruInput
                                name="approverUserId"
                                defaultValue={settings.approverUserId}
                                placeholder="User id or email"
                            />
                        </Field>
                    ) : (
                        /* Hidden field so approverUserId is still submitted */
                        <input type="hidden" name="approverUserId" value={settings.approverUserId} />
                    )}
                    <SwitchRow
                        label="Notify employees when payslip is ready"
                        name="notifyOnPayslip"
                        defaultChecked={settings.notifyOnPayslip}
                        description="Sends an email/in-app notification when payslips are published."
                    />
                </div>
            </ZoruCard>

            {/* Payslip template */}
            <ZoruCard className="p-6">
                <SectionHeader
                    title="Payslip template"
                    description="Layout used when generating PDF payslips."
                />
                <div className="max-w-xs">
                    <ZoruSelect name="payslipTemplate" defaultValue={settings.payslipTemplate}>
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {PAYSLIP_TEMPLATES.map((t) => (
                                <ZoruSelectItem key={t.value} value={t.value}>
                                    {t.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>
            </ZoruCard>

            {/* Save bar */}
            <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-surface-2 px-4 py-3">
                {state?.error ? (
                    <p className="text-[12.5px] text-zoru-danger-ink">{state.error}</p>
                ) : state?.message ? (
                    <p className="text-[12.5px] text-zoru-success-ink">{state.message}</p>
                ) : (
                    <span />
                )}
                <ZoruButton type="submit" disabled={isPending}>
                    {isPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    ) : (
                        <Save className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    Save settings
                </ZoruButton>
            </div>
        </form>
    );
}
