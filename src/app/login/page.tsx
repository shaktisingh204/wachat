
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
import { AlertCircle, ArrowRight, Eye, EyeOff, Facebook, Globe, LoaderCircle } from 'lucide-react';
import { handleLogin } from '@/app/actions';
import Image from 'next/image';

const initialState = {
  message: null,
  error: null,
};

const AppleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12.152 6.896c-.948 0-1.896.502-2.844.502-1.01 0-1.959-.533-2.908-.533-1.864 0-3.413 1.078-4.33 2.711-.948 1.664-.564 4.108.433 5.567.948 1.428 2.022 2.844 3.444 2.844.948 0 1.896-.502 2.844-.502 1.01 0 1.959.533 2.908.533 1.864 0 3.413-1.078 4.33-2.711.948-1.664.564-4.108-.433-5.567-.917-1.397-1.96-2.813-3.35-2.813a1.42 1.42 0 0 0-.107.001zm.148-3.021a3.413 3.413 0 0 1 2.482-1.01c.031 0 .062.004.093.004a3.36 3.36 0 0 0-2.544 1.272 3.32 3.32 0 0 0-2.511-1.272c-1.139 0-2.247.604-2.876 1.597a4.91 4.91 0 0 0 2.682 1.043c.948 0 1.896-.533 2.844-.533.093 0 .186.004.275.008a3.32 3.32 0 0 1-.004-.008z"/>
    </svg>
);


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
    <div className="flex items-center justify-center min-h-screen bg-foreground p-4 sm:p-6 lg:p-8">
      <div className="w-full h-full max-w-screen-xl mx-auto bg-background rounded-2xl p-6 sm:p-8 lg:p-12 flex flex-col">
        <header className="flex justify-between items-center w-full">
            <SabNodeLogo className="w-24 h-auto" />
             <div className="flex items-center gap-2">
                <Button variant="ghost" asChild><Link href="/signup">Sign up</Link></Button>
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
                            <CardTitle className="text-2xl font-bold font-headline">Agent Login</CardTitle>
                            <CardDescription>Hey, Enter your details to get sign in to your account</CardDescription>
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
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                             <div className="text-right">
                                <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Having trouble in sign in?</Link>
                            </div>
                            <SubmitButton />
                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or Sign in with</span></div>
                            </div>
                             <div className="grid grid-cols-3 gap-3">
                                <Button variant="outline"><Globe className="mr-2 h-4 w-4"/> Google</Button>
                                <Button variant="outline"><AppleIcon className="mr-2 h-4 w-4 fill-current"/> Apple ID</Button>
                                <Button variant="outline"><Facebook className="mr-2 h-4 w-4"/> Facebook</Button>
                            </div>
                        </CardContent>
                         <CardFooter className="justify-center">
                            <p className="text-sm text-muted-foreground">Don't have an account? <Link href="/signup" className="font-semibold text-foreground hover:text-primary">Request Now</Link></p>
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
