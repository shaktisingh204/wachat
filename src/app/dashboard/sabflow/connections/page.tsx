
'use client';

import { useState, useEffect, useTransition, useActionState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Zap, Plus, Search, GitFork, Briefcase, Mail, MessageSquare, Server, Link as LinkIcon, QrCode, Users, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NewConnectionDialog } from '@/components/wabasimplify/new-connection-dialog';
import { WhatsAppIcon, MetaIcon, SeoIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { getSession } from '@/app/actions';
import { saveSabFlowConnection } from '@/app/actions/sabflow.actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle } from 'lucide-react';

const appCategories = [
    {
        name: 'SabNode Apps',
        apps: [
            { id: 'wachat', name: 'Wachat', category: 'WhatsApp API', icon: WhatsAppIcon, connectionType: 'internal' },
            { id: 'crm', name: 'CRM Suite', category: 'Business Management', icon: Briefcase, connectionType: 'internal' },
            { id: 'sabchat', name: 'sabChat', category: 'Live Chat', icon: SabChatIcon, connectionType: 'internal' },
            { id: 'meta', name: 'Meta Suite', category: 'Social Media', icon: MetaIcon, connectionType: 'internal' },
            { id: 'instagram', name: 'Instagram Suite', category: 'Social Media', icon: InstagramIcon, connectionType: 'internal' },
            { id: 'email', name: 'Email Suite', category: 'Marketing', icon: Mail, connectionType: 'internal' },
            { id: 'sms', name: 'SMS Suite', category: 'Marketing', icon: MessageSquare, connectionType: 'internal' },
            { id: 'url-shortener', name: 'URL Shortener', category: 'Utilities', icon: LinkIcon, connectionType: 'internal' },
            { id: 'qr-code-maker', name: 'QR Code Maker', category: 'Utilities', icon: QrCode, connectionType: 'internal' },
            { id: 'seo-suite', name: 'SEO Suite', category: 'Marketing', icon: SeoIcon, connectionType: 'internal' },
        ]
    },
    {
        name: 'Popular Apps',
        apps: [
            { id: 'google_sheets', name: 'Google Sheets', category: 'Productivity', logo: 'https://picsum.photos/seed/gsheets/40/40', connectionType: 'oauth' },
            { 
                id: 'stripe', name: 'Stripe', category: 'Payment', logo: 'https://picsum.photos/seed/stripe/40/40', connectionType: 'apikey',
                credentials: [
                    { name: 'apiKey', label: 'API Key', type: 'password' },
                ]
            },
            { 
                id: 'shopify', name: 'Shopify', category: 'E-Commerce', logo: 'https://picsum.photos/seed/shopify/40/40', connectionType: 'apikey',
                credentials: [
                    { name: 'shopName', label: 'Shop Name', type: 'text', placeholder: 'your-store' },
                    { name: 'accessToken', label: 'Admin API Access Token', type: 'password' },
                ]
            },
            { id: 'slack', name: 'Slack', category: 'Communication', logo: 'https://picsum.photos/seed/slack/40/40', connectionType: 'oauth' },
            { id: 'gmail', name: 'Gmail', category: 'Email', logo: 'https://picsum.photos/seed/gmail/40/40', connectionType: 'oauth' },
            { 
                id: 'hubspot', name: 'HubSpot', category: 'CRM', logo: 'https://picsum.photos/seed/hubspot/40/40', connectionType: 'apikey',
                credentials: [
                     { name: 'accessToken', label: 'Private App Access Token', type: 'password' },
                ]
            },
            { id: 'discord', name: 'Discord', category: 'Communication', logo: 'https://picsum.photos/seed/discord/40/40', connectionType: 'oauth' },
            { id: 'notion', name: 'Notion', category: 'Productivity', logo: 'https://picsum.photos/seed/notion/40/40', connectionType: 'oauth' },
        ]
    }
];

const connectInitialState = { message: null, error: null };

function AppCard({ app, isConnected, onConnect }: { app: any, isConnected: boolean, onConnect: () => void }) {
    const Icon = app.icon;
    const [state, formAction] = useActionState(saveSabFlowConnection, connectInitialState);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if(state.message) onConnect();
    }, [state, onConnect]);

    const handleInternalConnect = () => {
        startTransition(() => {
            const formData = new FormData();
            formData.append('appId', app.id);
            formData.append('appName', app.name);
            formData.append('connectionName', `${app.name} Connection`);
            formData.append('credentials', JSON.stringify({ type: 'internal' }));
            formAction(formData);
        });
    }

    const connectButtonAction = app.connectionType === 'internal' ? handleInternalConnect : onConnect;

    return (
        <Card>
            <CardHeader className="flex-row items-center gap-4">
                {app.logo ? (
                    <Image src={app.logo} alt={`${app.name} logo`} width={40} height={40} className="rounded-md"/>
                ) : (
                    <div className="w-10 h-10 bg-muted flex items-center justify-center rounded-md">
                        {Icon && <Icon className="w-6 h-6 text-muted-foreground"/>}
                    </div>
                )}
                <div>
                    <CardTitle className="text-base">{app.name}</CardTitle>
                    <CardDescription>{app.category}</CardDescription>
                </div>
            </CardHeader>
            <CardFooter>
                 <Button 
                    className="w-full" 
                    variant={isConnected ? 'secondary' : 'default'}
                    onClick={connectButtonAction}
                    disabled={isConnected || isPending}
                >
                    {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : (isConnected ? <Check className="mr-2 h-4 w-4"/> : null)}
                    {isConnected ? 'Connected' : 'Connect'}
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function AppConnectionsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState<any>(null);
    const [connectedApps, setConnectedApps] = useState<any[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchConnections = () => {
        startLoading(async () => {
            const session = await getSession();
            setConnectedApps(session?.user?.sabFlowConnections || []);
        });
    };
    
    useEffect(() => {
        fetchConnections();
    }, []);

    const handleConnectClick = (app: any) => {
        setSelectedApp(app);
        setIsDialogOpen(true);
    }
    
    if (isLoading) {
        return <Skeleton className="h-96 w-full" />
    }

    return (
        <>
            <NewConnectionDialog 
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                app={selectedApp}
                onConnectionSaved={fetchConnections}
            />
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">App Connections</h1>
                        <p className="text-muted-foreground">Connect your tools to automate your workflows.</p>
                    </div>
                     <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New Connection</Button>
                </div>
                
                <Card>
                    <CardHeader>
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search over 5000+ apps..." className="pl-8" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" defaultValue={appCategories.map(c => c.name)} className="w-full space-y-4">
                            {appCategories.map(category => (
                                <AccordionItem value={category.name} key={category.name} className="border rounded-lg bg-background">
                                    <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                                        {category.name}
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 pt-0">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {category.apps.map(app => {
                                                const isConnected = connectedApps.some(c => c.appId === app.id);
                                                return (
                                                    <AppCard
                                                        key={app.id}
                                                        app={app}
                                                        isConnected={isConnected}
                                                        onConnect={() => {
                                                            if (app.connectionType !== 'internal') {
                                                                handleConnectClick(app);
                                                            } else {
                                                                // For internal apps, we might just refresh state
                                                                fetchConnections();
                                                            }
                                                        }}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
