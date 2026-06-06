import React from 'react';
import { PageHeader, PageHeaderHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';
import { ClientForm } from './_form';

export default function NewClientPage() {
    return (
        <div className="flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Add client</PageTitle>
                    <PageDescription>Create a new client to bill, schedule, and track work against.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <ClientForm />
        </div>
    );
}
