'use client';

/**
 * Estimate accept / decline panel. Renders the signature pad +
 * name input for "Accept" and a reason textarea modal for "Decline".
 * Once a terminal status is reached the panel becomes read-only and
 * shows the recorded signature image (if accepted).
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
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
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
  invoiceHash?: string | null;
};

export function EstimateActionsPanel({ hash, status, signature, declineReason, invoiceHash }: Props) {
  const [name, setName] = React.useState('');
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [actionInvoiceHash, setActionInvoiceHash] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [pending, startTransition] = React.useTransition();

  const effectiveInvoiceHash = actionInvoiceHash || invoiceHash;

  if (status === 'accepted') {
    return (
      <Card>
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
                  className="h-20 rounded-md border border-[var(--st-border)] bg-white"
                />
              ) : null}
            </>
          ) : (
            <p>This estimate has been accepted.</p>
          )}
          {effectiveInvoiceHash ? (
            <div className="mt-4 pt-4 border-t border-[var(--st-border)]">
              <Button asChild>
                <a href={`/share/invoice/${effectiveInvoiceHash}`}>
                  Pay Advance / Deposit
                </a>
              </Button>
            </div>
          ) : null}
        </ZoruCardContent>
      </Card>
    );
  }

  if (status === 'declined') {
    return (
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Estimate declined</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-2 text-sm text-[var(--st-text)]">
          {declineReason ? (
            <p className="whitespace-pre-line">Reason: {declineReason}</p>
          ) : (
            <p>This estimate has been declined.</p>
          )}
        </ZoruCardContent>
      </Card>
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
      if (result.success && 'invoiceHash' in result && result.invoiceHash) {
        setActionInvoiceHash(result.invoiceHash);
      }
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
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Respond to this estimate</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-4">
        {banner ? (
          <Alert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
            <ZoruAlertDescription>{banner.message}</ZoruAlertDescription>
          </Alert>
        ) : null}

        <div>
          <Label htmlFor="signer-name">Your full name</Label>
          <Input
            id="signer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </div>

        {!actionInvoiceHash ? <SignaturePad onChange={setSignatureData} /> : null}

        {!actionInvoiceHash ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleAccept} disabled={pending}>
              {pending ? 'Submitting…' : 'Accept estimate'}
            </Button>
            <Button variant="outline" onClick={() => setDeclineOpen(true)} disabled={pending}>
              Decline
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <a href={`/share/invoice/${actionInvoiceHash}`}>
                Pay Advance / Deposit
              </a>
            </Button>
          </div>
        )}

        <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <ZoruDialogContent>
            <ZoruDialogHeader>
              <ZoruDialogTitle>Decline estimate</ZoruDialogTitle>
              <ZoruDialogDescription>
                Optionally let the sender know why.
              </ZoruDialogDescription>
            </ZoruDialogHeader>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={4}
            />
            <ZoruDialogFooter>
              <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDecline} disabled={pending}>
                {pending ? 'Submitting…' : 'Decline'}
              </Button>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </Dialog>
      </ZoruCardContent>
    </Card>
  );
}
