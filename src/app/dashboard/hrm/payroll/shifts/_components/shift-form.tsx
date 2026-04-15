'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ClayCard, ClayButton } from '@/components/clay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
        <h2 className="mb-4 text-[16px] font-semibold text-clay-ink">Shift Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Shift Name" required>
            <Input
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
                className="h-9 w-12 cursor-pointer rounded-clay-sm border border-clay-border bg-clay-surface p-1"
              />
              <Input
                value={form.color_code}
                onChange={(e) => set('color_code', e.target.value)}
                placeholder="#EAB308"
              />
            </div>
          </Field>
          <Field label="Clock In Time">
            <Input
              type="time"
              value={form.clock_in_time ?? ''}
              onChange={(e) => set('clock_in_time', e.target.value)}
            />
          </Field>
          <Field label="Clock Out Time">
            <Input
              type="time"
              value={form.clock_out_time ?? ''}
              onChange={(e) => set('clock_out_time', e.target.value)}
            />
          </Field>
          <Field label="Office Start Time">
            <Input
              type="time"
              value={form.office_start_time}
              onChange={(e) => set('office_start_time', e.target.value)}
            />
          </Field>
          <Field label="Office End Time">
            <Input
              type="time"
              value={form.office_end_time}
              onChange={(e) => set('office_end_time', e.target.value)}
            />
          </Field>
          <Field label="Total Hours">
            <Input
              type="number"
              step="0.25"
              value={form.total_hours ?? 0}
              onChange={(e) => set('total_hours', Number(e.target.value))}
            />
          </Field>
          <Field label="Office Hours">
            <Input
              type="number"
              step="0.25"
              value={form.office_hours ?? 0}
              onChange={(e) => set('office_hours', Number(e.target.value))}
            />
          </Field>
          <Field label="Late Mark After (minutes)">
            <Input
              type="number"
              min={0}
              value={form.late_mark_after}
              onChange={(e) => set('late_mark_after', Number(e.target.value))}
            />
          </Field>
          <Field label="Early Clock-In Allowed (minutes)">
            <Input
              type="number"
              min={0}
              value={form.early_clock_in}
              onChange={(e) => set('early_clock_in', Number(e.target.value))}
            />
          </Field>
          <Field label="Break Time (hours)">
            <Input
              type="number"
              step="0.25"
              min={0}
              value={form.break_time_hours ?? 0}
              onChange={(e) => set('break_time_hours', Number(e.target.value))}
            />
          </Field>
          <Field label="Days Off Type">
            <Select
              value={form.days_off_type}
              onValueChange={(v) => set('days_off_type', v as WsDayOff)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week-off">Week Off</SelectItem>
                <SelectItem value="consecutive">Consecutive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </ClayCard>

      <ClayCard>
        <h2 className="mb-4 text-[16px] font-semibold text-clay-ink">Half-Day Rules</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Half-Day After (hours)">
            <Input
              type="number"
              step="0.25"
              min={0}
              value={form.half_day_after ?? 0}
              onChange={(e) => set('half_day_after', Number(e.target.value))}
            />
          </Field>
          <Field label="Half-Day Start">
            <Input
              type="time"
              value={form.half_day_start ?? ''}
              onChange={(e) => set('half_day_start', e.target.value)}
            />
          </Field>
          <Field label="Half-Day End">
            <Input
              type="time"
              value={form.half_day_end ?? ''}
              onChange={(e) => set('half_day_end', e.target.value)}
            />
          </Field>
        </div>
      </ClayCard>

      <ClayCard>
        <h2 className="mb-4 text-[16px] font-semibold text-clay-ink">Office Open Days</h2>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => {
            const checked = form.office_open_days?.includes(day) ?? false;
            return (
              <label
                key={day}
                className="flex items-center gap-2 rounded-clay-md border border-clay-border bg-clay-surface px-3 py-2 text-[13px] text-clay-ink"
              >
                <Checkbox
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
        <div className="rounded-clay-md border border-clay-red-soft bg-clay-red-soft/50 px-3 py-2 text-[13px] text-clay-red">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <ClayButton
          variant="pill"
          type="button"
          onClick={() => router.push('/dashboard/hrm/payroll/shifts')}
        >
          Cancel
        </ClayButton>
        <ClayButton variant="obsidian" type="submit" disabled={pending}>
          {pending ? 'Saving…' : initial?._id ? 'Save Changes' : 'Create Shift'}
        </ClayButton>
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
      <Label className="text-[12px] text-clay-ink-muted">
        {label}
        {required ? <span className="ml-0.5 text-clay-red">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
