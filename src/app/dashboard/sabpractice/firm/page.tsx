import * as React from 'react';
import { Suspense } from 'react';

import { listSabpracticeFirms } from '@/app/actions/sabpractice.actions';
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Spinner,
} from '@/components/sabcrm/20ui';

import { FirmForm } from './_components/firm-form';

async function FirmData() {
    const list = await listSabpracticeFirms({ status: 'all', limit: 1 });
    const firm = list.items[0] ?? null;
    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Firm settings</PageTitle>
                    <PageDescription>Your accounting firm profile.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <Card>
                <CardHeader>
                    <CardTitle>{firm ? 'Edit firm' : 'Create your firm'}</CardTitle>
                </CardHeader>
                <CardBody>
                    <FirmForm initial={firm} />
                </CardBody>
            </Card>
        </div>
    );
}

export default function FirmSettingsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center gap-2 p-6 text-sm text-[var(--st-text-secondary)]">
                    <Spinner size="sm" label="Loading firm" />
                    <span>Loading firm</span>
                </div>
            }
        >
            <FirmData />
        </Suspense>
    );
}
