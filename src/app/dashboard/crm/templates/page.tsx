import * as React from 'react';
import { Metadata } from 'next';
import { Mail, MessageSquare, FileText, Sparkles, Plus, Layers } from 'lucide-react';
import { PageHeader, ZoruPageHeading, ZoruPageEyebrow, ZoruPageTitle, ZoruPageDescription } from '@/components/sabcrm/20ui/compat';

import { getCrmUnifiedTemplates } from '@/app/actions/crm-templates.actions';
import { TemplatesListClient } from './_components/templates-list-client';

export const metadata: Metadata = {
    title: 'Visual Template Studio | SabNode CRM',
    description: 'Create and customize world-class, premium Email layouts, WhatsApp alerts, SMS segments, and PDF quotations with our visual studio.',
};

export default async function CrmTemplatesPage() {
    const initialTemplates = await getCrmUnifiedTemplates();

    return (
        <div className="flex-1 flex flex-col gap-6 p-6 bg-zoru-ink min-h-screen text-white">
            
            {/* Header */}
            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageEyebrow>CRM Suite</ZoruPageEyebrow>
                    <div className="flex items-center gap-3">
                        <ZoruPageTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zoru-surface-2 via-zoru-surface-2 to-zoru-surface-2 bg-clip-text text-transparent">
                            Visual Template Studio
                        </ZoruPageTitle>
                        <Badge className="bg-zoru-ink/60 text-zoru-ink-muted border border-zoru-line/20 text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 animate-pulse">
                            <Sparkles className="h-2.5 w-2.5 mr-1" /> Studio v2.0
                        </Badge>
                    </div>
                    <ZoruPageDescription className="text-zoru-ink-muted mt-1 max-w-2xl">
                        Compose and manage ultra-advanced corporate templates. Design responsive drag-and-drop Emails, WhatsApp notifications with rich quick-replies, rapid SMS segment flows, and statutory compliance PDF documents.
                    </ZoruPageDescription>
                </ZoruPageHeading>
            </PageHeader>

            {/* Main Interactive Client List & Modal controls */}
            <TemplatesListClient initialTemplates={initialTemplates} />
            
        </div>
    );
}

// Inline badge helper for server header
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
            {children}
        </span>
    );
}
