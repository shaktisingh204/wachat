
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Send, Megaphone, Newspaper, MessageSquare, ArrowRight, Star, ChevronDown, Check, Users, Settings, Edit, Trash2, Calendar, ThumbsUp, Share2
} from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

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

export const MetaSuiteShowcase = () => {
    const features = [
        { icon: Newspaper, title: 'Unified Content Scheduler', description: "Plan and publish content across both Facebook and Instagram from a single, intuitive interface.", gradient: 'card-gradient-blue' },
        { icon: Megaphone, title: 'Click-to-WhatsApp Ads', description: "Launch and monitor ad campaigns that drive conversations directly from Facebook to your WhatsApp.", gradient: 'card-gradient-blue' },
        { icon: Users, title: 'Audience Management', description: "View your custom audiences and prepare targeted campaigns for maximum impact.", gradient: 'card-gradient-blue' },
        { icon: MessageSquare, title: 'Unified Inbox', description: "Engage with customers from Messenger and Instagram DMs in one centralized location.", gradient: 'card-gradient-blue' }
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
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">The Meta Suite by SabNode</h1>
                    <p className="mx-auto text-lg text-muted-foreground">Unify your social media presence. Manage content, ads, and messages for Facebook and Instagram from one powerful dashboard.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button size="lg" asChild><Link href="/signup">Get Started for Free <ArrowRight className="ml-2 h-5 w-5" /></Link></Button>
                        <Button size="lg" variant="outline" asChild><Link href="#features">Learn More <ChevronDown className="ml-2 h-5 w-5"/></Link></Button>
                    </div>
                </div>
            </div>
            
            {/* Features Section */}
            <section id="features" className="py-16 bg-muted rounded-lg">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-12"><h2 className="text-3xl md:text-4xl font-bold font-headline">One Hub for All Your Meta Channels</h2><p className="max-w-2xl mx-auto text-lg text-muted-foreground">Streamline your workflow and save time by managing all your Meta platforms from a single, powerful interface.</p></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => <OverviewFeatureCard key={index} {...feature} />)}
                    </div>
                </div>
            </section>
            
            {/* Showcase Section */}
            <section id="showcase" className="py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold font-headline">Built for Efficiency and Scale</h2>
                        <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                           See how our unified tools simplify content creation, scheduling, and ad management.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-16 xl:gap-24">
                        {/* Content Creation Mockup */}
                        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12" key={`meta-showcase-1-${animationKey}`}>
                            <div className="lg:w-1/3 space-y-4 text-center lg:text-left">
                                <h3 className="text-2xl font-bold font-headline">Create Once, Publish Everywhere</h3>
                                <p className="text-muted-foreground">
                                    Craft your post and schedule it for both Facebook and Instagram simultaneously. Upload images and videos with ease.
                                </p>
                            </div>
                            <div className="lg:w-2/3 p-4 rounded-lg bg-background/30 w-full flex justify-center">
                               <Card className="w-full max-w-lg shadow-xl animate-fade-in-up card-gradient card-gradient-blue">
                                    <CardHeader><CardTitle>Create New Post</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <Textarea placeholder="What's on your mind?" className="h-32"/>
                                        <Input type="file" />
                                        <div className="flex items-center space-x-2">
                                            <Switch id="schedule-switch" />
                                            <Label htmlFor="schedule-switch" className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4" />
                                                Schedule for later
                                            </Label>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end">
                                        <Button>Publish</Button>
                                    </CardFooter>
                               </Card>
                            </div>
                        </div>
                        {/* Post Management Mockup */}
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12" key={`meta-showcase-2-${animationKey}`}>
                            <div className="lg:w-1/3 space-y-4 text-center lg:text-left">
                                <h3 className="text-2xl font-bold font-headline">Manage All Your Content</h3>
                                <p className="text-muted-foreground">
                                   View your live and scheduled posts in one place. Edit captions, manage comments, and see performance at a glance.
                                </p>
                            </div>
                            <div className="lg:w-2/3 p-4 rounded-lg bg-background/30 w-full flex justify-center">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                                    <Card className="animate-fade-in-up card-gradient card-gradient-blue" style={{animationDelay: '0.2s'}}>
                                        <Image src="https://placehold.co/600x400.png" width={300} height={200} alt="post" className="rounded-t-lg" data-ai-hint="nature landscape" />
                                        <CardContent className="p-2 text-xs">Our new collection is here!</CardContent>
                                        <CardFooter className="p-2 flex justify-between text-xs text-muted-foreground">
                                            <div className="flex gap-2"><ThumbsUp className="h-3 w-3"/>1.2k <MessageSquare className="h-3 w-3"/>89</div>
                                            <div className="flex gap-1"><Button size="icon" variant="ghost" className="h-6 w-6"><Edit className="h-3 w-3"/></Button><Button size="icon" variant="ghost" className="h-6 w-6"><Trash2 className="h-3 w-3"/></Button></div>
                                        </CardFooter>
                                    </Card>
                                     <Card className="animate-fade-in-up card-gradient card-gradient-purple" style={{animationDelay: '0.4s'}}>
                                        <CardHeader>
                                            <div className="flex justify-between items-center">
                                                <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4"/>Scheduled</CardTitle>
                                                <CardDescription className="text-xs !mt-0">Tomorrow at 10 AM</CardDescription>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                                            Weekly update post about our new blog article...
                                        </CardContent>
                                        <CardFooter className="p-2 flex justify-end">
                                            <Button size="sm">Publish Now</Button>
                                        </CardFooter>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
