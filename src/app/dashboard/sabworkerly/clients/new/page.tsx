import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';
import { ClientForm } from './_form';

export default function NewClientPage() {
    return (
        <div className="20ui mx-auto flex w-full max-w-[760px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>
                        <Link
                            href="/dashboard/sabworkerly/clients"
                            className="inline-flex items-center gap-1 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                            Clients
                        </Link>
                    </PageEyebrow>
                    <PageTitle>Add client</PageTitle>
                    <PageDescription>
                        Create a new client to bill, schedule, and track work against.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <ClientForm />
        </div>
    );
}
