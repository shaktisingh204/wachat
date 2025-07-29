

'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Send } from 'lucide-react';
import { EmailCampaignsClient } from '@/components/wabasimplify/email-campaigns-client';
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function PageSkeleton() {
    return <Skeleton className="h-full w-full" />;
}

export default function EmailCampaignsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Send /> Email Campaigns</h1>
                <p className="text-muted-foreground">Create, manage, and schedule your bulk email campaigns.</p>
            </div>
            <Suspense fallback={<PageSkeleton/>}>
                <EmailCampaignsClient />
            </Suspense>
        </div>
    );
}

