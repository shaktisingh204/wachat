import React from 'react';
import { PageHeader, PageHeaderHeading, PageEyebrow, PageTitle, PageDescription } from '@/components/sabcrm/20ui';
import { JobForm } from './_form';
import { getSabworkerlyClients } from '@/app/actions/sabworkerly.actions';

export default async function NewJobPage({
    searchParams,
}: {
    searchParams: Promise<{ clientId?: string }>;
}) {
    const { clientId } = await searchParams;
    const clients = await getSabworkerlyClients({ status: 'active', limit: 200 });
    return (
        <div className="ui20 flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Post job</PageTitle>
                    <PageDescription>Create a new job and assign it to a client.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <JobForm
                clients={clients.map((c) => ({ id: c._id, name: c.name }))}
                presetClientId={clientId ?? null}
            />
        </div>
    );
}
