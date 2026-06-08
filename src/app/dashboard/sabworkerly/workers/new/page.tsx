import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WorkerForm } from './_form';
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

export default function NewWorkerPage() {
    return (
        <div className="20ui mx-auto flex w-full max-w-[760px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>
                        <Link
                            href="/dashboard/sabworkerly/workers"
                            className="inline-flex items-center gap-1 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                            Workers
                        </Link>
                    </PageEyebrow>
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
