
'use server';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Zap, Mail, Bot, ShoppingCart, CheckCircle, MessageSquare } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { getIntegrationTypes } from "@/app/actions/crm-integrations.actions";
import Link from "next/link";

export default async function IntegrationsPage() {
    const status = await getIntegrationTypes();

    const integrations = [
        {
            name: 'Gmail',
            icon: Mail,
            description: 'Sync your emails and contacts directly from Gmail.',
            status: status.gmail ? 'connected' : 'available',
            link: '/dashboard/email/settings'
        },
        {
            name: 'WhatsApp',
            icon: MessageSquare,
            description: 'Connect your WhatsApp Business API for direct messaging.',
            status: status.whatsapp ? 'connected' : 'available',
            link: '/dashboard/settings/whatsapp'
        },
        {
            name: 'Shopify',
            icon: ShoppingCart,
            description: 'Sync your customers, products, and orders directly from your Shopify store.',
            status: status.shopify ? 'connected' : 'coming_soon',
        },
        {
            name: 'Zapier',
            icon: Zap,
            description: 'Connect your CRM to thousands of other apps with Zapier automation.',
            status: status.zapier ? 'connected' : 'coming_soon',
        },
        {
            name: 'Slack',
            icon: Bot,
            description: 'Get real-time notifications for new leads, deals, and tasks directly in Slack.',
            status: status.slack ? 'connected' : 'coming_soon',
        }
    ];

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
                                <div className={`p-3 rounded-full ${integration.status === 'connected' ? 'bg-green-100' : 'bg-muted'}`}>
                                    <Icon className={`h-6 w-6 ${integration.status === 'connected' ? 'text-green-600' : 'text-primary'}`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle>{integration.name}</CardTitle>
                                        {integration.status === 'connected' && <CheckCircle className="h-4 w-4 text-green-600" />}
                                    </div>
                                    <CardDescription>{integration.description}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardFooter className="mt-auto">
                                {integration.status === 'connected' ? (
                                    <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
                                        <Link href={integration.link || '#'}>Manage</Link>
                                    </Button>
                                ) : integration.status === 'available' ? (
                                    <Button className="w-full" asChild>
                                        <Link href={integration.link || '#'}>Connect</Link>
                                    </Button>
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
