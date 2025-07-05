
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { handleFacebookOAuthCallback } from '@/app/actions/facebook.actions';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function FacebookCallbackComponent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState('Connecting your Facebook account, please wait...');

    useEffect(() => {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error_description');

        if (errorParam) {
            setError(errorParam);
            return;
        }

        if (code) {
            handleFacebookOAuthCallback(code)
                .then(result => {
                    if (result.success) {
                        setMessage('Connection successful! Redirecting to your dashboard...');
                        router.push('/dashboard/facebook/all-projects');
                        router.refresh();
                    } else {
                        setError(result.error || 'An unknown error occurred during connection.');
                    }
                })
                .catch(err => {
                    setError('A server error occurred. Please try again.');
                });
        } else {
             setError('No authorization code was provided by Facebook. Please try connecting again.');
        }

    }, [searchParams, router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
             <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    {error ? <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> : <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-primary" />}
                    <CardTitle className="mt-4">{error ? 'Connection Failed' : 'Connecting...'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription className="text-center">
                        {error || message}
                    </CardDescription>
                </CardContent>
            </Card>
        </div>
    );
}


export default function FacebookCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <FacebookCallbackComponent />
        </Suspense>
    );
}
