
'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { handleAdminLogin } from '@/app/actions/admin.actions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const initialState = {
  success: false,
  error: undefined,
  token: undefined,
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={isPending}>
      {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Sign In to Admin Panel
    </Button>
  );
}

function setCookie(name: string, value: string, days: number) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

export default function AdminLoginPage() {
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const formAction = (formData: FormData) => {
    startTransition(async () => {
        const result = await handleAdminLogin(initialState, formData);
        setState(result);
    });
  };

  useEffect(() => {
    if (state.success && state.token) {
        setCookie('admin_session', state.token, 1);
        toast({ title: 'Login Successful!' });
        router.push('/admin/dashboard');
    } else if (state.error) {
        toast({ title: 'Login Failed', description: state.error, variant: 'destructive' });
    }
  }, [state, router, toast]);

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
                    <CardTitle className="text-2xl font-bold font-headline">Admin Panel Login</CardTitle>
                    <CardDescription>Enter your administrator credentials.</CardDescription>
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
                        <Label htmlFor="email" className="sr-only">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="Enter Admin Email" required />
                    </div>
                    <div className="relative space-y-2">
                        <Label htmlFor="password" className="sr-only">Password</Label>
                        <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter Admin Password" required />
                         <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 h-full text-sm font-semibold text-muted-foreground">
                            {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                        </button>
                    </div>
                    <SubmitButton isPending={isPending} />
                </CardContent>
            </form>
        </Card>
        
        <div className="absolute bottom-6 text-center w-full">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SabNode. All Rights Reserved. | <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></p>
        </div>
    </div>
  );
}
