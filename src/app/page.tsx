
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import { Sparkles, ArrowRight, MessageSquare, GitFork, ShoppingBag } from 'lucide-react';
import { getSession } from '@/app/actions/index.ts';
import { cn } from '@/lib/utils';

const FeatureCard = ({ icon: Icon, title, description, delay }: { icon: React.ElementType, title: string, description: string, delay: string }) => (
    <div className="p-6 border border-gray-800 rounded-lg bg-gray-900/50 animate-fade-in-up" style={{ animationDelay: delay }}>
        <Icon className="h-8 w-8 mb-4 text-primary" />
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
    </div>
);

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
            <div className="relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <Sparkles className="absolute -top-8 -left-8 h-12 w-12 text-yellow-400/30 animate-pulse" />
                <Sparkles className="absolute -top-4 right-0 h-8 w-8 text-yellow-400/20 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute bottom-0 -right-12 h-16 w-16 text-yellow-400/25 animate-pulse" style={{ animationDelay: '1s' }} />
                
                <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300">
                    Now Open for Beta
                </h1>
                <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
                    Welcome to the next generation of business communication. We're excited to invite you to be among the first to experience SabNode.
                </p>
                 <div className="mt-8">
                    <Button size="lg" asChild className="text-lg">
                        <Link href="/signup">
                            Join the Beta Now
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </div>
            
            <div className="container mx-auto px-4 mt-24">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard 
                        icon={MessageSquare}
                        title="Unified Messaging"
                        description="Engage with customers across WhatsApp, Facebook, and Instagram from a single, powerful inbox."
                        delay="0.4s"
                    />
                    <FeatureCard 
                        icon={GitFork}
                        title="No-Code Automation"
                        description="Build complex conversational flows and chatbots with a simple drag-and-drop interface."
                        delay="0.6s"
                    />
                    <FeatureCard 
                        icon={ShoppingBag}
                        title="E-Commerce Tools"
                        description="Create custom storefronts and manage your product catalogs directly within the platform."
                        delay="0.8s"
                    />
                </div>
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
