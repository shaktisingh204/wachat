
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WachatLogo } from '@/components/wabasimplify/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // This is a temporary, hardcoded admin login.
    // In a real application, this should use the same secure system as the main login.
    if (email === 'admin@wachat.com' && password === 'admin') {
      // In a real app, you would set a separate admin session cookie here
      router.push('/admin/dashboard');
    } else {
      setError('Invalid admin credentials.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <WachatLogo className="w-48 h-auto" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Admin Sign In</CardTitle>
            <CardDescription>Enter your administrator credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Login Failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@example.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Sign In to Admin Panel
              </Button>
            </form>
          </CardContent>
          <CardFooter>
             <p className="text-sm text-muted-foreground">
                  Not an admin?{' '}
                  <Link href="/login" className="text-primary hover:underline">
                      Go to user login
                  </Link>
              </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
