
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { handleFacebookOAuthCallback } from '@/app/actions/facebook.actions';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getProjectById } from '@/app/actions';

function FacebookCallbackComponent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState('Connecting your account, please wait...');

    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state') || 'facebook';
        const errorParam = searchParams.get('error_description');

        if (errorParam) {
            setError(errorParam);
            return;
        }

        if (code) {
            handleFacebookOAuthCallback(code, state)
                .then(result => {
                    if (result.success && result.redirectPath) {
                        setMessage('Connection successful! Syncing data and redirecting...');
                        router.push(result.redirectPath);
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
    
    const isConfigError = error?.includes('Server is not configured');

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                 <Card className="w-full max-w-lg">
                    <CardHeader className="text-center">
                        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                        <CardTitle className="mt-4">Connection Failed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isConfigError ? (
                            <div className="space-y-4 text-left">
                                <p className="text-destructive font-semibold text-center">The server is not configured correctly for this type of authentication.</p>
                                <p className="text-sm text-muted-foreground">To fix this, you must create a <code>.env.local</code> file in the root directory of the project and add the correct App credentials.</p>
                                <div className="p-4 bg-muted rounded-md text-sm font-mono overflow-x-auto">
                                    <pre><code>
                                        # .env.local (create this file in the root of your project)
                                        {"\n\n"}
                                        NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
                                        {"\n"}
                                        FACEBOOK_APP_SECRET=your_facebook_app_secret
                                        {"\n"}
                                        NEXT_PUBLIC_INSTAGRAM_APP_ID=your_instagram_app_id
                                        {"\n"}
                                        INSTAGRAM_APP_SECRET=your_instagram_app_secret
                                        {"\n"}
                                        NEXT_PUBLIC_META_ONBOARDING_APP_ID=your_whatsapp_onboarding_app_id
                                        {"\n"}
                                        META_ONBOARDING_APP_SECRET=your_whatsapp_onboarding_app_secret
                                        {"\n\n"}
                                        # Add other required variables from README.md
                                    </code></pre>
                                </div>
                                <p className="text-sm text-muted-foreground">After creating and saving the file, you must **restart the application** for the changes to take effect.</p>
                            </div>
                        ) : (
                            <CardDescription className="text-center">
                                {error}
                            </CardDescription>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button asChild variant="outline">
                            <Link href="/dashboard">Go Back</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
             <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-primary" />
                    <CardTitle className="mt-4">Connecting...</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription className="text-center">
                        {message}
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
