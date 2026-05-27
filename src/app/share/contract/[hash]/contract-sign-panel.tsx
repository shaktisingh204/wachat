'use client';

/**
 * Contract sign panel — full-name, email, place, today's date,
 * and signature pad. Submits to `signContract` server action.
 */

import * as React from 'react';
import {
  Alert,
  ZoruAlertDescription,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
} from '@/components/zoruui';
import { SignaturePad } from '@/components/share/signature-pad';
import { signContract } from '@/app/actions/public-contract.actions';

type Signature = {
  fullName: string;
  email: string;
  place: string;
  signedAt: string;
  signatureDataUrl: string;
};

type Props = {
  hash: string;
  signed: boolean;
  signatures: Signature[];
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function ContractSignPanel({ hash, signed, signatures }: Props) {
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [place, setPlace] = React.useState('');
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [pending, startTransition] = React.useTransition();

  const handleSign = () => {
    if (!fullName.trim()) {
      setBanner({ kind: 'error', message: 'Full name is required.' });
      return;
    }
    if (!email.trim()) {
      setBanner({ kind: 'error', message: 'Email is required.' });
      return;
    }
    if (!place.trim()) {
      setBanner({ kind: 'error', message: 'Place is required.' });
      return;
    }
    if (!signatureData) {
      setBanner({ kind: 'error', message: 'Please draw your signature.' });
      return;
    }
    startTransition(async () => {
      const result = await signContract(hash, {
        fullName,
        email,
        place,
        signatureDataUrl: signatureData,
      });
      if (result.success) {
        setBanner({ kind: 'success', message: result.message || 'Contract signed.' });
        setFullName('');
        setEmail('');
        setPlace('');
        setSignatureData(null);
      } else {
        setBanner({ kind: 'error', message: result.error });
      }
    });
  };

  return (
    <div className="space-y-6">
      {signatures.length > 0 && (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Signatures</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-6 text-sm">
            {signatures.map((sig, i) => (
              <div key={i} className="space-y-2 border-b border-zoru-line pb-4 last:border-0 last:pb-0">
                <p>
                  Signed by <span className="font-medium">{sig.fullName}</span>
                  {sig.email ? ` (${sig.email})` : ''} from {sig.place} on{' '}
                  {new Date(sig.signedAt).toLocaleString()}.
                </p>
                {sig.signatureDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={sig.signatureDataUrl}
                    alt={`Signature of ${sig.fullName}`}
                    className="h-20 rounded-md border border-zoru-line bg-white"
                  />
                ) : null}
              </div>
            ))}
          </ZoruCardContent>
        </Card>
      )}

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Sign this contract</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          {banner ? (
            <Alert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
              <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contract-name">Full name</Label>
              <Input
                id="contract-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="contract-email">Email</Label>
              <Input
                id="contract-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="contract-place">Place</Label>
              <Input
                id="contract-place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                autoComplete="address-level2"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="contract-date">Date</Label>
              <Input id="contract-date" type="date" defaultValue={todayIso()} readOnly disabled={pending} />
            </div>
          </div>

          <SignaturePad onChange={setSignatureData} />

          <Button onClick={handleSign} disabled={pending}>
            {pending ? 'Signing…' : 'Sign contract'}
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
