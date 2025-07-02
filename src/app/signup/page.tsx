
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WachatLogo } from '@/components/wabasimplify/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { handleSignup } from '@/app/actions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Account
        </Button>
    )
}

export default function SignupPage() {
  const [state, formAction] = useActionState(handleSignup, initialState);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <WachatLogo className="w-48 h-auto" />
        </div>
        <Card className="card-gradient card-gradient-green">
          <CardHeader>
            <CardTitle>Create an Account</CardTitle>
            <CardDescription>Enter your details to get started.</CardDescription>
          </CardHeader>
          <form action={formAction}>
            <CardContent className="space-y-4">
                {state?.error && (
                    <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Signup Failed</AlertTitle>
                    <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                )}
                 <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                    id="name" 
                    name="name"
                    type="text" 
                    placeholder="John Doe" 
                    required 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                    id="email" 
                    name="email"
                    type="email" 
                    placeholder="user@example.com" 
                    required 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                    id="password" 
                    name="password"
                    type="password" 
                    required 
                    />
                    <p className="text-xs text-muted-foreground">Must be at least 6 characters long.</p>
                </div>
                <SubmitButton />
            </CardContent>
          </form>
          <CardFooter className="justify-center">
              <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary hover:underline">
                      Sign In
                  </Link>
              </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
