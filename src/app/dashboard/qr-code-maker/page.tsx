
'use client';

import { QrCodeGenerator } from '@/components/wabasimplify/qr-code-generator';
import { QrCode } from 'lucide-react';

export default function QrCodeMakerPage() {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <QrCode className="h-8 w-8"/>
                    QR Code Maker
                </h1>
                <p className="text-muted-foreground mt-2">
                    Create and customize QR codes for URLs, text, Wi-Fi credentials, and more.
                </p>
            </div>
            <QrCodeGenerator />
        </div>
    );
}
