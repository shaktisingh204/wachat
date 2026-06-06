'use client';

import { useMemo } from 'react';
import { Label, Select, Input, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

export function EmployeeSelectField({
  value,
  onChange,
  disabled,
  employees
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
  employees: EmployeeLite[];
}) {
  const employeeOptions = useMemo(() => {
    return employees.map((e) => (
      <SelectItem key={e._id} value={e._id}>
        {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
      </SelectItem>
    ));
  }, [employees]);

  return (
    <div className="md:col-span-2">
      <Label className="text-[12px] text-[var(--st-text-secondary)]">
        Employee <span className="text-[var(--st-danger)]">*</span>
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
          <SelectValue placeholder="Select employee" />
        </SelectTrigger>
        <SelectContent>
          {employeeOptions}
        </SelectContent>
      </Select>
    </div>
  );
}

export function WeekStartField({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <Label className="text-[12px] text-[var(--st-text-secondary)]">
        Week Start <span className="text-[var(--st-danger)]">*</span>
      </Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
      />
    </div>
  );
}

export function WeekEndField({ value }: { value: string }) {
  return (
    <div>
      <Label className="text-[12px] text-[var(--st-text-secondary)]">
        Week End (auto)
      </Label>
      <Input
        type="date"
        value={value}
        readOnly
        className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px] opacity-60"
      />
    </div>
  );
}
