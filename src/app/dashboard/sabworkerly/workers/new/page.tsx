import React from 'react';
import { WorkerForm } from './_form';
import { PageHeader, ZoruPageTitle, ZoruPageDescription } from '@/components/sabcrm/20ui/compat';

export default function NewWorkerPage() {
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <ZoruPageTitle>Add worker</ZoruPageTitle>
                <ZoruPageDescription>
                    Onboard a temp worker. Documents (ID, visa, certs) are pulled from SabFiles.
                </ZoruPageDescription>
            </PageHeader>
            <WorkerForm />
        </div>
    );
}
