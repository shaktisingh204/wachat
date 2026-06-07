'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardFooter,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  Spinner,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { Send, X, CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react';
import { submitPublicTicket } from '@/app/actions/worksuite/public.actions';

interface FormField {
  _id: string;
  field_name: string;
  field_type: string;
  field_values?: string;
  is_required?: boolean;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
}

const BASE_FIELDS: FormField[] = [
  { _id: 'name', field_name: 'name', field_type: 'text', is_required: true },
  { _id: 'email', field_name: 'email', field_type: 'email', is_required: true },
  { _id: 'subject', field_name: 'subject', field_type: 'text', is_required: true },
  {
    _id: 'description',
    field_name: 'description',
    field_type: 'textarea',
    is_required: true,
  },
];

export function TicketFormRenderer({
  formId,
  fields,
}: {
  formId: string;
  fields: FormField[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimistic UI state
  const [isSubmittedOptimistically, setIsSubmittedOptimistically] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean | null>(null);

  // Spam protection
  const [mathA] = useState(Math.floor(Math.random() * 10) + 1);
  const [mathB] = useState(Math.floor(Math.random() * 10) + 1);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Hidden fields / Tracking
  const [trackingData, setTrackingData] = useState<Record<string, string>>({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setTrackingData({
      utm_source: urlParams.get('utm_source') || '',
      utm_medium: urlParams.get('utm_medium') || '',
      utm_campaign: urlParams.get('utm_campaign') || '',
      referrer: document.referrer || '',
    });
  }, []);

  const allFields = [
    ...BASE_FIELDS,
    ...fields.filter(
      (f) => !BASE_FIELDS.some((b) => b.field_name === f.field_name),
    ),
  ];

  const setValue = (k: string, v: any) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setError(null);
    for (const f of allFields) {
      if (f.is_required && !String(values[f.field_name] || '').trim()) {
        setError(`${labelize(f.field_name)} is required`);
        return;
      }
    }

    if (parseInt(captchaAnswer) !== mathA + mathB) {
      setError('Spam protection verification failed. Please try again.');
      return;
    }

    // Optimistic UI update
    setBusy(true);
    setIsSubmittedOptimistically(true);

    // Merge hidden tracking data
    const finalData = {
      ...values,
      ...trackingData,
    };

    const res = await submitPublicTicket(formId, finalData);
    setBusy(false);

    if (!res.success) {
      setSubmissionSuccess(false);
      setError(res.error);
      setIsSubmittedOptimistically(false);
      return;
    }

    setSubmissionSuccess(true);
    // Wait a beat, then redirect to the thank-you page.
    setTimeout(() => {
      router.push('/p/thanks?type=ticket');
    }, 2000);
  };

  if (isSubmittedOptimistically) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center justify-center py-12 text-center">
          {submissionSuccess === null ? (
            <>
              <Spinner size="lg" label="Submitting ticket" className="mb-4" />
              <h3 className="text-lg font-medium text-[var(--st-text)]">Submitting ticket...</h3>
              <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                Please wait while we process your request.
              </p>
            </>
          ) : submissionSuccess === true ? (
            <>
              <CheckCircle2
                className="mb-4 h-12 w-12 text-[var(--st-status-ok)]"
                aria-hidden="true"
              />
              <h3 className="text-lg font-medium text-[var(--st-text)]">Ticket submitted!</h3>
              <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                Redirecting you shortly...
              </p>
            </>
          ) : (
            <>
              <AlertCircle
                className="mb-4 h-12 w-12 text-[var(--st-danger)]"
                aria-hidden="true"
              />
              <h3 className="text-lg font-medium text-[var(--st-text)]">Submission Failed</h3>
              <p className="mt-2 text-sm text-[var(--st-text-secondary)]">{error}</p>
              <Button
                className="mt-6"
                onClick={() => {
                  setIsSubmittedOptimistically(false);
                  setError(null);
                }}
              >
                Try Again
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    );
  }

  const attachments: Attachment[] = values.attachments || [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <div className="grid gap-4">
            {allFields.map((f) => (
              <FieldInput
                key={f._id}
                field={f}
                value={values[f.field_name] || ''}
                onChange={(v) => setValue(f.field_name, v)}
                disabled={busy}
              />
            ))}

            <Field label="Attachments">
              <div className="flex flex-col gap-2">
                <SabFilePickerButton
                  variant="outline"
                  onPick={(pick: SabFilePick) =>
                    setValue('attachments', [
                      ...attachments,
                      { name: pick.name, url: pick.url, type: pick.mime || '' },
                    ])
                  }
                >
                  Add attachment
                </SabFilePickerButton>

                {attachments.length > 0 && (
                  <div className="mt-1 flex flex-col gap-2">
                    {attachments.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2 text-xs"
                      >
                        <span className="max-w-[200px] truncate sm:max-w-xs text-[var(--st-text)]">
                          {file.name}
                        </span>
                        <IconButton
                          label={`Remove ${file.name}`}
                          icon={X}
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            setValue(
                              'attachments',
                              attachments.filter((_, idx) => idx !== i),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <div className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
              <span className="text-[12.5px] font-medium text-[var(--st-text)]">
                Spam Protection <span className="text-[var(--st-danger)]">*</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--st-text)]">
                  What is {mathA} + {mathB}?
                </span>
                <Input
                  type="number"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  disabled={busy}
                  className="w-20"
                  placeholder="="
                  aria-label={`Sum of ${mathA} plus ${mathB}`}
                />
              </div>
            </div>
          </div>

          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}
        </CardBody>

        <CardFooter className="flex justify-end">
          <Button
            variant="primary"
            onClick={submit}
            loading={busy}
            iconLeft={Send}
          >
            Submit ticket
          </Button>
        </CardFooter>
      </Card>

      {/* Live Chat Fallback */}
      <Card variant="ghost" className="border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <CardBody>
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex flex-col">
              <h4 className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Need faster help?
              </h4>
              <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                Our support agents are available for live chat.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => alert('Live chat initiated. (Demo fallback)')}
            >
              Start Live Chat
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const labelText = labelize(field.field_name);

  if (field.field_type === 'textarea') {
    return (
      <Field label={labelText} required={field.is_required}>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={5}
          className="min-h-[120px]"
        />
      </Field>
    );
  }

  if (field.field_type === 'select' && field.field_values) {
    const opts = field.field_values
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    return (
      <Field label={labelText} required={field.is_required}>
        <Select
          value={value}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger aria-label={labelText}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {opts.map((v) => (
              <SelectItem key={v} value={v}>
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
        : field.field_type === 'email'
          ? 'email'
          : field.field_type === 'url'
            ? 'url'
            : 'text';

  return (
    <Field label={labelText} required={field.is_required}>
      <Input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </Field>
  );
}

function labelize(name: string): string {
  return name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
