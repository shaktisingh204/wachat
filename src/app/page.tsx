
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import {
  Send, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote, Check, AtSign, Zap, MessageCircle, ShoppingBag, Pencil, ServerCog, Megaphone, Play, LayoutGrid, Users, Shield, Repeat, ClipboardList, ArrowLeft, Video, Phone, MoreVertical, Smile, Paperclip, Camera, Mic, CheckCheck, Home, Link as LinkIcon, QrCode, BarChart, FileText, Newspaper, Clapperboard, Handshake, Brush, Mail, GitFork, Linkedin
} from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { WhatsAppIcon, MetaIcon, FacebookIcon as FacebookAppIcon, InstagramIcon, SeoIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MetaSuiteShowcase } from '@/components/wabasimplify/meta-suite-showcase';
import { getSession } from '@/app/actions';

const AppShowcase = ({ title, description, children, className, id }: { title: React.ReactNode, description: string, children: React.ReactNode, className?: string, id?: string }) => (
    <div id={id} className={cn("space-y-8 animate-fade-in", className)}>
        <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-headline">{title}</h2>
            <p className="max-w-2xl mx-auto text-lg text-muted-foreground mt-2">{description}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {children}
        </div>
    </div>
);

const OverviewShowcase = () => (
    <AppShowcase title="Welcome to SabNode" description="An all-in-one platform for your messaging and marketing needs. Select a tool on the right to learn more.">
    </AppShowcase>
);

const WhatsAppShowcase = () => {
    // This component is intentionally left empty as per the user's request.
    return (
        <div>
        </div>
    );
};


export default function HomePage() {
  const [activeApp, setActiveApp] = React.useState('overview');
  const [session, setSession] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getSession().then(sessionData => {
      setSession(sessionData);
      setLoading(false);
    });
  }, []);

  const appIcons = [
    { id: 'overview', icon: Home, label: 'Overview' },
    { id: 'whatsapp', icon: WhatsAppIcon, label: 'Wachat Suite' },
    { id: 'facebook', icon: MetaIcon, label: 'Meta Suite' },
    { id: 'crm', icon: Handshake, label: 'CRM Suite' },
    { id: 'seo-suite', icon: SeoIcon, label: 'SEO Suite' },
    { id: 'url-shortener', icon: LinkIcon, label: 'URL Shortener' },
    { id: 'qr-code-maker', icon: QrCode, label: 'QR Code Maker' },
    { id: 'website-builder', icon: Brush, label: 'Website Builder' },
    { id: 'email', icon: Mail, label: 'Email Suite' },
    { id: 'sms', icon: MessageSquare, label: 'SMS Suite' },
    { id: 'sabflow', icon: GitFork, label: 'SabFlow' },
    { id: 'sabchat', icon: SabChatIcon, label: 'sabChat' },
  ];

  const renderContent = () => {
    switch (activeApp) {
      case 'whatsapp':
        return <section id="whatsapp-suite"><WhatsAppShowcase /></section>;
      case 'facebook':
        return <section id="meta-suite"><MetaSuiteShowcase /></section>;
      default:
        return <section id="overview"><OverviewShowcase /></section>;
    }
  };

  return (
    <div data-theme={activeApp} className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-14 items-center">
          <div className="mr-4 flex"><Link href="/" className="mr-6 flex items-center space-x-2"><SabNodeLogo className="h-8 w-auto" /></Link></div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            {loading ? <div className="h-10 w-24 bg-muted rounded-md animate-pulse"></div> : (
              session ? (
                <Button asChild><Link href="/dashboard">Dashboard</Link></Button>
              ) : (
                <>
                  <Button variant="ghost" asChild><Link href="/login">Sign In</Link></Button>
                  <Button asChild><Link href="/signup">Sign Up</Link></Button>
                </>
              )
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 relative">
        <section className="py-16 md:py-24">{renderContent()}</section>
        <div className="fixed top-1/2 -translate-y-1/2 right-4 z-30">
            <div className="flex flex-col gap-2 p-2 rounded-full border bg-card/80 backdrop-blur-sm shadow-lg">
                {appIcons.map(app => (<Button key={app.id} variant={activeApp === app.id ? 'default' : 'ghost'} size="icon" onClick={() => setActiveApp(app.id)} className="rounded-full h-12 w-12"><app.icon className="h-6 w-6"/><span className="sr-only">{app.label}</span></Button>))}
            </div>
        </div>
      </main>
      <footer className="bg-card text-card-foreground border-t">
        <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="space-y-4">
                    <SabNodeLogo className="h-10 w-auto" />
                    <p className="text-sm text-muted-foreground max-w-xs">Your All-in-One Business Communication and Growth Platform.</p>
                    <div className="flex space-x-4">
                        <Link href="#"><FacebookAppIcon className="h-5 w-5 hover:text-primary" /></Link>
                        <Link href="#"><InstagramIcon className="h-5 w-5 hover:text-primary" /></Link>
                        <Link href="#"><Linkedin className="h-5 w-5 hover:text-primary" /></Link>
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold text-foreground mb-4">Product</h3>
                    <ul className="space-y-2 text-sm">
                        <li><Link href="#whatsapp-suite" className="text-muted-foreground hover:text-primary">Wachat Suite</Link></li>
                        <li><Link href="#meta-suite" className="text-muted-foreground hover:text-primary">Meta Suite</Link></li>
                        <li><Link href="#url-shortener" className="text-muted-foreground hover:text-primary">URL Shortener</Link></li>
                        <li><Link href="#qr-code-maker" className="text-muted-foreground hover:text-primary">QR Code Maker</Link></li>
                        <li><Link href="/pricing" className="text-muted-foreground hover:text-primary">Pricing</Link></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-semibold text-foreground mb-4">Company</h3>
                    <ul className="space-y-2 text-sm">
                        <li><Link href="/about-us" className="text-muted-foreground hover:text-primary">About Us</Link></li>
                        <li><Link href="/contact" className="text-muted-foreground hover:text-primary">Contact</Link></li>
                        <li><Link href="/careers" className="text-muted-foreground hover:text-primary">Careers</Link></li>
                        <li><Link href="/blog" className="text-muted-foreground hover:text-primary">Blog</Link></li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-semibold text-foreground mb-4">Legal</h3>
                    <ul className="space-y-2 text-sm">
                        <li><Link href="/terms-and-conditions" className="text-muted-foreground hover:text-primary">Terms & Conditions</Link></li>
                        <li><Link href="/privacy-policy" className="text-muted-foreground hover:text-primary">Privacy Policy</Link></li>
                    </ul>
                </div>
            </div>
            <Separator className="my-8 bg-border" />
            <div className="text-center text-sm text-muted-foreground">
                <p>info@sabnode.in</p>
                <p>D829 sector 5 malviya nagar jaipur 302017</p>
                <p>© {new Date().getFullYear()} SabNode. All Rights Reserved.</p>
            </div>
        </div>
      </footer>
    </div>
  );
}
