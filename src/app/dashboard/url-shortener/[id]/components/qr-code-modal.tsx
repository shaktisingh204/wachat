'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/sabcrm/20ui';
import { QrCode as QrCodeIcon, Download, Copy } from 'lucide-react';
import { toast } from 'sonner';

export function QrCodeModal({ url }: { url: string }) {
  const [isOpen, setIsOpen] = useState(false);

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
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-[13px]">
          <QrCodeIcon className="h-4 w-4" />
          QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code for Short URL</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 gap-6 bg-[var(--st-hover)] rounded-xl mt-4">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <QRCode
              id="qr-code-svg"
              value={url}
              size={200}
              level="H"
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              viewBox={`0 0 256 256`}
            />
          </div>
          <p className="text-center text-[13px] text-[var(--st-text-secondary)] break-all max-w-full px-4">
            {url}
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={copyToClipboard} className="gap-2">
            <Copy className="h-4 w-4" />
            Copy Link
          </Button>
          <Button onClick={downloadQrCode} className="gap-2">
            <Download className="h-4 w-4" />
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
