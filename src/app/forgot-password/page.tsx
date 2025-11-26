
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, LoaderCircle } from 'lucide-react';
import { handleForgotPassword } from '@/app/actions/index.ts';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send Reset Link
        </Button>
    )
}

export default function ForgotPasswordPage() {
  const [state, setState] = useState<any>(initialState);
  const [isPending, startTransition] = useTransition();
  
  const formAction = (formData: FormData) => {
    startTransition(async () => {
        const result = await handleForgotPassword(null, formData);
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
      
        <Card className="w-full max-w-sm shadow-2xl rounded-2xl animate-fade-in-up">
            <form action={formAction}>
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold font-headline">Forgot Your Password?</CardTitle>
                    <CardDescription>Enter your email and we'll send you instructions to reset your password.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
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
                        <Input id="email" name="email" type="email" placeholder="Enter your email" required />
                    </div>
                    <SubmitButton />
                </CardContent>
                <CardFooter className="justify-center">
                    <p className="text-sm text-muted-foreground">
                        <Link href="/login" className="font-semibold text-foreground hover:text-primary">&larr; Back to Sign In</Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
        
        <div className="absolute bottom-6 text-center w-full">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SabNode. All Rights Reserved. | <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></p>
        </div>
    </div>
  );
}
