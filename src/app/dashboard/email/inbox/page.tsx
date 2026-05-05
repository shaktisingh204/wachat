'use client';

import React from 'react';
import { EmailLayout } from '@/components/wabasimplify/email-new/email-layout';
import { EmailSuiteLayout } from '@/components/wabasimplify/email-suite-layout';
import {
    ZoruPageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    ZoruPageDescription,
} from '@/components/zoruui';

export default function EmailInboxPage() {
    return (
        <EmailSuiteLayout>
            <div className="h-full flex flex-col gap-4">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>Inbox</ZoruPageTitle>
                        <ZoruPageDescription>Manage your conversations.</ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <EmailLayout />
            </div>
        </EmailSuiteLayout>
    );
}
