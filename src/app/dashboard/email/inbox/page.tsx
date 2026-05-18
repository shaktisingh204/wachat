'use client';

import { ZoruPageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription } from '@/components/zoruui';
import {
  EmailLayout } from '@/components/wabasimplify/email-new/email-layout';
import { EmailSuiteLayout } from '@/components/wabasimplify/email-suite-layout';

import React from 'react';

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
