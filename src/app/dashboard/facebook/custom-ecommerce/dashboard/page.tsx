
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ShoppingBag, Package, Palette, Settings, GitFork } from 'lucide-react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";

const dashboardCards = [
    { title: "Products", description: "Add and manage your products.", icon: ShoppingBag, href: "/dashboard/facebook/custom-ecommerce/products", gradient: "card-gradient-green" },
    { title: "Orders", description: "View and process customer orders.", icon: Package, href: "/dashboard/facebook/custom-ecommerce/orders", gradient: "card-gradient-blue" },
    { title: "Flow Builder", description: "Create automated chat flows.", icon: GitFork, href: "/dashboard/facebook/custom-ecommerce/flow-builder", gradient: "card-gradient-purple" },
    { title: "Settings", description: "Configure shop settings and domains.", icon: Settings, href: "/dashboard/facebook/custom-ecommerce/settings", gradient: "card-gradient-orange" },
];

export default function CustomEcommerceDashboard() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <ShoppingBag className="h-8 w-8" />
                    Custom E-commerce Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                    Build and manage your own Messenger-based e-commerce storefront.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dashboardCards.map(card => (
                    <Card key={card.title} className={card.gradient}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><card.icon className="h-5 w-5"/>{card.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">{card.description}</p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild><Link href={card.href}>Go to {card.title}</Link></Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
