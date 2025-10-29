
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Zap, Mail, Bot, ShoppingCart } from 'lucide-react';
import { Button } from "@/components/ui/button";

const integrations = [
    {
        name: 'Shopify',
        icon: ShoppingCart,
        description: 'Sync your customers, products, and orders directly from your Shopify store.',
        status: 'available',
    },
    {
        name: 'Zapier',
        icon: Zap,
        description: 'Connect your CRM to thousands of other apps with Zapier automation.',
        status: 'coming_soon',
    },
    {
        name: 'Mailchimp',
        icon: Mail,
        description: 'Sync your contacts and audiences with your Mailchimp account for email marketing.',
        status: 'coming_soon',
    },
    {
        name: 'Slack',
        icon: Bot,
        description: 'Get real-time notifications for new leads, deals, and tasks directly in Slack.',
        status: 'coming_soon',
    }
];

export default function IntegrationsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Zap /> Integrations</h1>
                <p className="text-muted-foreground">Connect your CRM to other tools and services to streamline your workflow.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.map(integration => {
                    const Icon = integration.icon;
                    return (
                        <Card key={integration.name} className="flex flex-col">
                            <CardHeader className="flex-row items-start gap-4">
                                <div className="p-3 bg-muted rounded-full">
                                    <Icon className="h-6 w-6 text-primary"/>
                                </div>
                                <div>
                                    <CardTitle>{integration.name}</CardTitle>
                                    <CardDescription>{integration.description}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardFooter className="mt-auto">
                                {integration.status === 'available' ? (
                                    <Button className="w-full">Connect</Button>
                                ) : (
                                    <Button className="w-full" variant="outline" disabled>Coming Soon</Button>
                                )}
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    )
}
