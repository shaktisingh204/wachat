
'use client';

import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import QRCode from 'react-qr-code';
import { Download } from 'lucide-react';

interface QrCodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dataString: string | null;
    config?: { color: string; bgColor: string; eccLevel: string };
    logoDataUri?: string;
}

export function QrCodeDialog({ open, onOpenChange, dataString, config, logoDataUri }: QrCodeDialogProps) {
    const qrCodeRef = useRef<HTMLDivElement>(null);
    if (!dataString) return null;

    const handleDownload = () => {
        const svg = qrCodeRef.current?.querySelector('svg');
        if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement("canvas");
            // To ensure high quality, render at a larger size
            const scale = 3;
            const svgSize = svg.getBoundingClientRect();
            canvas.width = svgSize.width * scale;
            canvas.height = svgSize.height * scale;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            
            // Fill background
            ctx.fillStyle = `#${config?.bgColor || 'FFFFFF'}`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngFile = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.download = "qrcode.png";
                downloadLink.href = pngFile;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            };
            img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle>QR Code</DialogTitle>
                    <DialogDescription>
                        Scan this code with your device.
                    </DialogDescription>
                </DialogHeader>
                <div ref={qrCodeRef} className="flex justify-center items-center p-4 bg-white rounded-lg">
                    <QRCode
                        value={dataString}
                        size={256}
                        fgColor={`#${config?.color || '000000'}`}
                        bgColor={`#${config?.bgColor || 'FFFFFF'}`}
                        level={(config?.eccLevel as any) || 'L'}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        {...(logoDataUri && {
                            imageSettings: {
                                src: logoDataUri,
                                height: 40,
                                width: 40,
                                excavate: true,
                            },
                        })}
                    />
                </div>
                <Button onClick={handleDownload} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Download QR Code
                </Button>
            </DialogContent>
        </Dialog>
    );
}
