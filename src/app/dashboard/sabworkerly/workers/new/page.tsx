import React from 'react';
import { WorkerForm } from './_form';
import { PageHeader, PageTitle, PageDescription } from '@/components/sabcrm/20ui/compat';

export default function NewWorkerPage() {
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <PageTitle>Add worker</PageTitle>
                <PageDescription>
                    Onboard a temp worker. Documents (ID, visa, certs) are pulled from SabFiles.
                </PageDescription>
            </PageHeader>
            <WorkerForm />
        </div>
    );
}
