
'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function FacebookCallbackHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    const [error, setError] = useState<string | null>(null);
    const [isProcessing, startTransition] = useTransition();

    useEffect(() => {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error_description');

        if (errorParam) {
            setError(errorParam);
            return;
        }

        if (code) {
            startTransition(async () => {
                const result = await handleWabaOnboarding(code);

                if (result.error) {
                    setError(result.error);
                    toast({
                        title: 'Onboarding Failed',
                        description: result.error,
                        variant: 'destructive',
                        duration: 10000,
                    });
                } else {
                    toast({
                        title: 'Onboarding Complete',
                        description: result.message,
                    });
                    router.push('/dashboard');
                }
            });
        } else {
            const err = 'No authorization code received from Meta. The setup was likely cancelled.';
            setError(err);
        }
    }, [searchParams, router, toast]);

    if (error) {
        return (
             <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-destructive text-destructive-foreground rounded-full h-12 w-12 flex items-center justify-center">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <CardTitle className="mt-4">Onboarding Failed</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>
                       {error}
                    </CardDescription>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button asChild>
                        <Link href="/dashboard/setup">Try Again</Link>
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    
    return (
        <div className="flex flex-col items-center justify-center text-center">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg font-semibold text-muted-foreground">
                Finalizing connection, please wait...
            </p>
             <p className="mt-2 text-sm text-muted-foreground">
                This may take a moment. Do not close this window.
            </p>
        </div>
    );
}

export default function FacebookCallbackPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
            <Suspense fallback={
                 <div className="flex flex-col items-center justify-center text-center">
                    <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-lg font-semibold text-muted-foreground">Loading...</p>
                </div>
            }>
                <FacebookCallbackHandler />
            </Suspense>
        </div>
    );
}
