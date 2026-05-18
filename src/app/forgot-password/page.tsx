
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { ZoruButton, ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent, ZoruCardDescription, ZoruCardFooter, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { ZoruAlert, ZoruAlertDescription, ZoruAlertTitle } from '@/components/zoruui';
import { AlertCircle, CheckCircle, LoaderCircle } from 'lucide-react';
import { handleForgotPassword } from '@/app/actions/user.actions';

const initialState = {
    message: null,
    error: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send Reset Link
        </ZoruButton>
    )
}

export default function ForgotPasswordPage() {
    const [state, setState] = useState<any>(initialState);
    const [isPending, startTransition] = useTransition();

    const formAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await handleForgotPassword(null as any, formData);
            setState(result);
        });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-auth-texture p-4 sm:p-6 lg:p-8">
            <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
                <Link href="/">
                    <SabNodeLogo className="w-24 h-auto" />
                </Link>
            </div>

            <ZoruCard className="w-full max-w-sm shadow-2xl rounded-2xl animate-fade-in-up">
                <form action={formAction}>
                    <ZoruCardHeader className="text-center">
                        <ZoruCardTitle className="text-2xl font-bold font-headline">Forgot Your Password?</ZoruCardTitle>
                        <ZoruCardDescription>Enter your email and we'll send you instructions to reset your password.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-6 p-6">
                        {state?.error && (
                            <ZoruAlert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <ZoruAlertTitle>Error</ZoruAlertTitle>
                                <ZoruAlertDescription>{state.error}</ZoruAlertDescription>
                            </ZoruAlert>
                        )}
                        {state?.message && (
                            <ZoruAlert>
                                <CheckCircle className="h-4 w-4" />
                                <ZoruAlertTitle>Check Your Email</ZoruAlertTitle>
                                <ZoruAlertDescription>{state.message}</ZoruAlertDescription>
                            </ZoruAlert>
                        )}
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="email" className="sr-only">Email</ZoruLabel>
                            <ZoruInput id="email" name="email" type="email" placeholder="Enter your email" required />
                        </div>
                        <SubmitButton />
                    </ZoruCardContent>
                    <ZoruCardFooter className="justify-center">
                        <p className="text-sm text-muted-foreground">
                            <Link href="/login" className="font-semibold text-foreground hover:text-primary">&larr; Back to Sign In</Link>
                        </p>
                    </ZoruCardFooter>
                </form>
            </ZoruCard>

            <div className="absolute bottom-6 text-center w-full">
                <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SabNode. All Rights Reserved. | <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></p>
            </div>
        </div>
    );
}
