'use client';

/**
 * SabCRM People — Employee detail client
 * (`/sabcrm/people/employees/[id]`, spec WI-24).
 *
 * The flagship tabbed profile: Profile / Employment / Compensation /
 * Documents / Skills & history / Activity. Every stored field of the
 * `hrm_payroll_types::Employee` document renders in a slot — FKs as
 * RESOLVED labels (never ObjectIds), money via `formatDocMoney`, dates
 * via `formatDocDate`, bank account masked.
 *
 * Header: StatusFlow (happy path `['active']`, exceptions pill) +
 * ConvertMenu (Mark on leave / resigned / terminated, Punch in today,
 * View payslips, Delete) + an Edit drawer over the FULL engine
 * `UpdateEmployeeInput` surface with real EntityPickers.
 *
 * Statutory & bank, documents and skills/history render read-only —
 * the engine update DTO does not carry those fragments yet (see the
 * coverage notes in `docs/sabcrm/rnd/people-suite.md` §WI-24).
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlarmClockCheck,
  ArrowLeft,
  CalendarOff,
  FilePenLine,
  ReceiptText,
  Trash2,
  UserCheck,
  UserMinus,
  UserX,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  type BadgeTone,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  ConvertMenu,
  EntityPicker,
  StatusFlow,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
} from '../../../finance/_components/doc-surface';
import {
  EMPLOYEE_FLOW,
  EMPLOYEE_GENDERS,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  PEOPLE_EMPLOYEES_PATH,
  PEOPLE_PAYSLIPS_PATH,
  employmentTypeLabel,
} from '../employees-config';

import {
  deleteSabcrmEmployee,
  searchSabcrmDepartments,
  searchSabcrmDesignations,
  searchSabcrmEmployeeSalaryStructures,
  searchSabcrmEmployees,
  transitionSabcrmEmployeeStatus,
  updateSabcrmEmployee,
} from '@/app/actions/sabcrm-people-employees.actions';
import { punchInSabcrm } from '@/app/actions/sabcrm-people-attendance.actions';
import type {
  SabcrmEmployeeActivity,
  SabcrmEmployeeActivityRef,
  SabcrmEmployeeDetail,
  SabcrmEmployeeUpdateValues,
} from '@/app/actions/sabcrm-people-employees.actions.types';
import type {
  CrmEmployeeAddressBlock,
  CrmEmployeeStatus,
  SabcrmEmployeeDoc,
} from '@/lib/rust-client/sabcrm-people-employees';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../../../finance/_components/doc-surface/doc-surface.css';

/* ─── Display helpers ─────────────────────────────────────────── */

function employeeName(doc: SabcrmEmployeeDoc): string {
  const full = [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim();
  return doc.displayName?.trim() || full || 'Employee';
}

/** `XXXX1234` — mask everything but the last four digits. */
function maskAccount(accountNo: string | undefined): string {
  if (!accountNo) return '—';
  const tail = accountNo.slice(-4);
  return `${'•'.repeat(Math.max(accountNo.length - 4, 2))}${tail}`;
}

function titleCase(raw: string | undefined): string {
  if (!raw) return '—';
  return raw
    .replaceAll('_', ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

const ACTIVITY_TONES: Record<string, BadgeTone> = {
  approved: 'success',
  present: 'success',
  paid: 'success',
  disbursed: 'success',
  issued: 'info',
  wfh: 'info',
  leave: 'info',
  pending: 'warning',
  half_day: 'warning',
  processing: 'warning',
  rejected: 'danger',
  absent: 'danger',
  cancelled: 'neutral',
  holiday: 'neutral',
};

function activityTone(status: string | undefined): BadgeTone {
  return (status && ACTIVITY_TONES[status]) || 'neutral';
}

/** One label/value slot. Values render "—" when absent — never blank. */
function Info({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}): React.JSX.Element {
  const body =
    children ??
    (value === undefined || value === null || value === '' ? '—' : value);
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--st-text-tertiary)]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-[var(--st-text)]">
        {body}
      </dd>
    </div>
  );
}

function InfoGrid({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </dl>
  );
}

function addressText(block: CrmEmployeeAddressBlock | undefined): string {
  if (!block) return '—';
  const parts = [
    block.line1,
    block.line2,
    block.city,
    block.state,
    block.country,
    block.pinCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

/** Read-only SabFiles slot — "On file" badge or a muted "Not on file". */
function FileSlot({
  label,
  fileId,
}: {
  label: string;
  fileId: string | undefined;
}): React.JSX.Element {
  return (
    <Info label={label}>
      {fileId ? (
        <Badge tone="success">On file</Badge>
      ) : (
        <span className="text-[var(--st-text-tertiary)]">Not on file</span>
      )}
    </Info>
  );
}

function FileListSlot({
  label,
  fileIds,
}: {
  label: string;
  fileIds: string[] | undefined;
}): React.JSX.Element {
  const count = fileIds?.length ?? 0;
  return (
    <Info label={label}>
      {count > 0 ? (
        <Badge tone="success">{count === 1 ? '1 file' : `${count} files`}</Badge>
      ) : (
        <span className="text-[var(--st-text-tertiary)]">No files</span>
      )}
    </Info>
  );
}

/* ─── Activity rail card ──────────────────────────────────────── */

function ActivityCard({
  title,
  description,
  rows,
  empty,
}: {
  title: string;
  description: string;
  rows: SabcrmEmployeeActivityRef[];
  empty: string;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--st-text-tertiary)]">{empty}</p>
        ) : (
          <ul className="grid gap-2">
            {rows.map((row) => {
              const body = (
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--st-text)]">
                      {row.label}
                    </span>
                    {row.date ? (
                      <span className="block text-xs text-[var(--st-text-tertiary)]">
                        {formatDocDate(row.date)}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {typeof row.amount === 'number' ? (
                      <span className="text-sm tabular-nums">
                        {formatDocMoney(row.amount, row.currency ?? 'INR')}
                      </span>
                    ) : null}
                    {row.status ? (
                      <Badge tone={activityTone(row.status)} dot>
                        {titleCase(row.status)}
                      </Badge>
                    ) : null}
                  </span>
                </span>
              );
              return (
                <li key={row.id}>
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="block rounded-md px-2 py-1.5 hover:bg-[var(--st-bg-secondary)]"
                    >
                      {body}
                    </Link>
                  ) : (
                    <span className="block px-2 py-1.5">{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ─── Edit drawer ─────────────────────────────────────────────── */

interface PickerState {
  id: string | null;
  label: string | null;
}

const GENDER_OPTIONS: SelectOption[] = [
  { value: '', label: 'Not captured' },
  ...EMPLOYEE_GENDERS.map((g) => ({ value: g.value, label: g.label })),
];

const TYPE_OPTIONS: SelectOption[] = EMPLOYMENT_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

const STATUS_OPTIONS: SelectOption[] = EMPLOYEE_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

function numOrUndefined(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

interface EditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: SabcrmEmployeeDetail;
  onSaved: () => void;
}

function EditDrawer({
  open,
  onOpenChange,
  detail,
  onSaved,
}: EditDrawerProps): React.JSX.Element {
  const { doc, labels } = detail;

  const [salutation, setSalutation] = React.useState(doc.salutation ?? '');
  const [firstName, setFirstName] = React.useState(doc.firstName);
  const [lastName, setLastName] = React.useState(doc.lastName);
  const [displayName, setDisplayName] = React.useState(doc.displayName ?? '');
  const [dob, setDob] = React.useState((doc.dob ?? '').slice(0, 10));
  const [gender, setGender] = React.useState<string | null>(doc.gender ?? '');
  const [personalEmail, setPersonalEmail] = React.useState(
    doc.personalEmail ?? '',
  );
  const [personalPhone, setPersonalPhone] = React.useState(
    doc.personalPhone ?? '',
  );
  const [workEmail, setWorkEmail] = React.useState(doc.workEmail ?? '');
  const [workPhone, setWorkPhone] = React.useState(doc.workPhone ?? '');
  const [joiningDate, setJoiningDate] = React.useState(
    (doc.joiningDate ?? '').slice(0, 10),
  );
  const [employmentType, setEmploymentType] = React.useState<string | null>(
    doc.employmentType ?? 'full_time',
  );
  const [department, setDepartment] = React.useState<PickerState>({
    id: doc.departmentId ?? null,
    label: labels.department,
  });
  const [designation, setDesignation] = React.useState<PickerState>({
    id: doc.designationId ?? null,
    label: labels.designation,
  });
  const [manager, setManager] = React.useState<PickerState>({
    id: doc.reportingManagerId ?? null,
    label: labels.reportingManager,
  });
  const [dottedManager, setDottedManager] = React.useState<PickerState>({
    id: doc.dottedLineManagerId ?? null,
    label: labels.dottedLineManager,
  });
  const [structure, setStructure] = React.useState<PickerState>({
    id: doc.salaryStructureId ?? null,
    label: labels.salaryStructure,
  });
  const [ctc, setCtc] = React.useState(doc.ctc != null ? String(doc.ctc) : '');
  const [variablePct, setVariablePct] = React.useState(
    doc.variablePct != null ? String(doc.variablePct) : '',
  );
  const [noticePeriodDays, setNoticePeriodDays] = React.useState(
    doc.noticePeriodDays != null ? String(doc.noticePeriodDays) : '',
  );
  const [status, setStatus] = React.useState<string | null>(
    doc.status ?? 'active',
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const searchEmployees = React.useCallback(async (q: string) => {
    const res = await searchSabcrmEmployees(q);
    return res.ok ? res.data : [];
  }, []);

  const submit = (): void => {
    setFormError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First and last name are required.');
      return;
    }
    const values: SabcrmEmployeeUpdateValues = {
      salutation: salutation || undefined,
      firstName,
      lastName,
      displayName: displayName || undefined,
      dob: dob || undefined,
      gender: (gender || '') as SabcrmEmployeeUpdateValues['gender'],
      personalEmail: personalEmail || undefined,
      personalPhone: personalPhone || undefined,
      workEmail: workEmail || undefined,
      workPhone: workPhone || undefined,
      joiningDate: joiningDate || undefined,
      departmentId: department.id ?? undefined,
      designationId: designation.id ?? undefined,
      employmentType: (employmentType ||
        '') as SabcrmEmployeeUpdateValues['employmentType'],
      reportingManagerId: manager.id ?? undefined,
      dottedLineManagerId: dottedManager.id ?? undefined,
      salaryStructureId: structure.id ?? undefined,
      ctc: numOrUndefined(ctc),
      variablePct: numOrUndefined(variablePct),
      noticePeriodDays: numOrUndefined(noticePeriodDays),
      status: (status || '') as SabcrmEmployeeUpdateValues['status'],
    };
    startTransition(async () => {
      const res = await updateSabcrmEmployee(doc._id, values);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success('Employee profile updated.');
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} side="right">
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>Edit {employeeName(doc)}</DrawerTitle>
        </DrawerHeader>
        <div className="grid gap-4 overflow-y-auto px-5 pb-6">
          {formError ? (
            <Alert tone="danger" role="alert">
              {formError}
            </Alert>
          ) : null}

          <section aria-label="Identity" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Salutation">
              <Input
                value={salutation}
                onChange={(e) => setSalutation(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Display name">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="First name" required>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Last name" required>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Date of birth">
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Gender">
              <SelectField
                value={gender}
                onChange={setGender}
                options={GENDER_OPTIONS}
                disabled={pending}
                aria-label="Gender"
              />
            </Field>
          </section>

          <section aria-label="Contact" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Work email">
              <Input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Work phone">
              <Input
                value={workPhone}
                onChange={(e) => setWorkPhone(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Personal email">
              <Input
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Personal phone">
              <Input
                value={personalPhone}
                onChange={(e) => setPersonalPhone(e.target.value)}
                disabled={pending}
              />
            </Field>
          </section>

          <section aria-label="Employment" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Joining date">
              <Input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Employment type">
              <SelectField
                value={employmentType}
                onChange={setEmploymentType}
                options={TYPE_OPTIONS}
                disabled={pending}
                aria-label="Employment type"
              />
            </Field>
            <Field label="Department">
              <EntityPicker
                value={department.id}
                valueLabel={department.label}
                onChange={(opt) =>
                  setDepartment({ id: opt?.id ?? null, label: opt?.label ?? null })
                }
                search={async (q) => {
                  const res = await searchSabcrmDepartments(q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search departments…"
                disabled={pending}
                aria-label="Department"
              />
            </Field>
            <Field label="Designation">
              <EntityPicker
                value={designation.id}
                valueLabel={designation.label}
                onChange={(opt) =>
                  setDesignation({
                    id: opt?.id ?? null,
                    label: opt?.label ?? null,
                  })
                }
                search={async (q) => {
                  const res = await searchSabcrmDesignations(q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search designations…"
                disabled={pending}
                aria-label="Designation"
              />
            </Field>
            <Field label="Reporting manager">
              <EntityPicker
                value={manager.id}
                valueLabel={manager.label}
                onChange={(opt) =>
                  setManager({ id: opt?.id ?? null, label: opt?.label ?? null })
                }
                search={searchEmployees}
                placeholder="Search employees…"
                disabled={pending}
                aria-label="Reporting manager"
              />
            </Field>
            <Field label="Dotted-line manager">
              <EntityPicker
                value={dottedManager.id}
                valueLabel={dottedManager.label}
                onChange={(opt) =>
                  setDottedManager({
                    id: opt?.id ?? null,
                    label: opt?.label ?? null,
                  })
                }
                search={searchEmployees}
                placeholder="Search employees…"
                disabled={pending}
                aria-label="Dotted-line manager"
              />
            </Field>
            <Field label="Notice period (days)">
              <Input
                type="number"
                min={0}
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Status">
              <SelectField
                value={status}
                onChange={setStatus}
                options={STATUS_OPTIONS}
                disabled={pending}
                aria-label="Status"
              />
            </Field>
          </section>

          <section aria-label="Compensation" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Salary structure">
              <EntityPicker
                value={structure.id}
                valueLabel={structure.label}
                onChange={(opt) =>
                  setStructure({ id: opt?.id ?? null, label: opt?.label ?? null })
                }
                search={async (q) => {
                  const res = await searchSabcrmEmployeeSalaryStructures(q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search salary structures…"
                disabled={pending}
                aria-label="Salary structure"
              />
            </Field>
            <Field label="Annual CTC (INR)">
              <Input
                type="number"
                min={0}
                value={ctc}
                onChange={(e) => setCtc(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Variable pay (% of CTC)">
              <Input
                type="number"
                min={0}
                max={100}
                value={variablePct}
                onChange={(e) => setVariablePct(e.target.value)}
                disabled={pending}
              />
            </Field>
          </section>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={submit}>
              Save changes
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── Component ───────────────────────────────────────────────── */

export interface EmployeeDetailClientProps {
  detail: SabcrmEmployeeDetail | null;
  activity: SabcrmEmployeeActivity | null;
  error: string | null;
}

export function EmployeeDetailClient({
  detail,
  activity,
  error,
}: EmployeeDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, startTransition] = React.useTransition();

  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 pb-12 pt-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Employee</PageTitle>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="ghost" iconLeft={ArrowLeft} asChild>
              <Link href={PEOPLE_EMPLOYEES_PATH}>Back to employees</Link>
            </Button>
          </PageActions>
        </PageHeader>
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load the employee: {error ?? 'Unknown error.'}
          </Alert>
        </div>
      </div>
    );
  }

  const { doc, labels } = detail;
  const status = doc.status ?? 'active';

  const transition = (next: CrmEmployeeStatus): void => {
    startTransition(async () => {
      const res = await transitionSabcrmEmployeeStatus(doc._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${employeeName(doc)} marked ${titleCase(next).toLowerCase()}.`,
      );
      router.refresh();
    });
  };

  const punchInToday = (): void => {
    startTransition(async () => {
      const res = await punchInSabcrm({ employeeId: doc._id, source: 'web' });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Punched in ${employeeName(doc)} for today.`);
    });
  };

  const removeEmployee = (): void => {
    startTransition(async () => {
      const res = await deleteSabcrmEmployee(doc._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Employee deleted.');
      router.push(PEOPLE_EMPLOYEES_PATH);
    });
  };

  const menuItems: ConvertMenuItem[] = [
    {
      key: 'active',
      label: 'Mark active',
      icon: UserCheck,
      disabled: status === 'active',
      onSelect: () => transition('active'),
    },
    {
      key: 'on_leave',
      label: 'Mark on leave',
      icon: CalendarOff,
      disabled: status === 'on_leave',
      onSelect: () => transition('on_leave'),
    },
    {
      key: 'resigned',
      label: 'Mark resigned',
      icon: UserMinus,
      danger: true,
      disabled: status === 'resigned',
      onSelect: () => transition('resigned'),
    },
    {
      key: 'terminated',
      label: 'Mark terminated',
      icon: UserX,
      danger: true,
      disabled: status === 'terminated',
      onSelect: () => transition('terminated'),
    },
    {
      key: 'punch-in',
      label: 'Punch in today',
      icon: AlarmClockCheck,
      description: 'Stamps a web punch-in on today',
      group: true,
      onSelect: punchInToday,
    },
    {
      key: 'payslips',
      label: 'View payslips',
      icon: ReceiptText,
      onSelect: () => router.push(PEOPLE_PAYSLIPS_PATH),
    },
    {
      key: 'delete',
      label: 'Delete employee',
      icon: Trash2,
      danger: true,
      group: true,
      onSelect: () => setConfirmDelete(true),
    },
  ];

  const subtitle = [doc.employeeId, doc.designation, doc.workEmail]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <div className="mb-1">
            <Button variant="ghost" size="sm" iconLeft={ArrowLeft} asChild>
              <Link href={PEOPLE_EMPLOYEES_PATH}>Employees</Link>
            </Button>
          </div>
          <PageTitle>{employeeName(doc)}</PageTitle>
          <PageDescription>{subtitle || 'Employee profile'}</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={FilePenLine}
            onClick={() => setEditOpen(true)}
            disabled={busy}
          >
            Edit
          </Button>
          <ConvertMenu label="Actions" items={menuItems} disabled={busy} />
        </PageActions>
      </PageHeader>

      <div className="mb-6">
        <StatusFlow
          flow={EMPLOYEE_FLOW}
          statuses={EMPLOYEE_STATUSES}
          current={status}
        />
      </div>

      <Tabs defaultValue="profile">
        <TabsList aria-label="Employee sections">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="compensation">Compensation</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="skills">Skills &amp; history</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ── Profile ─────────────────────────────────────────── */}
        <TabsContent value="profile">
          <div className="grid gap-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Identity</CardTitle>
                <CardDescription>
                  Personal details as stored on the employee document.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <InfoGrid>
                  <Info label="Salutation" value={doc.salutation} />
                  <Info label="First name" value={doc.firstName} />
                  <Info label="Middle name" value={doc.middleName} />
                  <Info label="Last name" value={doc.lastName} />
                  <Info label="Display name" value={doc.displayName} />
                  <Info label="Date of birth" value={formatDocDate(doc.dob)} />
                  <Info label="Gender" value={titleCase(doc.gender)} />
                  <Info
                    label="Marital status"
                    value={titleCase(doc.maritalStatus)}
                  />
                  <Info label="Blood group" value={doc.bloodGroup} />
                  <Info label="Nationality" value={doc.nationality} />
                  <Info
                    label="Languages"
                    value={doc.languages?.length ? doc.languages.join(', ') : undefined}
                  />
                  <FileSlot label="Photo" fileId={doc.photoFileId} />
                </InfoGrid>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
                <CardDescription>
                  Work and personal reachability, emergency contact and
                  addresses.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <InfoGrid>
                  <Info label="Work email" value={doc.workEmail} />
                  <Info label="Work phone" value={doc.workPhone} />
                  <Info label="Extension" value={doc.extension} />
                  <Info label="Personal email" value={doc.personalEmail} />
                  <Info label="Personal phone" value={doc.personalPhone} />
                  <Info
                    label="Emergency contact"
                    value={
                      doc.emergencyContact
                        ? `${doc.emergencyContact.name} (${doc.emergencyContact.relation}) · ${doc.emergencyContact.phone}`
                        : undefined
                    }
                  />
                  <Info
                    label="Current address"
                    value={addressText(doc.address?.current)}
                  />
                  <Info
                    label="Permanent address"
                    value={addressText(doc.address?.permanent)}
                  />
                </InfoGrid>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statutory &amp; bank</CardTitle>
                <CardDescription>
                  Identity documents and payout account. Populated by the
                  onboarding document flows.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <InfoGrid>
                  <Info
                    label="Aadhaar (masked)"
                    value={doc.identityDocs?.aadhaarMasked}
                  />
                  <Info label="PAN" value={doc.identityDocs?.pan} />
                  <Info label="Passport no." value={doc.identityDocs?.passportNo} />
                  <Info
                    label="Passport expiry"
                    value={
                      doc.identityDocs?.passportExpiry
                        ? formatDocDate(doc.identityDocs.passportExpiry)
                        : undefined
                    }
                  />
                  <Info
                    label="Driving licence"
                    value={doc.identityDocs?.drivingLicence}
                  />
                  <Info label="Voter ID" value={doc.identityDocs?.voterId} />
                  <Info label="UAN" value={doc.uan} />
                  <Info label="ESIC no." value={doc.esicNo} />
                  <Info
                    label="Bank account"
                    value={doc.bank ? maskAccount(doc.bank.accountNo) : undefined}
                  />
                  <Info label="IFSC" value={doc.bank?.ifsc} />
                  <Info
                    label="Bank"
                    value={
                      doc.bank
                        ? [doc.bank.bankName, doc.bank.branch]
                            .filter(Boolean)
                            .join(' · ')
                        : undefined
                    }
                  />
                  <Info label="Name on account" value={doc.bank?.nameOnAccount} />
                </InfoGrid>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* ── Employment ──────────────────────────────────────── */}
        <TabsContent value="employment">
          <div className="grid gap-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Employment</CardTitle>
                <CardDescription>
                  Org placement, reporting lines and lifecycle.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <InfoGrid>
                  <Info label="Employee ID" value={doc.employeeId} />
                  <Info
                    label="Joining date"
                    value={formatDocDate(doc.joiningDate)}
                  />
                  <Info
                    label="Confirmation date"
                    value={
                      doc.confirmationDate
                        ? formatDocDate(doc.confirmationDate)
                        : undefined
                    }
                  />
                  <Info
                    label="Probation ends"
                    value={
                      doc.probationEnd
                        ? formatDocDate(doc.probationEnd)
                        : undefined
                    }
                  />
                  <Info
                    label="Employment type"
                    value={employmentTypeLabel(doc.employmentType)}
                  />
                  <Info label="Department" value={labels.department} />
                  <Info label="Designation" value={labels.designation} />
                  <Info
                    label="Reporting manager"
                    value={labels.reportingManager}
                  />
                  <Info
                    label="Dotted-line manager"
                    value={labels.dottedLineManager}
                  />
                  <Info label="Work location" value={doc.workLocation} />
                  <Info label="Shift" value={labels.shift} />
                  <Info
                    label="Notice period"
                    value={
                      doc.noticePeriodDays != null
                        ? `${doc.noticePeriodDays} days`
                        : undefined
                    }
                  />
                  <Info label="Status">
                    <Badge
                      tone={
                        EMPLOYEE_STATUSES.find((s) => s.value === status)?.tone ??
                        'neutral'
                      }
                      dot
                    >
                      {EMPLOYEE_STATUSES.find((s) => s.value === status)?.label ??
                        titleCase(status)}
                    </Badge>
                  </Info>
                  {doc.exitDate ? (
                    <Info label="Exit date" value={formatDocDate(doc.exitDate)} />
                  ) : null}
                  {doc.exitReason ? (
                    <Info label="Exit reason" value={doc.exitReason} />
                  ) : null}
                  <Info
                    label="Tags"
                    value={doc.tags?.length ? doc.tags.join(', ') : undefined}
                  />
                </InfoGrid>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* ── Compensation ────────────────────────────────────── */}
        <TabsContent value="compensation">
          <div className="grid gap-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Compensation</CardTitle>
                <CardDescription>
                  The structure drives every payroll run&apos;s math.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <InfoGrid>
                  <Info label="Salary structure">
                    {labels.salaryStructure ? (
                      <Link
                        href="/sabcrm/people/salary-structures"
                        className="text-[var(--st-accent)] hover:underline"
                      >
                        {labels.salaryStructure}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Info>
                  <Info
                    label="Annual CTC"
                    value={
                      doc.ctc != null
                        ? formatDocMoney(doc.ctc, 'INR')
                        : undefined
                    }
                  />
                  <Info
                    label="Variable pay"
                    value={
                      doc.variablePct != null
                        ? `${doc.variablePct}% of CTC`
                        : undefined
                    }
                  />
                </InfoGrid>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* ── Documents ───────────────────────────────────────── */}
        <TabsContent value="documents">
          <div className="grid gap-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Employment documents</CardTitle>
                <CardDescription>
                  Every document lives in SabFiles. Slots fill via the
                  onboarding and profile document flows.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <InfoGrid>
                  <FileSlot label="Offer letter" fileId={doc.offerLetterFileId} />
                  <FileSlot
                    label="Appointment letter"
                    fileId={doc.appointmentFileId}
                  />
                  <FileSlot label="Contract" fileId={doc.contractFileId} />
                  <FileSlot label="NDA" fileId={doc.ndaFileId} />
                  <FileSlot label="Work permit" fileId={doc.workPermitFileId} />
                  <FileListSlot label="KYC files" fileIds={doc.kycFiles} />
                  <FileListSlot
                    label="Education certificates"
                    fileIds={doc.educationCertFiles}
                  />
                  <FileListSlot label="ID proofs" fileIds={doc.idProofFiles} />
                </InfoGrid>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visa</CardTitle>
                <CardDescription>
                  Present only for employees on a work visa.
                </CardDescription>
              </CardHeader>
              <CardBody>
                {doc.visa ? (
                  <InfoGrid>
                    <Info label="Visa number" value={doc.visa.number} />
                    <Info label="Type" value={doc.visa.visaType} />
                    <Info label="Country" value={doc.visa.country} />
                    <Info
                      label="Issued"
                      value={
                        doc.visa.issued ? formatDocDate(doc.visa.issued) : undefined
                      }
                    />
                    <Info
                      label="Valid till"
                      value={
                        doc.visa.validTill
                          ? formatDocDate(doc.visa.validTill)
                          : undefined
                      }
                    />
                  </InfoGrid>
                ) : (
                  <p className="text-sm text-[var(--st-text-tertiary)]">
                    No visa on file.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* ── Skills & history ────────────────────────────────── */}
        <TabsContent value="skills">
          <div className="grid gap-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardBody>
                {doc.skills?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {doc.skills.map((s, i) => (
                      <Badge key={`${s.name}-${i}`} tone="info">
                        {s.name}
                        {s.level ? ` · ${s.level}` : ''}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--st-text-tertiary)]">
                    No skills recorded.
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Certifications</CardTitle>
              </CardHeader>
              <CardBody>
                {doc.certifications?.length ? (
                  <ul className="grid gap-3">
                    {doc.certifications.map((c, i) => (
                      <li key={`${c.name}-${i}`} className="text-sm">
                        <span className="font-medium">{c.name}</span>
                        {c.issuer ? (
                          <span className="text-[var(--st-text-secondary)]">
                            {' '}
                            · {c.issuer}
                          </span>
                        ) : null}
                        <span className="block text-xs text-[var(--st-text-tertiary)]">
                          {[
                            c.issued ? `Issued ${formatDocDate(c.issued)}` : null,
                            c.expiry ? `Expires ${formatDocDate(c.expiry)}` : null,
                            c.fileId ? 'Certificate on file' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'No dates recorded'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--st-text-tertiary)]">
                    No certifications recorded.
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Education</CardTitle>
              </CardHeader>
              <CardBody>
                {doc.education?.length ? (
                  <ul className="grid gap-3">
                    {doc.education.map((e, i) => (
                      <li key={`${e.institution}-${i}`} className="text-sm">
                        <span className="font-medium">
                          {e.degree}
                          {e.fieldOfStudy ? ` — ${e.fieldOfStudy}` : ''}
                        </span>
                        <span className="block text-xs text-[var(--st-text-tertiary)]">
                          {[
                            e.institution,
                            [e.start?.slice(0, 4), e.end?.slice(0, 4)]
                              .filter(Boolean)
                              .join(' to '),
                            e.grade,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--st-text-tertiary)]">
                    No education history recorded.
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Past employment</CardTitle>
              </CardHeader>
              <CardBody>
                {doc.pastEmployment?.length ? (
                  <ul className="grid gap-3">
                    {doc.pastEmployment.map((p, i) => (
                      <li key={`${p.company}-${i}`} className="text-sm">
                        <span className="font-medium">
                          {p.role} · {p.company}
                        </span>
                        <span className="block text-xs text-[var(--st-text-tertiary)]">
                          {[
                            [p.start?.slice(0, 4), p.end?.slice(0, 4)]
                              .filter(Boolean)
                              .join(' to '),
                            p.reasonForLeaving,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'No dates recorded'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--st-text-tertiary)]">
                    No past employment recorded.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* ── Activity ────────────────────────────────────────── */}
        <TabsContent value="activity">
          <div className="grid gap-4 pt-4 lg:grid-cols-3">
            <ActivityCard
              title="Attendance"
              description="Last 30 days."
              rows={activity?.attendance ?? []}
              empty="No attendance in the last 30 days."
            />
            <ActivityCard
              title="Leave applications"
              description="Most recent first."
              rows={activity?.leaves ?? []}
              empty="No leave applications yet."
            />
            <ActivityCard
              title="Payslips"
              description="Generated from payroll runs."
              rows={activity?.payslips ?? []}
              empty="No payslips yet."
            />
          </div>
        </TabsContent>
      </Tabs>

      <EditDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        detail={detail}
        onSaved={() => router.refresh()}
      />

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!busy) setConfirmDelete(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {employeeName(doc)}?</AlertDialogTitle>
            <AlertDialogDescription>
              The employee record is archived and disappears from the roster,
              attendance pickers and payroll runs. This cannot be undone from
              the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={busy}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={busy} onClick={removeEmployee}>
              Delete employee
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
