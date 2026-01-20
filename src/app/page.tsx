
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import {
  Send, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote, Check, AtSign, Zap, MessageCircle, ShoppingBag, Pencil, ServerCog, Megaphone, Play, LayoutGrid, Users, Shield, Repeat, ClipboardList, ArrowLeft, Video, Phone, MoreVertical, Smile, Paperclip, Camera, Mic, CheckCheck, Home, Link as LinkIcon, QrCode, BarChart, FileText, Newspaper, Clapperboard, Handshake, Brush, Mail, GitFork, Linkedin, Briefcase, Users2, Rocket, Factory, Building, Boxes, HeartPulse, BookOpen, Truck, Landmark, UtensilsCrossed, FlaskConical, PenTool, BedDouble, TrendingUp, Hourglass, Wrench, Clock, LayoutDashboard, Sparkles, Code2
} from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <Card className="text-center p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-card/50 backdrop-blur-sm">
        <CardHeader className="items-center p-0">
            <div className="flex-shrink-0 mb-4 bg-primary/10 p-4 rounded-full transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                <Icon className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-2">
            <p className="text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

const UseCaseCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
  <Card className="hover:shadow-lg transition-shadow bg-transparent">
    <CardHeader className="flex flex-row items-center gap-4">
      <div className="p-3 bg-primary/10 rounded-lg">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const WhoIsItForCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <Card className="p-6 text-center hover:shadow-lg hover:-translate-y-1 transition-transform duration-300 bg-card/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
             <div className="flex-shrink-0 bg-primary/10 p-4 rounded-full">
                <Icon className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h4 className="font-semibold text-lg">{title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
        </div>
    </Card>
);

const whatIsSabnodeFeatures = [
    { text: "Automating WhatsApp interactions with smart responses and follow-up messages.", icon: WhatsAppIcon },
    { text: "Organizing and managing all customer communication through a single unified dashboard.", icon: LayoutDashboard },
    { text: "Building AI chatbots without writing a line of code, using visual flow diagrams.", icon: Bot },
    { text: "Creating automation workflows that operate without human assistance 24/7.", icon: Zap },
    { text: "Seamless integration of CRMs, Business Forms, Payment systems, and other business software.", icon: GitFork }
];

const ChallengeCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="text-center space-y-4 group">
        <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-lg group-hover:blur-xl transition-all duration-300 animate-pulse"></div>
            <div className="relative flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full">
                <Icon className="h-10 w-10 text-primary transition-transform duration-300 group-hover:scale-110" />
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
        </div>
    </div>
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
    <div className="flex flex-col min-h-screen bg-background text-foreground glossy-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/60 backdrop-blur-sm">
        <div className="container mx-auto px-4 flex h-16 items-center">
          <div className="mr-4 flex"><Link href="/" className="mr-6 flex items-center space-x-2"><SabNodeLogo className="h-8 w-auto" /></Link></div>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link href="#features" className="text-muted-foreground transition-colors hover:text-foreground">Features</Link>
            <Link href="#use-cases" className="text-muted-foreground transition-colors hover:text-foreground">Use Cases</Link>
            <Link href="/pricing" className="text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
            <Link href="/blog" className="text-muted-foreground transition-colors hover:text-foreground">Blog</Link>
          </nav>
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
        <section className="py-12 md:py-16">
            <div className="container mx-auto px-4 text-center">
                <Badge variant="outline" className="mb-4 text-sm py-1 px-3 border-primary/50 text-primary">Sabnode—AI Automation Platform for Modern Businesses</Badge>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">AI Automation That Runs Your Business on Autopilot</h1>
                <p className="max-w-3xl mx-auto mt-6 text-lg text-muted-foreground">Replace manual work with no-code AI systems built for WhatsApp, marketing, sales, and daily
business operations.</p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" asChild><Link href="/signup">Join the Beta Now <ArrowRight className="ml-2 h-5 w-5" /></Link></Button>
                    <Button size="lg" variant="outline" asChild><Link href="#">Watch Automation Demo <Play className="ml-2 h-5 w-5"/></Link></Button>
                </div>
            </div>
        </section>
        
        {/* Why AI Section */}
        <section className="py-8 md:py-12">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Why Businesses Need AI Automation Today</h2>
                    <p className="max-w-3xl mx-auto text-lg text-muted-foreground mt-4">With the rise of customer expectations, businesses are operating on multiple customer
interaction channels—WhatsApp, Instagram, Facebook, and email. Teams repeat the same
actions time and time again and respond late not because they do not want to, but because
manual work is limited.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 text-center">
                    <ChallengeCard icon={LayoutGrid} title="Multi-Channel Management" description="Managing messages on WhatsApp, Instagram, and Facebook across multiple platforms."/>
                    <ChallengeCard icon={Repeat} title="Repetitive Tasks" description="Repeating the same replies and follow-ups every single day."/>
                    <ChallengeCard icon={Hourglass} title="Slow Responses" description="Losing valuable customers because of slow responses."/>
                    <ChallengeCard icon={Wrench} title="Siloed Tools" description="Using multiple tools without a connected automation system."/>
                    <ChallengeCard icon={Clock} title="Wasted Time" description="Spending hours on tasks that AI can complete in seconds."/>
                </div>
                <div className="mt-16 text-center">
                    <blockquote className="text-2xl md:text-3xl font-semibold max-w-3xl mx-auto">
                        Modern businesses don’t fail because they lack ideas.
                        They fail because manual execution cannot keep up with growth.
                    </blockquote>
                </div>
            </div>
        </section>

        {/* What Is Sabnode Section */}
        <section id="what-is" className="py-8 md:py-12">
             <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
                <div className="space-y-4">
                    <Card><CardContent className="p-6 flex items-start gap-4"><Rocket className="h-8 w-8 text-primary flex-shrink-0 mt-1"/><div><h4 className="font-semibold text-foreground text-lg">AI Automation Platform</h4><p className="text-sm text-muted-foreground">Sabnode is a powerful, no-code platform built to simplify how modern businesses communicate, market, and operate—without adding technical complexity.</p></div></CardContent></Card>
                    <Card><CardContent className="p-6 flex items-start gap-4"><GitFork className="h-8 w-8 text-primary flex-shrink-0 mt-1"/><div><h4 className="font-semibold text-foreground text-lg">Integrated System</h4><p className="text-sm text-muted-foreground">It combines all tools, conversations, and business processes into a single, intelligent system designed for speed and is capable of sustaining scalable growth.</p></div></CardContent></Card>
                </div>
                <div className="space-y-4">
                    {whatIsSabnodeFeatures.map((feature, index) => (
                        <Card key={index} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4 flex items-start gap-4">
                                <feature.icon className="h-6 w-6 text-secondary flex-shrink-0 mt-1"/>
                                <p>{feature.text}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>

        {/* Core Features Section */}
         <section id="features" className="py-8 md:py-12 bg-muted/50">
            <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-12"><h2 className="text-3xl md:text-4xl font-bold font-headline">Core Features & Capabilities</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <FeatureCard icon={Users} title="Unified Messaging Inbox" description="Manage WhatsApp, Instagram, and Messenger from one central dashboard."/>
                    <FeatureCard icon={WhatsAppIcon} title="WhatsApp Automation & Marketing" description="Use auto-replies, chatbots, and broadcast campaigns to engage customers instantly."/>
                    <FeatureCard icon={Bot} title="No-Code AI Chatbots" description="Design intelligent conversational flows with a simple drag-and-drop interface."/>
                    <FeatureCard icon={Zap} title="Smart Workflows & Integrations" description="Connect your CRM, Google Sheets, forms, and payment gateways."/>
                    <FeatureCard icon={ShoppingBag} title="E-commerce & Product Catalog Automation" description="Manage product catalogs on WhatsApp and automate order inquiries."/>
                    <FeatureCard icon={Rocket} title="Proof > Promise (Our Philosophy)" description="We build reliable systems that replace manual work, no hype."/>
                </div>
            </div>
        </section>

        {/* Use Cases Section */}
        <section id="use-cases" className="py-8 md:py-12">
             <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Built for Real Business Challenges</h2>
                    <p className="max-w-2xl mx-auto text-lg text-muted-foreground">From growing sales to streamlining operations, see how Sabnode can transform your work.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <UseCaseCard icon={TrendingUp} title="Lead Generation & Sales Automation" description="Stop losing leads because of slow follow-ups. Sabnode automatically captures, qualifies, and manages leads using WhatsApp and AI workflows. Every potential customer gets the attention they deserve, even when your team is busy, turning more leads into real sales."/>
                    <UseCaseCard icon={Smile} title="Customer Support Automation" description="Answer FAQs instantly, direct conversations to the right team, and reduce manual support work. With AI-powered chatbots, your customers get fast, accurate responses 24/7, improving satisfaction while your team focuses on complex tasks."/>
                    <UseCaseCard icon={Send} title="Marketing Campaign Automation" description="Run WhatsApp broadcasts, multi-step campaigns, and promotional flows without raising a finger. Sabnode ensures your marketing is consistent, timely, and personalized at scale, so you can reach more customers without extra effort."/>
                    <UseCaseCard icon={ServerCog} title="Internal Process Automation" description="From reporting to data entry and operational workflows, Sabnode automates repetitive tasks across your business. Save hours every week, reduce errors, and let your team focus on profitable initiatives that drive real growth."/>
                </div>
            </div>
        </section>
        
        {/* Philosophy Section */}
        <section className="py-8 md:py-12">
             <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
                 <div className="relative aspect-square">
                    <Image src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?q=80&w=1080&auto=format&fit=crop" alt="Business workflow" layout="fill" objectFit="cover" className="rounded-lg shadow-lg" data-ai-hint="business workflow"/>
                </div>
                 <div className="space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Proof &gt; Promise (Our Philosophy)</h2>
                    <p className="text-lg text-muted-foreground">At Sabnode, we believe in action over ideas. Many platforms talk about what’s possible, but few actually deliver systems that work in the real world.</p>
                    <p className="text-muted-foreground">We build automation systems that are reliable, practical, and designed to replace hours of repetitive work, so your business can run smoothly, even when you’re offline. Every workflow is tested with real businesses to ensure it works—no hype, no empty claims.</p>
                    <ul className="space-y-2 pt-2">
                        <li className="flex items-start gap-3"><Check className="h-5 w-5 text-primary flex-shrink-0 mt-1"/>Systems that replace hours of manual work, freeing your team for strategic tasks.</li>
                        <li className="flex items-start gap-3"><Check className="h-5 w-5 text-primary flex-shrink-0 mt-1"/>Automations that continue to run even when you’re offline, so nothing slips through the
cracks.</li>
                        <li className="flex items-start gap-3"><Check className="h-5 w-5 text-primary flex-shrink-0 mt-1"/>Tested in real-world business scenarios, proving effectiveness, not just theory.</li>
                        <li className="flex items-start gap-3"><Check className="h-5 w-5 text-primary flex-shrink-0 mt-1"/>No hype. Only execution. Our focus is on building workflows that actually deliver results.</li>
                    </ul>
                </div>
            </div>
        </section>
        
        {/* Who is it for Section */}
        <section id="who-is-it-for" className="py-8 md:py-12">
            <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Who Needs to Use Sabnode?</h2>
                    <p className="max-w-3xl mx-auto text-lg text-muted-foreground">Sabnode is designed for anyone who wants to grow their business without getting stuck in
manual work. If you’re looking for smart ways to automate communication, marketing, and
operations, Sabnode makes it simple, reliable, and effective.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    <WhoIsItForCard icon={Building} title="Small & Medium Businesses" description="Streamline operations, save time, and scale efficiently."/>
                    <WhoIsItForCard icon={Megaphone} title="Digital Marketing Agencies" description="Manage multiple client campaigns and leads from one platform."/>
                    <WhoIsItForCard icon={ShoppingBag} title="Online Brands & E-commerce" description="Automate customer support, orders, and product catalogs."/>
                    <WhoIsItForCard icon={Star} title="Coaches, Consultants & Creators" description="Engage clients and followers with intelligent
workflows."/>
                    <WhoIsItForCard icon={Users2} title="Teams & Collaborators" description="Work together in a unified dashboard to manage customer interactions."/>
                    <WhoIsItForCard icon={Pencil} title="Automation & AI learners" description="Build practical AI systems without coding."/>
                </div>
            </div>
        </section>
        
        {/* About Section */}
        <section className="py-8 md:py-12">
             <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
                 <div className="space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline flex items-center gap-3">
                        About Sabnode <Sparkles className="h-8 w-8 text-amber-400" />
                    </h2>
                    <p className="text-lg text-muted-foreground">Sabnode was created to help businesses move beyond basic AI tools and actually put
automation to work. Too many companies get stuck using AI as just another app—we focus on
real systems that make work easier, faster, and smarter.</p>
                    <p className="text-muted-foreground">Our philosophy is simple: practical automation over attractive features. Sabnode is built to help
your business run smoothly, whether it’s handling customer messages, marketing campaigns, or
internal workflows.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform duration-300">
                        <CardContent className="p-4 text-center space-y-2">
                            <Zap className="h-8 w-8 text-primary mx-auto"/>
                            <h4 className="font-semibold">Practical Automation</h4>
                            <p className="text-xs text-muted-foreground">Solutions you can implement today.</p>
                        </CardContent>
                    </Card>
                     <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform duration-300">
                        <CardContent className="p-4 text-center space-y-2">
                            <ServerCog className="h-8 w-8 text-primary mx-auto"/>
                            <h4 className="font-semibold">Real Business Systems</h4>
                            <p className="text-xs text-muted-foreground">Workflows for actual business operations.</p>
                        </CardContent>
                    </Card>
                     <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform duration-300">
                        <CardContent className="p-4 text-center space-y-2">
                            <Code2 className="h-8 w-8 text-primary mx-auto"/>
                            <h4 className="font-semibold">No-Code Simplicity</h4>
                            <p className="text-xs text-muted-foreground">Build AI systems without technical knowledge.</p>
                        </CardContent>
                    </Card>
                     <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform duration-300">
                        <CardContent className="p-4 text-center space-y-2">
                            <TrendingUp className="h-8 w-8 text-primary mx-auto"/>
                            <h4 className="font-semibold">Scalable Execution</h4>
                            <p className="text-xs text-muted-foreground">Automations that grow with your business.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>

         {/* Final CTA Section */}
        <section className="py-12 md:py-16 bg-primary text-primary-foreground">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-headline">Stop Using AI Like a Tool. <br/>Start Using AI Like a System.</h2>
                <p className="max-w-2xl mx-auto mt-6 text-lg text-primary-foreground/80">Build automation workflows that save time, reduce cost, and scale your business.</p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" variant="secondary" asChild><Link href="/signup">Join Sabnode Beta Today</Link></Button>
                    <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10" asChild><Link href="#features">Explore Features</Link></Button>
                </div>
            </div>
        </section>
      </main>
      <footer className="bg-card text-card-foreground border-t">
        <div className="container mx-auto px-4 py-8">
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
