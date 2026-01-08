
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import {
  Send, GitBranch, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote, Check, AtSign, Zap, MessageCircle, ShoppingBag, Pencil, ServerCog, Megaphone, Play, LayoutGrid, Users, Shield, Repeat, ClipboardList, ArrowLeft, Video, Phone, MoreVertical, Smile, Paperclip, Camera, Mic, CheckCheck, Home, Link as LinkIcon, QrCode, BarChart, FileText, Newspaper, Clapperboard, Handshake, Brush, Mail, GitFork, Linkedin, Facebook as FacebookIcon
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
        
    </AppShowcase>
);

const WhatsAppShowcase = () => {
    const [animationKey, setAnimationKey] = React.useState(0);
    React.useEffect(() => {
        const animationDuration = 10000;
        const timer = setInterval(() => setAnimationKey(prevKey => prevKey + 1), animationDuration);
        return () => clearInterval(timer);
    }, []);
    return(
        <div className="space-y-16 md:space-y-24">
            <div className="container mx-auto px-4 grid justify-items-center text-center gap-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* First Phone */}
                    <div className="relative w-[340px] h-[660px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800" key={`showcase-1-${animationKey}`}>
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
                     {/* Second Phone */}
                    <div className="relative w-full h-[660px] overflow-hidden" key={`showcase-2-${animationKey}`}>
                        <div className="p-4 rounded-lg bg-background/30 w-full h-full">
                            <div className="relative h-full w-full overflow-hidden">
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
                </div>
            </div>
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
    { id: 'website-builder', href: '/dashboard/website-builder', icon: Brush, label: 'Website Builder' },
    { id: 'email', href: '/dashboard/email', icon: Mail, label: 'Email Suite' },
    { id: 'sms', href: '/dashboard/sms', icon: MessageSquare, label: 'SMS Suite' },
    { id: 'sabflow', href: '/dashboard/sabflow', icon: GitFork, label: 'SabFlow' },
    { id: 'sabchat', href: '/dashboard/sabchat', icon: SabChatIcon, label: 'SabChat' },
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
                        <Link href="#"><FacebookIcon className="h-5 w-5 hover:text-primary" /></Link>
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
