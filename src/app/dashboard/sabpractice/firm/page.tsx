import * as React from 'react';
import { Suspense } from 'react';
import { Building2 } from 'lucide-react';

import { listSabpracticeFirms } from '@/app/actions/sabpractice.actions';
import {
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Skeleton,
} from '@/components/sabcrm/20ui';

import { FirmForm } from './_components/firm-form';

async function FirmData() {
    const list = await listSabpracticeFirms({ status: 'all', limit: 1 });
    const firm = list.items[0] ?? null;
    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabPractice</PageEyebrow>
                    <PageTitle>Firm settings</PageTitle>
                    <PageDescription>
                        Your accounting firm profile. This appears on shared client documents.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <Card>
                <CardHeader className="flex flex-row items-center gap-2.5">
                    <span
                        className="inline-flex size-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                    >
                        <Building2 size={15} />
                    </span>
                    <div>
                        <CardTitle>{firm ? 'Firm profile' : 'Create your firm'}</CardTitle>
                        <CardDescription>
                            {firm
                                ? 'Update the details your clients see.'
                                : 'Add your firm details to get started.'}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardBody>
                    <FirmForm initial={firm} />
                </CardBody>
            </Card>
        </div>
    );
}

function FirmSkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Loading firm">
            <div className="space-y-2">
                <Skeleton width={90} height={12} />
                <Skeleton width={180} height={26} />
                <Skeleton width={420} height={14} />
            </div>
            <Skeleton height={420} />
        </div>
    );
}

export default function FirmSettingsPage() {
    return (
        <Suspense fallback={<FirmSkeleton />}>
            <FirmData />
        </Suspense>
    );
}
