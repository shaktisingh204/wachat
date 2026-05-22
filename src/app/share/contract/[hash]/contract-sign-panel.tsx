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

type SignedBy = {
  fullName: string;
  email: string;
  place: string;
  signedAt: string;
  signatureDataUrl: string;
} | null;

type Props = {
  hash: string;
  signed: boolean;
  signedBy: SignedBy;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function ContractSignPanel({ hash, signed, signedBy }: Props) {
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [place, setPlace] = React.useState('');
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [pending, startTransition] = React.useTransition();

  if (signed) {
    return (
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Contract signed</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3 text-sm">
          <Alert>
            <ZoruAlertDescription>
              Thank you. This contract has been digitally signed.
            </ZoruAlertDescription>
          </Alert>
          {signedBy ? (
            <div className="space-y-2">
              <p>
                Signed by <span className="font-medium">{signedBy.fullName}</span>
                {signedBy.email ? ` (${signedBy.email})` : ''} from {signedBy.place} on{' '}
                {new Date(signedBy.signedAt).toLocaleString()}.
              </p>
              {signedBy.signatureDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={signedBy.signatureDataUrl}
                  alt={`Signature of ${signedBy.fullName}`}
                  className="h-20 rounded-md border border-zinc-200 bg-white"
                />
              ) : null}
            </div>
          ) : null}
        </ZoruCardContent>
      </Card>
    );
  }

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
      setBanner(
        result.success
          ? { kind: 'success', message: result.message || 'Contract signed.' }
          : { kind: 'error', message: result.error },
      );
    });
  };

  return (
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
            />
          </div>
          <div>
            <Label htmlFor="contract-place">Place</Label>
            <Input
              id="contract-place"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              autoComplete="address-level2"
            />
          </div>
          <div>
            <Label htmlFor="contract-date">Date</Label>
            <Input id="contract-date" type="date" defaultValue={todayIso()} readOnly />
          </div>
        </div>

        <SignaturePad onChange={setSignatureData} />

        <Button onClick={handleSign} disabled={pending}>
          {pending ? 'Signing…' : 'Sign contract'}
        </Button>
      </ZoruCardContent>
    </Card>
  );
}
