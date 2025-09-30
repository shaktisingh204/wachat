'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { getSession } from '@/app/actions';

export default function Home() {
  const [session, setSession] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getSession().then(sessionData => {
      setSession(sessionData);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
        <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-900/80 backdrop-blur">
            <div className="container mx-auto px-4 flex h-14 items-center">
                <div className="mr-4 flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <SabNodeLogo className="h-8 w-auto" />
                    </Link>
                </div>
                <div className="flex flex-1 items-center justify-end space-x-2">
                    {loading ? (
                        <div className="h-10 w-24 bg-gray-800 rounded-md animate-pulse"></div>
                    ) : session ? (
                        <Button asChild><Link href="/dashboard">Dashboard</Link></Button>
                    ) : (
                        <>
                            <Button variant="ghost" asChild><Link href="/login">Sign In</Link></Button>
                            <Button asChild><Link href="/signup">Sign Up</Link></Button>
                        </>
                    )}
                </div>
            </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="relative animate-fade-in-up">
                <Sparkles className="absolute -top-8 -left-8 h-12 w-12 text-yellow-400/50 animate-pulse" />
                <Sparkles className="absolute -top-4 right-0 h-8 w-8 text-yellow-400/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute bottom-0 -right-12 h-16 w-16 text-yellow-400/40 animate-pulse" style={{ animationDelay: '1s' }} />
                
                <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300">
                    We are going live on Diwali
                </h1>
                <p className="mt-4 text-lg text-gray-300">
                    Our platform is getting ready for a grand celebration of light and technology.
                </p>
            </div>
        </main>
        
        <footer className="py-6">
            <div className="container mx-auto px-4 text-center text-xs text-gray-500">
                 <p>© {new Date().getFullYear()} SabNode. All Rights Reserved.</p>
            </div>
        </footer>
    </div>
  );
}
