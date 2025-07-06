
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
      
        <Card className="w-full max-w-sm shadow-2xl rounded-2xl animate-fade-in-up">
            <form action={formAction}>
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold font-headline">Sign In to your Account</CardTitle>
                    <CardDescription>Welcome back! Please enter your details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6 pb-12">
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
                     <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline">
                            <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.08-2.58 1.98-4.48 1.98-3.79 0-7.17-3.22-7.17-7.22s3.38-7.22 7.17-7.22c2.23 0 3.63.92 4.48 1.75l2.72-2.72C19.62 3.39 16.67 2 12.48 2 7.01 2 2.56 6.18 2.56 12s4.45 10 9.92 10c2.79 0 5.1-1 6.88-2.84 1.92-1.92 2.58-4.75 2.58-7.17 0-.66-.07-1.32-.19-1.98z"/></svg>
                            Google
                        </Button>
                        <Button variant="outline">
                             <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="currentColor" d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.35C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.732 0 1.325-.593 1.325-1.325V1.325C24 .593 23.407 0 22.675 0z"/></svg>
                            Facebook
                        </Button>
                    </div>
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
