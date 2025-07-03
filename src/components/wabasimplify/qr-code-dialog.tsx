
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface QrCodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    url: string | null;
}

export function QrCodeDialog({ open, onOpenChange, url }: QrCodeDialogProps) {
    if (!url) return null;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
    
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = qrApiUrl;
        link.download = `qrcode-${url.split('/').pop()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle>QR Code</DialogTitle>
                    <DialogDescription>
                        Scan this code to open the link: <br />
                        <span className="font-mono text-xs text-primary">{url}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center items-center p-4">
                    <Image
                        src={qrApiUrl}
                        alt={`QR Code for ${url}`}
                        width={250}
                        height={250}
                        data-ai-hint="qr code"
                    />
                </div>
                <Button onClick={handleDownload} className="w-full">Download QR Code</Button>
            </DialogContent>
        </Dialog>
    );
}
