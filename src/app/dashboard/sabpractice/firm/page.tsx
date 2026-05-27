import * as React from 'react';
import { Suspense } from 'react';

import { listSabpracticeFirms } from '@/app/actions/sabpractice.actions';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/zoruui';

import { FirmForm } from './_components/firm-form';

async function FirmData() {
    const list = await listSabpracticeFirms({ status: 'all', limit: 1 });
    const firm = list.items[0] ?? null;
    return (
        <div className="space-y-6">
            <PageHeader>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Firm settings</h1>
                    <p className="text-sm text-[var(--zoru-ink-muted)]">
                        Your accounting firm's profile.
                    </p>
                </div>
            </PageHeader>
            <Card>
                <CardHeader>
                    <CardTitle>{firm ? 'Edit firm' : 'Create your firm'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <FirmForm initial={firm} />
                </CardContent>
            </Card>
        </div>
    );
}

export default function FirmSettingsPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--zoru-ink-muted)]">Loading firm…</div>
            }
        >
            <FirmData />
        </Suspense>
    );
}
