'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/sabcrm/20ui';
import QRCode from 'react-qr-code';
import { BioLink } from '../types';

type Props = {
  link: BioLink | null;
  onClose: () => void;
};

export function BioQRCode({ link, onClose }: Props) {
  if (!link) return null;

  const url = link.url || 'https://sabnode.com';

  return (
    <Dialog open={!!link} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md flex flex-col items-center">
        <DialogHeader className="w-full text-center sm:text-center">
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Scan this code to visit the link directly.
          </DialogDescription>
        </DialogHeader>

        {/* True white surface + black modules are required for reliable QR
            scanning, independent of the active theme. Intentional non-token color. */}
        <div className="mt-4 rounded-[var(--st-radius)] bg-white p-4">
          <QRCode
            value={url}
            size={200}
            bgColor="#ffffff"
            fgColor="#000000"
            level="Q"
          />
        </div>

        <p className="mt-4 w-full break-all px-4 text-center text-xs text-[var(--st-text-secondary)]">
          {url}
        </p>
      </DialogContent>
    </Dialog>
  );
}
