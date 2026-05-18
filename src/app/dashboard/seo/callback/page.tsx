'use client';

import { ZoruCard, useZoruToast } from '@/components/zoruui';
import {
  useEffect,
  useState } from 'react';
import { useSearchParams,
  useRouter } from 'next/navigation';
import { exchangeGscCode } from '@/app/actions/seo-gsc.actions';

import { Loader2 } from 'lucide-react';

export default function SeoCallbackPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useZoruToast();
    const [status, setStatus] = useState('Processing Google Login...');

    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
            setStatus('Error: No code returned from Google.');
            return;
        }

        if (!state) {
            setStatus('Error: No state returned. Cannot identify project.');
            return;
        }

        const handleExchange = async () => {
            try {
                const res = await exchangeGscCode(code, state);
                if (res.success) {
                    toast({ title: 'Google Search Console Connected' });
                    router.push(`/dashboard/seo/${state}/gsc`);
                } else {
                    setStatus('Failed to exchange token: ' + res.error);
                }
            } catch (e: any) {
                setStatus('Error: ' + e.message);
            }
        };

        handleExchange();
    }, [searchParams, router, toast]);

    return (
        <div className="h-screen w-full flex items-center justify-center">
            <ZoruCard className="p-8 flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-zoru-ink" />
                <p className="text-zoru-ink-muted">{status}</p>
            </ZoruCard>
        </div>
    );
}
