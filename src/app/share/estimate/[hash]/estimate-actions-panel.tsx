'use client';

/**
 * Estimate accept / decline panel. Renders the signature pad +
 * name input for "Accept" and a reason textarea modal for "Decline".
 * Once a terminal status is reached the panel becomes read-only and
 * shows the recorded signature image (if accepted).
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
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
} from '@/components/zoruui';
import { SignaturePad } from '@/components/share/signature-pad';
import {
  acceptEstimate,
  declineEstimate,
} from '@/app/actions/public-estimate.actions';

type Signature = {
  signedByName: string;
  signedAt: string;
  signatureDataUrl: string;
} | null;

type Props = {
  hash: string;
  status: string;
  signature: Signature;
  declineReason: string | null;
};

export function EstimateActionsPanel({ hash, status, signature, declineReason }: Props) {
  const [name, setName] = React.useState('');
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [banner, setBanner] = React.useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [pending, startTransition] = React.useTransition();

  if (status === 'accepted') {
    return (
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Estimate accepted</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3 text-sm">
          {signature ? (
            <>
              <p>
                Accepted by <span className="font-medium">{signature.signedByName}</span> on{' '}
                {new Date(signature.signedAt).toLocaleString()}.
              </p>
              {signature.signatureDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={signature.signatureDataUrl}
                  alt={`Signature of ${signature.signedByName}`}
                  className="h-20 rounded-md border border-zinc-200 bg-white"
                />
              ) : null}
            </>
          ) : (
            <p>This estimate has been accepted.</p>
          )}
        </ZoruCardContent>
      </ZoruCard>
    );
  }

  if (status === 'declined') {
    return (
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Estimate declined</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-2 text-sm text-zinc-600">
          {declineReason ? (
            <p className="whitespace-pre-line">Reason: {declineReason}</p>
          ) : (
            <p>This estimate has been declined.</p>
          )}
        </ZoruCardContent>
      </ZoruCard>
    );
  }

  const handleAccept = () => {
    if (!name.trim()) {
      setBanner({ kind: 'error', message: 'Please enter your full name.' });
      return;
    }
    if (!signatureData) {
      setBanner({ kind: 'error', message: 'Please draw your signature.' });
      return;
    }
    startTransition(async () => {
      const result = await acceptEstimate(hash, signatureData, name);
      setBanner(
        result.success
          ? { kind: 'success', message: result.message || 'Accepted.' }
          : { kind: 'error', message: result.error },
      );
    });
  };

  const handleDecline = () => {
    startTransition(async () => {
      const result = await declineEstimate(hash, reason);
      setBanner(
        result.success
          ? { kind: 'success', message: result.message || 'Declined.' }
          : { kind: 'error', message: result.error },
      );
      if (result.success) setDeclineOpen(false);
    });
  };

  return (
    <ZoruCard>
      <ZoruCardHeader>
        <ZoruCardTitle>Respond to this estimate</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-4">
        {banner ? (
          <ZoruAlert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
            <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
          </ZoruAlert>
        ) : null}

        <div>
          <ZoruLabel htmlFor="signer-name">Your full name</ZoruLabel>
          <ZoruInput
            id="signer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </div>

        <SignaturePad onChange={setSignatureData} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <ZoruButton onClick={handleAccept} disabled={pending}>
            {pending ? 'Submitting…' : 'Accept estimate'}
          </ZoruButton>
          <ZoruButton variant="outline" onClick={() => setDeclineOpen(true)} disabled={pending}>
            Decline
          </ZoruButton>
        </div>

        <ZoruDialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <ZoruDialogContent>
            <ZoruDialogHeader>
              <ZoruDialogTitle>Decline estimate</ZoruDialogTitle>
              <ZoruDialogDescription>
                Optionally let the sender know why.
              </ZoruDialogDescription>
            </ZoruDialogHeader>
            <ZoruTextarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={4}
            />
            <ZoruDialogFooter>
              <ZoruButton variant="ghost" onClick={() => setDeclineOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton variant="destructive" onClick={handleDecline} disabled={pending}>
                {pending ? 'Submitting…' : 'Decline'}
              </ZoruButton>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </ZoruDialog>
      </ZoruCardContent>
    </ZoruCard>
  );
}
