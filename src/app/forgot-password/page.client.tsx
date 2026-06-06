'use client';

import { Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label, Alert, AlertDescription, AlertTitle, Skeleton } from '@/components/sabcrm/20ui';
import {
  useState,
  useEffect,
  useTransition,
} from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { SabNodeLogo } from '@/components/zoruui-domain/logo';

import { AlertCircle, CheckCircle, LoaderCircle } from 'lucide-react';
import { handleForgotPassword } from '@/app/actions/user.actions';

export interface ForgotPasswordState {
    message?: string | null;
    error?: string | null;
}

const initialState: ForgotPasswordState = {
    message: null,
    error: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {pending ? 'Sending...' : 'Send Reset Link'}
        </Button>
    );
}

function ForgotPasswordForm() {
    const [state, setState] = useState<ForgotPasswordState>(initialState);
    const [isPending, startTransition] = useTransition();

    const formAction = (formData: FormData) => {
        startTransition(async () => {
            try {
                const email = formData.get('email');
                if (!email) {
                    setState({ error: 'Email is required.' });
                    return;
                }
                const result = await handleForgotPassword(initialState, formData);
                setState(result);
            } catch (err: any) {
                setState({ error: err?.message || 'An unexpected error occurred.' });
            }
        });
    };

    return (
        <form action={formAction}>
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold font-headline">Forgot Your Password?</CardTitle>
                <CardDescription>Enter your email and we'll send you instructions to reset your password.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-6 p-6">
                {state?.error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                )}
                {state?.message && (
                    <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Check Your Email</AlertTitle>
                        <AlertDescription>{state.message}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-2">
                    <Label htmlFor="email" className="sr-only">Email</Label>
                    <Input 
                        id="email" 
                        name="email" 
                        type="email" 
                        placeholder="Enter your email" 
                        required 
                        disabled={isPending}
                        aria-describedby="email-error"
                    />
                </div>
                <SubmitButton />
            </CardBody>
            <CardFooter className="justify-center">
                <p className="text-sm text-[var(--st-text-secondary)]">
                    <Link href="/login" className="font-semibold text-[var(--st-text)] hover:text-[var(--st-text)]">&larr; Back to Sign In</Link>
                </p>
            </CardFooter>
        </form>
    );
}

function Footer() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="absolute bottom-6 text-center w-full flex justify-center">
                <Skeleton className="h-4 w-64" />
            </div>
        );
    }

    return (
        <div className="absolute bottom-6 text-center w-full">
            <p className="text-xs text-[var(--st-text-secondary)]">
                © {new Date().getFullYear()} SabNode. All Rights Reserved. | <Link href="/privacy-policy" className="hover:text-[var(--st-text)]">Privacy Policy</Link>
            </p>
        </div>
    );
}

export default function ForgotPasswordPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--st-bg)] p-4 sm:p-6 lg:p-8">
            <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
                <Link href="/">
                    <SabNodeLogo className="w-24 h-auto" />
                </Link>
            </div>

            <Card className="w-full max-w-sm shadow-2xl rounded-2xl animate-fade-in-up">
                <ForgotPasswordForm />
            </Card>

            <Footer />
        </div>
    );
}
