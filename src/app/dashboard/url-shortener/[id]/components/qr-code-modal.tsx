'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  useToast,
} from '@/components/sabcrm/20ui';
import { QrCode as QrCodeIcon, Download, Copy } from 'lucide-react';

export function QrCodeModal({ url }: { url: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const downloadQrCode = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = 'qrcode.png';
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button variant="outline" size="sm" iconLeft={QrCodeIcon} onClick={() => setIsOpen(true)}>
        QR code
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR code for this link</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex flex-col items-center justify-center gap-6 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-6">
          <div className="rounded-[var(--st-radius)] bg-white p-4 shadow-[var(--st-shadow-sm)]">
            <QRCode
              id="qr-code-svg"
              value={url}
              size={200}
              level="H"
              className="h-auto w-full max-w-full"
              viewBox="0 0 256 256"
            />
          </div>
          <p className="max-w-full break-all px-4 text-center text-[13px] text-[var(--st-text-secondary)]">
            {url}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" iconLeft={Copy} onClick={copyToClipboard}>
            Copy link
          </Button>
          <Button variant="primary" iconLeft={Download} onClick={downloadQrCode}>
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
