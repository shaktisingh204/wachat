'use client';

import {
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import type { LeadFormField } from '../types';

export function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: LeadFormField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const labelText = labelize(field.field_name);

  if (field.field_type === 'textarea') {
    return (
      <Field label={labelText} required={field.is_required} id={field._id}>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={4}
          className="font-mono text-[12.5px]"
        />
      </Field>
    );
  }

  if (field.field_type === 'select' && field.field_values?.length) {
    return (
      <Field label={labelText} required={field.is_required} id={field._id}>
        <Select
          value={value}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger
            id={field._id}
            aria-label={labelText}
            className="font-mono text-[12.5px]"
          >
            <SelectValue placeholder="Select option..." />
          </SelectTrigger>
          <SelectContent>
            {field.field_values.map((v) => (
              <SelectItem key={v} value={v} className="font-mono text-[12.5px]">
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  const inputType =
    field.field_type === 'date'
      ? 'date'
      : field.field_type === 'number'
        ? 'number'
        : field.field_name === 'email'
          ? 'email'
          : 'text';

  return (
    <Field label={labelText} required={field.is_required} id={field._id}>
      <Input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="font-mono text-[12.5px]"
      />
    </Field>
  );
}

function labelize(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
