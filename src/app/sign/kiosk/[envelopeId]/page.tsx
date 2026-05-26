'use client';

/**
 * Kiosk / in-person sign page.
 *
 * URL shape:
 *   /sign/kiosk/<envelopeId>?signerId=<id>&pin=<...>
 *
 * The PIN is verified server-side against the signer's `pinHash`. The
 * URL itself can be shown openly (e.g. on a kiosk QR code) because the
 * PIN is the bearer credential — without it the submission rejects.
 *
 * We deliberately reuse the public sign page's submission action; the
 * kiosk only differs in how the signer is authenticated (PIN-only).
 */

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, Card, Input, Label } from '@/components/zoruui';
import { submitSignature } from '@/app/actions/sabsign.actions';

interface KioskPayload {
  _id: string;
  name: string;
  docUrl?: string;
  docName?: string;
  fields: Array<{
    id: string;
    recipientRole: string;
    fieldType: string;
    label?: string;
    options?: string[];
  }>;
  signer: {
    id: string;
    role: string;
    name: string;
    authMethod: string;
  };
}

export default function KioskSignPage() {
  const params = useParams<{ envelopeId: string }>();
  const search = useSearchParams();
  const signerId = search.get('signerId') || '';
  const initialPin = search.get('pin') || '';

  const [payload, setPayload] = React.useState<KioskPayload | null>(null);
  const [pin, setPin] = React.useState(initialPin);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Kiosk flow: there is no per-signer access token; the read endpoint
  // is permissive and gates only on `signerId`. The actual gate is the
  // PIN at submit time (verified against `pinHash` server-side).
  React.useEffect(() => {
    if (!signerId) return;
    fetch(`/api/sign/kiosk/${params.envelopeId}?signerId=${signerId}`)
      .then((r) => r.json())
      .then((data) => setPayload(data))
      .catch((err) => setError(String(err)));
  }, [params.envelopeId, signerId]);

  const submit = async () => {
    if (!payload) return;
    if (pin.length < 4) {
      setError('Enter the PIN.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await submitSignature(params.envelopeId, {
        signerId: payload.signer.id,
        // The kiosk endpoint doesn't carry an access token; Rust accepts
        // empty-string here when auth_method == pin (PIN is the credential).
        accessToken: '',
        pin,
        fieldValues: Object.entries(values).map(([fieldId, value]) => ({ fieldId, value })),
      });
      setDone(`Submitted. Envelope is now ${res.envelopeStatus.replace('_', ' ')}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-500">Cannot open kiosk session</h2>
          <p className="text-sm text-zoru-ink-muted mt-2">{error}</p>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-zoru-ink">Thank you</h2>
          <p className="text-sm text-zoru-ink-muted mt-2">{done}</p>
        </Card>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-sm text-zoru-ink-muted">
        Loading kiosk…
      </div>
    );
  }

  const fields = payload.fields.filter((f) => f.recipientRole === payload.signer.role);

  return (
    <div className="min-h-screen bg-zoru-bg p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
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
              Signing as <strong>{payload.signer.name}</strong> ({payload.signer.role})
            </p>
          </Card>
          <Card className="p-4 border border-zoru-line space-y-2">
            <Label>PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </Card>
          <Card className="p-4 border border-zoru-line space-y-3">
            <h3 className="text-sm font-medium text-zoru-ink">Fields</h3>
            {fields.length === 0 ? (
              <p className="text-xs text-zoru-ink-muted">No additional fields.</p>
            ) : (
              fields.map((f) => (
                <div key={f.id}>
                  <Label className="text-xs">{f.label || f.fieldType}</Label>
                  <Input
                    value={values[f.id] || ''}
                    onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                  />
                </div>
              ))
            )}
          </Card>
          <Button disabled={busy} onClick={submit}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
