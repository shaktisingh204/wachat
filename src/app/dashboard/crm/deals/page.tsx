
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Handshake } from 'lucide-react';

export default function DealsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Handshake /> Deals</h1>
                <p className="text-muted-foreground">Manage your sales pipeline and track deals.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">The Deals pipeline is under development and will be available soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}
