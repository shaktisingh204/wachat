'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, ZoruCardContent, Button, Input, Label, Select } from '@/components/zoruui';
import { LoaderCircle, Send, Terminal } from 'lucide-react';
import { submitPublicLead } from '@/app/actions/worksuite/public.actions';

interface Field {
  _id: string;
  field_name: string;
  field_type: string;
  field_values?: string[];
  is_required?: boolean;
}

const BASE_FIELDS: Field[] = [
  { _id: 'name', field_name: 'name', field_type: 'text', is_required: true },
  { _id: 'email', field_name: 'email', field_type: 'text', is_required: true },
  { _id: 'phone', field_name: 'phone', field_type: 'text' },
  { _id: 'company', field_name: 'company', field_type: 'text' },
  { _id: 'message', field_name: 'message', field_type: 'textarea' },
];

export function LeadFormRenderer({
  formId,
  fields,
}: {
  formId: string;
  fields: Field[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allFields = [
    ...BASE_FIELDS,
    ...fields.filter(
      (f) => !BASE_FIELDS.some((b) => b.field_name === f.field_name),
    ),
  ];

  const setValue = (k: string, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setError(null);
    for (const f of allFields) {
      if (f.is_required && !String(values[f.field_name] || '').trim()) {
        setError(`${labelize(f.field_name)} is required.`);
        return;
      }
    }
    if (!values.email && !values.phone) {
      setError('Please provide at least an email or a phone number.');
      return;
    }
    setBusy(true);
    const res = await submitPublicLead(formId, values);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push('/p/thanks?type=lead');
  };

  return (
    <Card className="shadow-md border-foreground/10">
      <ZoruCardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-mono uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            Payload parameters
          </h2>
          <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
            application/json
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {allFields.map((f) => (
            <FieldInput
              key={f._id}
              field={f}
              value={values[f.field_name] || ''}
              onChange={(v) => setValue(f.field_name, v)}
              disabled={busy}
            />
          ))}
        </div>

        {error ? (
          <p className="text-[12px] font-mono text-danger font-medium bg-danger/5 border border-danger/25 p-2.5 rounded-lg">
            ERR_SUBMIT_FAILED: {error}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end">
          <Button
            variant="default"
            className="font-mono text-[12px] h-9 px-4 w-full sm:w-auto min-w-40"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                POSTING...
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                POST // SUBMIT
              </>
            )}
          </Button>
        </div>

        {/* CURL SAMPLE */}
        <div className="mt-2 rounded-lg bg-secondary/40 border border-border p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">// Curl representation</p>
          <pre className="text-[10.5px] font-mono text-foreground whitespace-pre-wrap leading-tight bg-secondary/80 p-2.5 rounded border border-border/50">
            {`curl -X POST https://api.sabnode.com/v1/leads/${formId.slice(0, 6)}/submit \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(values, null, 2).replace(/\n/g, '\n  ')}'`}
          </pre>
        </div>
      </ZoruCardContent>
    </Card>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const labelText = labelize(field.field_name);
  const label = (
    <Label htmlFor={field._id} className="text-[12px] font-mono uppercase tracking-tight text-muted-foreground">
      {labelText}
      {field.is_required ? (
        <span className="text-danger"> *</span>
      ) : null}
    </Label>
  );

  if (field.field_type === 'textarea') {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <textarea
          id={field._id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px] font-mono shadow-inner ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          rows={4}
        />
      </div>
    );
  }

  if (field.field_type === 'select' && field.field_values?.length) {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <Select
          id={field._id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          options={[
            { value: '', label: 'Select option...' },
            ...field.field_values.map((v) => ({ value: v, label: v })),
          ]}
          className="font-mono text-[12.5px]"
        />
      </div>
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
    <div className="flex flex-col gap-1.5">
      {label}
      <Input
        id={field._id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="font-mono text-[12.5px]"
      />
    </div>
  );
}

function labelize(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
