'use client';

import { ZoruAlert, ZoruAlertDescription, ZoruAlertTitle, ZoruButton, ZoruSkeleton } from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { getSession } from '@/app/actions/index.ts';
import type { User } from '@/lib/definitions';
import { AlertCircle,
  ChevronLeft } from 'lucide-react';
import { TagsSettingsTab } from '@/components/wabasimplify/tags-settings-tab';
import Link from 'next/link';

function SettingsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div><ZoruSkeleton className="h-8 w-1/3" /><ZoruSkeleton className="h-4 w-2/3 mt-2" /></div>
            <ZoruSkeleton className="h-96 w-full" />
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
            <ZoruAlert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Not Logged In</ZoruAlertTitle>
                <ZoruAlertDescription>
                    You need to be logged in to access this page.
                </ZoruAlertDescription>
            </ZoruAlert>
        );
    }

    return (
        <div className="flex flex-col gap-8">
             <div>
                <ZoruButton variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/qr-code-maker">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to QR Code Maker
                    </Link>
                </ZoruButton>
                <h1 className="text-3xl text-zoru-ink">QR Code Maker Settings</h1>
                <p className="text-zoru-ink-muted">Manage your tags. Tags can be applied to QR codes and short links to help you organize them.</p>
            </div>
            <TagsSettingsTab user={user} />
        </div>
    )
}
