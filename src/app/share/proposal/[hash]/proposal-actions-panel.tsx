'use client';

/**
 * Proposal accept / decline panel. Same shape as the estimate panel
 * but bound to the proposal server actions.
 */

import * as React from 'react';
import { Alert, AlertDescription, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from '@/components/sabcrm/20ui';
import { SignaturePad } from '@/components/share/signature-pad';
import {
  acceptProposal,
  declineProposal,
} from '@/app/actions/public-proposal.actions';

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

export function ProposalActionsPanel({ hash, status, signature, declineReason }: Props) {
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
      <Card>
        <CardHeader>
          <CardTitle>Proposal accepted</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
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
            <p>This proposal has been accepted.</p>
          )}
        </CardBody>
      </Card>
    );
  }

  if (status === 'declined') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proposal declined</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-[var(--st-text)]">
          {declineReason ? (
            <p className="whitespace-pre-line">Reason: {declineReason}</p>
          ) : (
            <p>This proposal has been declined.</p>
          )}
        </CardBody>
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
      const result = await acceptProposal(hash, signatureData, name);
      setBanner(
        result.success
          ? { kind: 'success', message: result.message || 'Accepted.' }
          : { kind: 'error', message: result.error },
      );
    });
  };

  const handleDecline = () => {
    startTransition(async () => {
      const result = await declineProposal(hash, reason);
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
      <CardHeader>
        <CardTitle>Respond to this proposal</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {banner ? (
          <Alert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
            <AlertDescription>{banner.message}</AlertDescription>
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

        <SignaturePad onChange={setSignatureData} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleAccept} disabled={pending}>
            {pending ? 'Submitting…' : 'Accept proposal'}
          </Button>
          <Button variant="outline" onClick={() => setDeclineOpen(true)} disabled={pending}>
            Decline
          </Button>
        </div>

        <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline proposal</DialogTitle>
              <DialogDescription>
                Optionally let the sender know why.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={4}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDecline} disabled={pending}>
                {pending ? 'Submitting…' : 'Decline'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardBody>
    </Card>
  );
}
