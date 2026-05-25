import { Button, Card, ZoruCardContent } from '@/components/zoruui';
import { Skeleton } from '@/components/zoruui/skeleton';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPosTransactionById } from '@/app/actions/crm-pos.actions';
import { PosRefundForm } from '../../_components/pos-refund-form';

/**
 * New POS refund — `/dashboard/crm/pos/refunds/new`.
 *
 * Server-component shell. Requires `?originalTransactionId=<id>` so
 * the cashier is always anchored to a specific sale. The shell hydrates
 * the original transaction inside a Suspense block and hands it to a
 * `<PosRefundForm>` client island for per-line refund entry.
 */

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/pos/refunds';

interface PageProps {
    searchParams: Promise<{ originalTransactionId?: string }>;
}

async function RefundFormContainer({ originalTransactionId }: { originalTransactionId: string }) {
    const original = await getPosTransactionById(originalTransactionId);
    if (!original) notFound();

    return <PosRefundForm original={original} />;
}

function RefundFormSkeleton() {
    return (
        <Card className="p-8">
            <div className="space-y-4">
                <Skeleton className="h-6 w-48 animate-pulse" />
                <Skeleton className="h-32 w-full animate-pulse" />
                <Skeleton className="h-10 w-32 animate-pulse" />
            </div>
        </Card>
    );
}

export default async function NewPosRefundPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const originalTransactionId = sp.originalTransactionId?.trim();

    if (!originalTransactionId) {
        return (
            <EntityDetailShell
                eyebrow="POS REFUND"
                title="New refund"
                back={{ href: BASE, label: 'Refunds' }}
            >
                <Card>
                    <ZoruCardContent className="flex flex-col items-center gap-2 p-8 text-center animate-in fade-in-50">
                        <p className="text-sm text-zoru-ink">
                            Provide a transaction id to start a refund.
                        </p>
                        <p className="text-[12px] text-zoru-ink-muted">
                            Open the session detail page and use "Start refund" on a transaction.
                        </p>
                        <Button size="sm" variant="outline" asChild>
                            <Link href="/dashboard/crm/pos/sessions">
                                Pick a session
                            </Link>
                        </Button>
                    </ZoruCardContent>
                </Card>
            </EntityDetailShell>
        );
    }

    return (
        <EntityDetailShell
            eyebrow="POS REFUND"
            title="Refund Transaction"
            back={{ href: BASE, label: 'Refunds' }}
        >
            <Suspense fallback={<RefundFormSkeleton />}>
                <RefundFormContainer originalTransactionId={originalTransactionId} />
            </Suspense>
        </EntityDetailShell>
    );
}
