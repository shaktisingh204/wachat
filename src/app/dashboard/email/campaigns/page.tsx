'use client';

import { ZoruSkeleton, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription } from '@/components/zoruui';
import {
  Send } from 'lucide-react';
import { EmailCampaignsClient } from '@/components/wabasimplify/email-campaigns-client';
import { Suspense } from "react";
import { EmailSuiteLayout } from '@/components/wabasimplify/email-suite-layout';

function PageSkeleton() {
    return <ZoruSkeleton className="h-full w-full" />;
}

export default function EmailCampaignsPage() {
    return (
        <EmailSuiteLayout>
            <div className="flex flex-col gap-8">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>
                            <span className="inline-flex items-center gap-3">
                                <Send className="h-7 w-7" /> Email Campaigns
                            </span>
                        </ZoruPageTitle>
                        <ZoruPageDescription>Create, manage, and schedule your bulk email campaigns.</ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <Suspense fallback={<PageSkeleton />}>
                    <EmailCampaignsClient />
                </Suspense>
            </div>
        </EmailSuiteLayout>
    );
}
