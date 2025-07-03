
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Download, QrCode } from 'lucide-react';

export function QrCodeGenerator() {
    const [inputValue, setInputValue] = useState('https://wabasimplify.com');
    
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(inputValue)}`;

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = qrApiUrl;
        link.download = `qrcode.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card className="card-gradient card-gradient-green">
            <CardHeader>
                <CardTitle>Generate a QR Code</CardTitle>
                <CardDescription>Enter any text or URL to create a scannable QR code.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="qr-input">Text or URL</Label>
                            <Textarea
                                id="qr-input"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Enter text or a URL..."
                                className="h-32"
                            />
                        </div>
                        <Button onClick={handleDownload} disabled={!inputValue.trim()}>
                            <Download className="mr-2 h-4 w-4" />
                            Download QR Code
                        </Button>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg aspect-square w-full max-w-xs mx-auto">
                        {inputValue.trim() ? (
                            <Image
                                src={qrApiUrl}
                                alt="Generated QR Code"
                                width={250}
                                height={250}
                                data-ai-hint="qr code"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground text-center gap-2">
                                <QrCode className="h-16 w-16"/>
                                <p>QR code will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
