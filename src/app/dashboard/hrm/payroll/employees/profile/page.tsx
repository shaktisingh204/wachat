'use client';

import { useEffect, useState, useTransition } from 'react';
import { UserCog, LoaderCircle, Save } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  saveEmployeeDetail,
  getEmployeeDetails,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeDetail } from '@/lib/worksuite/hr-ext-types';

type EmployeeLite = { _id: string; name: string };

/** All date fields stored as YYYY-MM-DD strings for HTML <input type="date"> */
type FormState = {
  _id?: string;
  employee_id?: string;
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
  joining_date?: string;
  last_date?: string;
  probation_end_date?: string;
  notice_period_end_date?: string;
  internship_end_date?: string;
  contract_end_date?: string;
  marriage_anniversary_date?: string;
  employment_type?: string;
  notice_period?: number;
  reporting_to?: string;
  overtime_hourly_rate?: number;
  hourly_rate?: number;
  slack_username?: string;
  bank_account_number?: string;
  bank_name?: string;
  tax_regime?: string;
  work_anniversary_notified_str?: string;
};

const EMPTY: FormState = {
  employee_id: '',
  about_me: '',
  marital_status: '',
  gender: '',
  date_of_birth: '',
  blood_group: '',
  religion: '',
  nationality: '',
  languages: '',
  hobbies: '',
  address: '',
  joining_date: '',
  last_date: '',
  probation_end_date: '',
  notice_period_end_date: '',
  internship_end_date: '',
  contract_end_date: '',
  marriage_anniversary_date: '',
  employment_type: '',
  notice_period: undefined,
  reporting_to: '',
  overtime_hourly_rate: undefined,
  hourly_rate: undefined,
  slack_username: '',
  work_anniversary_notified_str: 'false',
  bank_account_number: '',
  bank_name: '',
  tax_regime: '',
};

function toDateInput(v: any): string {
  if (!v) return '';
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function detailToForm(d: WsEmployeeDetail): FormState {
  return {
    _id: String(d._id ?? ''),
    employee_id: d.employee_id ?? '',
    about_me: d.about_me ?? '',
    marital_status: d.marital_status ?? '',
    gender: d.gender ?? '',
    date_of_birth: toDateInput(d.date_of_birth),
    blood_group: d.blood_group ?? '',
    religion: d.religion ?? '',
    nationality: d.nationality ?? '',
    languages: Array.isArray(d.languages) ? d.languages.join(', ') : (d.languages ?? ''),
    hobbies: d.hobbies ?? '',
    address: d.address ?? '',
    joining_date: toDateInput(d.joining_date),
    last_date: toDateInput(d.last_date),
    probation_end_date: toDateInput(d.probation_end_date),
    notice_period_end_date: toDateInput(d.notice_period_end_date),
    internship_end_date: toDateInput(d.internship_end_date),
    contract_end_date: toDateInput(d.contract_end_date),
    marriage_anniversary_date: toDateInput(d.marriage_anniversary_date),
    employment_type: d.employment_type ?? '',
    notice_period: d.notice_period,
    reporting_to: d.reporting_to ?? '',
    overtime_hourly_rate: d.overtime_hourly_rate,
    hourly_rate: d.hourly_rate,
    slack_username: d.slack_username ?? '',
    work_anniversary_notified_str: d.work_anniversary_notified ? 'true' : 'false',
    bank_account_number: d.bank_account_number ?? '',
    bank_name: d.bank_name ?? '',
    tax_regime: d.tax_regime ?? '',
  };
}

export default function EmployeeProfilePage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();

  // Load employee list once
  useEffect(() => {
    startLoading(async () => {
      const es = await getCrmEmployees();
      setEmployees(
        (es as any[]).map((e) => ({
          _id: String(e._id),
          name:
            [e.firstName, e.lastName].filter(Boolean).join(' ').trim() ||
            e.email ||
            'Unnamed',
        })),
      );
    });
  }, []);

  // When employee selection changes, load their detail
  const handleEmpChange = (empId: string) => {
    setSelectedEmpId(empId);
    if (!empId) {
      setForm(EMPTY);
      return;
    }
    startLoading(async () => {
      const details = await getEmployeeDetails();
      const found = (details as WsEmployeeDetail[]).find(
        (d) => String(d.employee_id) === empId || String((d as any).user_id) === empId,
      );
      if (found) {
        setForm(detailToForm(found));
      } else {
        setForm({ ...EMPTY, employee_id: empId });
      }
    });
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      const dateFields = [
        'date_of_birth',
        'joining_date',
        'last_date',
        'probation_end_date',
        'notice_period_end_date',
        'internship_end_date',
        'contract_end_date',
        'marriage_anniversary_date',
      ] as const;
      const textFields = [
        'employee_id',
        'about_me',
        'marital_status',
        'gender',
        'blood_group',
        'religion',
        'nationality',
        'languages',
        'hobbies',
        'address',
        'employment_type',
        'reporting_to',
        'slack_username',
        'bank_account_number',
        'bank_name',
        'tax_regime',
      ] as const;
      for (const k of textFields) {
        if (form[k] !== undefined) fd.append(k, String(form[k] ?? ''));
      }
      for (const k of dateFields) {
        const v = form[k as keyof FormState];
        if (v) fd.append(k, String(v));
      }
      if (form.notice_period !== undefined)
        fd.append('notice_period', String(form.notice_period));
      if (form.overtime_hourly_rate !== undefined)
        fd.append('overtime_hourly_rate', String(form.overtime_hourly_rate));
      if (form.hourly_rate !== undefined)
        fd.append('hourly_rate', String(form.hourly_rate));
      fd.append(
        'work_anniversary_notified',
        form.work_anniversary_notified_str === 'true' ? 'true' : 'false',
      );

      const r = await saveEmployeeDetail(null, fd);
      if (r.message) {
        toast({ title: 'Saved', description: r.message });
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Employee Extended Profile"
        subtitle="View and edit detailed employee profile information."
        icon={UserCog}
      />

      {/* Employee Selector */}
      <ClayCard>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground">Select Employee</Label>
          <Select value={selectedEmpId} onValueChange={handleEmpChange}>
            <SelectTrigger className="h-10 w-full max-w-sm rounded-lg border-border bg-card text-[13px]">
              <SelectValue placeholder="Choose an employee…" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ClayCard>

      {isLoading && (
        <div className="flex items-center justify-center py-10 text-[13px] text-muted-foreground">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}

      {!isLoading && selectedEmpId && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Section 1 — Personal Info */}
          <ClayCard>
            <h2 className="mb-4 text-[15px] font-semibold text-foreground">Personal Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="About Me" fullWidth>
                <Textarea
                  rows={3}
                  value={form.about_me ?? ''}
                  onChange={(e) => set('about_me', e.target.value)}
                  className="rounded-lg border-border bg-card text-[13px]"
                />
              </Field>

              <SelectField
                label="Marital Status"
                value={form.marital_status ?? ''}
                onChange={(v) => set('marital_status', v as any)}
                options={[
                  { value: 'single', label: 'Single' },
                  { value: 'married', label: 'Married' },
                  { value: 'divorced', label: 'Divorced' },
                  { value: 'widowed', label: 'Widowed' },
                ]}
              />

              <SelectField
                label="Gender"
                value={form.gender ?? ''}
                onChange={(v) => set('gender', v as any)}
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'others', label: 'Others' },
                ]}
              />

              <DateField
                label="Date of Birth"
                value={form.date_of_birth as string ?? ''}
                onChange={(v) => set('date_of_birth', v)}
              />

              <SelectField
                label="Blood Group"
                value={form.blood_group ?? ''}
                onChange={(v) => set('blood_group', v)}
                options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => ({
                  value: g,
                  label: g,
                }))}
              />

              <TextField
                label="Religion"
                value={form.religion ?? ''}
                onChange={(v) => set('religion', v)}
              />

              <TextField
                label="Nationality"
                value={form.nationality ?? ''}
                onChange={(v) => set('nationality', v)}
              />

              <TextField
                label="Languages (comma-separated)"
                value={form.languages ?? ''}
                onChange={(v) => set('languages', v)}
              />

              <Field label="Hobbies" fullWidth>
                <Textarea
                  rows={2}
                  value={form.hobbies ?? ''}
                  onChange={(e) => set('hobbies', e.target.value)}
                  className="rounded-lg border-border bg-card text-[13px]"
                />
              </Field>

              <Field label="Address" fullWidth>
                <Textarea
                  rows={2}
                  value={form.address ?? ''}
                  onChange={(e) => set('address', e.target.value)}
                  className="rounded-lg border-border bg-card text-[13px]"
                />
              </Field>

              <DateField
                label="Marriage Anniversary Date"
                value={form.marriage_anniversary_date as string ?? ''}
                onChange={(v) => set('marriage_anniversary_date', v)}
              />
            </div>
          </ClayCard>

          {/* Section 2 — Employment */}
          <ClayCard>
            <h2 className="mb-4 text-[15px] font-semibold text-foreground">Employment</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Employment Type"
                value={form.employment_type ?? ''}
                onChange={(v) => set('employment_type', v as any)}
                options={[
                  { value: 'full-time', label: 'Full-time' },
                  { value: 'part-time', label: 'Part-time' },
                  { value: 'contract', label: 'Contract' },
                  { value: 'internship', label: 'Internship' },
                  { value: 'trainee', label: 'Trainee' },
                ]}
              />

              <DateField
                label="Joining Date"
                value={form.joining_date as string ?? ''}
                onChange={(v) => set('joining_date', v)}
              />

              <DateField
                label="Last Date"
                value={form.last_date as string ?? ''}
                onChange={(v) => set('last_date', v)}
              />

              <DateField
                label="Probation End Date"
                value={form.probation_end_date as string ?? ''}
                onChange={(v) => set('probation_end_date', v)}
              />

              <Field label="Notice Period (days)">
                <Input
                  type="number"
                  min="0"
                  value={form.notice_period ?? ''}
                  onChange={(e) => set('notice_period', e.target.value ? Number(e.target.value) : undefined)}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </Field>

              <DateField
                label="Notice Period End Date"
                value={form.notice_period_end_date as string ?? ''}
                onChange={(v) => set('notice_period_end_date', v)}
              />

              <DateField
                label="Internship End Date"
                value={form.internship_end_date as string ?? ''}
                onChange={(v) => set('internship_end_date', v)}
              />

              <DateField
                label="Contract End Date"
                value={form.contract_end_date as string ?? ''}
                onChange={(v) => set('contract_end_date', v)}
              />

              <Field label="Reporting To">
                <Select
                  value={form.reporting_to ?? '__none__'}
                  onValueChange={(v) => set('reporting_to', v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-border bg-card text-[13px]">
                    <SelectValue placeholder="Select manager…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {employees
                      .filter((e) => e._id !== selectedEmpId)
                      .map((e) => (
                        <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Overtime Hourly Rate">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.overtime_hourly_rate ?? ''}
                  onChange={(e) =>
                    set('overtime_hourly_rate', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </Field>

              <Field label="Hourly Rate">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hourly_rate ?? ''}
                  onChange={(e) =>
                    set('hourly_rate', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </Field>

              <TextField
                label="Slack Username"
                value={form.slack_username ?? ''}
                onChange={(v) => set('slack_username', v)}
              />

              <SelectField
                label="Work Anniversary Notified"
                value={form.work_anniversary_notified_str ?? 'false'}
                onChange={(v) => set('work_anniversary_notified_str', v)}
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
              />
            </div>
          </ClayCard>

          {/* Section 3 — Banking & Tax */}
          <ClayCard>
            <h2 className="mb-4 text-[15px] font-semibold text-foreground">Banking &amp; Tax</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Bank Account Number"
                value={form.bank_account_number ?? ''}
                onChange={(v) => set('bank_account_number', v)}
              />

              <TextField
                label="Bank Name"
                value={form.bank_name ?? ''}
                onChange={(v) => set('bank_name', v)}
              />

              <SelectField
                label="Tax Regime"
                value={form.tax_regime ?? ''}
                onChange={(v) => set('tax_regime', v)}
                options={[
                  { value: 'old', label: 'Old' },
                  { value: 'new', label: 'New' },
                ]}
              />
            </div>
          </ClayCard>

          <div className="flex justify-end">
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isSaving}
              leading={
                isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              Save Profile
            </ClayButton>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Small helper components ─────────────────────────────────────── */

function Field({
  label,
  fullWidth,
  children,
}: {
  label: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <Label className="text-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  fullWidth,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <Field label={label} fullWidth={fullWidth}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border-border bg-card text-[13px]"
      />
    </Field>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border-border bg-card text-[13px]"
      />
    </Field>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  fullWidth,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  fullWidth?: boolean;
}) {
  return (
    <Field label={label} fullWidth={fullWidth}>
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger className="h-10 w-full rounded-lg border-border bg-card text-[13px]">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— None —</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
