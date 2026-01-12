
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff, LoaderCircle, MapPin } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

function SubmitButton({ isPending, disabled }: { isPending: boolean; disabled: boolean }) {
    return (
        <Button type="submit" className="w-full" disabled={isPending || disabled}>
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign In
        </Button>
    )
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const [error, setError] = React.useState<string | null>(errorParam);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const [locationPermission, setLocationPermission] = React.useState<'pending' | 'granted' | 'denied'>('pending');
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
            setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            });
            setLocationPermission('granted');
        },
        () => {
            setLocationPermission('denied');
            setError("Location access is required to sign in. Please enable it in your browser settings and refresh the page.");
        }
      );
    } else {
      setLocationPermission('denied');
      setError("Geolocation is not supported by this browser.");
    }
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    
    if (locationPermission !== 'granted' || !location) {
        setError("Location access is required to sign in. Please enable it in your browser settings and refresh the page.");
        return;
    }

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    startTransition(async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await userCredential.user.getIdToken();

            const response = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${idToken}` },
                 body: JSON.stringify({ 
                    location: {
                        type: 'Point',
                        coordinates: [location.longitude, location.latitude]
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Session creation failed: ${errorBody}`);
            }

            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        }
    });
  };
  
   const handleSocialLogin = async (provider: 'google' | 'facebook') => {
      if (locationPermission !== 'granted' || !location) {
          setError("Location access is required to sign in. Please enable it in your browser settings and refresh the page.");
          return;
      }
      const authProvider = provider === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      startTransition(async () => {
          try {
              const result = await signInWithPopup(auth, authProvider);
              const idToken = await result.user.getIdToken();
              const name = result.user.displayName;
              
              const response = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${idToken}` },
                 body: JSON.stringify({ 
                    name: name,
                    location: {
                        type: 'Point',
                        coordinates: [location.longitude, location.latitude]
                    }
                 })
              });

              if (!response.ok) {
                 const errorBody = await response.text();
                 throw new Error(`Session creation failed (social): ${errorBody}`);
              }
              
              router.push('/dashboard');
          } catch(err: any) {
              setError(err.message || 'An unknown error occurred during social login.');
          }
      });
  }

  const isLoginDisabled = locationPermission !== 'granted';

  return (
    <Card className="w-full max-w-sm shadow-2xl rounded-2xl animate-fade-in-up relative overflow-hidden">
        <form onSubmit={handleLogin}>
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold font-headline">Sign In to your Account</CardTitle>
                <CardDescription>Welcome back! Please enter your details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
                {error && (
                    <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Login Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                 {locationPermission === 'denied' && !error && (
                    <Alert variant="destructive">
                        <MapPin className="h-4 w-4" />
                        <AlertTitle>Location Access Required</AlertTitle>
                        <AlertDescription>
                            Please enable location services in your browser to continue.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="space-y-2">
                    <Label htmlFor="email" className="sr-only">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="Enter your email" required />
                </div>
                <div className="relative space-y-2">
                    <Label htmlFor="password"className="sr-only">Password</Label>
                    <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Passcode" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 h-full text-sm font-semibold text-muted-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </button>
                </div>
                    <div className="text-right">
                    <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary">Having trouble signing in?</Link>
                </div>
                <SubmitButton isPending={isPending} disabled={isLoginDisabled} />
                 <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" type="button" onClick={() => handleSocialLogin('google')} disabled={isPending || isLoginDisabled}>
                        <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.08-2.58 1.98-4.48 1.98-3.79 0-7.17-3.22-7.17-7.22s3.38-7.22 7.17-7.22c2.23 0 3.63.92 4.48 1.75l2.72-2.72C19.62 3.39 16.67 2 12.48 2 7.01 2 2.56 6.18 2.56 12s4.45 10 9.92 10c2.79 0 5.1-1 6.88-2.84 1.92-1.92 2.58-4.75 2.58-7.17 0-.66-.07-1.32-.19-1.98z"/></svg>
                        Google
                    </Button>
                    <Button variant="outline" type="button" onClick={() => handleSocialLogin('facebook')} disabled={isPending || isLoginDisabled}>
                         <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="currentColor" d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.35C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.732 0 1.325-.593 1.325-1.325V1.325C24 .593 23.407 0 22.675 0z"/></svg>
                        Facebook
                    </Button>
                </div>
            </CardContent>
                <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">Don't have an account? <Link href="/signup" className="font-semibold text-foreground hover:text-primary">Register Now</Link></p>
                </CardFooter>
        </form>
    </Card>
  );
}
