
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { handleLogin } from '@/app/actions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign In
        </Button>
    )
}

export default function LoginPage() {
  const [state, formAction] = useActionState(handleLogin, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-auth-texture p-4 sm:p-6 lg:p-8">
        <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
            <Link href="/">
                <SabNodeLogo className="w-24 h-auto" />
            </Link>
        </div>
      
        <Card className="w-full max-w-md shadow-2xl rounded-2xl animate-fade-in-up">
            <form action={formAction}>
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold font-headline">Sign In to your Account</CardTitle>
                    <CardDescription>Welcome back! Please enter your details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {state?.error && (
                        <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Login Failed</AlertTitle>
                        <AlertDescription>{state.error}</AlertDescription>
                        </Alert>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="email" className="sr-only">Email or Phone</Label>
                        <Input id="email" name="email" type="email" placeholder="Enter Email / Phone No" required />
                    </div>
                    <div className="relative space-y-2">
                        <Label htmlFor="password"className="sr-only">Password</Label>
                        <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Passcode" required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 h-full text-sm font-semibold text-muted-foreground">
                            {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                        </button>
                    </div>
                        <div className="text-right">
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Having trouble signing in?</Link>
                    </div>
                    <SubmitButton />
                </CardContent>
                    <CardFooter className="justify-center">
                    <p className="text-sm text-muted-foreground">Don't have an account? <Link href="/signup" className="font-semibold text-foreground hover:text-primary">Request Now</Link></p>
                    </CardFooter>
            </form>
        </Card>
        
        <div className="absolute bottom-6 text-center w-full">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SabNode. All Rights Reserved. | <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></p>
        </div>
    </div>
  );
}
