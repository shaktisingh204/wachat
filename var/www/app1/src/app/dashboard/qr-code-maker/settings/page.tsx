

'use client';

import { useEffect, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getSession } from '@/app/actions';
import type { User } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { TagsSettingsTab } from '@/components/wabasimplify/tags-settings-tab';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function SettingsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-2/3 mt-2" /></div>
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export default function QrCodeSettingsPage() {
    const [user, setUser] = useState<(Omit<User, 'password'> & { _id: string, tags?: any[] }) | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        startLoadingTransition(async () => {
            const session = await getSession();
            setUser(session?.user || null);
        });
    }, []);

    if (!isClient || isLoading) {
        return <SettingsPageSkeleton />;
    }

    if (!user) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Not Logged In</AlertTitle>
                <AlertDescription>
                    You need to be logged in to access this page.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8">
             <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/qr-code-maker">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to QR Code Maker
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">QR Code Maker Settings</h1>
                <p className="text-muted-foreground">Manage your tags. Tags can be applied to QR codes and short links to help you organize them.</p>
            </div>
            <TagsSettingsTab user={user} />
        </div>
    )
}
