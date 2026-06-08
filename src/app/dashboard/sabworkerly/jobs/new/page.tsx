import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
        <div className="20ui mx-auto flex w-full max-w-[760px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>
                        <Link
                            href="/dashboard/sabworkerly/jobs"
                            className="inline-flex items-center gap-1 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                            Jobs
                        </Link>
                    </PageEyebrow>
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
