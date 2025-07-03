
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { WachatLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import {
  Send, GitBranch, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote, Check, AtSign, Zap, MessageCircle, ShoppingBag, Pencil, ServerCog, Megaphone, Play, LayoutGrid, Users, Shield, Repeat, ClipboardList, ArrowLeft, Video, Phone, MoreVertical, Smile, Paperclip, Camera, Mic, CheckCheck, Home, Link as LinkIcon, QrCode
} from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { WhatsAppIcon, FacebookIcon as FacebookAppIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';

const AppShowcase = ({ title, description, children, className }: { title: React.ReactNode, description: string, children: React.ReactNode, className?: string }) => (
    <div className={cn("space-y-8 animate-fade-in", className)}>
        <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-headline">{title}</h2>
            <p className="max-w-2xl mx-auto text-lg text-muted-foreground mt-2">{description}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children}
        </div>
    </div>
);

const FeatureCard = ({ icon: Icon, title, description, gradient }: { icon: React.ElementType, title: string, description: string, gradient?: string }) => (
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
    <AppShowcase title="Welcome to Wachat" description="An all-in-one platform for your messaging and marketing needs. Select a tool on the right to learn more.">
        <FeatureCard icon={Send} title="WhatsApp Campaigns" description="Launch targeted broadcast campaigns with detailed, real-time analytics." gradient="card-gradient-green" />
        <FeatureCard icon={Megaphone} title="Facebook Ads" description="Create and manage 'Click to WhatsApp' ad campaigns directly from the dashboard." gradient="card-gradient-blue" />
        <FeatureCard icon={LinkIcon} title="URL Shortener" description="Create branded, trackable short links for your campaigns." gradient="card-gradient-purple" />
        <FeatureCard icon={QrCode} title="QR Code Generator" description="Generate custom QR codes for URLs, Wi-Fi, contact cards, and more." gradient="card-gradient-orange" />
    </AppShowcase>
);

const WhatsAppShowcase = () => {
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
        { name: 'Maria Garcia', title: 'Marketing Manager, Bloom Co.', avatar: 'https://placehold.co/100x100.png', text: 'Wachat has revolutionized our customer outreach. The flow builder is incredibly intuitive, and we saw a 200% increase in engagement on our first campaign!', aiHint: 'woman portrait' },
        { name: 'David Chen', title: 'Support Lead, TechGear Inc.', avatar: 'https://placehold.co/100x100.png', text: "The unified live chat and AI auto-replies have cut our support response times in half. It's an essential tool for our team.", aiHint: 'man portrait' },
        { name: 'Aisha Ahmed', title: 'Founder, The Artisan Box', avatar: 'https://placehold.co/100x100.png', text: "As a small business, Wachat gave us the power of a full marketing team. Sending templates and managing contacts has never been easier.", aiHint: 'woman face' }
    ];
    const faqs = [
        { question: 'Is Wachat an official WhatsApp product?', answer: 'No, Wachat is an independent application that uses the official WhatsApp Business API provided by Meta. We provide a user-friendly interface to access the powerful features of the API.' },
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
        <div className="space-y-16 md:space-y-24">
            {/* Hero Section */}
            <div className="container mx-auto px-4 grid justify-items-center text-center gap-8">
                <div className="space-y-4 max-w-3xl">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">Streamline Your WhatsApp Business API Experience</h1>
                    <p className="mx-auto text-lg text-muted-foreground">Manage campaigns, automate conversations, and engage customers effortlessly with Wachat. The all-in-one platform for your WhatsApp marketing and support needs.</p>
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
                                <ArrowLeft className="h-5 w-5 opacity-90" /><Avatar><AvatarFallback>W</AvatarFallback></Avatar>
                                <div className="flex-1 flex flex-col items-start"><p className="font-semibold text-[15px]">Wachat</p><p className="text-xs opacity-80">online</p></div>
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
                        {features.map((feature, index) => <FeatureCard key={index} {...feature} />)}
                    </div>
                </div>
            </section>
            
            {/* Testimonials Section */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-12"><h2 className="text-3xl md:text-4xl font-bold font-headline">Loved by Businesses Worldwide</h2><p className="max-w-2xl mx-auto text-lg text-muted-foreground">Don't just take our word for it. Here's what our customers have to say.</p></div>
                    <div className="flex flex-wrap justify-center gap-6">
                        {testimonials.map((testimonial, index) => (
                            <Card key={index} className="w-full max-w-sm flex flex-col card-gradient card-gradient-blue">
                                <CardHeader><Quote className="h-8 w-8 text-primary/30"/></CardHeader>
                                <CardContent className="flex-grow"><p className="italic text-foreground/90">"{testimonial.text}"</p></CardContent>
                                <CardFooter className="flex items-center gap-4 mt-4"><Avatar><AvatarImage src={testimonial.avatar} alt={testimonial.name} data-ai-hint={testimonial.aiHint}/><AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback></Avatar><div><p className="font-semibold">{testimonial.name}</p><p className="text-sm text-muted-foreground">{testimonial.title}</p></div></CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-16 bg-muted rounded-lg">
                <div className="container max-w-3xl mx-auto px-4">
                    <div className="text-center space-y-4 mb-10"><h2 className="text-3xl md:text-4xl font-bold font-headline">Frequently Asked Questions</h2></div>
                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((faq, index) => (<AccordionItem value={`item-${index}`} key={index}><AccordionTrigger className="text-lg text-left">{faq.question}</AccordionTrigger><AccordionContent className="text-base text-muted-foreground">{faq.answer}</AccordionContent></AccordionItem>))}
                    </Accordion>
                </div>
            </section>
        </div>
    );
};

export default function HomePage() {
  const [activeApp, setActiveApp] = React.useState('overview');

  const appIcons = [
    { id: 'overview', icon: Home, label: 'Overview' },
    { id: 'whatsapp', icon: WhatsAppIcon, label: 'WhatsApp Suite' },
    { id: 'facebook', icon: FacebookAppIcon, label: 'Facebook Tools' },
    { id: 'instagram', icon: InstagramIcon, label: 'Instagram Tools' },
    { id: 'url-shortener', icon: LinkIcon, label: 'URL Shortener' },
    { id: 'qr-code-maker', icon: QrCode, label: 'QR Code Maker' },
  ];

  const renderContent = () => {
    switch (activeApp) {
      case 'whatsapp':
        return <WhatsAppShowcase />;
      case 'facebook':
        return <AppShowcase title="Facebook Integration" description="Connect your Facebook assets for seamless ad management."><FeatureCard icon={Megaphone} title="Facebook Ads" description="Create and manage 'Click to WhatsApp' ad campaigns directly from the dashboard." gradient="card-gradient-blue" /><ComingSoonCard title="Audience Management" icon={Users} /><ComingSoonCard title="Page Post Sync" icon={Newspaper} /><ComingSoonCard title="Lead Form Integration" icon={FileText} /></AppShowcase>;
      case 'instagram':
        return <AppShowcase title="Instagram Tools" description="Manage your Instagram presence alongside your other channels."><ComingSoonCard title="Instagram DM Inbox" icon={MessageSquare} /><ComingSoonCard title="Story Replies" icon={Repeat} /><ComingSoonCard title="Post Comments" icon={Quote} /><ComingSoonCard title="Reels Management" icon={Video} /></AppShowcase>;
      case 'url-shortener':
         return <AppShowcase title="URL Shortener" description="Create, manage, and track short links."><FeatureCard icon={LinkIcon} title="Easy Shortening" description="Create custom, branded short links with optional aliases and tags." gradient="card-gradient-purple" /><ComingSoonCard title="Custom Domains" icon={Shield} /><ComingSoonCard title="Detailed Analytics" icon={BarChart} /><ComingSoonCard title="Link Expiration" icon={Clock} /></AppShowcase>;
      case 'qr-code-maker':
          return <AppShowcase title="QR Code Generator" description="Generate and manage dynamic QR codes."><FeatureCard icon={QrCode} title="Multi-Type Codes" description="Generate codes for URLs, Wi-Fi, contact cards, pre-filled SMS messages, and more." gradient="card-gradient-orange" /><ComingSoonCard title="Dynamic QR Codes" icon={Pencil} /><ComingSoonCard title="Scan Analytics" icon={BarChart} /><ComingSoonCard title="Logo Embedding" icon={Star} /></AppShowcase>;
      case 'overview':
      default:
        return <OverviewShowcase />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-14 items-center">
          <div className="mr-4 flex"><Link href="/" className="mr-6 flex items-center space-x-2"><WachatLogo className="h-8 w-auto" /></Link></div>
          <div className="flex flex-1 items-center justify-end space-x-2"><Button variant="ghost" asChild><Link href="/login">Sign In</Link></Button><Button asChild><Link href="/signup">Sign Up</Link></Button></div>
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
      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row justify-between items-center gap-4"><p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Wachat. All rights reserved.</p><div className="flex gap-4"><Link href="/terms-and-conditions" className="text-sm text-muted-foreground hover:text-primary">Terms & Conditions</Link><Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary">Privacy Policy</Link></div></div>
      </footer>
    </div>
  );
}
