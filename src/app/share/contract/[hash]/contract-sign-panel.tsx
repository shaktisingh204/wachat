'use client';

/**
 * Contract sign panel — full-name, email, place, today's date,
 * and signature pad. Submits to `signContract` server action.
 */

import * as React from 'react';
import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruInput,
  ZoruLabel,
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
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Contract signed</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3 text-sm">
          <ZoruAlert>
            <ZoruAlertDescription>
              Thank you. This contract has been digitally signed.
            </ZoruAlertDescription>
          </ZoruAlert>
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
      </ZoruCard>
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
    <ZoruCard>
      <ZoruCardHeader>
        <ZoruCardTitle>Sign this contract</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-4">
        {banner ? (
          <ZoruAlert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
            <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
          </ZoruAlert>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="contract-name">Full name</ZoruLabel>
            <ZoruInput
              id="contract-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="contract-email">Email</ZoruLabel>
            <ZoruInput
              id="contract-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="contract-place">Place</ZoruLabel>
            <ZoruInput
              id="contract-place"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              autoComplete="address-level2"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="contract-date">Date</ZoruLabel>
            <ZoruInput id="contract-date" type="date" defaultValue={todayIso()} readOnly />
          </div>
        </div>

        <SignaturePad onChange={setSignatureData} />

        <ZoruButton onClick={handleSign} disabled={pending}>
          {pending ? 'Signing…' : 'Sign contract'}
        </ZoruButton>
      </ZoruCardContent>
    </ZoruCard>
  );
}
