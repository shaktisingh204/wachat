
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import {
  Send, GitBranch, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote, Check, AtSign, Zap, MessageCircle, ShoppingBag, Pencil, ServerCog, Megaphone, Play, LayoutGrid, Users, Shield, Repeat, ClipboardList, ArrowLeft, Video, Phone, MoreVertical, Smile, Paperclip, Camera, Mic, CheckCheck, Home, Link as LinkIcon, QrCode, BarChart, FileText, Newspaper, Wifi, Type, Clock,
  Facebook, Twitter, Linkedin, Handshake
} from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { WhatsAppIcon, MetaIcon, FacebookIcon as FacebookAppIcon, InstagramIcon, SeoIcon } from '@/components/wabasimplify/custom-sidebar-components';
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

const OverviewFeatureCard = ({ icon: Icon, title, description, gradient }: { icon: React.ElementType, title: string, description: string, gradient?: string }) => (
    <Card className={cn("hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient", gradient)}>
        <CardHeader className="items-center">
            <div className="p-4 bg-primary/10 rounded-full">
                <Icon className="h-8 w-8 text-primary" />
            </div>
        </CardHeader>
        <CardContent className="space-y-2 flex-grow text-center">
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

const ComingSoonCard = ({ title, icon: Icon }: { title: string, icon: React.ElementType }) => (
     <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col items-center justify-center text-center p-6 bg-muted/50 opacity-70">
        <div className="p-4 bg-foreground/10 rounded-full mb-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardContent className="p-0 mt-2">
            <p className="text-sm text-muted-foreground">Coming Soon!</p>
        </CardContent>
    </Card>
);

const OverviewShowcase = () => (
    <AppShowcase title="Welcome to SabNode" description="An all-in-one platform for your messaging and marketing needs. Select a tool on the right to learn more.">
        <OverviewFeatureCard icon={Send} title="WhatsApp Campaigns" description="Launch targeted broadcast campaigns with detailed, real-time analytics." gradient="card-gradient-green" />
        <OverviewFeatureCard icon={Megaphone} title="Facebook Ads" description="Create and manage 'Click to WhatsApp' ad campaigns directly from the dashboard." gradient="card-gradient-blue" />
        <OverviewFeatureCard icon={LinkIcon} title="URL Shortener" description="Create branded, trackable short links with expiration dates and detailed analytics." gradient="card-gradient-purple" />
        <OverviewFeatureCard icon={QrCode} title="QR Code Generator" description="Generate custom QR codes for URLs, Wi-Fi, contact cards, and more." gradient="card-gradient-orange" />
    </AppShowcase>
);

const WhatsAppShowcase = ({ id }: { id?: string }) => {
    const features = [
        { icon: Send, title: 'Campaign Management', description: 'Launch targeted broadcast campaigns with detailed, real-time analytics and delivery reports.', gradient: 'card-gradient-green' },
        { icon: GitBranch, title: 'No-Code Flow Builder', description: 'Design powerful, automated conversational flows with our intuitive drag-and-drop builder.', gradient: 'card-gradient-blue' },
        { icon: MessageSquare, title: 'Unified Live Chat', description: 'Engage with your customers in real-time through a multi-agent live chat interface.', gradient: 'card-gradient-purple' },
        { icon: Bot, title: 'AI-Powered Replies', description: 'Leverage AI to handle common queries and provide instant support, and translate messages automatically.', gradient: 'card-gradient-orange' },
        { icon: ServerCog, title: 'Interactive Flows', description: 'Build rich, native forms and UI screens that open directly inside WhatsApp, boosting conversion rates.', gradient: 'card-gradient-green' },
        { icon: LayoutGrid, title: 'Kanban Chat View', description: 'Organize conversations visually with a drag-and-drop Kanban board to track leads and support tickets.', gradient: 'card-gradient-purple' },
        { icon: ShoppingBag, title: 'Product Catalogs', description: 'Showcase your products directly within WhatsApp using interactive catalog messages.', gradient: 'card-gradient-orange' },
        { icon: Shield, title: 'Compliance Tools', description: 'Easily manage opt-ins and opt-outs with built-in compliance features.', gradient: 'card-gradient-blue' }
    ];
    const testimonials = [
        { name: 'Maria Garcia', title: 'Marketing Manager, Bloom Co.', avatar: 'https://placehold.co/100x100.png', text: 'SabNode has revolutionized our customer outreach. The flow builder is incredibly intuitive, and we saw a 200% increase in engagement on our first campaign!', aiHint: 'woman portrait' },
        { name: 'David Chen', title: 'Support Lead, TechGear Inc.', avatar: 'https://placehold.co/100x100.png', text: "The unified live chat and AI auto-replies have cut our support response times in half. It's an essential tool for our team.", aiHint: 'man portrait' },
        { name: 'Aisha Ahmed', title: 'Founder, The Artisan Box', avatar: 'https://placehold.co/100x100.png', text: "As a small business, SabNode gave us the power of a full marketing team. Sending templates and managing contacts has never been easier.", aiHint: 'woman face' }
    ];
    const faqs = [
        { question: 'Is SabNode an official WhatsApp product?', answer: 'No, SabNode is an independent application that uses the official WhatsApp Business API provided by Meta. We provide a user-friendly interface to access the powerful features of the API.' },
        { question: 'What do I need to get started?', answer: "You'll need a WhatsApp Business Account (WABA) and a phone number that is not currently being used by a personal WhatsApp account. Our embedded signup process will guide you through connecting your account." },
        { question: 'Can I use my existing WhatsApp number?', answer: "You cannot use a number that is currently active on the consumer WhatsApp app. You'll need to use a new number or migrate your existing business number to the WhatsApp Business API, which is a process we can help guide you through." },
        { question: 'Is there a free trial?', answer: 'Yes, you can sign up for free to explore the platform. Meta may have its own charges for sending messages, which are separate from our platform fees. Please refer to Meta\'s documentation for their latest pricing.' }
    ];

    const [animationKey, setAnimationKey] = React.useState(0);
    React.useEffect(() => {
        const animationDuration = 10000;
        const timer = setInterval(() => setAnimationKey(prevKey => prevKey + 1), animationDuration);
        return () => clearInterval(timer);
    }, []);

    return (
        <div id={id} className="space-y-16 md:space-y-24">
            {/* Hero Section */}
            <div className="container mx-auto px-4 grid justify-items-center text-center gap-8">
                <div className="space-y-4 max-w-3xl">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">The Wachat Suite in SabNode</h1>
                    <p className="mx-auto text-lg text-muted-foreground">Manage campaigns, automate conversations, and engage customers effortlessly. The all-in-one platform for your WhatsApp marketing and support needs.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button size="lg" asChild><Link href="/signup">Get Started for Free <ArrowRight className="ml-2 h-5 w-5" /></Link></Button>
                        <Button size="lg" variant="outline" asChild><Link href="#features">Learn More <ChevronDown className="ml-2 h-5 w-5"/></Link></Button>
                    </div>
                </div>
                <div key={animationKey} className="relative mt-8 flex justify-center">
                    <div className="relative w-[340px] h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                         <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                            <div className="absolute inset-0 bg-black/5"></div>
                            <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                <ArrowLeft className="h-5 w-5 opacity-90" /><Avatar><AvatarFallback>S</AvatarFallback></Avatar>
                                <div className="flex-1 flex flex-col items-start"><p className="font-semibold text-[15px]">SabNode</p><p className="text-xs opacity-80">online</p></div>
                            </div>
                            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '1s' }}><div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">Start flow</div></div>
                                <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '2s' }}><div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">Welcome! Tap to see our product showcase.</div></div>
                            </div>
                            <div className="absolute inset-0 bg-black/40 flex flex-col justify-end z-20 animate-fade-in" style={{ animationDelay: '3s', opacity: 0 }}>
                                <div className="bg-[#F0F2F5] h-[90%] rounded-t-2xl flex flex-col animate-slide-in-up" style={{ animationDelay: '3.3s' }}>
                                    <div className="p-2 border-b text-center font-semibold text-sm bg-white rounded-t-2xl">Product Showcase</div>
                                    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                                        <div className="flex gap-3 border rounded-lg p-3 bg-white">
                                            <Image src="https://placehold.co/80x80.png" alt="product" width={80} height={80} className="rounded-md" data-ai-hint="shirt product" />
                                            <div><p className="font-medium text-gray-800">Cool T-Shirt</p><p className="text-sm text-muted-foreground">$25.00</p><Button size="sm" variant="outline" className="mt-1 h-7">Add</Button></div>
                                        </div>
                                    </div>
                                    <div className="p-3 border-t bg-white"><Button className="w-full bg-[#008069] hover:bg-[#008069]/90">View Cart</Button></div>
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <section id="features" className="py-16 bg-muted rounded-lg">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-12"><h2 className="text-3xl md:text-4xl font-bold font-headline">Powerful Tools for Growth</h2><p className="max-w-2xl mx-auto text-lg text-muted-foreground">Everything you need to scale your customer communication on WhatsApp.</p></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {features.map((feature, index) => <OverviewFeatureCard key={index} {...feature} />)}
                    </div>
                </div>
            </section>
            
            {/* Showcase Section */}
            <section id="showcase" className="py-16 md:py-24 bg-muted">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold font-headline">One Platform, Complete Control</h2>
                        <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                            From visual automations to conversation management, see how SabNode puts you in control of the entire customer journey.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-16 xl:gap-24">
                        {/* Flow Builder Mockup */}
                        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12" key={`showcase-1-${animationKey}`}>
                            <div className="lg:w-1/3 space-y-4 text-center lg:text-left">
                                <h3 className="text-2xl font-bold font-headline">No-Code Flow Builder</h3>
                                <p className="text-muted-foreground">
                                    Visually map out complex conversation logic with branching, conditions, and API calls. Perfect for support bots and drip campaigns.
                                </p>
                            </div>
                            <div className="lg:w-2/3 p-4 rounded-lg bg-background/30 w-full">
                                <div className="relative h-96 w-full overflow-hidden">
                                    {/* SVG for lines */}
                                    <svg className="absolute top-0 left-0 w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M110 50 C 150 50, 150 100, 210 100" stroke="hsl(var(--border))" strokeWidth="2" className="animate-draw-long" style={{animationDelay: '0.5s'}}/>
                                        <path d="M110 50 C 150 50, 150 200, 210 200" stroke="hsl(var(--border))" strokeWidth="2" className="animate-draw-long" style={{animationDelay: '0.8s'}}/>
                                        <path d="M320 100 C 360 100, 360 50, 420 50" stroke="hsl(var(--border))" strokeWidth="2" className="animate-draw-long" style={{animationDelay: '1.2s'}}/>
                                        <path d="M320 200 C 360 200, 360 280, 420 280" stroke="hsl(var(--border))" strokeWidth="2" className="animate-draw-long" style={{animationDelay: '1.5s'}}/>
                                    </svg>
                                    {/* Nodes */}
                                    <div className="absolute top-8 left-0 w-28 text-center animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                                        <div className="mx-auto bg-primary/20 text-primary rounded-full h-10 w-10 flex items-center justify-center"><Play className="h-5 w-5"/></div>
                                        <p className="text-xs font-semibold mt-1">Start Flow</p>
                                    </div>
                                    <div className="absolute top-[80px] left-[210px] w-28 text-center animate-fade-in-up" style={{animationDelay: '1s'}}>
                                        <div className="mx-auto bg-blue-500/20 text-blue-600 rounded-full h-10 w-10 flex items-center justify-center"><MessageSquare className="h-5 w-5"/></div>
                                        <p className="text-xs font-semibold mt-1">Welcome Message</p>
                                    </div>
                                    <div className="absolute top-[180px] left-[210px] w-28 text-center animate-fade-in-up" style={{animationDelay: '1.3s'}}>
                                        <div className="mx-auto bg-purple-500/20 text-purple-600 rounded-full h-10 w-10 flex items-center justify-center"><GitBranch className="h-5 w-5"/></div>
                                        <p className="text-xs font-semibold mt-1">Main Menu</p>
                                    </div>
                                    <div className="absolute top-8 left-[420px] w-28 text-center animate-fade-in-up" style={{animationDelay: '1.8s'}}>
                                        <div className="mx-auto bg-orange-500/20 text-orange-600 rounded-full h-10 w-10 flex items-center justify-center"><ServerCog className="h-5 w-5"/></div>
                                        <p className="text-xs font-semibold mt-1">Check Balance API</p>
                                    </div>
                                    <div className="absolute top-[260px] left-[420px] w-28 text-center animate-fade-in-up" style={{animationDelay: '2.1s'}}>
                                        <div className="mx-auto bg-teal-500/20 text-teal-600 rounded-full h-10 w-10 flex items-center justify-center"><Bot className="h-5 w-5"/></div>
                                        <p className="text-xs font-semibold mt-1">Connect to Agent</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Declarative Flow UI Builder Mockup */}
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12" key={`showcase-2-${animationKey}`}>
                            <div className="lg:w-1/3 space-y-4 text-center lg:text-left">
                                <h3 className="text-2xl font-bold font-headline">Interactive Flow UI Builder</h3>
                                <p className="text-muted-foreground">
                                    Build rich, native forms and multi-step experiences that open directly inside WhatsApp for higher conversion rates.
                                </p>
                            </div>
                            <div className="lg:w-2/3 flex justify-center w-full">
                                <div className="relative w-[340px] h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                    <div 
                                        className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" 
                                        style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}
                                    >
                                        <div className="absolute inset-0 bg-black/5"></div>
                                        {/* Header */}
                                        <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                            <ArrowLeft className="h-5 w-5 opacity-90" />
                                            <Avatar><AvatarFallback>S</AvatarFallback></Avatar>
                                            <div className="flex-1 flex flex-col items-start">
                                                <div className="flex items-center gap-1.5"><p className="font-semibold text-[15px]">SabNode</p><CheckCheck className="h-4 w-4 text-green-400" /></div>
                                                <p className="text-xs opacity-80">tap here for contact info</p>
                                            </div>
                                        </div>
                                        {/* Static Chat BG */}
                                        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                            <div className="flex justify-end">
                                                <div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">
                                                    <p>Ready to see more? Open our interactive order form to browse the full catalog!</p>
                                                    <div className="w-full bg-black/20 text-center rounded-md p-2 mt-2 font-medium text-base">
                                                        🛒 Start Your Order
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Animated Meta Flow Overlay */}
                                        <div className="absolute inset-0 bg-black/40 flex flex-col justify-end z-20 animate-fade-in" style={{ animationDelay: '0.5s', opacity: 0 }}>
                                            <div className="bg-[#F0F2F5] h-[90%] rounded-t-2xl flex flex-col animate-slide-in-up" style={{ animationDelay: '0.8s' }}>
                                                <div className="p-2 border-b text-center font-semibold text-sm bg-white rounded-t-2xl">
                                                Order Products
                                                </div>
                                                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                                                <p className="font-semibold text-gray-800">Summer Collection</p>
                                                <div className="flex gap-3 border rounded-lg p-3 bg-white">
                                                    <Image src="https://placehold.co/80x80.png" alt="product" width={80} height={80} className="rounded-md" data-ai-hint="shirt product"/>
                                                    <div><p className="font-medium text-gray-800">Cool T-Shirt</p><p className="text-sm text-muted-foreground">$25.00</p><Button size="sm" variant="outline" className="mt-1 h-7">Add</Button></div>
                                                </div>
                                                <div className="flex gap-3 border rounded-lg p-3 bg-white">
                                                    <Image src="https://placehold.co/80x80.png" alt="product" width={80} height={80} className="rounded-md" data-ai-hint="sunglasses product"/>
                                                    <div><p className="font-medium text-gray-800">Sunglasses</p><p className="text-sm text-muted-foreground">$40.00</p><Button size="sm" variant="outline" className="mt-1 h-7">Add</Button></div>
                                                </div>
                                                </div>
                                                <div className="p-3 border-t bg-white"><Button className="w-full bg-[#008069] hover:bg-[#008069]/90">View Cart (2)</Button></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Kanban Board Mockup */}
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12" key={`showcase-3-${animationKey}`}>
                            <div className="lg:w-1/3 space-y-4 text-center lg:text-left">
                                <h3 className="text-2xl font-bold font-headline">Visualize Your Workflow</h3>
                                <p className="text-muted-foreground">
                                    Drag and drop conversations through your pipeline. From new lead to resolved ticket, never lose track of a customer again.
                                </p>
                            </div>
                            <div className="lg:w-2/3 p-4 rounded-lg bg-background/30 w-full">
                                <div className="relative h-[450px] w-full overflow-hidden">
                                    <div className="flex h-full gap-4">
                                        {/* Column 1: New */}
                                        <div className="w-1/3 bg-background/50 rounded-lg p-2 md:p-3 flex flex-col gap-3">
                                            <h3 className="font-semibold px-2 text-foreground">New Leads (2)</h3>
                                            {/* Static Card */}
                                            <div className="bg-card p-3 rounded-md shadow">
                                                <p className="font-semibold text-sm">Aisha Ahmed</p>
                                                <p className="text-xs text-muted-foreground">Interested in the new collection.</p>
                                            </div>
                                            {/* The card that will animate */}
                                            <div className="bg-card p-3 rounded-md shadow animate-kanban-drag relative z-10">
                                                <p className="font-semibold text-sm">David Chen</p>
                                                <p className="text-xs text-muted-foreground">Where is my order #1234?</p>
                                            </div>
                                        </div>
                                        {/* Column 2: Open */}
                                        <div className="w-1/3 bg-background/50 rounded-lg p-2 md:p-3 flex flex-col gap-3">
                                            <h3 className="font-semibold px-2 text-foreground">Open Tickets (1)</h3>
                                            <div className="bg-card p-3 rounded-md shadow">
                                                <p className="font-semibold text-sm">Maria Garcia</p>
                                                <p className="text-xs text-muted-foreground">Follow-up on quote required.</p>
                                            </div>
                                        </div>
                                        {/* Column 3: Resolved */}
                                        <div className="w-1/3 bg-background/50 rounded-lg p-2 md:p-3 flex flex-col gap-3">
                                            <h3 className="font-semibold px-2 text-foreground">Resolved (0)</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* New Features Section */}
            <section className="py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold font-headline">A Complete Toolkit for WhatsApp</h2>
                        <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                            SabNode is packed with features designed to handle every aspect of your customer communication.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-24">
                        {/* Agent Collaboration */}
                        <div className="flex flex-col sm:flex-row items-center gap-8" key={`showcase-4-${animationKey}`}>
                            <div className="w-[340px] h-auto flex-shrink-0">
                                <div className="relative w-full h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                    <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                                        <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                            <ArrowLeft className="h-5 w-5 opacity-90" />
                                            <Avatar><AvatarFallback>S</AvatarFallback></Avatar>
                                            <div className="flex-1"><p className="font-semibold text-[15px]">Sarah (Agent)</p><p className="text-xs opacity-80">online</p></div>
                                        </div>
                                        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                            <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '0.5s' }}><div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">I need help with my recent order.</div></div>
                                            <div className="bg-[#182229] rounded-md px-2 py-1 text-xs text-[#8696A0] text-center self-center shadow animate-fade-in-up" style={{ animationDelay: '1.5s' }}>Conversation assigned to Sarah</div>
                                            <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '2.5s' }}><div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">Hi! I'm Sarah, I can help with that. What is your order number?</div></div>
                                        </div>
                                        <div className="bg-[#1F2C33] p-2 flex items-center gap-2 mt-auto z-10">
                                            <div className="bg-[#2A3942] rounded-full flex-1 flex items-center px-3"><Smile className="h-5 w-5 text-gray-400" /><Input className="bg-transparent border-none text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 h-10" placeholder="Message" /><Paperclip className="h-5 w-5 text-gray-400" /></div>
                                            <div className="bg-[#00A884] h-10 w-10 rounded-full flex items-center justify-center"><Mic className="h-5 w-5 text-white" /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 text-center sm:text-left">
                                <Users className="h-8 w-8 text-primary"/>
                                <h3 className="text-2xl font-bold font-headline">Collaborate as a Team</h3>
                                <p className="text-muted-foreground">Assign conversations, leave private notes, and manage support tickets efficiently with a multi-agent inbox.</p>
                            </div>
                        </div>

                        {/* Auto Replies */}
                        <div className="flex flex-col sm:flex-row-reverse items-center gap-8" key={`showcase-5-${animationKey}`}>
                            <div className="w-[340px] h-auto flex-shrink-0">
                                <div className="relative w-full h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                    <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                                        <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                            <ArrowLeft className="h-5 w-5 opacity-90" />
                                            <Avatar><AvatarFallback>S</AvatarFallback></Avatar>
                                            <div className="flex-1"><p className="font-semibold text-[15px]">SabNode</p><p className="text-xs opacity-80">online</p></div>
                                        </div>
                                        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                            <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '0.5s' }}><div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">What are your hours?</div></div>
                                            <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '1.5s' }}><div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">Hi there! We are open from 9 AM to 6 PM, Monday to Friday.</div></div>
                                        </div>
                                        <div className="bg-[#1F2C33] p-2 flex items-center gap-2 mt-auto z-10">
                                            <div className="bg-[#2A3942] rounded-full flex-1 flex items-center px-3"><Smile className="h-5 w-5 text-gray-400" /><Input className="bg-transparent border-none text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 h-10" placeholder="Message" /><Paperclip className="h-5 w-5 text-gray-400" /></div>
                                            <div className="bg-[#00A884] h-10 w-10 rounded-full flex items-center justify-center"><Mic className="h-5 w-5 text-white" /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 text-center sm:text-left">
                                <Repeat className="h-8 w-8 text-primary"/>
                                <h3 className="text-2xl font-bold font-headline">Instant Auto-Replies</h3>
                                <p className="text-muted-foreground">Set up keyword-based or out-of-office replies to ensure your customers always get a timely response.</p>
                            </div>
                        </div>

                        {/* AI Chat */}
                        <div className="flex flex-col sm:flex-row items-center gap-8" key={`showcase-6-${animationKey}`}>
                            <div className="w-[340px] h-auto flex-shrink-0">
                                <div className="relative w-full h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                    <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                                        <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                            <ArrowLeft className="h-5 w-5 opacity-90" />
                                            <Avatar><AvatarFallback>A</AvatarFallback></Avatar>
                                            <div className="flex-1"><p className="font-semibold text-[15px]">AI Assistant</p><p className="text-xs opacity-80">online</p></div>
                                        </div>
                                        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                            <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '0.5s' }}><div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">Do you offer vegan options?</div></div>
                                            <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '1.5s' }}><div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">Yes, we do! Our Garden Delight pizza is 100% vegan. Would you like to see the full menu?</div></div>
                                        </div>
                                        <div className="bg-[#1F2C33] p-2 flex items-center gap-2 mt-auto z-10">
                                            <div className="bg-[#2A3942] rounded-full flex-1 flex items-center px-3"><Smile className="h-5 w-5 text-gray-400" /><Input className="bg-transparent border-none text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 h-10" placeholder="Message" /><Paperclip className="h-5 w-5 text-gray-400" /></div>
                                            <div className="bg-[#00A884] h-10 w-10 rounded-full flex items-center justify-center"><Mic className="h-5 w-5 text-white" /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 text-center sm:text-left">
                                <Bot className="h-8 w-8 text-primary"/>
                                <h3 className="text-2xl font-bold font-headline">Your Own AI Assistant</h3>
                                <p className="text-muted-foreground">Train an AI on your business data to answer common questions, qualify leads, and reduce your team's workload.</p>
                            </div>
                        </div>
                        
                        {/* Canned Messages */}
                        <div className="flex flex-col sm:flex-row-reverse items-center gap-8" key={`showcase-8-${animationKey}`}>
                            <div className="w-[340px] h-auto flex-shrink-0">
                                <div className="relative w-full h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                    <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                                        <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                            <ArrowLeft className="h-5 w-5 opacity-90" />
                                            <Avatar><AvatarFallback>J</AvatarFallback></Avatar>
                                            <div className="flex-1"><p className="font-semibold text-[15px]">John (Agent)</p><p className="text-xs opacity-80">online</p></div>
                                        </div>
                                        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                            <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '0.5s' }}><div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">What's your refund policy?</div></div>
                                        </div>
                                        <div className="bg-card p-2 rounded-md shadow-lg text-card-foreground absolute bottom-16 left-3 right-3 z-20 animate-fade-in-up" style={{ animationDelay: '1.5s', opacity: 0 }}>
                                            <p className="font-bold text-sm">/refund_policy</p>
                                            <p className="text-xs text-muted-foreground">We offer a 30-day money-back guarantee...</p>
                                        </div>
                                        <div className="bg-[#1F2C33] p-2 flex items-center gap-2 mt-auto z-10">
                                            <div className="bg-[#2A3942] rounded-full flex-1 flex items-center px-3">
                                                <Smile className="h-5 w-5 text-gray-400" />
                                                <div className="text-white text-sm pl-2 animate-fade-in" style={{animationDelay: '1s', opacity: 0}}>/refund</div>
                                                <Input className="bg-transparent border-none text-white focus-visible:ring-0 focus-visible:ring-offset-0 h-10 flex-1" />
                                                <Paperclip className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <div className="bg-[#00A884] h-10 w-10 rounded-full flex items-center justify-center">
                                                <Send className="h-5 w-5 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 text-center sm:text-left">
                                <ClipboardList className="h-8 w-8 text-primary"/>
                                <h3 className="text-2xl font-bold font-headline">Faster Replies with Canned Messages</h3>
                                <p className="text-muted-foreground">Create a library of pre-written responses for common questions. Type '/' to quickly search and send.</p>
                            </div>
                        </div>
                        
                        {/* Compliance */}
                        <div className="flex flex-col sm:flex-row items-center gap-8" key={`showcase-7-${animationKey}`}>
                            <div className="w-[340px] h-auto flex-shrink-0">
                                <div className="relative w-full h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                    <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                                        <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                            <ArrowLeft className="h-5 w-5 opacity-90" />
                                            <Avatar><AvatarFallback>S</AvatarFallback></Avatar>
                                            <div className="flex-1"><p className="font-semibold text-[15px]">SabNode</p><p className="text-xs opacity-80">online</p></div>
                                        </div>
                                        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                            <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '0.5s' }}><div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">STOP</div></div>
                                            <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '1.5s' }}><div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">You have been unsubscribed from our messages. Text START to subscribe again.</div></div>
                                        </div>
                                        <div className="bg-[#1F2C33] p-2 flex items-center gap-2 mt-auto z-10">
                                            <div className="bg-[#2A3942] rounded-full flex-1 flex items-center px-3"><Smile className="h-5 w-5 text-gray-400" /><Input className="bg-transparent border-none text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 h-10" placeholder="Message" /><Paperclip className="h-5 w-5 text-gray-400" /></div>
                                            <div className="bg-[#00A884] h-10 w-10 rounded-full flex items-center justify-center"><Mic className="h-5 w-5 text-white" /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 text-center sm:text-left">
                                <Shield className="h-8 w-8 text-primary"/>
                                <h3 className="text-2xl font-bold font-headline">Built-in Compliance Tools</h3>
                                <p className="text-muted-foreground">Easily manage opt-ins and opt-outs to stay compliant with WhatsApp policies and respect customer preferences.</p>
                            </div>
                        </div>

                        {/* Product Catalog Showcase */}
                        <div className="flex flex-col sm:flex-row-reverse items-center gap-8" key={`showcase-9-${animationKey}`}>
                            <div className="w-[340px] h-auto flex-shrink-0">
                                <div className="relative w-full h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                    <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                                        <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                            <ArrowLeft className="h-5 w-5 opacity-90" />
                                            <Avatar><AvatarFallback>E</AvatarFallback></Avatar>
                                            <div className="flex-1"><p className="font-semibold text-[15px]">Ecoshop</p><p className="text-xs opacity-80">online</p></div>
                                        </div>
                                        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                            <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '0.5s' }}><div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">Do you have any new arrivals?</div></div>
                                            <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '1.5s' }}>
                                                <div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">
                                                    <p>Yes we do! Check out our latest collection by tapping the button below.</p>
                                                    <div className="w-full bg-black/20 text-center rounded-md p-2 mt-2 font-medium text-base">
                                                        🛍️ View Products
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 flex flex-col justify-end z-20 animate-fade-in" style={{ animationDelay: '2.5s', opacity: 0 }}>
                                      <div className="bg-[#F0F2F5] h-[90%] rounded-t-2xl flex flex-col animate-slide-in-up" style={{ animationDelay: '2.8s' }}>
                                        <div className="p-2 border-b text-center font-semibold text-sm bg-white rounded-t-2xl">
                                          Our Collection
                                        </div>
                                        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                          <div className="flex gap-3 border rounded-lg p-2 bg-white">
                                            <Image src="https://placehold.co/80x80.png" alt="product" width={60} height={60} className="rounded-md" data-ai-hint="eco-friendly bottle"/>
                                            <div><p className="font-medium text-gray-800 text-sm">Eco Water Bottle</p><p className="text-xs text-muted-foreground">$15.00</p></div>
                                          </div>
                                           <div className="flex gap-3 border rounded-lg p-2 bg-white">
                                            <Image src="https://placehold.co/80x80.png" alt="product" width={60} height={60} className="rounded-md" data-ai-hint="bamboo toothbrush"/>
                                            <div><p className="font-medium text-gray-800 text-sm">Bamboo Toothbrush Set</p><p className="text-xs text-muted-foreground">$8.00</p></div>
                                          </div>
                                          <div className="flex gap-3 border rounded-lg p-2 bg-white">
                                            <Image src="https://placehold.co/80x80.png" alt="product" width={60} height={60} className="rounded-md" data-ai-hint="tote bag"/>
                                            <div><p className="font-medium text-gray-800 text-sm">Reusable Tote Bag</p><p className="text-xs text-muted-foreground">$12.00</p></div>
                                          </div>
                                        </div>
                                      </div>
                                   </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 text-center sm:text-left">
                                <ShoppingBag className="h-8 w-8 text-primary"/>
                                <h3 className="text-2xl font-bold font-headline">Interactive Product Catalogs</h3>
                                <p className="text-muted-foreground">Let customers browse and purchase your products directly in chat with rich, interactive catalog messages.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold font-headline">Loved by Businesses Worldwide</h2>
                        <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                            Don't just take our word for it. Here's what our customers have to say.
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6">
                        {testimonials.map((testimonial, index) => (
                            <Card key={index} className="w-full max-w-sm flex flex-col card-gradient card-gradient-blue">
                                <CardHeader>
                                    <Quote className="h-8 w-8 text-primary/30"/>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="italic text-foreground/90">"{testimonial.text}"</p>
                                </CardContent>
                                <CardFooter className="flex items-center gap-4 mt-4">
                                    <Avatar>
                                        <AvatarImage src={testimonial.avatar} alt={testimonial.name} data-ai-hint={testimonial.aiHint}/>
                                        <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{testimonial.name}</p>
                                        <p className="text-sm text-muted-foreground">{testimonial.title}</p>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-16 bg-muted">
                <div className="container max-w-3xl mx-auto px-4">
                    <div className="text-center space-y-4 mb-10"><h2 className="text-3xl md:text-4xl font-bold font-headline">Frequently Asked Questions</h2></div>
                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((faq, index) => (<AccordionItem value={`item-${index}`} key={index}><AccordionTrigger className="text-lg text-left">{faq.question}</AccordionTrigger><AccordionContent className="text-base text-muted-foreground">{faq.answer}</AccordionContent></AccordionItem>))}
                    </Accordion>
                </div>
            </section>
            
            {/* Final CTA Section */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <div className="relative overflow-hidden bg-primary text-primary-foreground rounded-lg p-8 md:p-12 text-center space-y-4">
                        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/10 rounded-full"></div>
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full"></div>
                        <h2 className="text-3xl md:text-4xl font-bold font-headline relative z-10">Ready to Supercharge Your WhatsApp?</h2>
                        <p className="max-w-xl mx-auto text-lg text-primary-foreground/80 relative z-10">
                            Join hundreds of businesses growing with SabNode. Create your account and launch your first campaign in minutes.
                        </p>
                        <Button size="lg" variant="secondary" asChild className="relative z-10">
                            <Link href="/signup">Sign Up Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
                        </Button>
                    </div>
                </div>
            </section>
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
    { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite' },
    { id: 'crm', href: '/dashboard/crm', icon: Handshake, label: 'CRM Suite' },
    { id: 'seo-suite', href: '/dashboard/seo', icon: SeoIcon, label: 'SEO Suite' },
    { id: 'url-shortener', href: '/dashboard/url-shortener', icon: LinkIcon, label: 'URL Shortener' },
    { id: 'qr-code-maker', href: '/dashboard/qr-code-maker', icon: QrCode, label: 'QR Code Maker' },
  ];

  const renderContent = () => {
    switch (activeApp) {
      case 'whatsapp':
        return <section id="whatsapp-suite"><WhatsAppShowcase /></section>;
      case 'facebook':
        return <section id="meta-suite"><MetaSuiteShowcase /></section>;
      case 'url-shortener':
         return (
            <section id="url-shortener">
                <AppShowcase title="Powerful URL Shortener" description="Create, manage, and track short links with our enterprise-grade toolkit.">
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient card-gradient-purple">
                        <CardHeader><CardTitle>Easy Shortening</CardTitle></CardHeader>
                        <CardContent className="flex-grow space-y-2">
                            <p className="text-muted-foreground text-sm">Create custom, branded short links with optional aliases and expiration dates.</p>
                            <div className="p-3 bg-background/50 rounded-md mt-2 space-y-2">
                                <Input defaultValue="https://your-long-url.com/..." disabled />
                                <Button className="w-full" disabled>Shorten</Button>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient card-gradient-green">
                        <CardHeader><CardTitle>Custom Domains</CardTitle></CardHeader>
                        <CardContent className="flex-grow space-y-2">
                            <p className="text-muted-foreground text-sm">Use your own domain for branded links, complete with DNS verification guidance.</p>
                            <div className="p-3 bg-background/50 rounded-md mt-2 space-y-2">
                                <Badge>links.mybrand.com</Badge>
                                <Input value="promo-2024" disabled />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient card-gradient-blue">
                        <CardHeader><CardTitle>Detailed Analytics</CardTitle></CardHeader>
                        <CardContent className="flex-grow space-y-2">
                            <p className="text-muted-foreground text-sm">Track every click with detailed logs including timestamp, referrer, and user agent.</p>
                            <div className="p-3 bg-background/50 rounded-md mt-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-2xl">1,234</span>
                                    <span className="text-sm text-muted-foreground">Total Clicks</span>
                                </div>
                                <div className="h-24 mt-2 bg-muted rounded-md flex items-end p-2 gap-1">
                                    <div className="w-1/4 h-[50%] bg-primary/50 rounded-t-sm"></div>
                                    <div className="w-1/4 h-[80%] bg-primary/50 rounded-t-sm"></div>
                                    <div className="w-1/4 h-[30%] bg-primary/50 rounded-t-sm"></div>
                                    <div className="w-1/4 h-[60%] bg-primary/50 rounded-t-sm"></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient card-gradient-orange">
                        <CardHeader><CardTitle>Tagging & Expiration</CardTitle></CardHeader>
                        <CardContent className="flex-grow space-y-2">
                            <p className="text-muted-foreground text-sm">Organize links with colored tags and set them to expire automatically.</p>
                            <div className="p-3 bg-background/50 rounded-md mt-2 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    <Badge style={{backgroundColor: '#4ade80'}}>Campaign A</Badge>
                                    <Badge style={{backgroundColor: '#60a5fa'}}>Social Media</Badge>
                                </div>
                                <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>Expires: 31 Dec 2024</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </AppShowcase>
            </section>
        );
      case 'qr-code-maker':
          return (
            <section id="qr-code-maker">
                <AppShowcase title="Advanced QR Code Generator" description="Generate and manage dynamic, trackable QR codes for any use case.">
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient card-gradient-orange">
                        <CardHeader><CardTitle>Multi-Type Codes</CardTitle></CardHeader>
                        <CardContent className="flex-grow space-y-2">
                            <p className="text-muted-foreground text-sm">Generate codes for URLs, Wi-Fi, contact cards, pre-filled SMS messages, and more.</p>
                            <div className="p-3 bg-background/50 rounded-md mt-2 grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 bg-muted rounded"><LinkIcon className="h-5 w-5 mx-auto"/></div>
                                <div className="p-2 bg-muted rounded"><Wifi className="h-5 w-5 mx-auto"/></div>
                                <div className="p-2 bg-muted rounded"><Type className="h-5 w-5 mx-auto"/></div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient card-gradient-purple">
                        <CardHeader><CardTitle>Dynamic QR Codes</CardTitle></CardHeader>
                        <CardContent className="flex-grow space-y-2">
                            <p className="text-muted-foreground text-sm">Update the destination of your URL codes at any time without reprinting.</p>
                            <div className="p-3 bg-background/50 rounded-md mt-2 flex items-center justify-center gap-4">
                                <Image src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=example" alt="QR Code" width={80} height={80} data-ai-hint="qr code" />
                                <Pencil className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient card-gradient-blue">
                        <CardHeader><CardTitle>Scan Analytics</CardTitle></CardHeader>
                        <CardContent className="flex-grow space-y-2">
                            <p className="text-muted-foreground text-sm">Track how many people scan your dynamic QR codes with detailed analytics.</p>
                            <div className="p-3 bg-background/50 rounded-md mt-2 flex items-center justify-center gap-4">
                                <Image src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=example" alt="QR Code" width={80} height={80} data-ai-hint="qr code"/>
                                <BarChart className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient card-gradient-green">
                        <CardHeader><CardTitle>Logo Embedding</CardTitle></CardHeader>
                        <CardContent className="flex-grow space-y-2">
                            <p className="text-muted-foreground text-sm">Add your brand's logo to the center of your QR code for a professional touch.</p>
                            <div className="p-3 bg-background/50 rounded-md mt-2 flex items-center justify-center">
                                <div className="relative">
                                    <Image src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=example" alt="QR Code" width={100} height={100} data-ai-hint="qr code" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-white p-1 rounded-full"><SabNodeLogo className="h-5 w-5"/></div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </AppShowcase>
            </section>
        );
      case 'crm':
        return <section id="crm-suite"><OverviewShowcase /></section>; // Placeholder, can create a new component later
      case 'overview':
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
                    <p className="text-sm text-muted-foreground max-w-xs">Your All-in-One Business Communication Platform.</p>
                    <div className="flex space-x-4">
                        <Link href="#"><Facebook className="h-5 w-5 hover:text-primary" /></Link>
                        <Link href="#"><Twitter className="h-5 w-5 hover:text-primary" /></Link>
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
export default function Home() {
  return <></>;
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
