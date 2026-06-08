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
import { issueSignerOtp, submitSignature } from '@/app/actions/sabsign.actions';

interface SignPagePayload {
  _id: string;
  docUrl?: string;
  docName?: string;
  name: string;
  fields: Array<{
    id: string;
    recipientRole: string;
    fieldType: string;
    label?: string;
    required?: boolean;
    options?: string[];
    value?: string;
  }>;
  signer: {
    id: string;
    role: string;
    name: string;
    email: string;
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
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // The public sign page hydrates via `/api/sign/[envelopeId]` (TODO:
  // wire this read-only public endpoint). For now we fetch the envelope
  // via a server action that re-derives the public projection.
  React.useEffect(() => {
    let mounted = true;
    fetch(`/api/sign/${params.envelopeId}?signerId=${signerId}&t=${accessToken}`)
      .then((r) => r.json())
      .then((data: SignPagePayload) => {
        if (!mounted) return;
        setPayload(data);
        setKbaAnswers(new Array(data.signer.kbaQuestions?.length || 0).fill(''));
      })
      .catch((err) => setError(String(err)));
    return () => {
      mounted = false;
    };
  }, [params.envelopeId, signerId, accessToken]);

  const requestOtp = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      const res = await issueSignerOtp(params.envelopeId, payload.signer.id);
      if (res.otpPreview) toast.info(`Dev OTP: ${res.otpPreview}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (decline = false) => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitSignature(params.envelopeId, {
        signerId: payload.signer.id,
        accessToken,
        pin: pin || undefined,
        otp: otp || undefined,
        kbaAnswers,
        fieldValues: Object.entries(values).map(([fieldId, value]) => ({
          fieldId,
          value,
        })),
        decline,
        declineReason: decline ? prompt('Reason for declining?') || undefined : undefined,
      });
      setDone(
        decline
          ? 'Declined. Thank you.'
          : `Submitted. Envelope is now ${res.envelopeStatus.replace('_', ' ')}.`,
      );
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

  const fields = payload.fields.filter((f) => f.recipientRole === payload.signer.role);

  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] p-4">
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
              <h3 className="text-sm font-medium text-[var(--st-text)]">Your fields</h3>
              {fields.length === 0 ? (
                <p className="text-xs text-[var(--st-text-secondary)]">
                  Nothing to fill. Only your signature is required.
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
                  if (f.fieldType === 'dropdown') {
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

          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => submit(false)}>
              Submit
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => submit(true)}>
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
