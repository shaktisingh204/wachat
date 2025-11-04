
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getSession } from '@/app/actions/index.ts';
import type { User, WithId } from '@/lib/definitions';
import { SmsSettingsForm } from '@/components/wabasimplify/sms-settings-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function SmsSettingsPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const session = await getSession();
            if (session?.user) {
                setUser(session.user);
            }
        });
    }, []);

    if (isLoading) {
        return <Skeleton className="h-64 w-full max-w-2xl" />;
    }

    if (!user) {
        return (
             <Alert variant="destructive" className="max-w-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>
                    Could not load user data. Please try logging in again.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="max-w-2xl">
            <SmsSettingsForm user={user} />
        </div>
    );
}

    