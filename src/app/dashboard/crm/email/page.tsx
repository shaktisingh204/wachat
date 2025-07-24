
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EmailIntegrationPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Mail /> Email</h1>
                <p className="text-muted-foreground">Manage your email communications directly within the CRM.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Unified Inbox Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground mb-4">The unified inbox to view and manage all your synced emails is under development. In the meantime, you can configure your email accounts and create templates in the settings.</p>
                    <Button asChild>
                        <Link href="/dashboard/crm/settings?tab=email">Go to Email Settings</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
