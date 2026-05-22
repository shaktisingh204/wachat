import { Button, Card, ZoruCardContent } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';

/**
 * New POS refund — `/dashboard/crm/pos/refunds/new`.
 *
 * Server-component shell. Requires `?originalTransactionId=<id>` so
 * the cashier is always anchored to a specific sale. The shell hydrates
 * the original transaction and hands it to a `<PosRefundForm>` client
 * island for per-line refund-qty/amount entry.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPosTransactionById } from '@/app/actions/crm-pos.actions';

import { PosRefundForm } from '../../_components/pos-refund-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/pos/refunds';

interface PageProps {
    searchParams: Promise<{ originalTransactionId?: string }>;
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
                    <ZoruCardContent className="flex flex-col items-center gap-2 p-8 text-center">
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

    const original = await getPosTransactionById(originalTransactionId);
    if (!original) notFound();

    return (
        <EntityDetailShell
            eyebrow="POS REFUND"
            title={`Refund · ${original.transactionNumber}`}
            back={{ href: BASE, label: 'Refunds' }}
        >
            <PosRefundForm original={original} />
        </EntityDetailShell>
    );
}
