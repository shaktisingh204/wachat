
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function EmailIntegrationPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Mail /> Email Integration</h1>
                <p className="text-muted-foreground">Manage your email communications directly within the CRM.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Full two-way email sync, templates, and tracking are under development.</p>
                </CardContent>
            </Card>
        </div>
    );
}
