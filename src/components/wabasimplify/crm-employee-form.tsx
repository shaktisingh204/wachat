'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruDatePicker,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
    LoaderCircle,
  Save,
  User as UserIcon,
  Briefcase,
  HeartPulse,
  Building2,
  Banknote,
  Sparkles,
  ArrowLeft,
  } from 'lucide-react';

import { saveCrmEmployee } from '@/app/actions/index.ts';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type {
    WithId,
  CrmEmployee,
  CrmDepartment,
  CrmDesignation,
  } from '@/lib/definitions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

/**
 * Employee form (used by `/dashboard/hrm/payroll/employees/new` and
 * `…/[employeeId]/edit`).
 *
 * Rebuilt with the ZoruUI design system into discrete `ZoruCard`
 * sections — Personal, Job, Extended Personal, Employment, Banking &
 * Tax, Custom Fields — replacing the previous single big accordion.
 *
 * **Server-action contract preserved verbatim.** Every FormData key
 * the upstream `saveCrmEmployee` server action reads is emitted here
 * with the exact same name. See the comment block above each section
 * for the live list of keys it owns. The list was confirmed against
 * `src/app/actions/crm-employees.actions.ts` on 2026-05-13.
 *
 * Cascading pickers:
 *  - department → designation (designation filter is `{ department_id }`)
 *  - country → state → city (work location, three `location` lookups
 *    that share filter state)
 *
 * The form is intentionally driven by `useActionState` + a server
 * action — no client-side fetch waterfalls, no `useEffect` data
 * preload. `EntityFormField` pickers fetch on focus, which is
 * dramatically cheaper than the previous full prefetch.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import {
    CustomFieldInput,
    type CustomFieldValue,
} from '@/components/crm/custom-field-input';

/* ───────────────────────── types & helpers ───────────────────────── */

const initialState: { message?: string; error?: string } = {
    message: undefined,
    error: undefined,
};

const NONE = '__none__';

interface ExtendedDetail {
    about_me?: string;
    marital_status?: string;
    gender?: string;
    date_of_birth?: string;
    blood_group?: string;
    religion?: string;
    nationality?: string;
    languages?: string;
    hobbies?: string;
    address?: string;
    marriage_anniversary_date?: string;
    employment_type?: string;
    probation_end_date?: string;
    last_date?: string;
    notice_period_end_date?: string;
    internship_end_date?: string;
    contract_end_date?: string;
    notice_period?: number;
    reporting_to?: string;
    overtime_hourly_rate?: number;
    hourly_rate?: number;
    slack_username?: string;
    bank_account_id?: string;
    bank_account_number?: string;
    bank_name?: string;
    tax_regime?: string;
    work_anniversary_notified?: boolean;
}

interface EmployeeFormProps {
    employee?: WithId<CrmEmployee> | null;
    /** @deprecated kept for backwards-compatible call sites — unused. */
    departments?: WithId<CrmDepartment>[];
    /** @deprecated kept for backwards-compatible call sites — unused. */
    designations?: WithId<CrmDesignation>[];
    detail?: ExtendedDetail | null;
    /** Where to send the user after a successful save. */
    redirectAfterSave?: string;
}

function toDate(v: unknown): Date | undefined {
    if (!v) return undefined;
    try {
        const d = new Date(v as string);
        return Number.isFinite(d.getTime()) ? d : undefined;
    } catch {
        return undefined;
    }
}

/* ───────────────────────── shared bits ───────────────────────── */

const labelCls = 'text-[12.5px] text-zoru-ink-muted';
const inputCls = 'h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]';
const triggerCls = 'h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]';

function Req() {
    return <span className="ml-0.5 text-zoru-danger-ink">*</span>;
}

function SectionCard({
    title,
    description,
    icon: Icon,
    children,
}: {
    title: string;
    description?: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    children: React.ReactNode;
}) {
    return (
        <ZoruCard className="overflow-hidden p-0">
            <div className="flex items-center gap-3 border-b border-zoru-line bg-zoru-surface px-5 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zoru-line bg-zoru-bg">
                    <Icon className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[13.5px] font-medium text-zoru-ink">
                        {title}
                    </span>
                    {description ? (
                        <span className="text-[12px] text-zoru-ink-muted">{description}</span>
                    ) : null}
                </div>
            </div>
            <div className="p-5 sm:p-6">{children}</div>
        </ZoruCard>
    );
}

function Field({
    label,
    htmlFor,
    required,
    span,
    children,
}: {
    label: string;
    htmlFor?: string;
    required?: boolean;
    span?: 1 | 2 | 3;
    children: React.ReactNode;
}) {
    const spanCls =
        span === 2
            ? 'md:col-span-2'
            : span === 3
                ? 'md:col-span-3'
                : '';
    return (
        <div className={`space-y-1.5 ${spanCls}`}>
            <ZoruLabel htmlFor={htmlFor} className={labelCls}>
                {label}
                {required ? <Req /> : null}
            </ZoruLabel>
            {children}
        </div>
    );
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending} size="lg">
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
                <Save className="h-4 w-4" strokeWidth={1.75} />
            )}
            {isEditing ? 'Save Changes' : 'Add Employee'}
        </ZoruButton>
    );
}

/* ───────────────────────── component ───────────────────────── */

export function EmployeeForm({
    employee,
    detail,
    redirectAfterSave,
}: EmployeeFormProps) {
    const [state, formAction] = useActionState(saveCrmEmployee, initialState);
    const { toast } = useZoruToast();
    const router = useRouter();
    const isEditing = !!employee;

    /* Core dates — `dateOfJoining` is required, `dateOfBirth` on the
     * core doc is optional. Detail-table date_of_birth is separately
     * captured below; both are kept to preserve every existing field. */
    const [dateOfJoining, setDateOfJoining] = useState<Date | undefined>(
        () => toDate(employee?.dateOfJoining) ?? new Date(),
    );
    const [coreDateOfBirth, setCoreDateOfBirth] = useState<Date | undefined>(
        () => toDate((employee as any)?.dateOfBirth),
    );
    const [detailDateOfBirth, setDetailDateOfBirth] = useState<Date | undefined>(
        () => toDate(detail?.date_of_birth),
    );
    const [marriageAnniversary, setMarriageAnniversary] = useState<Date | undefined>(
        () => toDate(detail?.marriage_anniversary_date),
    );
    const [probationEnd, setProbationEnd] = useState<Date | undefined>(
        () => toDate(detail?.probation_end_date),
    );
    const [lastDate, setLastDate] = useState<Date | undefined>(
        () => toDate(detail?.last_date),
    );
    const [noticePeriodEnd, setNoticePeriodEnd] = useState<Date | undefined>(
        () => toDate(detail?.notice_period_end_date),
    );
    const [internshipEnd, setInternshipEnd] = useState<Date | undefined>(
        () => toDate(detail?.internship_end_date),
    );
    const [contractEnd, setContractEnd] = useState<Date | undefined>(
        () => toDate(detail?.contract_end_date),
    );

    /* Entity refs (cascading). All are surfaced to the server action via
     * the corresponding FormData keys, which `EntityFormField` writes
     * via its own hidden input. */
    const [departmentId, setDepartmentId] = useState<string>(
        employee?.departmentId?.toString() ?? '',
    );
    const [designationId, setDesignationId] = useState<string>(
        employee?.designationId?.toString() ?? '',
    );
    const [workCountry, setWorkCountry] = useState<string>(
        employee?.workCountry ?? '',
    );
    const [workState, setWorkState] = useState<string>(
        employee?.workState ?? '',
    );
    const [workCity, setWorkCity] = useState<string>(employee?.workCity ?? '');

    // The designation lookup needs to be re-mounted when the department
    // changes so its `filter` prop is honoured by the picker (it caches
    // results keyed by the stringified filter). We also clear the
    // selection if the user changes department after picking. Key the
    // pickers by their filter source.
    const designationFilter = useMemo<Record<string, unknown> | undefined>(
        () => (departmentId ? { department_id: departmentId } : undefined),
        [departmentId],
    );
    const stateFilter = useMemo<Record<string, unknown> | undefined>(
        () => (workCountry ? { country: workCountry } : undefined),
        [workCountry],
    );
    const cityFilter = useMemo<Record<string, unknown> | undefined>(
        () => (workState ? { state: workState } : undefined),
        [workState],
    );

    /* Custom fields — JSON-encoded into a hidden `customFields` input
     * so the server action can call `applyCustomFieldsToEntity`. */
    const [customFields, setCustomFields] = useState<WsCustomField[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<
        Record<string, CustomFieldValue>
    >(() => {
        const seed = (employee as
            | (WithId<CrmEmployee> & { customFields?: Record<string, CustomFieldValue> })
            | null
            | undefined)?.customFields;
        return seed ?? {};
    });
    const customFieldsLoadedRef = useRef(false);

    useEffect(() => {
        if (customFieldsLoadedRef.current) return;
        customFieldsLoadedRef.current = true;
        let cancelled = false;
        (async () => {
            try {
                const defs = await getCustomFieldsFor('employee');
                if (!cancelled) setCustomFields((defs as WsCustomField[]) ?? []);
            } catch {
                if (!cancelled) setCustomFields([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleCustomFieldChange = useCallback(
        (slug: string, next: CustomFieldValue) => {
            setCustomFieldValues((prev) => ({ ...prev, [slug]: next }));
        },
        [],
    );

    const handleFormAction = useCallback(
        (formData: FormData) => {
            formData.set('customFields', JSON.stringify(customFieldValues));
            formAction(formData);
        },
        [formAction, customFieldValues],
    );

    /* Toast + redirect on action settle. */
    const handledRef = useRef(false);
    useEffect(() => {
        if (handledRef.current) return;
        if (state.message) {
            handledRef.current = true;
            toast({ title: 'Saved', description: state.message });
            const target = redirectAfterSave ?? '/dashboard/hrm/payroll/employees';
            router.push(target);
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, redirectAfterSave]);

    return (
        <form action={handleFormAction} className="flex flex-col gap-5 pb-28">
            {/* Hidden fields the action reads. Keys are load-bearing —
               do NOT rename without updating `saveCrmEmployee`. */}
            {isEditing && (
                <input
                    type="hidden"
                    name="employeeId"
                    value={employee!._id.toString()}
                />
            )}
            <input
                type="hidden"
                name="dateOfJoining"
                value={dateOfJoining?.toISOString() ?? ''}
            />
            {coreDateOfBirth && (
                <input
                    type="hidden"
                    name="dateOfBirth"
                    value={coreDateOfBirth.toISOString()}
                />
            )}
            {detailDateOfBirth && (
                <input
                    type="hidden"
                    name="date_of_birth"
                    value={detailDateOfBirth.toISOString()}
                />
            )}
            {marriageAnniversary && (
                <input
                    type="hidden"
                    name="marriage_anniversary_date"
                    value={marriageAnniversary.toISOString()}
                />
            )}
            {probationEnd && (
                <input
                    type="hidden"
                    name="probation_end_date"
                    value={probationEnd.toISOString()}
                />
            )}
            {lastDate && (
                <input
                    type="hidden"
                    name="last_date"
                    value={lastDate.toISOString()}
                />
            )}
            {noticePeriodEnd && (
                <input
                    type="hidden"
                    name="notice_period_end_date"
                    value={noticePeriodEnd.toISOString()}
                />
            )}
            {internshipEnd && (
                <input
                    type="hidden"
                    name="internship_end_date"
                    value={internshipEnd.toISOString()}
                />
            )}
            {contractEnd && (
                <input
                    type="hidden"
                    name="contract_end_date"
                    value={contractEnd.toISOString()}
                />
            )}

            {/* ─── Personal Information ─── */}
            <SectionCard
                title="Personal Information"
                description="Basic identity and contact details."
                icon={UserIcon}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First Name" htmlFor="firstName" required>
                        <ZoruInput
                            id="firstName"
                            name="firstName"
                            defaultValue={employee?.firstName}
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Last Name" htmlFor="lastName" required>
                        <ZoruInput
                            id="lastName"
                            name="lastName"
                            defaultValue={employee?.lastName}
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Work Email" htmlFor="email" required>
                        <ZoruInput
                            id="email"
                            name="email"
                            type="email"
                            defaultValue={employee?.email}
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Phone" htmlFor="phone">
                        <ZoruInput
                            id="phone"
                            name="phone"
                            type="tel"
                            defaultValue={employee?.phone}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Date of Birth">
                        <ZoruDatePicker
                            value={coreDateOfBirth}
                            onChange={setCoreDateOfBirth}
                            placeholder="Select date of birth"
                        />
                    </Field>
                </div>
            </SectionCard>

            {/* ─── Job Information ─── */}
            <SectionCard
                title="Job Information"
                description="Role, department and work location."
                icon={Briefcase}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Employee ID" htmlFor="employeeIdCode" required>
                        <ZoruInput
                            id="employeeIdCode"
                            name="employeeIdCode"
                            defaultValue={employee?.employeeId}
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Status">
                        <ZoruSelect
                            name="status"
                            defaultValue={employee?.status || 'Active'}
                        >
                            <ZoruSelectTrigger className={triggerCls}>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="Active">Active</ZoruSelectItem>
                                <ZoruSelectItem value="Inactive">Inactive</ZoruSelectItem>
                                <ZoruSelectItem value="Terminated">
                                    Terminated
                                </ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                    <Field label="Department">
                        <EntityFormField
                            entity="department"
                            name="departmentId"
                            initialId={departmentId || undefined}
                            placeholder="Select department…"
                            onChange={(id) => {
                                setDepartmentId(id ?? '');
                                // Department changed → clear designation
                                // so the next picker honours the filter.
                                setDesignationId('');
                            }}
                        />
                    </Field>
                    <Field label="Designation">
                        <EntityFormField
                            // Re-mount on department change so the picker
                            // re-issues the lookup with the new filter.
                            key={`designation-${departmentId || 'all'}`}
                            entity="designation"
                            name="designationId"
                            initialId={designationId || undefined}
                            filter={designationFilter}
                            placeholder={
                                departmentId
                                    ? 'Select designation…'
                                    : 'Pick a department first…'
                            }
                            onChange={(id) => setDesignationId(id ?? '')}
                        />
                    </Field>
                    <Field label="Date of Joining" required>
                        <ZoruDatePicker
                            value={dateOfJoining}
                            onChange={setDateOfJoining}
                            placeholder="Select joining date"
                        />
                    </Field>
                </div>

                <div className="mt-5">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-subtle">
                        Work Location
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Field label="Country">
                            <EntityFormField
                                entity="country"
                                name="workCountry"
                                initialId={workCountry || undefined}
                                placeholder="Country…"
                                onChange={(id) => {
                                    setWorkCountry(id ?? '');
                                    setWorkState('');
                                    setWorkCity('');
                                }}
                            />
                        </Field>
                        <Field label="State / Region">
                            <EntityFormField
                                key={`state-${workCountry || 'all'}`}
                                entity="state"
                                name="workState"
                                initialId={workState || undefined}
                                filter={stateFilter}
                                placeholder={
                                    workCountry ? 'State…' : 'Pick a country first…'
                                }
                                onChange={(id) => {
                                    setWorkState(id ?? '');
                                    setWorkCity('');
                                }}
                            />
                        </Field>
                        <Field label="City">
                            <EntityFormField
                                key={`city-${workState || 'all'}`}
                                entity="city"
                                name="workCity"
                                initialId={workCity || undefined}
                                filter={cityFilter}
                                placeholder={
                                    workState ? 'City…' : 'Pick a state first…'
                                }
                                onChange={(id) => setWorkCity(id ?? '')}
                            />
                        </Field>
                    </div>
                </div>
            </SectionCard>

            {/* ─── Extended Personal Info ─── */}
            <SectionCard
                title="Personal Profile"
                description="Identity, demographics and bio."
                icon={HeartPulse}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="About" span={2}>
                        <ZoruTextarea
                            name="about_me"
                            rows={3}
                            defaultValue={detail?.about_me ?? ''}
                            className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                        />
                    </Field>
                    <Field label="Gender">
                        <ZoruSelect
                            name="gender"
                            defaultValue={detail?.gender || NONE}
                        >
                            <ZoruSelectTrigger className={triggerCls}>
                                <ZoruSelectValue placeholder="Select…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value={NONE}>— None —</ZoruSelectItem>
                                <ZoruSelectItem value="male">Male</ZoruSelectItem>
                                <ZoruSelectItem value="female">Female</ZoruSelectItem>
                                <ZoruSelectItem value="others">Others</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                    <Field label="Marital Status">
                        <ZoruSelect
                            name="marital_status"
                            defaultValue={detail?.marital_status || NONE}
                        >
                            <ZoruSelectTrigger className={triggerCls}>
                                <ZoruSelectValue placeholder="Select…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value={NONE}>— None —</ZoruSelectItem>
                                <ZoruSelectItem value="single">Single</ZoruSelectItem>
                                <ZoruSelectItem value="married">Married</ZoruSelectItem>
                                <ZoruSelectItem value="divorced">Divorced</ZoruSelectItem>
                                <ZoruSelectItem value="widowed">Widowed</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                    <Field label="Date of Birth (Detailed)">
                        <ZoruDatePicker
                            value={detailDateOfBirth}
                            onChange={setDetailDateOfBirth}
                            placeholder="Select date of birth"
                        />
                    </Field>
                    <Field label="Blood Group">
                        <ZoruSelect
                            name="blood_group"
                            defaultValue={detail?.blood_group || NONE}
                        >
                            <ZoruSelectTrigger className={triggerCls}>
                                <ZoruSelectValue placeholder="Select…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value={NONE}>— None —</ZoruSelectItem>
                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(
                                    (g) => (
                                        <ZoruSelectItem key={g} value={g}>
                                            {g}
                                        </ZoruSelectItem>
                                    ),
                                )}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                    <Field label="Nationality" htmlFor="nationality">
                        <ZoruInput
                            id="nationality"
                            name="nationality"
                            defaultValue={detail?.nationality ?? ''}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Religion" htmlFor="religion">
                        <ZoruInput
                            id="religion"
                            name="religion"
                            defaultValue={detail?.religion ?? ''}
                            className={inputCls}
                        />
                    </Field>
                    <Field
                        label="Languages (comma-separated)"
                        htmlFor="languages"
                    >
                        <ZoruInput
                            id="languages"
                            name="languages"
                            defaultValue={detail?.languages ?? ''}
                            placeholder="English, Hindi, …"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Marriage Anniversary">
                        <ZoruDatePicker
                            value={marriageAnniversary}
                            onChange={setMarriageAnniversary}
                            placeholder="Select date"
                        />
                    </Field>
                    <Field label="Hobbies" htmlFor="hobbies" span={2}>
                        <ZoruTextarea
                            id="hobbies"
                            name="hobbies"
                            rows={2}
                            defaultValue={detail?.hobbies ?? ''}
                            className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                        />
                    </Field>
                    <Field label="Address" htmlFor="address" span={2}>
                        <ZoruTextarea
                            id="address"
                            name="address"
                            rows={2}
                            defaultValue={detail?.address ?? ''}
                            className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                        />
                    </Field>
                </div>
            </SectionCard>

            {/* ─── Employment Details ─── */}
            <SectionCard
                title="Employment Details"
                description="Type, probation, notice and reporting."
                icon={Building2}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Employment Type">
                        <ZoruSelect
                            name="employment_type"
                            defaultValue={detail?.employment_type || NONE}
                        >
                            <ZoruSelectTrigger className={triggerCls}>
                                <ZoruSelectValue placeholder="Select…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value={NONE}>— None —</ZoruSelectItem>
                                <ZoruSelectItem value="full-time">Full-time</ZoruSelectItem>
                                <ZoruSelectItem value="part-time">Part-time</ZoruSelectItem>
                                <ZoruSelectItem value="contract">Contract</ZoruSelectItem>
                                <ZoruSelectItem value="internship">
                                    Internship
                                </ZoruSelectItem>
                                <ZoruSelectItem value="trainee">Trainee</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                    <Field label="Reporting To">
                        <EntityFormField
                            entity="employee"
                            name="ext_reporting_to"
                            initialId={detail?.reporting_to || undefined}
                            placeholder="Select manager…"
                            filter={
                                isEditing && employee
                                    ? { _id: { $ne: employee._id } }
                                    : undefined
                            }
                        />
                    </Field>
                    <Field label="Probation End Date">
                        <ZoruDatePicker
                            value={probationEnd}
                            onChange={setProbationEnd}
                            placeholder="Select date"
                        />
                    </Field>
                    <Field label="Last Working Date">
                        <ZoruDatePicker
                            value={lastDate}
                            onChange={setLastDate}
                            placeholder="Select date"
                        />
                    </Field>
                    <Field label="Notice Period (days)" htmlFor="notice_period">
                        <ZoruInput
                            id="notice_period"
                            name="notice_period"
                            type="number"
                            min={0}
                            defaultValue={detail?.notice_period ?? ''}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Notice Period End Date">
                        <ZoruDatePicker
                            value={noticePeriodEnd}
                            onChange={setNoticePeriodEnd}
                            placeholder="Select date"
                        />
                    </Field>
                    <Field label="Internship End Date">
                        <ZoruDatePicker
                            value={internshipEnd}
                            onChange={setInternshipEnd}
                            placeholder="Select date"
                        />
                    </Field>
                    <Field label="Contract End Date">
                        <ZoruDatePicker
                            value={contractEnd}
                            onChange={setContractEnd}
                            placeholder="Select date"
                        />
                    </Field>
                    <Field label="Hourly Rate" htmlFor="hourly_rate">
                        <ZoruInput
                            id="hourly_rate"
                            name="hourly_rate"
                            type="number"
                            min={0}
                            step={0.01}
                            defaultValue={detail?.hourly_rate ?? ''}
                            className={inputCls}
                        />
                    </Field>
                    <Field
                        label="Overtime Hourly Rate"
                        htmlFor="overtime_hourly_rate"
                    >
                        <ZoruInput
                            id="overtime_hourly_rate"
                            name="overtime_hourly_rate"
                            type="number"
                            min={0}
                            step={0.01}
                            defaultValue={detail?.overtime_hourly_rate ?? ''}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Slack Username" htmlFor="slack_username">
                        <ZoruInput
                            id="slack_username"
                            name="slack_username"
                            defaultValue={detail?.slack_username ?? ''}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Work Anniversary Notified">
                        <ZoruSelect
                            name="work_anniversary_notified"
                            defaultValue={
                                detail?.work_anniversary_notified ? 'true' : 'false'
                            }
                        >
                            <ZoruSelectTrigger className={triggerCls}>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="false">No</ZoruSelectItem>
                                <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                </div>
            </SectionCard>

            {/* ─── Banking & Tax ─── */}
            <SectionCard
                title="Banking & Tax"
                description="Payment and statutory details."
                icon={Banknote}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Linked Bank Account" span={2}>
                        <EntityFormField
                            entity="bankAccount"
                            name="ext_bank_account_id"
                            initialId={detail?.bank_account_id || undefined}
                            placeholder="Select bank account…"
                        />
                    </Field>
                    <Field
                        label="Bank Account Number"
                        htmlFor="bank_account_number"
                    >
                        <ZoruInput
                            id="bank_account_number"
                            name="bank_account_number"
                            defaultValue={detail?.bank_account_number ?? ''}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Bank Name" htmlFor="bank_name">
                        <ZoruInput
                            id="bank_name"
                            name="bank_name"
                            defaultValue={detail?.bank_name ?? ''}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Tax Regime">
                        <ZoruSelect
                            name="tax_regime"
                            defaultValue={detail?.tax_regime || NONE}
                        >
                            <ZoruSelectTrigger className={triggerCls}>
                                <ZoruSelectValue placeholder="Select…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value={NONE}>— None —</ZoruSelectItem>
                                <ZoruSelectItem value="old">Old</ZoruSelectItem>
                                <ZoruSelectItem value="new">New</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </Field>
                    <Field label="Gross Salary" htmlFor="grossSalary">
                        <ZoruInput
                            id="grossSalary"
                            name="grossSalary"
                            type="number"
                            min={0}
                            defaultValue={
                                (employee as any)?.salaryDetails?.grossSalary ?? ''
                            }
                            className={inputCls}
                        />
                    </Field>
                </div>
            </SectionCard>

            {/* ─── Custom Fields ─── */}
            {customFields.length > 0 ? (
                <SectionCard
                    title="Custom Fields"
                    description="Tenant-specific attributes."
                    icon={Sparkles}
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        {customFields.map((f) => (
                            <CustomFieldInput
                                key={String(f._id ?? f.name)}
                                field={f}
                                value={customFieldValues[f.name]}
                                onChange={(next) => handleCustomFieldChange(f.name, next)}
                            />
                        ))}
                    </div>
                </SectionCard>
            ) : null}

            {/* ─── Sticky Action Bar ─── */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zoru-line bg-zoru-bg/95 backdrop-blur supports-[backdrop-filter]:bg-zoru-bg/80">
                <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <ZoruButton
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                        Cancel
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </div>
        </form>
    );
}

export default EmployeeForm;
