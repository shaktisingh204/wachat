'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Link as LinkIcon, Code, Key } from 'lucide-react';
import { WhatsAppIcon } from '@/components/wabasimplify/custom-sidebar-components';

const integrations = [
    {
        title: 'WhatsApp Link Generator',
        description: 'Create wa.me links with pre-filled messages.',
        icon: LinkIcon,
        href: '/dashboard/integrations/whatsapp-link-generator',
        gradient: 'card-gradient-green',
    },
    {
        title: 'Website Widget Generator',
        description: 'Embed a floating WhatsApp chat widget on your website.',
        icon: Code,
        href: '/dashboard/integrations/whatsapp-widget-generator',
        gradient: 'card-gradient-blue',
    },
    {
        title: 'Razorpay Integration',
        description: 'Connect your Razorpay account to accept payments.',
        icon: Key,
        href: '/dashboard/integrations/razorpay',
        gradient: 'card-gradient-purple',
    }
];

export default function IntegrationsPage() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map(integration => (
                <Card key={integration.href} className={`flex flex-col ${integration.gradient}`}>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-lg">
                                <integration.icon className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>{integration.title}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p className="text-muted-foreground">{integration.description}</p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild className="w-full">
                            <Link href={integration.href}>
                                Configure <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
