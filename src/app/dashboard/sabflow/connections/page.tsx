
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Zap, Plus, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NewConnectionDialog } from '@/components/wabasimplify/new-connection-dialog';

const appCategories = [
    {
        name: 'SabNode Apps',
        apps: [
            { id: 'wachat', name: 'Wachat', category: 'WhatsApp API', logo: '/logo.svg', connectionType: 'internal' },
            { id: 'crm', name: 'CRM Suite', category: 'Business Management', logo: '/logo.svg', connectionType: 'internal' },
            { id: 'meta', name: 'Meta Suite', category: 'Social Media', logo: '/logo.svg', connectionType: 'internal' },
        ]
    },
    {
        name: 'Popular Apps',
        apps: [
            { id: 'google_sheets', name: 'Google Sheets', category: 'Productivity', logo: '/assets/google-sheets-icon.png', connectionType: 'oauth' },
            { id: 'stripe', name: 'Stripe', category: 'Payment', logo: '/assets/stripe-icon.png', connectionType: 'apikey' },
            { id: 'shopify', name: 'Shopify', category: 'E-Commerce', logo: '/assets/shopify-icon.png', connectionType: 'apikey' },
            { id: 'slack', name: 'Slack', category: 'Communication', logo: '/assets/slack-icon.png', connectionType: 'oauth' },
            { id: 'gmail', name: 'Gmail', category: 'Email', logo: '/assets/gmail-icon.png', connectionType: 'oauth' },
            { id: 'hubspot', name: 'HubSpot', category: 'CRM', logo: '/assets/hubspot-icon.png', connectionType: 'apikey' },
            { id: 'discord', name: 'Discord', category: 'Communication', logo: '/assets/discord-icon.png', connectionType: 'oauth' },
            { id: 'notion', name: 'Notion', category: 'Productivity', logo: '/assets/notion-icon.png', connectionType: 'apikey' },
        ]
    }
];

export default function AppConnectionsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState<any>(null);

    const handleConnectClick = (app: any) => {
        setSelectedApp(app);
        setIsDialogOpen(true);
    }

    return (
        <>
            <NewConnectionDialog 
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                app={selectedApp}
                onConnectionSaved={() => {
                    // Here you would refetch the list of connected apps
                }}
            />
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">App Connections</h1>
                        <p className="text-muted-foreground">Connect your tools to automate your workflows.</p>
                    </div>
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
                                            {category.apps.map(app => (
                                                <Card key={app.name}>
                                                    <CardHeader className="flex-row items-center gap-4">
                                                        <Image src={app.logo} alt={`${app.name} logo`} width={40} height={40} className="rounded-md"/>
                                                        <div>
                                                            <CardTitle className="text-base">{app.name}</CardTitle>
                                                            <CardDescription>{app.category}</CardDescription>
                                                        </div>
                                                    </CardHeader>
                                                    <CardFooter>
                                                        <Button className="w-full" onClick={() => handleConnectClick(app)}>Connect</Button>
                                                    </CardFooter>
                                                </Card>
                                            ))}
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
