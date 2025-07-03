'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { WachatLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import {
  Send, GitBranch, MessageSquare, Bot, Home,
  Link as LinkIcon, QrCode, Facebook, Instagram
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Data for showcases
const allFeatures = [
  { app: 'whatsapp', icon: Send, title: 'Campaign Management', description: 'Launch targeted broadcast campaigns with detailed, real-time analytics.' },
  { app: 'whatsapp', icon: GitBranch, title: 'No-Code Flow Builder', description: 'Design powerful, automated conversational flows with an intuitive builder.' },
  { app: 'whatsapp', icon: MessageSquare, title: 'Unified Live Chat', description: 'Engage with customers in real-time through a multi-agent live chat interface.' },
  { app: 'whatsapp', icon: Bot, title: 'AI-Powered Replies', description: 'Leverage AI to handle common queries and provide instant support.' },
  { app: 'facebook', icon: Facebook, title: 'Facebook Ads', description: 'Create and manage "Click to WhatsApp" ad campaigns directly from the dashboard.' },
  { app: 'instagram', icon: Instagram, title: 'Instagram DMs', description: 'Manage your Instagram conversations alongside WhatsApp. (Coming Soon)' },
  { app: 'url-shortener', icon: LinkIcon, title: 'URL Shortener', description: 'Create branded, trackable short links for your campaigns.' },
  { app: 'qr-code-maker', icon: QrCode, title: 'QR Code Generator', description: 'Generate custom QR codes for URLs, Wi-Fi, contact cards, and more.' },
];

const AppShowcase = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => (
    <div className="space-y-8 animate-fade-in">
        <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-headline">{title}</h2>
            <p className="max-w-2xl mx-auto text-lg text-muted-foreground mt-2">{description}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children}
        </div>
    </div>
);

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform">
        <CardHeader className="flex-row items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg"><Icon className="h-6 w-6 text-primary" /></div>
            <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

const ComingSoonCard = ({ title }: { title: string }) => (
     <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col items-center justify-center text-center p-6">
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-2">Coming Soon!</CardDescription>
    </Card>
);


export default function HomePage() {
  const [activeApp, setActiveApp] = React.useState('overview');

  const appIcons = [
    { id: 'overview', icon: Home, label: 'Overview' },
    { id: 'whatsapp', icon: WhatsAppIcon, label: 'WhatsApp Suite' },
    { id: 'facebook', icon: Facebook, label: 'Facebook Tools' },
    { id: 'instagram', icon: Instagram, label: 'Instagram Tools' },
    { id: 'url-shortener', icon: LinkIcon, label: 'URL Shortener' },
    { id: 'qr-code-maker', icon: QrCode, label: 'QR Code Maker' },
  ];

  const renderContent = () => {
    switch (activeApp) {
      case 'whatsapp':
        return (
          <AppShowcase title="WhatsApp Business Suite" description="All the tools you need to master WhatsApp communication.">
            {allFeatures.filter(f => f.app === 'whatsapp').map((feature, i) => <FeatureCard key={i} {...feature} />)}
          </AppShowcase>
        );
      case 'facebook':
        return (
          <AppShowcase title="Facebook Integration" description="Connect your Facebook assets for seamless ad management.">
            <FeatureCard {...allFeatures.find(f => f.app === 'facebook')!} />
            <ComingSoonCard title="Audience Management" />
            <ComingSoonCard title="Page Post Sync" />
            <ComingSoonCard title="Lead Form Integration" />
          </AppShowcase>
        );
      case 'instagram':
        return (
           <AppShowcase title="Instagram Tools" description="Manage your Instagram presence alongside your other channels.">
                <ComingSoonCard title="Instagram DM Inbox" />
                <ComingSoonCard title="Story Replies" />
                <ComingSoonCard title="Post Comments" />
                <ComingSoonCard title="Reels Management" />
           </AppShowcase>
        );
      case 'url-shortener':
         return (
             <AppShowcase title="URL Shortener" description="Create, manage, and track short links.">
                <FeatureCard {...allFeatures.find(f => f.app === 'url-shortener')!} />
                <ComingSoonCard title="Custom Domains" />
                <ComingSoonCard title="Detailed Analytics" />
                <ComingSoonCard title="Link Expiration" />
            </AppShowcase>
        );
      case 'qr-code-maker':
          return (
             <AppShowcase title="QR Code Generator" description="Generate and manage dynamic QR codes.">
                <FeatureCard {...allFeatures.find(f => f.app === 'qr-code-maker')!} />
                <ComingSoonCard title="Dynamic QR Codes" />
                <ComingSoonCard title="Scan Analytics" />
                <ComingSoonCard title="Logo Embedding" />
            </AppShowcase>
        );
      case 'overview':
      default:
        return (
          <AppShowcase title="Welcome to Wachat" description="An all-in-one platform for your messaging and marketing needs. Select a tool to learn more.">
            {allFeatures.slice(0, 4).map((feature, i) => <FeatureCard key={i} {...feature} />)}
          </AppShowcase>
        );
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <WachatLogo className="h-8 w-auto" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
                {renderContent()}
            </div>
        </section>

        {/* Floating App Rail */}
        <div className="fixed top-1/2 -translate-y-1/2 right-4 z-30">
            <div className="flex flex-col gap-2 p-2 rounded-full border bg-card/80 backdrop-blur-sm shadow-lg">
                {appIcons.map(app => (
                    <Button 
                        key={app.id}
                        variant={activeApp === app.id ? 'default' : 'ghost'}
                        size="icon"
                        onClick={() => setActiveApp(app.id)}
                        className="rounded-full h-12 w-12"
                    >
                        <app.icon className="h-6 w-6"/>
                    </Button>
                ))}
            </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Wachat. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms-and-conditions" className="text-sm text-muted-foreground hover:text-primary">
              Terms & Conditions
            </Link>
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
