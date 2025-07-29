
'use client';

import { EmailTemplatesManager } from '@/components/wabasimplify/email-templates-manager';
import { FileText } from 'lucide-react';

export default function EmailTemplatesPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><FileText /> Email Templates</h1>
                <p className="text-muted-foreground">Create and manage reusable email templates for your campaigns.</p>
            </div>
            <EmailTemplatesManager />
        </div>
    )
}
