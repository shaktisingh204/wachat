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
import {
  Button,
  Card,
  Input,
  Label,
} from '@/components/zoruui';
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
      if (res.otpPreview) alert(`Dev OTP: ${res.otpPreview}`);
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
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-500">Unable to load envelope</h2>
          <p className="text-sm text-zoru-ink-muted mt-2">{error}</p>
        </Card>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-sm text-zoru-ink-muted">
        Loading envelope…
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-zoru-ink">All set</h2>
          <p className="text-sm text-zoru-ink-muted mt-2">{done}</p>
        </Card>
      </div>
    );
  }

  const fields = payload.fields.filter((f) => f.recipientRole === payload.signer.role);

  return (
    <div className="min-h-screen bg-zoru-bg p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <Card className="overflow-hidden border border-zoru-line">
          {payload.docUrl ? (
            <iframe
              src={payload.docUrl}
              title={payload.docName || payload.name}
              className="w-full h-[80vh] block"
            />
          ) : (
            <div className="p-8 text-sm text-zoru-ink-muted">No document URL.</div>
          )}
        </Card>
        <div className="space-y-3">
          <Card className="p-4 border border-zoru-line">
            <h2 className="text-lg font-semibold text-zoru-ink">{payload.name}</h2>
            <p className="text-sm text-zoru-ink-muted">
              {payload.signer.name} ({payload.signer.email}) — role{' '}
              <strong>{payload.signer.role}</strong>
            </p>
          </Card>

          {payload.signer.authMethod === 'sms_otp' && (
            <Card className="p-4 border border-zoru-line space-y-2">
              <Label>SMS code</Label>
              <div className="flex gap-2">
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} />
                <Button variant="outline" onClick={requestOtp} disabled={busy}>
                  Send code
                </Button>
              </div>
            </Card>
          )}

          {payload.signer.authMethod === 'pin' && (
            <Card className="p-4 border border-zoru-line space-y-2">
              <Label>PIN</Label>
              <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
            </Card>
          )}

          {payload.signer.authMethod === 'kba' && payload.signer.kbaQuestions && (
            <Card className="p-4 border border-zoru-line space-y-3">
              <h3 className="text-sm font-medium text-zoru-ink">Identity questions</h3>
              {payload.signer.kbaQuestions.map((q, i) => (
                <div key={i}>
                  <Label className="text-xs">{q.question}</Label>
                  <Input
                    value={kbaAnswers[i] || ''}
                    onChange={(e) => {
                      const out = [...kbaAnswers];
                      out[i] = e.target.value;
                      setKbaAnswers(out);
                    }}
                  />
                </div>
              ))}
            </Card>
          )}

          <Card className="p-4 border border-zoru-line space-y-3">
            <h3 className="text-sm font-medium text-zoru-ink">Your fields</h3>
            {fields.length === 0 ? (
              <p className="text-xs text-zoru-ink-muted">
                Nothing to fill — only your signature is required.
              </p>
            ) : (
              fields.map((f) => (
                <div key={f.id}>
                  <Label className="text-xs">{f.label || f.fieldType}</Label>
                  {f.fieldType === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={values[f.id] === 'true'}
                      onChange={(e) =>
                        setValues({ ...values, [f.id]: e.target.checked ? 'true' : 'false' })
                      }
                    />
                  ) : f.fieldType === 'dropdown' ? (
                    <select
                      className="w-full h-9 rounded-md border border-zoru-line bg-zoru-bg px-2 text-sm"
                      value={values[f.id] || ''}
                      onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                    >
                      <option value="">—</option>
                      {(f.options || []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={values[f.id] || ''}
                      onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                      placeholder={
                        f.fieldType === 'signature' ? 'Type your name to sign' : undefined
                      }
                    />
                  )}
                </div>
              ))
            )}
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
