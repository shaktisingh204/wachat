
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import {
  Send, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote, Check, AtSign, Zap, MessageCircle, ShoppingBag, Pencil, ServerCog, Megaphone, Play, LayoutGrid, Users, Shield, Repeat, ClipboardList, ArrowLeft, Video, Phone, MoreVertical, Smile, Paperclip, Camera, Mic, CheckCheck, Home, Link as LinkIcon, QrCode, BarChart, FileText, Newspaper, Clapperboard, Handshake, Brush, Mail, GitFork, Linkedin, Briefcase, Users2, Rocket, TrendingUp
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

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="flex flex-col items-center text-center p-4">
        <div className="flex-shrink-0 mb-4 bg-primary/10 p-3 rounded-full">
            <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
    </div>
);

const UseCaseCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardHeader className="flex flex-row items-center gap-4">
      <div className="p-3 bg-muted rounded-lg">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);


export default function HomePage() {
  const [session, setSession] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getSession().then(sessionData => {
      setSession(sessionData);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-14 items-center">
          <div className="mr-4 flex"><Link href="/" className="mr-6 flex items-center space-x-2"><SabNodeLogo className="h-8 w-auto" /></Link></div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            {loading ? <div className="h-10 w-24 bg-muted rounded-md animate-pulse"></div> : (
              session?.user ? (
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
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 bg-muted/30">
            <div className="container mx-auto px-4 text-center">
                <Badge variant="outline" className="mb-4">AI Automation Platform for Modern Businesses</Badge>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">AI Automation That Runs Your Business on Autopilot</h1>
                <p className="max-w-3xl mx-auto mt-6 text-lg text-muted-foreground">Replace manual work with no-code AI systems built for WhatsApp, marketing, sales, and daily business operations.</p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" asChild><Link href="/signup">Join the Beta Now <ArrowRight className="ml-2 h-5 w-5" /></Link></Button>
                    <Button size="lg" variant="outline" asChild><Link href="#">Watch Automation Demo <Play className="ml-2 h-5 w-5"/></Link></Button>
                </div>
            </div>
        </section>

        {/* Why AI Section */}
        <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Why Businesses Need AI Automation Today</h2>
                    <p className="max-w-2xl mx-auto text-lg text-muted-foreground mt-4">With rising customer expectations, teams are stretched thin across multiple channels, repeating the same tasks day after day.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div>
                        <h3 className="font-semibold text-lg">Managing multiple channels</h3>
                        <p className="text-muted-foreground mt-2">Switching between WhatsApp, Instagram, and Facebook leads to delays.</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Repetitive replies & follow-ups</h3>
                        <p className="text-muted-foreground mt-2">Valuable time is lost on tasks that can be easily automated.</p>
                    </div>
                     <div>
                        <h3 className="font-semibold text-lg">Losing customers to slow responses</h3>
                        <p className="text-muted-foreground mt-2">In a fast-paced world, speed is everything. Delays cost you sales.</p>
                    </div>
                </div>
                <div className="mt-16 text-center">
                    <blockquote className="text-2xl md:text-3xl font-semibold max-w-3xl mx-auto">
                        Modern businesses don’t fail because they lack ideas.
They fail because manual execution cannot keep up with growth.
                    </blockquote>
                </div>
            </div>
        </section>

        {/* What is Sabnode Section */}
        <section className="py-16 md:py-24 bg-muted/30">
            <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">What Is Sabnode?</h2>
                    <p className="text-lg text-muted-foreground">Sabnode is an AI-powered, no-code automation platform built to simplify how modern
businesses communicate, market, and operate—without adding technical complexity.</p>
                    <p className="text-muted-foreground">It combines all your tools,
conversations, and business processes into a single, clearly defined system. The system is
designed for speed and is capable of sustaining scalable growth.</p>
                </div>
                <div className="space-y-4">
                    <div className="flex items-start gap-4"><Check className="h-6 w-6 text-primary flex-shrink-0 mt-1"/><p>Automating WhatsApp interactions with smart responses and follow-up messages</p></div>
                    <div className="flex items-start gap-4"><Check className="h-6 w-6 text-primary flex-shrink-0 mt-1"/><p>Organizing and managing all customer communication through a single unified
dashboard</p></div>
                    <div className="flex items-start gap-4"><Check className="h-6 w-6 text-primary flex-shrink-0 mt-1"/><p>Building AI chatbots without writing a line of code, using visual flow diagrams</p></div>
                    <div className="flex items-start gap-4"><Check className="h-6 w-6 text-primary flex-shrink-0 mt-1"/><p>Seamless integration of CRMs, Business Forms, Payment systems, and other business
software</p></div>
                </div>
            </div>
        </section>

        {/* Core Features Section */}
         <section id="features" className="py-16 md:py-24">
            <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-12"><h2 className="text-3xl md:text-4xl font-bold font-headline">Core Features & Capabilities</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <FeatureCard icon={Users} title="Unified Messaging Inbox" description="Manage WhatsApp, Instagram, and Messenger from one central dashboard."/>
                    <FeatureCard icon={WhatsAppIcon} title="WhatsApp Automation & Marketing" description="Use auto-replies, chatbots, and broadcast campaigns to engage customers instantly."/>
                    <FeatureCard icon={Bot} title="No-Code AI Chatbots" description="Design intelligent conversational flows with a simple drag-and-drop interface."/>
                    <FeatureCard icon={Zap} title="Smart Workflows & Integrations" description="Connect your CRM, Google Sheets, forms, and payment gateways."/>
                    <FeatureCard icon={ShoppingBag} title="E-commerce & Product Catalog Automation" description="Manage product catalogs on WhatsApp and automate order inquiries."/>
                    <FeatureCard icon={Rocket} title="Proof > Promise (Our Philosophy)" description="Our philosophy: We build reliable systems that replace manual work, no hype."/>
                </div>
            </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-16 md:py-24 bg-muted/30">
             <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Built for Real Business Challenges</h2>
                    <p className="max-w-2xl mx-auto text-lg text-muted-foreground">From growing sales to streamlining operations, see how Sabnode can transform your work.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <UseCaseCard icon={TrendingUp} title="Lead Generation & Sales Automation" description="Stop losing leads because of slow follow-ups. Sabnode automatically captures, qualifies, and manages leads using WhatsApp and AI workflows. Every potential customer gets the attention they deserve, even when your team is busy, turning more leads into real sales."/>
                    <UseCaseCard icon={Smile} title="Customer Support Automation" description="Answer FAQs instantly, direct conversations to the right team, and reduce manual support work. With AI-powered chatbots, your customers get fast, accurate responses 24/7, improving satisfaction while your team focuses on complex tasks."/>
                    <UseCaseCard icon={Send} title="Marketing Campaign Automation" description="Run WhatsApp broadcasts, multi-step campaigns, and promotional flows without raising a finger. Sabnode ensures your marketing is consistent, timely, and personalized at scale, so you can reach more customers without extra effort."/>
                    <UseCaseCard icon={ServerCog} title="Internal Process Automation" description="From reporting to data entry and operational workflows, Sabnode automates repetitive tasks across your business. Save hours every week, reduce errors, and let your team focus on profitable initiatives that drive real growth."/>
                </div>
            </div>
        </section>

         {/* Final CTA Section */}
        <section className="py-20 md:py-32">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-headline">Stop Using AI Like a Tool. <br/>Start Using It Like a System.</h2>
                <p className="max-w-2xl mx-auto mt-6 text-lg text-muted-foreground">Build automation workflows that save time, reduce cost, and scale your business.</p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" asChild><Link href="/signup">Join Sabnode Beta Today</Link></Button>
                    <Button size="lg" variant="secondary" asChild><Link href="#features">Explore Features</Link></Button>
                </div>
            </div>
        </section>
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
                        <li><Link href="#features" className="text-muted-foreground hover:text-primary">Features</Link></li>
                        <li><Link href="/pricing" className="text-muted-foreground hover:text-primary">Pricing</Link></li>
                        <li><Link href="/login" className="text-muted-foreground hover:text-primary">Login</Link></li>
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
