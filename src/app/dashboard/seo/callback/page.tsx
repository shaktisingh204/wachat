'use client';

import { Card, useToast } from '@/components/sabcrm/20ui/compat';
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
    const { toast } = useToast();
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
            } catch (e: unknown) {
                if (e instanceof Error) {
                    setStatus('Error: ' + e.message);
                } else {
                    setStatus('Error: An unknown error occurred.');
                }
            }
        };

        handleExchange();
    }, [searchParams, router, toast]);

    return (
        <div className="h-screen w-full flex items-center justify-center">
            <Card className="p-8 flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--st-text)]" />
                <p className="text-[var(--st-text-secondary)]">{status}</p>
            </Card>
        </div>
    );
}
