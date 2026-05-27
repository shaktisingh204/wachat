'use client';

/**
 * Dynamic lead form renderer. Fields come from the
 * `crm_lead_custom_forms.fields[]` array — each field declares its
 * type (text/email/phone/textarea/select/checkbox/date/number) plus
 * a label and required flag.
 *
 * On submit, the entire field map is forwarded to `submitPublicLead`
 * which creates a `crm_leads` record and (optionally) a GDPR consent
 * record. A success state replaces the form with `thankYouMessage`.
 */

import * as React from 'react';
import {
  Alert,
  ZoruAlertDescription,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
} from '@/components/zoruui';
import {
  submitPublicLead,
  type LeadFormField,
} from '@/app/actions/public-lead-form.actions';

type Props = {
  formId: string;
  fields: LeadFormField[];
  thankYouMessage: string;
  consentEnabled: boolean;
  consentText?: string;
  recaptchaSiteKey?: string;
};

type FieldValue = string | boolean;

export function LeadFormClient({
  formId,
  fields,
  thankYouMessage,
  consentEnabled,
  consentText,
  recaptchaSiteKey,
}: Props) {
  const initial = React.useMemo<Record<string, FieldValue>>(() => {
    const seed: Record<string, FieldValue> = {};
    for (const f of fields) {
      seed[f.name] = f.type === 'checkbox' ? false : '';
    }
    if (consentEnabled) seed.__consent = false;
    return seed;
  }, [fields, consentEnabled]);

  const [values, setValues] = React.useState<Record<string, FieldValue>>(initial);
  const [submitted, setSubmitted] = React.useState(false);
  const [banner, setBanner] = React.useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [pending, startTransition] = React.useTransition();

  const setField = (name: string, value: FieldValue) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      let token: string | undefined;
      if (recaptchaSiteKey) {
        // @ts-ignore
        if (typeof window !== 'undefined' && window.grecaptcha) {
          // @ts-ignore
          token = window.grecaptcha.getResponse();
          if (!token) {
            setBanner({ kind: 'error', message: 'Please complete the reCAPTCHA.' });
            return;
          }
        } else {
          setBanner({ kind: 'error', message: 'reCAPTCHA failed to load.' });
          return;
        }
      }

      const result = await submitPublicLead(formId, values, token);
      if (result.success) {
        setSubmitted(true);
        setBanner(null);
      } else {
        setBanner({ kind: 'error', message: result.error });
        // @ts-ignore
        if (recaptchaSiteKey && typeof window !== 'undefined' && window.grecaptcha) {
          // @ts-ignore
          window.grecaptcha.reset();
        }
      }
    });
  };

  if (submitted) {
    return (
      <div className="rounded-md bg-zoru-surface-2 p-4 text-sm text-zoru-ink">
        <p className="font-medium">Thank you!</p>
        <p className="mt-1 whitespace-pre-line">{thankYouMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {banner ? (
        <Alert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
          <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
        </Alert>
      ) : null}

      {fields.map((field) => (
        <FieldRow
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={(v) => setField(field.name, v)}
        />
      ))}

      {consentEnabled ? (
        <label className="flex items-start gap-2 text-sm text-zoru-ink">
          <Checkbox
            checked={Boolean(values.__consent)}
            onCheckedChange={(checked: boolean | 'indeterminate') =>
              setField('__consent', checked === true)
            }
          />
          <span>{consentText || 'I consent to the storage and processing of my data.'}</span>
        </label>
      ) : null}
      
      {recaptchaSiteKey ? (
        <div className="g-recaptcha" data-sitekey={recaptchaSiteKey}></div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit'}
      </Button>
    </form>
  );
}

type FieldRowProps = {
  field: LeadFormField;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
};

function FieldRow({ field, value, onChange }: FieldRowProps) {
  const id = `field-${field.name}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required ? <span className="ml-1 text-zoru-ink">*</span> : null}
    </Label>
  );

  switch (field.type) {
    case 'textarea':
      return (
        <div>
          {label}
          <Textarea
            id={id}
            placeholder={field.placeholder}
            required={field.required}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
          />
        </div>
      );
    case 'select':
      return (
        <div>
          {label}
          <Select
            value={typeof value === 'string' ? value : ''}
            onValueChange={(v) => onChange(v)}
          >
            <ZoruSelectTrigger id={id}>
              <ZoruSelectValue placeholder={field.placeholder || 'Select…'} />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {(field.options || []).map((opt) => (
                <ZoruSelectItem key={opt} value={opt}>
                  {opt}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </div>
      );
    case 'checkbox':
      return (
        <label htmlFor={id} className="flex items-center gap-2 text-sm text-zoru-ink">
          <Checkbox
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked: boolean | 'indeterminate') =>
              onChange(checked === true)
            }
          />
          <span>
            {field.label}
            {field.required ? <span className="ml-1 text-zoru-ink">*</span> : null}
          </span>
        </label>
      );
    case 'date':
    case 'email':
    case 'phone':
    case 'number':
    case 'text':
    default: {
      const htmlType =
        field.type === 'phone'
          ? 'tel'
          : field.type === 'email'
            ? 'email'
            : field.type === 'number'
              ? 'number'
              : field.type === 'date'
                ? 'date'
                : 'text';
      return (
        <div>
          {label}
          <Input
            id={id}
            type={htmlType}
            placeholder={field.placeholder}
            required={field.required}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    }
  }
}
