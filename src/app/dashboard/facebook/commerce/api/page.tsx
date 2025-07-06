'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Settings, ShoppingBag, Package, Megaphone, MessageSquare, Webhook, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

const apiAreas = [
    {
        title: "Business Setup",
        icon: Settings,
        apis: ["Graph API", "Business Management API"],
        description: "For merchant registration and business asset management."
    },
    {
        title: "Catalogs & Products",
        icon: ShoppingBag,
        apis: ["Product Catalog API"],
        description: "To upload, manage, and organize products and collections."
    },
    {
        title: "Shops",
        icon: LayoutGrid,
        apis: ["Commerce API"],
        description: "For creating and configuring your Facebook Shop storefront."
    },
    {
        title: "Orders & Fulfillment",
        icon: Package,
        apis: ["Commerce Orders API"],
        description: "Handles orders, payments (if applicable), and fulfillment."
    },
    {
        title: "Ads (Optional)",
        icon: Megaphone,
        apis: ["Marketing API"],
        description: "Used for boosting products and creating dynamic catalog ads."
    },
    {
        title: "Messaging (Optional)",
        icon: MessageSquare,
        apis: ["Messenger Platform API"],
        description: "For customer communication regarding orders and support."
    },
    {
        title: "Automation",
        icon: Webhook,
        apis: ["Webhooks"],
        description: "To receive real-time notifications for orders, messages, and product updates."
    }
];

export default function CommerceApiPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Server /> E-Commerce API Reference</h1>
                <p className="text-muted-foreground">An overview of the Meta APIs used to power the E-Commerce builder.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {apiAreas.map((area) => {
                    const Icon = area.icon;
                    return (
                        <Card key={area.title} className="flex flex-col card-gradient card-gradient-green">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Icon className="h-6 w-6 text-primary" />
                                    <CardTitle>{area.title}</CardTitle>
                                </div>
                                <CardDescription>{area.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <div className="flex flex-wrap gap-2">
                                    {area.apis.map(api => (
                                        <Badge key={api} variant="outline">{api}</Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
             <div className="text-center text-sm text-muted-foreground">
                For detailed documentation, please visit the <Link href="https://developers.facebook.com/docs/commerce-platform" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Commerce Platform Docs</Link>.
            </div>
        </div>
    );
}
