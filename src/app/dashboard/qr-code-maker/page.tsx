
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
                    Generate QR codes to launch WhatsApp conversations or link to your website.
                </p>
            </div>
            <QrCodeGenerator />
        </div>
    );
}
