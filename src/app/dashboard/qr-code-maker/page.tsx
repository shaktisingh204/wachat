

import { QrCodeGenerator } from '@/components/wabasimplify/qr-code-generator';
import { getSession } from '@/lib/auth';
import { getQrCodes } from '@/app/actions/qr-code.actions';
import { SavedQrCodes } from '@/components/wabasimplify/saved-qr-codes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function QrCodeMakerPage() {
    const session = await getSession();
    if (!session?.user) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>You must be logged in to access this page.</AlertDescription>
            </Alert>
        );
    }
    
    const qrCodes = await getQrCodes();

    return (
        <div className="flex flex-col gap-8">
            <QrCodeGenerator user={session.user} />
            <SavedQrCodes initialQrCodes={qrCodes} />
        </div>
    );
}
