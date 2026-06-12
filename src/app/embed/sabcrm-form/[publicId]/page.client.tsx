'use client';

/**
 * PUBLIC SabCRM form client (`/embed/sabcrm-form/[publicId]`).
 *
 * Calm, Linear-grade single-card form on 20ui. Renders the sanitised
 * field list (text / email / phone / textarea / select), validates
 * required fields client-side, and submits through the unauthenticated
 * `submitSabcrmPublicForm` server action. On success it honors the form's
 * configured redirect URL (hard navigation) or success message; a hidden
 * honeypot input (`_hp`) is included for bot detection.
 */

import * as React from 'react';
import { CheckCircle, FileQuestion } from 'lucide-react';

import {
  Alert,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  SelectField,
  Textarea,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import { submitSabcrmPublicForm } from '@/app/actions/sabcrm-forms-public.actions';

import '@/components/sabcrm/20ui/surface-crm-base.css';

/** Serializable form view the server page narrows the public doc into. */
export interface PublicFormView {
  publicId: string;
  name: string;
  description: string;
  successMessage: string;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
    placeholder: string;
    options: string[];
  }>;
}

export interface SabcrmPublicFormClientProps {
  form: PublicFormView | null;
  unavailable: boolean;
}

export function SabcrmPublicFormClient({
  form,
  unavailable,
}: SabcrmPublicFormClientProps): React.JSX.Element {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const setValue = (name: string, value: string): void => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  if (unavailable || !form) {
    return (
      <main className="ui20 min-h-screen bg-transparent">
        <div className="mx-auto w-full max-w-lg px-4 py-16">
          <EmptyState
            icon={FileQuestion}
            title="Form unavailable"
            description="This form doesn't exist or isn't accepting submissions."
          />
        </div>
      </main>
    );
  }

  if (success !== null) {
    return (
      <main className="ui20 min-h-screen bg-transparent">
        <div className="mx-auto w-full max-w-lg px-4 py-16">
          <EmptyState
            icon={CheckCircle}
            tone="success"
            title={success || 'Submission successful.'}
          />
        </div>
      </main>
    );
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);

    for (const field of form.fields) {
      if (field.required && !(values[field.name] ?? '').trim()) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    startTransition(async () => {
      const res = await submitSabcrmPublicForm(
        form.publicId,
        { ...values, _hp: honeypot },
        typeof window !== 'undefined' ? window.location.href : undefined,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      setSuccess(res.message || form.successMessage || 'Thank you! Your submission has been received.');
    });
  };

  return (
    <main className="ui20 min-h-screen bg-transparent">
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <Card className="shadow-md">
          <form onSubmit={handleSubmit}>
            <CardHeader className="flex-col items-start gap-1 pb-2">
              <CardTitle className="text-xl font-semibold">
                {form.name}
              </CardTitle>
              {form.description ? (
                <CardDescription>{form.description}</CardDescription>
              ) : null}
            </CardHeader>

            <div className="flex flex-col gap-4 px-5 pb-2 pt-2">
              {/* Honeypot — visually hidden, bots fill it, humans don't. */}
              <input
                type="text"
                name="_hp"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-px w-px opacity-0"
              />

              {form.fields.map((field) => (
                <Field
                  key={field.name}
                  label={field.label}
                  required={field.required}
                >
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      placeholder={field.placeholder || undefined}
                      disabled={pending}
                    />
                  ) : field.type === 'select' ? (
                    <SelectField
                      value={values[field.name] || null}
                      onChange={(v) => setValue(field.name, v ?? '')}
                      options={field.options.map(
                        (o): SelectOption => ({ value: o, label: o }),
                      )}
                      placeholder={field.placeholder || 'Select…'}
                      disabled={pending}
                    />
                  ) : (
                    <Input
                      type={
                        field.type === 'email'
                          ? 'email'
                          : field.type === 'phone'
                            ? 'tel'
                            : 'text'
                      }
                      inputMode={field.type === 'phone' ? 'tel' : undefined}
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      placeholder={field.placeholder || undefined}
                      disabled={pending}
                    />
                  )}
                </Field>
              ))}

              {error ? (
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              ) : null}
            </div>

            <div className="px-5 pb-5 pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={pending}
                className="w-full"
              >
                Submit
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
