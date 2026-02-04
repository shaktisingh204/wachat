'use client';

import React from 'react';
import { EmailLayout } from '@/components/wabasimplify/email-new/email-layout';

import { EmailSuiteLayout } from '@/components/wabasimplify/email-suite-layout';

export default function EmailInboxPage() {
    return (
        <EmailSuiteLayout>
            <div className="h-full flex flex-col gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">Inbox</h1>
                    <p className="text-muted-foreground">Manage your conversations.</p>
                </div>
                <EmailLayout />
            </div>
        </EmailSuiteLayout>
    );
}
