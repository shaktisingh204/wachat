import React from 'react';
import { PageHeader, ZoruPageTitle } from '@/components/sabcrm/20ui/compat';
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
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <ZoruPageTitle>Post job</ZoruPageTitle>
            </PageHeader>
            <JobForm
                clients={clients.map((c) => ({ id: c._id, name: c.name }))}
                presetClientId={clientId ?? null}
            />
        </div>
    );
}
