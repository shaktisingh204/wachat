
'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { handleSignup } from '@/app/actions';
import Image from 'next/image';

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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen bg-foreground p-4 sm:p-6 lg:p-8">
      <div className="w-full h-full max-w-screen-xl mx-auto bg-background rounded-2xl p-6 sm:p-8 lg:p-12 flex flex-col">
        <header className="flex justify-between items-center w-full">
            <SabNodeLogo className="w-24 h-auto" />
             <div className="flex items-center gap-2">
                <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
                <Button asChild><Link href="/request-demo">Request Demo</Link></Button>
             </div>
        </header>

        <main className="flex-1 grid lg:grid-cols-2 items-center gap-8 lg:gap-16 py-8">
            <div className="hidden lg:flex items-center justify-center">
                 <Image src="https://placehold.co/400x400.png" alt="Illustration of a person working on a laptop" width={400} height={400} data-ai-hint="woman laptop illustration line art" />
            </div>
            
            <div className="flex justify-center">
                <Card className="w-full max-w-md shadow-2xl rounded-2xl">
                    <form action={formAction}>
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl font-bold font-headline">Create your Account</CardTitle>
                            <CardDescription>Let's get started with your 30-day free trial.</CardDescription>
                        </CardHeader>
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
                                <Input id="name" name="name" type="text" placeholder="John Doe" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" placeholder="user@example.com" required />
                            </div>
                            <div className="relative space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Create a password" required />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                                <p className="text-xs text-muted-foreground">Must be at least 6 characters long.</p>
                            </div>
                            <SubmitButton />
                        </CardContent>
                         <CardFooter className="justify-center">
                            <p className="text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-semibold text-foreground hover:text-primary">Sign In</Link></p>
                         </CardFooter>
                    </form>
                </Card>
            </div>
        </main>
        
        <footer className="w-full text-center lg:text-left">
            <p className="text-sm text-muted-foreground">Copyright @wework 2022 | <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></p>
        </footer>
      </div>
    </div>
  );
}
