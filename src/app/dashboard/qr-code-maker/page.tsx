

'use client';

import { QrCodeGenerator } from '@/components/wabasimplify/qr-code-generator';
import { getSession } from '@/app/actions/index.ts';
import { getQrCodes } from '@/app/actions/qr-code.actions';
import { SavedQrCodes } from '@/components/wabasimplify/saved-qr-codes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

export default function QrCodeMakerPage() {
    const [session, setSession] = useState<any>(null);
    const [qrCodes, setQrCodes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const sessionData = await getSession();
            if (sessionData?.user) {
                const plainSession = JSON.parse(JSON.stringify(sessionData));
                setSession(plainSession);
                const codes = await getQrCodes();
                setQrCodes(codes);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);
    
    if (isLoading) {
        return <div>Loading...</div>; // Or a proper skeleton
    }

    if (!session?.user) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>You must be logged in to access this page.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <QrCodeGenerator user={session.user} />
            <SavedQrCodes initialQrCodes={qrCodes} />
        </div>
    );
}
