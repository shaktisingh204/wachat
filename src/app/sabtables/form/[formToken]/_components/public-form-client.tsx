'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Textarea,
} from '@/components/sabcrm/20ui';
import type { SabtablesTableDoc } from '@/lib/rust-client/sabtables-tables';
import type { SabtablesViewDoc } from '@/lib/rust-client/sabtables-views';

interface Props {
  view: SabtablesViewDoc;
  table: SabtablesTableDoc;
}

/**
 * Renders a public form for a SabTables `form` view. Submits through a
 * Next.js API route (`/api/sabtables/forms/[formToken]`) that the
 * server-side wiring will need to provide. See TODO at the bottom of
 * `src/app/actions/sabtables.actions.ts`.
 */
export function PublicFormClient({ view, table }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sabtables/forms/${encodeURIComponent(view.formToken ?? '')}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fieldsJson: values }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="ui20 min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md" padding="lg">
          <EmptyState
            icon={CheckCircle2}
            tone="success"
            title="Thanks!"
            description="Your response has been recorded."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="ui20 min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-xl" padding="lg">
        <PageHeader bordered={false} compact>
          <PageHeaderHeading>
            <PageTitle>{view.name || table.name}</PageTitle>
            {table.description ? (
              <PageDescription>{table.description}</PageDescription>
            ) : null}
          </PageHeaderHeading>
        </PageHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {table.fields.map((f) => (
            <Field key={f.id} label={f.name} required={f.isRequired}>
              {f.fieldType === 'long_text' ? (
                <Textarea
                  value={(values[f.id] as string | undefined) ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  rows={4}
                />
              ) : f.fieldType === 'checkbox' ? (
                <Checkbox
                  checked={Boolean(values[f.id])}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.id]: e.target.checked }))
                  }
                />
              ) : (
                <Input
                  type={
                    f.fieldType === 'email'
                      ? 'email'
                      : f.fieldType === 'url'
                        ? 'url'
                        : f.fieldType === 'number' ||
                            f.fieldType === 'currency' ||
                            f.fieldType === 'percent' ||
                            f.fieldType === 'rating'
                          ? 'number'
                          : f.fieldType === 'date'
                            ? 'date'
                            : f.fieldType === 'datetime'
                              ? 'datetime-local'
                              : 'text'
                  }
                  value={(values[f.id] as string | number | undefined) ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                />
              )}
            </Field>
          ))}
          {error ? (
            <Alert tone="danger" title="Submission failed">
              {error}
            </Alert>
          ) : null}
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? 'Submitting' : 'Submit'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
