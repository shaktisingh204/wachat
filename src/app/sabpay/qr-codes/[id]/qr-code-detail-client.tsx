'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import QRCode from 'react-qr-code';

import { Button, toast } from '@/components/sabcrm/20ui';

import { closeSabpayQrCode } from '../../actions/qr-codes';
import { ConfirmAction } from '../../_components/confirm-action';
import { CopyableId } from '../../_components/copyable-id';

/** Scannable preview of the QR's payload URL, with a copy control beneath. */
export function QrCodePreview({ value }: { value: string }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        padding: '6px 0',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--st-border)',
          display: 'inline-flex',
        }}
      >
        <QRCode value={value} size={208} />
      </div>
      <CopyableId value={value} />
    </div>
  );
}

/**
 * "Close QR" header action for the QR-code detail page. Renders nothing once
 * the code is already closed.
 */
export function QrCodeCloseAction({
  id,
  status,
}: {
  id: string;
  status: string;
}): React.JSX.Element | null {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  if (status !== 'active') return null;

  async function handleConfirm() {
    const result = await closeSabpayQrCode(id);
    if (result.error || !result.qrCode) {
      const message = result.error || 'Could not close the QR code.';
      toast({ title: 'Close failed', description: message, tone: 'danger' });
      throw new Error(message);
    }
    toast({ title: 'QR code closed', tone: 'success' });
    router.refresh();
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        iconLeft={<XCircle size={14} />}
        onClick={() => setOpen(true)}
      >
        Close QR
      </Button>
      <ConfirmAction
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Close this QR code?"
        description={`${id} will stop accepting payments immediately. This cannot be undone.`}
        confirmLabel="Close QR"
      />
    </>
  );
}
