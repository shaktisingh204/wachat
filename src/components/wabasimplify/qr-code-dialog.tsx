
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
import { Download } from 'lucide-react';
import { QrCodeRenderer } from './qr-code-renderer';
import { downloadQrCode, normalizeHex } from '@/lib/qr-utils';

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

    const handleDownload = async () => {
        const svg = qrCodeRef.current?.querySelector('svg');
        if (svg) {
            await downloadQrCode(svg, {
                filename: 'qrcode',
                format: 'png',
                bgColor: config?.bgColor,
                logoDataUri,
                size: 256
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xs max-h-[85vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>QR Code</DialogTitle>
                    <DialogDescription>
                        Scan this code with your device.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-2">
                    <div ref={qrCodeRef} className="flex justify-center items-center p-4 bg-white rounded-lg">
                        <QrCodeRenderer
                            value={dataString}
                            size={256}
                            fgColor={normalizeHex(config?.color || '000000')}
                            bgColor={normalizeHex(config?.bgColor || 'FFFFFF')}
                            level={(config?.eccLevel as any) || 'L'}
                            logoDataUri={logoDataUri}
                        />
                    </div>
                </div>
                <div className="px-6 pb-6 pt-2">
                    <Button onClick={handleDownload} className="w-full">
                        <Download className="mr-2 h-4 w-4" />
                        Download QR Code
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
