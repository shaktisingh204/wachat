'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { exchangeGscCode } from '@/app/actions/seo-gsc.actions';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function SeoCallbackPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState("Processing Google Login...");

    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // Check if this is passed as projectId

        if (!code) {
            setStatus("Error: No code returned from Google.");
            return;
        }

        // In our GscClient.getAuthUrl, we passed 'projectId' as state.
        // If not checking state integrity for now, just assume it's projectId.
        // Note: Real prod should use session cookie for state validation too.

        if (!state) {
            setStatus("Error: No state returned. Cannot identify project.");
            return;
        }

        const handleExchange = async () => {
            try {
                const res = await exchangeGscCode(code, state);
                if (res.success) {
                    toast({ title: "Google Search Console Connected" });
                    router.push(`/dashboard/seo/${state}/gsc`);
                } else {
                    setStatus("Failed to exchange token: " + res.error);
                }
            } catch (e: any) {
                setStatus("Error: " + e.message);
            }
        };

        handleExchange();

    }, [searchParams, router]);

    return (
        <div className="h-screen w-full flex items-center justify-center p-4">
            <Card className="p-8 flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">{status}</p>
            </Card>
        </div>
    );
}
