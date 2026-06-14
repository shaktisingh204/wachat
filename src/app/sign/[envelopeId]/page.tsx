'use client';

/**
 * Public signing page. Reached via per-signer URLs of the form:
 *
 *   /sign/<envelopeId>?signerId=<id>&t=<accessToken>
 *
 * This page is unauthenticated at the Next.js layer; the actual auth is
 * performed inside the Rust `submit_signature` handler, which checks
 * `(signerId, accessToken)` plus the configured auth tier (OTP / KBA /
 * PIN).
 *
 * The signer's only inputs are the field values; the document itself is
 * rendered via the SabFiles URL the envelope was created with.
 */

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FileX2 } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Field,
  Input,
  Checkbox,
  Spinner,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { getSignView, issueSignerOtp, submitSignature } from '@/app/actions/sabsign.actions';
import { getPublicSignBranding } from '@/app/actions/sabsign-settings.actions';
import type { EnvelopeField } from '@/lib/rust-client/sabsign-envelopes';
import type { SabsignBranding } from '@/lib/sabsign/branding';
import { fieldVisibility, computeFormula } from '@/lib/sabsign/conditions';
import { t, LOCALES, normalizeLocale } from '@/lib/sabsign/i18n';

interface SignPagePayload {
  _id: string;
  docUrl?: string;
  docName?: string;
  name: string;
  fields: EnvelopeField[];
  signer: {
    id: string;
    role: string;
    name: string;
    email: string;
    phone?: string;
    authMethod: 'email' | 'sms_otp' | 'kba' | 'pin';
    kbaQuestions?: Array<{ question: string }>;
  };
}

export default function PublicSignPage() {
  const params = useParams<{ envelopeId: string }>();
  const search = useSearchParams();
  const { toast } = useToast();
  const signerId = search.get('signerId') || '';
  const accessToken = search.get('t') || '';

  const [payload, setPayload] = React.useState<SignPagePayload | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [otp, setOtp] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [kbaAnswers, setKbaAnswers] = React.useState<string[]>([]);
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [branding, setBranding] = React.useState<SabsignBranding | null>(null);
  const [locale, setLocale] = React.useState('en');

  // Default the signing language from the signer's browser.
  React.useEffect(() => {
    if (typeof navigator !== 'undefined') setLocale(normalizeLocale(navigator.language));
  }, []);

  // White-label branding for the signing experience (public, by envelope id).
  React.useEffect(() => {
    let mounted = true;
    getPublicSignBranding(params.envelopeId)
      .then((b) => mounted && setBranding(b))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [params.envelopeId]);

  // Hydrate the (sanitized) envelope via the public, token-authed sign view.
  // Verifies `(signerId, token)` server-side and marks the signer `viewed`.
  React.useEffect(() => {
    let mounted = true;
    getSignView(params.envelopeId, signerId, accessToken)
      .then((view) => {
        if (!mounted) return;
        const signer = view.envelope.signers.find((s) => s.id === signerId);
        if (!signer) {
          setError('This signing link is not valid for any recipient.');
          return;
        }
        setPayload({
          _id: view.envelope._id,
          docUrl: view.envelope.docUrl,
          docName: view.envelope.docName,
          name: view.envelope.name,
          fields: view.envelope.fields,
          signer: {
            id: signer.id,
            role: signer.role,
            name: signer.name,
            email: signer.email,
            phone: signer.phone,
            authMethod: signer.authMethod,
            kbaQuestions: signer.kbaQuestions,
          },
        });
        setKbaAnswers(new Array(signer.kbaQuestions?.length || 0).fill(''));
      })
      .catch((err) => setError(err?.message || String(err)));
    return () => {
      mounted = false;
    };
  }, [params.envelopeId, signerId, accessToken]);

  const requestOtp = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      const res = await issueSignerOtp(
        params.envelopeId,
        payload.signer.id,
        payload.signer.phone,
      );
      if (res.otpPreview) toast.info(`Dev OTP: ${res.otpPreview}`);
      else toast.info('Verification code sent.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (decline = false) => {
    if (!payload) return;
    if (!decline && !consent) {
      setError(t(locale, 'agreeFirst'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Inject computed formula-field values, then drop values for fields that
      // are hidden by conditional logic.
      const merged: Record<string, string> = { ...values };
      for (const f of payload.fields) {
        const computed = computeFormula(f, merged);
        if (computed != null) merged[f.id] = computed;
      }
      const fieldValues = payload.fields
        .filter((f) => fieldVisibility(f, merged).visible && merged[f.id] != null)
        .map((f) => ({ fieldId: f.id, value: merged[f.id] ?? '' }));

      const res = await submitSignature(params.envelopeId, {
        signerId: payload.signer.id,
        accessToken,
        pin: pin || undefined,
        otp: otp || undefined,
        kbaAnswers,
        fieldValues,
        decline,
        declineReason: decline ? prompt('Reason for declining?') || undefined : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      setDone(
        decline
          ? t(locale, 'declinedThanks')
          : `Submitted. Envelope is now ${res.envelopeStatus.replace('_', ' ')}.`,
      );
      // Notify an embedding parent window (embedded signing).
      try {
        if (typeof window !== 'undefined' && window.parent !== window) {
          window.parent.postMessage(
            {
              type: decline ? 'sabsign:declined' : 'sabsign:completed',
              envelopeId: params.envelopeId,
              signerId: payload.signer.id,
              status: res.envelopeStatus,
            },
            '*',
          );
        }
      } catch {
        /* cross-origin parent — ignore */
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="20ui min-h-screen flex items-center justify-center p-6 bg-[var(--st-bg)]">
        <Card className="max-w-md w-full">
          <CardBody>
            <EmptyState
              icon={FileX2}
              tone="danger"
              title="Unable to load envelope"
              description={error}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="20ui min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-[var(--st-bg)]">
        <Spinner size="lg" label="Loading envelope" />
        <p className="text-sm text-[var(--st-text-secondary)]">Loading envelope.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="20ui min-h-screen flex items-center justify-center p-6 bg-[var(--st-bg)]">
        <Card className="max-w-md w-full text-center">
          <CardBody>
            <h2 className="text-lg font-semibold text-[var(--st-text)]">All set</h2>
            <p className="text-sm text-[var(--st-text-secondary)] mt-2">{done}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // This signer's fields, with conditional logic applied: drop hidden fields
  // and surface formula-computed values read-only.
  const fields = payload.fields
    .filter((f) => f.recipientRole === payload.signer.role)
    .filter((f) => fieldVisibility(f, values).visible);

  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] p-4">
      <div className="mx-auto mb-3 flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.senderName || 'logo'}
              className="max-h-9 object-contain"
            />
          ) : null}
          {branding?.senderName ? (
            <span className="text-sm font-medium text-[var(--st-text)]">
              {branding.senderName}
            </span>
          ) : null}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
          {t(locale, 'language')}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="rounded border border-[var(--st-border)] bg-[var(--st-surface)] px-2 py-1 text-xs text-[var(--st-text)]"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <Card padding="none" className="overflow-hidden">
          {payload.docUrl ? (
            <iframe
              src={payload.docUrl}
              title={payload.docName || payload.name}
              className="w-full h-[80vh] block"
            />
          ) : (
            <div className="p-8 text-sm text-[var(--st-text-secondary)]">No document URL.</div>
          )}
        </Card>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>{payload.name}</CardTitle>
              <CardDescription>
                {payload.signer.name} ({payload.signer.email}), role{' '}
                <Badge tone="accent">{payload.signer.role}</Badge>
              </CardDescription>
            </CardHeader>
          </Card>

          {payload.signer.authMethod === 'sms_otp' && (
            <Card>
              <CardBody>
                <Field label="SMS code">
                  <div className="flex gap-2">
                    <Input value={otp} onChange={(e) => setOtp(e.target.value)} />
                    <Button variant="outline" onClick={requestOtp} disabled={busy}>
                      Send code
                    </Button>
                  </div>
                </Field>
              </CardBody>
            </Card>
          )}

          {payload.signer.authMethod === 'pin' && (
            <Card>
              <CardBody>
                <Field label="PIN">
                  <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
                </Field>
              </CardBody>
            </Card>
          )}

          {payload.signer.authMethod === 'kba' && payload.signer.kbaQuestions && (
            <Card>
              <CardBody className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--st-text)]">Identity questions</h3>
                {payload.signer.kbaQuestions.map((q, i) => (
                  <Field key={i} label={q.question}>
                    <Input
                      value={kbaAnswers[i] || ''}
                      onChange={(e) => {
                        const out = [...kbaAnswers];
                        out[i] = e.target.value;
                        setKbaAnswers(out);
                      }}
                    />
                  </Field>
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--st-text)]">
                {t(locale, 'yourFields')}
              </h3>
              {fields.length === 0 ? (
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {t(locale, 'nothingToFill')}
                </p>
              ) : (
                fields.map((f) => {
                  if (f.fieldType === 'checkbox') {
                    return (
                      <Checkbox
                        key={f.id}
                        label={f.label || f.fieldType}
                        checked={values[f.id] === 'true'}
                        onChange={(e) =>
                          setValues({ ...values, [f.id]: e.target.checked ? 'true' : 'false' })
                        }
                      />
                    );
                  }
                  if (f.fieldType === 'dropdown' || f.fieldType === 'radio') {
                    return (
                      <Field key={f.id} label={f.label || f.fieldType}>
                        <Select
                          value={values[f.id] || ''}
                          onValueChange={(v) => setValues({ ...values, [f.id]: v })}
                        >
                          <SelectTrigger aria-label={f.label || f.fieldType}>
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {(f.options || []).map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    );
                  }
                  return (
                    <Field key={f.id} label={f.label || f.fieldType}>
                      <Input
                        value={values[f.id] || ''}
                        onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                        placeholder={
                          f.fieldType === 'signature' ? 'Type your name to sign' : undefined
                        }
                      />
                    </Field>
                  );
                })
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Checkbox
                label={t(locale, 'consent')}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
            </CardBody>
          </Card>

          {error ? (
            <p className="text-sm text-[var(--st-status-danger,#dc2626)]">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={busy || !consent}
              onClick={() => submit(false)}
            >
              {busy ? t(locale, 'submitting') : t(locale, 'finishSign')}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => submit(true)}>
              {t(locale, 'decline')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
