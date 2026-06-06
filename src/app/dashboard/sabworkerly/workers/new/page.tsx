import React from 'react';
import { WorkerForm } from './_form';
import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

export default function NewWorkerPage() {
    return (
        <div className="ui20 flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Add worker</PageTitle>
                    <PageDescription>
                        Onboard a temp worker. Documents (ID, visa, certs) are pulled from SabFiles.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <WorkerForm />
        </div>
    );
}
