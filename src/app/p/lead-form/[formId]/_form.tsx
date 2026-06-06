'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, Button } from '@/components/sabcrm/20ui';
import { LoaderCircle, Send, Terminal } from 'lucide-react';
import { submitPublicLead } from '@/app/actions/worksuite/public.actions';
import { FieldInput } from './_components/field-input';
import { CurlSample } from './_components/curl-sample';
import type { LeadFormField } from './types';

const BASE_FIELDS: LeadFormField[] = [
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
  fields: LeadFormField[];
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
        const labelText = f.field_name
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setError(`${labelText} is required.`);
        return;
      }
    }
    if (!values.email && !values.phone) {
      setError('Please provide at least an email or a phone number.');
      return;
    }
    setBusy(true);
    try {
      const res = await submitPublicLead(formId, values);
      setBusy(false);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.push('/p/thanks?type=lead');
    } catch (err: any) {
      setBusy(false);
      setError(err.message || 'An unexpected API error occurred.');
    }
  };

  return (
    <Card className="shadow-md border-foreground/10">
      <CardBody className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-mono uppercase tracking-wider text-[var(--st-text)] flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-[var(--st-text-secondary)]" />
            Payload parameters
          </h2>
          <span className="text-[10px] font-mono bg-[var(--st-bg-muted)] px-1.5 py-0.5 rounded text-[var(--st-text-secondary)]">
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

        <CurlSample formId={formId} values={values} />
      </CardBody>
    </Card>
  );
}
