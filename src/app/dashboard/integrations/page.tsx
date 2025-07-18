
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap } from 'lucide-react';

export default function IntegrationsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Zap className="h-8 w-8" />
                    Integrations
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect SabNode with your favorite tools and services.
                </p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">More integrations with platforms like Shopify, Zapier, and more are on the way.</p>
                </CardContent>
            </Card>
        </div>
    );
}
