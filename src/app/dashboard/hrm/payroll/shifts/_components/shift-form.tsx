'use client';

import {
  Button,
  Input,
  Label,
  Checkbox,
} from '@/components/zoruui';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ClayCard } from '@/components/clay';

// TODO 1E.sweep: shift-type dropdowns -> <EnumFormField enumName="shiftType">; department/employees -> <EntityFormField>/<EntityMultiFormField>. See plan §1E.

import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveEmployeeShift } from '@/app/actions/worksuite/shifts.actions';
import type { WsEmployeeShift, WsWeekDay, WsDayOff } from '@/lib/worksuite/shifts-types';

const WEEKDAYS: WsWeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function ShiftForm({ initial }: { initial?: WsEmployeeShift }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<WsEmployeeShift>(
    initial ?? {
      userId: '',
      name: '',
      color_code: '#EAB308',
      clock_in_time: '09:00',
      clock_out_time: '18:00',
      total_hours: 8,
      late_mark_after: 15,
      early_clock_in: 30,
      office_open_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      office_start_time: '09:00',
      office_end_time: '18:00',
      office_hours: 8,
      days_off_type: 'week-off',
      break_time_hours: 1,
      half_day_after: 4,
      half_day_start: '',
      half_day_end: '',
    },
  );

  const set = <K extends keyof WsEmployeeShift>(key: K, value: WsEmployeeShift[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: WsWeekDay, on: boolean) => {
    setForm((prev) => ({
      ...prev,
      office_open_days: on
        ? Array.from(new Set([...(prev.office_open_days ?? []), day]))
        : (prev.office_open_days ?? []).filter((d) => d !== day),
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveEmployeeShift(form);
      if (!res.success) {
        setError(res.error ?? 'Failed to save shift');
        return;
      }
      router.push('/dashboard/hrm/payroll/shifts');
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ClayCard>
        <h2 className="mb-4 text-[16px] font-semibold text-foreground">Shift Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Shift Name" required>
            <ZoruInput
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="Morning Shift"
            />
          </Field>
          <Field label="Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color_code}
                onChange={(e) => set('color_code', e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-card p-1"
              />
              <ZoruInput
                value={form.color_code}
                onChange={(e) => set('color_code', e.target.value)}
                placeholder="#EAB308"
              />
            </div>
          </Field>
          <Field label="Clock In Time">
            <ZoruInput
              type="time"
              value={form.clock_in_time ?? ''}
              onChange={(e) => set('clock_in_time', e.target.value)}
            />
          </Field>
          <Field label="Clock Out Time">
            <ZoruInput
              type="time"
              value={form.clock_out_time ?? ''}
              onChange={(e) => set('clock_out_time', e.target.value)}
            />
          </Field>
          <Field label="Office Start Time">
            <ZoruInput
              type="time"
              value={form.office_start_time}
              onChange={(e) => set('office_start_time', e.target.value)}
            />
          </Field>
          <Field label="Office End Time">
            <ZoruInput
              type="time"
              value={form.office_end_time}
              onChange={(e) => set('office_end_time', e.target.value)}
            />
          </Field>
          <Field label="Total Hours">
            <ZoruInput
              type="number"
              step="0.25"
              value={form.total_hours ?? 0}
              onChange={(e) => set('total_hours', Number(e.target.value))}
            />
          </Field>
          <Field label="Office Hours">
            <ZoruInput
              type="number"
              step="0.25"
              value={form.office_hours ?? 0}
              onChange={(e) => set('office_hours', Number(e.target.value))}
            />
          </Field>
          <Field label="Late Mark After (minutes)">
            <ZoruInput
              type="number"
              min={0}
              value={form.late_mark_after}
              onChange={(e) => set('late_mark_after', Number(e.target.value))}
            />
          </Field>
          <Field label="Early Clock-In Allowed (minutes)">
            <ZoruInput
              type="number"
              min={0}
              value={form.early_clock_in}
              onChange={(e) => set('early_clock_in', Number(e.target.value))}
            />
          </Field>
          <Field label="Break Time (hours)">
            <ZoruInput
              type="number"
              step="0.25"
              min={0}
              value={form.break_time_hours ?? 0}
              onChange={(e) => set('break_time_hours', Number(e.target.value))}
            />
          </Field>
          <Field label="Days Off Type">
            <EnumFormField
              enumName="daysOffType"
              name="__days_off_picker"
              initialId={form.days_off_type}
              onChange={(v) => set('days_off_type', (v ?? 'week-off') as WsDayOff)}
            />
          </Field>
        </div>
      </ClayCard>

      <ClayCard>
        <h2 className="mb-4 text-[16px] font-semibold text-foreground">Half-Day Rules</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Half-Day After (hours)">
            <ZoruInput
              type="number"
              step="0.25"
              min={0}
              value={form.half_day_after ?? 0}
              onChange={(e) => set('half_day_after', Number(e.target.value))}
            />
          </Field>
          <Field label="Half-Day Start">
            <ZoruInput
              type="time"
              value={form.half_day_start ?? ''}
              onChange={(e) => set('half_day_start', e.target.value)}
            />
          </Field>
          <Field label="Half-Day End">
            <ZoruInput
              type="time"
              value={form.half_day_end ?? ''}
              onChange={(e) => set('half_day_end', e.target.value)}
            />
          </Field>
        </div>
      </ClayCard>

      <ClayCard>
        <h2 className="mb-4 text-[16px] font-semibold text-foreground">Office Open Days</h2>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => {
            const checked = form.office_open_days?.includes(day) ?? false;
            return (
              <label
                key={day}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground"
              >
                <ZoruCheckbox
                  checked={checked}
                  onCheckedChange={(v) => toggleDay(day, Boolean(v))}
                />
                <span className="capitalize">{day}</span>
              </label>
            );
          })}
        </div>
      </ClayCard>

      {error ? (
        <div className="rounded-lg border border-rose-50 bg-rose-50/50 px-3 py-2 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <ZoruButton
          variant="pill"
          type="button"
          onClick={() => router.push('/dashboard/hrm/payroll/shifts')}
        >
          Cancel
        </ZoruButton>
        <ZoruButton type="submit" disabled={pending}>
          {pending ? 'Saving…' : initial?._id ? 'Save Changes' : 'Create Shift'}
        </ZoruButton>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <ZoruLabel className="text-[12px] text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </ZoruLabel>
      {children}
    </div>
  );
}
