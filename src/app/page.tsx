
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { WachatLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import {
  Send, GitBranch, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote, Check, AtSign, Zap, MessageCircle, ShoppingBag, Pencil, ServerCog, Megaphone, Play, LayoutGrid, Users, Shield, Repeat, ClipboardList, ArrowLeft, Video, Phone, MoreVertical, Smile, Paperclip, Camera, Mic, CheckCheck
} from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const features = [
  {
    icon: <Send className="h-8 w-8 text-primary" />,
    title: 'Campaign Management',
    description: 'Launch targeted broadcast campaigns with detailed, real-time analytics and delivery reports.',
    gradient: 'card-gradient-green',
  },
  {
    icon: <GitBranch className="h-8 w-8 text-primary" />,
    title: 'No-Code Flow Builder',
    description: 'Design powerful, automated conversational flows with our intuitive drag-and-drop builder.',
    gradient: 'card-gradient-blue',
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    title: 'Unified Live Chat',
    description: 'Engage with your customers in real-time through a multi-agent live chat interface.',
    gradient: 'card-gradient-purple',
  },
  {
    icon: <Bot className="h-8 w-8 text-primary" />,
    title: 'AI-Powered Replies',
    description: 'Leverage AI to handle common queries, provide instant support, and translate messages automatically.',
    gradient: 'card-gradient-orange',
  },
  {
    icon: <ServerCog className="h-8 w-8 text-primary" />,
    title: 'Interactive Flows',
    description: 'Build rich, native forms and UI screens that open directly inside WhatsApp, boosting conversion rates.',
    gradient: 'card-gradient-green',
  },
  {
    icon: <Megaphone className="h-8 w-8 text-primary" />,
    title: 'WhatsApp Ads',
    description: 'Create and manage "Click to WhatsApp" ad campaigns directly from the dashboard to drive new leads.',
    gradient: 'card-gradient-blue',
  },
  {
    icon: <LayoutGrid className="h-8 w-8 text-primary" />,
    title: 'Kanban Chat View',
    description: 'Organize conversations visually with a drag-and-drop Kanban board to track leads and support tickets.',
    gradient: 'card-gradient-purple',
  }
];


const testimonials = [
    {
        name: 'Maria Garcia',
        title: 'Marketing Manager, Bloom Co.',
        avatar: 'https://placehold.co/100x100.png',
        text: 'Wachat has revolutionized our customer outreach. The flow builder is incredibly intuitive, and we saw a 200% increase in engagement on our first campaign!',
        aiHint: 'woman portrait',
    },
    {
        name: 'David Chen',
        title: 'Support Lead, TechGear Inc.',
        avatar: 'https://placehold.co/100x100.png',
        text: "The unified live chat and AI auto-replies have cut our support response times in half. It's an essential tool for our team.",
        aiHint: 'man portrait',
    },
    {
        name: 'Aisha Ahmed',
        title: 'Founder, The Artisan Box',
        avatar: 'https://placehold.co/100x100.png',
        text: "As a small business, Wachat gave us the power of a full marketing team. Sending templates and managing contacts has never been easier.",
        aiHint: 'woman face',
    }
]

const faqs = [
    {
        question: 'Is Wachat an official WhatsApp product?',
        answer: 'No, Wachat is an independent application that uses the official WhatsApp Business API provided by Meta. We provide a user-friendly interface to access the powerful features of the API.'
    },
    {
        question: 'What do I need to get started?',
        answer: "You'll need a WhatsApp Business Account (WABA) and a phone number that is not currently being used by a personal WhatsApp account. Our embedded signup process will guide you through connecting your account."
    },
    {
        question: 'Can I use my existing WhatsApp number?',
        answer: "You cannot use a number that is currently active on the consumer WhatsApp app. You'll need to use a new number or migrate your existing business number to the WhatsApp Business API, which is a process we can help guide you through."
    },
    {
        question: 'Is there a free trial?',
        answer: 'Yes, you can sign up for free to explore the platform. Meta may have its own charges for sending messages, which are separate from our platform fees. Please refer to Meta\'s documentation for their latest pricing.'
    }
]

export default function HomePage() {
  const [animationKey, setAnimationKey] = React.useState(0);

  React.useEffect(() => {
    const animationDuration = 10000;
    const timer = setInterval(() => {
        setAnimationKey(prevKey => prevKey + 1);
    }, animationDuration);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center">
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
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto grid justify-items-center text-center gap-8">
            <div className="space-y-4 max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">
                Streamline Your WhatsApp Business API Experience
              </h1>
              <p className="mx-auto text-lg text-muted-foreground">
                Manage campaigns, automate conversations, and engage customers effortlessly with Wachat. The all-in-one platform for your WhatsApp marketing and support needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/signup">Get Started for Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#features">Learn More <ChevronDown className="ml-2 h-5 w-5"/></Link>
                </Button>
              </div>
            </div>
            <div key={animationKey} className="relative mt-8 flex justify-center">
              {/* Doodles */}
              <Zap className="h-8 w-8 text-yellow-400 absolute top-0 -left-4 animate-fade-in-up" style={{animationDelay: '0.5s'}} />
              <AtSign className="h-6 w-6 text-red-400 absolute top-16 -right-8 animate-fade-in-up" style={{animationDelay: '0.7s'}}/>
              <Pencil className="h-7 w-7 text-blue-400 absolute bottom-24 -left-12 animate-fade-in-up" style={{animationDelay: '0.9s'}}/>
              <ShoppingBag className="h-9 w-9 text-green-500 absolute bottom-8 -right-4 animate-fade-in-up" style={{animationDelay: '1.1s'}}/>
              <MessageCircle className="h-5 w-5 text-purple-400 absolute top-3/4 left-0 animate-fade-in-up" style={{animationDelay: '1.3s'}}/>
              <Check className="h-8 w-8 text-green-500 absolute top-8 right-0 animate-fade-in-up" style={{animationDelay: '1.5s'}}/>

              {/* Phone Mockup */}
               <div className="relative w-80 h-[640px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                <div 
                    className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" 
                    style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}
                >
                   <div className="absolute inset-0 bg-black/5"></div>
                   {/* Header */}
                   <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                        <ArrowLeft className="h-5 w-5 opacity-90" />
                        <Avatar><AvatarFallback>W</AvatarFallback></Avatar>
                        <div className="flex-1 flex flex-col items-start">
                            <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-[15px]">Wachat</p>
                                <CheckCheck className="h-4 w-4 text-green-400" />
                            </div>
                            <p className="text-xs opacity-80">tap here for contact info</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <Video className="h-5 w-5 opacity-90" />
                            <Phone className="h-5 w-5 opacity-90" />
                            <MoreVertical className="h-5 w-5 opacity-90" />
                        </div>
                    </div>
                   {/* Chat */}
                   <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                        {/* 1. User says Hi */}
                        <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '1s' }}>
                            <div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">
                                <p>Hi</p>
                                <div className="text-right text-[10px] text-white/60 mt-1">10:00 AM</div>
                            </div>
                        </div>
                        {/* 2. Bot auto-reply */}
                        <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '2.5s' }}>
                            <div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">
                                <p>Welcome to Wachat! How can I help you today? Type "Start flow" to see our product showcase.</p>
                                 <div className="text-right text-[10px] text-[#A3E9D5] mt-1 flex items-center justify-end gap-1"><span>10:01 AM</span><CheckCheck className="h-4 w-4 text-[#A3E9D5]" /></div>
                            </div>
                        </div>
                        {/* 3. User says Start flow */}
                        <div className="flex justify-start animate-fade-in-up" style={{ animationDelay: '4s' }}>
                            <div className="bg-[#202C33] text-white rounded-lg rounded-tl-none p-2 text-sm max-w-xs shadow">
                                <p>Start flow</p>
                                <div className="text-right text-[10px] text-white/60 mt-1">10:02 AM</div>
                            </div>
                        </div>
                        {/* 4. Flow Welcome */}
                        <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '5s' }}>
                            <div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">
                                <p>Welcome to the product showcase! Here is our latest item, fresh from our API.</p>
                                <div className="text-right text-[10px] text-[#A3E9D5] mt-1 flex items-center justify-end gap-1"><span>10:02 AM</span><CheckCheck className="h-4 w-4 text-[#A3E9D5]" /></div>
                            </div>
                        </div>
                        {/* 5. Flow Image */}
                        <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '6s' }}>
                            <div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-1 text-sm max-w-xs shadow">
                                <Image src="https://placehold.co/600x400.png" alt="product" width={200} height={150} className="rounded-md" data-ai-hint="sneaker product photo" />
                                <div className="p-1.5">
                                    <p className="pt-1">Our new Super Sneakers are now in stock!</p>
                                    <div className="text-right text-[10px] text-[#A3E9D5] mt-1 flex items-center justify-end gap-1"><span>10:02 AM</span><CheckCheck className="h-4 w-4 text-[#A3E9D5]" /></div>
                                </div>
                            </div>
                        </div>
                        {/* 6. Flow Template with Button */}
                        <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: '7.5s' }}>
                            <div className="bg-[#005C4B] text-white rounded-lg rounded-tr-none p-2 text-sm max-w-xs shadow">
                                <p>Ready to see more? Open our interactive order form to browse the full catalog!</p>
                                <div className="w-full bg-black/20 text-center rounded-md p-2 mt-2 font-medium text-base">🛒 Order Now</div>
                                <div className="text-right text-[10px] text-[#A3E9D5] mt-1 flex items-center justify-end gap-1"><span>10:03 AM</span><CheckCheck className="h-4 w-4 text-[#A3E9D5]" /></div>
                            </div>
                        </div>
                   </div>
                   {/* Input Footer */}
                   <div className="bg-[#1F2C33] p-2 flex items-center gap-2 mt-auto z-10">
                        <div className="bg-[#2A3942] rounded-full flex-1 flex items-center px-3">
                            <Smile className="h-5 w-5 text-gray-400" />
                            <Input className="bg-transparent border-none text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 h-10" placeholder="Message" />
                            <Paperclip className="h-5 w-5 text-gray-400" />
                            <Camera className="h-5 w-5 text-gray-400 ml-2" />
                        </div>
                        <div className="bg-[#00A884] h-10 w-10 rounded-full flex items-center justify-center">
                            <Mic className="h-5 w-5 text-white" />
                        </div>
                    </div>
                   {/* Meta Flow Overlay */}
                   <div className="absolute inset-0 bg-black/40 flex flex-col justify-end z-20 animate-fade-in" style={{ animationDelay: '8.5s', opacity: 0 }}>
                      <div className="bg-[#F0F2F5] h-[90%] rounded-t-2xl flex flex-col animate-slide-in-up" style={{ animationDelay: '8.5s' }}>
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
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 bg-muted">
          <div className="container mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">Powerful Tools for Growth</h2>
              <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                Everything you need to scale your customer communication on WhatsApp.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className={cn("text-center hover:shadow-lg hover:-translate-y-2 transition-transform duration-300 flex flex-col card-gradient", feature.gradient)}>
                  <CardHeader className="items-center">
                    <div className="p-4 bg-primary/10 rounded-full">
                        {feature.icon}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 flex-grow">
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Showcase Section */}
        <section id="showcase" className="py-16 md:py-24 bg-muted">
            <div className="container mx-auto">
                <div className="text-center space-y-4 mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">One Platform, Complete Control</h2>
                    <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                        From visual automations to conversation management, see how Wachat puts you in control of the entire customer journey.
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
                            <div className="relative w-80 h-[640px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                <div 
                                    className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" 
                                    style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}
                                >
                                    <div className="absolute inset-0 bg-black/5"></div>
                                    {/* Header */}
                                    <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                        <ArrowLeft className="h-5 w-5 opacity-90" />
                                        <Avatar><AvatarFallback>W</AvatarFallback></Avatar>
                                        <div className="flex-1 flex flex-col items-start">
                                            <div className="flex items-center gap-1.5"><p className="font-semibold text-[15px]">Wachat</p><CheckCheck className="h-4 w-4 text-green-400" /></div>
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
                    <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12" key={`showcase-3-${animationKey}`}>
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
            <div className="container mx-auto">
                <div className="text-center space-y-4 mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">A Complete Toolkit for WhatsApp</h2>
                    <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                        Wachat is packed with features designed to handle every aspect of your customer communication.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-24">
                    {/* Agent Collaboration */}
                    <div className="flex flex-col sm:flex-row items-center gap-8" key={`showcase-4-${animationKey}`}>
                        <div className="w-80 h-auto flex-shrink-0">
                            <div className="relative w-full h-[640px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
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
                         <div className="w-80 h-auto flex-shrink-0">
                            <div className="relative w-full h-[640px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                                    <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                        <ArrowLeft className="h-5 w-5 opacity-90" />
                                        <Avatar><AvatarFallback>W</AvatarFallback></Avatar>
                                        <div className="flex-1"><p className="font-semibold text-[15px]">Wachat</p><p className="text-xs opacity-80">online</p></div>
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
                        <div className="w-80 h-auto flex-shrink-0">
                            <div className="relative w-full h-[640px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
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
                         <div className="w-80 h-auto flex-shrink-0">
                            <div className="relative w-full h-[640px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
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
                         <div className="w-80 h-auto flex-shrink-0">
                            <div className="relative w-full h-[640px] bg-slate-900 rounded-[2.5rem] p-1.5 shadow-2xl ring-4 ring-slate-800">
                                <div className="h-full bg-slate-900 rounded-[2.25rem] flex flex-col relative overflow-hidden bg-center bg-cover" style={{backgroundImage: "url('/images/chat-bg-dark.png')"}}>
                                    <div className="bg-[#1F2C33] text-white p-2.5 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                                        <ArrowLeft className="h-5 w-5 opacity-90" />
                                        <Avatar><AvatarFallback>W</AvatarFallback></Avatar>
                                        <div className="flex-1"><p className="font-semibold text-[15px]">Wachat</p><p className="text-xs opacity-80">online</p></div>
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
                </div>
            </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16">
            <div className="container mx-auto">
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
            <div className="container max-w-3xl mx-auto">
                 <div className="text-center space-y-4 mb-10">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Frequently Asked Questions</h2>
                </div>
                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem value={`item-${index}`} key={index}>
                            <AccordionTrigger className="text-lg text-left">{faq.question}</AccordionTrigger>
                            <AccordionContent className="text-base text-muted-foreground">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
        
        {/* Final CTA Section */}
        <section className="py-16">
            <div className="container mx-auto">
                <div className="relative overflow-hidden bg-primary text-primary-foreground rounded-lg p-8 md:p-12 text-center space-y-4">
                     <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/10 rounded-full"></div>
                     <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full"></div>
                     <h2 className="text-3xl md:text-4xl font-bold font-headline relative z-10">Ready to Supercharge Your WhatsApp?</h2>
                     <p className="max-w-xl mx-auto text-lg text-primary-foreground/80 relative z-10">
                        Join hundreds of businesses growing with Wachat. Create your account and launch your first campaign in minutes.
                    </p>
                    <Button size="lg" variant="secondary" asChild className="relative z-10">
                        <Link href="/signup">Sign Up Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
                    </Button>
                </div>
            </div>
        </section>


      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
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
