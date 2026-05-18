'use client';

import { ZoruPageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription } from '@/components/zoruui';
import {
  EmailTemplatesManager } from '@/components/wabasimplify/email-templates-manager';
import { FileText } from 'lucide-react';
import { EmailSuiteLayout } from '@/components/wabasimplify/email-suite-layout';

export default function EmailTemplatesPage() {
    return (
        <EmailSuiteLayout>
            <div className="flex flex-col gap-8">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>
                            <span className="inline-flex items-center gap-3">
                                <FileText className="h-7 w-7" /> Email Templates
                            </span>
                        </ZoruPageTitle>
                        <ZoruPageDescription>Create and manage reusable email templates for your campaigns.</ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <EmailTemplatesManager />
            </div>
        </EmailSuiteLayout>
    )
}
