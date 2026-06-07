'use client';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Input,
  Field,
} from '@/components/sabcrm/20ui';
import {
  Megaphone,
  Newspaper,
  MessageSquare,
  ArrowRight,
  ChevronDown,
  LayoutGrid,
  Brush,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import React from 'react';

import Link from 'next/link';

const OverviewFeatureCard = ({ icon: Icon, title, description, gradient }: { icon: React.ElementType, title: string, description: string, gradient?: string }) => (
    <Card className={cn("hover:shadow-lg hover:-translate-y-1 transition-transform flex flex-col card-gradient", gradient)}>
        <CardHeader className="items-center">
            <div className="p-4 bg-[var(--st-text)]/10 rounded-full">
                <Icon className="h-8 w-8 text-[var(--st-text)]" aria-hidden="true" />
            </div>
        </CardHeader>
        <CardBody className="space-y-2 flex-grow text-center">
            <h3 className="text-xl font-semibold text-[var(--st-text)]">{title}</h3>
            <p className="text-[var(--st-text-secondary)]">{description}</p>
        </CardBody>
    </Card>
);

export const MetaSuiteShowcase = () => {
    const features = [
        { icon: Newspaper, title: 'Unified Content Scheduler', description: "Plan and publish content across both Facebook and Instagram from a single, intuitive interface.", gradient: 'card-gradient-blue' },
        { icon: Megaphone, title: 'Click-to-WhatsApp Ads', description: "Launch and monitor ad campaigns that drive conversations directly from Facebook to your WhatsApp.", gradient: 'card-gradient-blue' },
        { icon: MessageSquare, title: 'Unified Inbox & Kanban', description: "Manage Messenger conversations visually with a drag-and-drop Kanban board.", gradient: 'card-gradient-blue' },
        { icon: Brush, title: 'Custom Website Builder', description: "Build interactive webviews and landing pages that launch directly from Messenger.", gradient: 'card-gradient-blue' }
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
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter text-[var(--st-text)]">The Meta Suite by SabNode</h1>
                    <p className="mx-auto text-lg text-[var(--st-text-secondary)]">Unify your social media presence. Manage content, ads, and messages for Facebook and Instagram from one powerful dashboard.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/signup"><Button size="lg" variant="primary" iconRight={ArrowRight}>Get Started for Free</Button></Link>
                        <Link href="#features"><Button size="lg" variant="outline" iconRight={ChevronDown}>Learn More</Button></Link>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <section id="features" className="py-16 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)]">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-12"><h2 className="text-3xl md:text-4xl font-bold font-headline text-[var(--st-text)]">One Hub for All Your Meta Channels</h2><p className="max-w-2xl mx-auto text-lg text-[var(--st-text-secondary)]">Streamline your workflow and save time by managing all your Meta platforms from a single, powerful interface.</p></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => <OverviewFeatureCard key={index} {...feature} />)}
                    </div>
                </div>
            </section>

            {/* Showcase Section */}
            <section id="showcase" className="py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <div className="text-center space-y-4 mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold font-headline text-[var(--st-text)]">Built for Efficiency and Scale</h2>
                        <p className="max-w-2xl mx-auto text-lg text-[var(--st-text-secondary)]">
                            See how our unified tools simplify your social media management.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-16 xl:gap-24">
                        {/* Live Chat Mockup */}
                        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12" key={`meta-showcase-chat-${animationKey}`}>
                            <div className="lg:w-1/3 space-y-4 text-center lg:text-left">
                                <h3 className="text-2xl font-bold font-headline text-[var(--st-text)]">Unified Messenger Inbox</h3>
                                <p className="text-[var(--st-text-secondary)]">
                                    Manage all your Facebook Messenger conversations in one place. Assign chats, use canned replies, and never miss a message.
                                </p>
                            </div>
                            <div className="lg:w-2/3 p-4 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]/30 w-full flex justify-center">
                                <Card padding="none" className="w-full shadow-xl animate-fade-in-up flex h-[450px] overflow-hidden">
                                    <div className="w-1/3 border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex flex-col">
                                        <div className="p-3 border-b border-[var(--st-border)]"><Input placeholder="Search..." aria-label="Search conversations" /></div>
                                        <div className="flex-1 overflow-y-auto">
                                            <div className="p-3 flex gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                                <Avatar><AvatarImage src="https://placehold.co/100x100.png" alt="Aisha Ahmed" data-ai-hint="woman portrait" /><AvatarFallback>A</AvatarFallback></Avatar>
                                                <div><p className="font-semibold text-sm text-[var(--st-text)]">Aisha Ahmed</p><p className="text-xs text-[var(--st-text-secondary)]">Thanks for the help!</p></div>
                                            </div>
                                            <div className="p-3 flex gap-3 border-b border-[var(--st-border)]">
                                                <Avatar><AvatarImage src="https://placehold.co/100x100.png" alt="David Chen" data-ai-hint="man portrait" /><AvatarFallback>D</AvatarFallback></Avatar>
                                                <div><p className="font-semibold text-sm text-[var(--st-text)]">David Chen</p><p className="text-xs text-[var(--st-text-secondary)]">Sure, here is my order #...</p></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-2/3 flex flex-col">
                                        <div className="p-3 border-b border-[var(--st-border)] flex-shrink-0 flex items-center gap-2"><Avatar><AvatarFallback>A</AvatarFallback></Avatar><p className="font-semibold text-[var(--st-text)]">Aisha Ahmed</p></div>
                                        <div className="flex-1 p-4 space-y-3 bg-[var(--st-bg-muted)]">
                                            <div className="flex justify-start"><div className="bg-[var(--st-bg-secondary)] p-2 rounded-[var(--st-radius)] text-sm text-[var(--st-text)]">Is the blue shirt in stock?</div></div>
                                            <div className="flex justify-end animate-fade-in-up [animation-delay:0.5s]"><div className="bg-[var(--st-accent)] text-[var(--st-text-inverted)] p-2 rounded-[var(--st-radius)] text-sm">Yes it is! Would you like to order?</div></div>
                                        </div>
                                        <div className="p-2 border-t border-[var(--st-border)]"><Input placeholder="Type a message..." aria-label="Type a message" /></div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                        {/* Kanban Board Mockup */}
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12" key={`meta-showcase-kanban-${animationKey}`}>
                            <div className="lg:w-1/3 space-y-4 text-center lg:text-left">
                                <h3 className="text-2xl font-bold font-headline text-[var(--st-text)]">Visualize Your Workflow</h3>
                                <p className="text-[var(--st-text-secondary)]">
                                    Drag and drop conversations through your pipeline. From new lead to resolved ticket, never lose track of a customer again.
                                </p>
                            </div>
                            <div className="lg:w-2/3 p-4 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]/30 w-full">
                                <div className="relative h-[450px] w-full overflow-hidden">
                                    <div className="flex h-full gap-4">
                                        {/* Column 1: New */}
                                        <div className="w-1/3 bg-[var(--st-bg-secondary)]/50 rounded-[var(--st-radius)] p-2 md:p-3 flex flex-col gap-3">
                                            <h3 className="font-semibold px-2 text-[var(--st-text)]">New Leads (2)</h3>
                                            <div className="bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] shadow">
                                                <p className="font-semibold text-sm text-[var(--st-text)]">Aisha Ahmed</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Interested in the new collection.</p>
                                            </div>
                                            <div className="bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] shadow animate-kanban-drag relative z-10">
                                                <p className="font-semibold text-sm text-[var(--st-text)]">David Chen</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Where is my order #1234?</p>
                                            </div>
                                        </div>
                                        {/* Column 2: Open */}
                                        <div className="w-1/3 bg-[var(--st-bg-secondary)]/50 rounded-[var(--st-radius)] p-2 md:p-3 flex flex-col gap-3">
                                            <h3 className="font-semibold px-2 text-[var(--st-text)]">Open Tickets (1)</h3>
                                            <div className="bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] shadow">
                                                <p className="font-semibold text-sm text-[var(--st-text)]">Maria Garcia</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Follow-up on quote required.</p>
                                            </div>
                                        </div>
                                        {/* Column 3: Resolved */}
                                        <div className="w-1/3 bg-[var(--st-bg-secondary)]/50 rounded-[var(--st-radius)] p-2 md:p-3 flex flex-col gap-3">
                                            <h3 className="font-semibold px-2 text-[var(--st-text)]">Resolved (0)</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Website Builder Mockup */}
                        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12" key={`meta-showcase-builder-${animationKey}`}>
                            <div className="lg:w-1/3 space-y-4 text-center lg:text-left">
                                <h3 className="text-2xl font-bold font-headline text-[var(--st-text)]">Custom Website Builder</h3>
                                <p className="text-[var(--st-text-secondary)]">
                                    Build custom landing pages, product galleries, or forms that launch directly from Messenger or your Facebook Page.
                                </p>
                            </div>
                            <div className="lg:w-2/3 p-4 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]/30 w-full flex justify-center">
                                <Card padding="none" className="w-full shadow-xl animate-fade-in-up flex h-[450px] overflow-hidden">
                                    <div className="w-1/4 border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex flex-col p-2 space-y-2">
                                        <Button variant="outline" size="sm" className="justify-start" iconLeft={LayoutGrid}>Section</Button>
                                        <Button variant="outline" size="sm" className="justify-start" iconLeft={Newspaper}>Heading</Button>
                                        <Button variant="outline" size="sm" className="justify-start" iconLeft={ShoppingBag}>Products</Button>
                                    </div>
                                    <div className="flex-1 p-4 bg-[var(--st-bg-muted)]">
                                        <div className="bg-[var(--st-bg)] p-4 rounded-[var(--st-radius)] shadow-inner space-y-4">
                                            <div className="h-24 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] animate-pulse"></div>
                                            <div className="space-y-2">
                                                <div className="h-6 w-2/3 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] animate-pulse"></div>
                                                <div className="h-4 w-full bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-1/3 border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 space-y-4">
                                        <h4 className="font-semibold text-sm text-[var(--st-text)]">Properties</h4>
                                        <Field label="Background">
                                            <Input type="color" defaultValue="#e2e8f0" aria-label="Background color" />
                                        </Field>
                                        <Field label="Padding">
                                            <Input type="number" defaultValue="32" aria-label="Padding in pixels" />
                                        </Field>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
