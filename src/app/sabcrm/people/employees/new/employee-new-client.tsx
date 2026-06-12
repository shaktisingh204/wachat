'use client';

/**
 * SabCRM People — New employee form client.
 *
 * The full `CreateEmployeeInput` surface, grouped per spec WI-24:
 * Identity → Contact → Employment → Compensation. Every FK is a REAL
 * kit `EntityPicker` over a gated search action (department,
 * designation, reporting / dotted-line manager, salary structure) —
 * never a free-text ObjectId input.
 *
 * Statutory & bank, documents and skills/history are PATCH-side
 * sections owned by the detail page (the create DTO does not carry
 * them — see the crate docs on `CreateEmployeeInput`).
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import { EntityPicker } from '../../../finance/_components/doc-surface';
import {
  EMPLOYEE_GENDERS,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  PEOPLE_EMPLOYEES_PATH,
  employeeDetailHref,
} from '../employees-config';

import {
  createSabcrmEmployee,
  searchSabcrmDepartments,
  searchSabcrmDesignations,
  searchSabcrmEmployeeSalaryStructures,
  searchSabcrmEmployees,
} from '@/app/actions/sabcrm-people-employees.actions';
import type { SabcrmEmployeeCreateValues } from '@/app/actions/sabcrm-people-employees.actions.types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../../../finance/_components/doc-surface/doc-surface.css';

/* ─── Helpers ─────────────────────────────────────────────────── */

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

interface PickerState {
  id: string | null;
  label: string | null;
}

const EMPTY_PICK: PickerState = { id: null, label: null };

function numOrUndefined(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/* ─── Component ───────────────────────────────────────────────── */

export function EmployeeNewClient(): React.JSX.Element {
  const router = useRouter();

  /* Identity */
  const [salutation, setSalutation] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [dob, setDob] = React.useState('');
  const [gender, setGender] = React.useState<string | null>('');

  /* Contact */
  const [personalEmail, setPersonalEmail] = React.useState('');
  const [personalPhone, setPersonalPhone] = React.useState('');
  const [workEmail, setWorkEmail] = React.useState('');
  const [workPhone, setWorkPhone] = React.useState('');

  /* Employment */
  const [joiningDate, setJoiningDate] = React.useState('');
  const [employmentType, setEmploymentType] = React.useState<string | null>(
    'full_time',
  );
  const [department, setDepartment] = React.useState<PickerState>(EMPTY_PICK);
  const [designation, setDesignation] = React.useState<PickerState>(EMPTY_PICK);
  const [manager, setManager] = React.useState<PickerState>(EMPTY_PICK);
  const [dottedManager, setDottedManager] =
    React.useState<PickerState>(EMPTY_PICK);
  const [noticePeriodDays, setNoticePeriodDays] = React.useState('');
  const [status, setStatus] = React.useState<string | null>('active');

  /* Compensation */
  const [structure, setStructure] = React.useState<PickerState>(EMPTY_PICK);
  const [ctc, setCtc] = React.useState('');
  const [variablePct, setVariablePct] = React.useState('');

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'First name is required.';
    if (!lastName.trim()) next.lastName = 'Last name is required.';
    if (!dob) next.dob = 'Date of birth is required.';
    if (!workEmail.trim()) next.workEmail = 'Work email is required.';
    if (!joiningDate) next.joiningDate = 'Joining date is required.';
    if (!department.id) next.department = 'Pick a department.';
    if (!designation.id) next.designation = 'Pick a designation.';
    if (!structure.id) next.structure = 'Pick a salary structure.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (): void => {
    setFormError(null);
    if (!validate()) return;
    const values: SabcrmEmployeeCreateValues = {
      salutation: salutation || undefined,
      firstName,
      lastName,
      displayName: displayName || undefined,
      dob,
      gender: (gender || '') as SabcrmEmployeeCreateValues['gender'],
      personalEmail: personalEmail || undefined,
      personalPhone: personalPhone || undefined,
      workEmail,
      workPhone: workPhone || undefined,
      joiningDate,
      departmentId: department.id ?? '',
      designationId: designation.id ?? '',
      employmentType: (employmentType ||
        '') as SabcrmEmployeeCreateValues['employmentType'],
      reportingManagerId: manager.id ?? undefined,
      dottedLineManagerId: dottedManager.id ?? undefined,
      status: (status || '') as SabcrmEmployeeCreateValues['status'],
      salaryStructureId: structure.id ?? '',
      ctc: numOrUndefined(ctc),
      variablePct: numOrUndefined(variablePct),
      noticePeriodDays: numOrUndefined(noticePeriodDays),
    };
    startTransition(async () => {
      const res = await createSabcrmEmployee(values);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        `${res.data.displayName ?? `${res.data.firstName} ${res.data.lastName}`} added to the roster.`,
      );
      router.push(employeeDetailHref(res.data._id));
    });
  };

  const searchEmployees = React.useCallback(async (q: string) => {
    const res = await searchSabcrmEmployees(q);
    return res.ok ? res.data : [];
  }, []);

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>New employee</PageTitle>
          <PageDescription>
            Onboard a person onto the roster. Statutory, bank, documents and
            skills are completed afterwards from the employee profile.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" iconLeft={ArrowLeft} asChild>
            <Link href={PEOPLE_EMPLOYEES_PATH}>Back to employees</Link>
          </Button>
        </PageActions>
      </PageHeader>

      {formError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {formError}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4">
        {/* ── 1. Identity ───────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              Who this person is — names, birth date and demographics.
            </CardDescription>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Salutation">
              <Input
                value={salutation}
                onChange={(e) => setSalutation(e.target.value)}
                placeholder="Mr. / Ms. / Dr."
                disabled={pending}
              />
            </Field>
            <Field label="Display name" help="Shown across lists and payslips.">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Defaults to first + last name"
                disabled={pending}
              />
            </Field>
            <Field label="First name" required error={errors.firstName}>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Last name" required error={errors.lastName}>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Date of birth" required error={errors.dob}>
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
                aria-label="Gender"
              />
            </Field>
          </CardBody>
        </Card>

        {/* ── 2. Contact ───────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Work and personal reachability.</CardDescription>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Work email" required error={errors.workEmail}>
              <Input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="jane@acme.example"
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
          </CardBody>
        </Card>

        {/* ── 3. Employment ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>
              Org placement, reporting lines and lifecycle.
            </CardDescription>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Joining date" required error={errors.joiningDate}>
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
                aria-label="Employment type"
              />
            </Field>
            <Field label="Department" required error={errors.department}>
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
                invalid={!!errors.department}
                disabled={pending}
                aria-label="Department"
              />
            </Field>
            <Field label="Designation" required error={errors.designation}>
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
                invalid={!!errors.designation}
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
                aria-label="Status"
              />
            </Field>
          </CardBody>
        </Card>

        {/* ── 4. Compensation ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Compensation</CardTitle>
            <CardDescription>
              Payroll inputs — the structure drives every run&apos;s math.
            </CardDescription>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Salary structure"
              required
              error={errors.structure}
              help="Rich structures created under People → Salary structures."
            >
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
                invalid={!!errors.structure}
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
                placeholder="1200000"
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
          </CardBody>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" asChild>
            <Link href={PEOPLE_EMPLOYEES_PATH}>Cancel</Link>
          </Button>
          <Button
            variant="primary"
            iconLeft={UserPlus}
            loading={pending}
            onClick={submit}
          >
            Add employee
          </Button>
        </div>
      </div>
    </div>
  );
}
