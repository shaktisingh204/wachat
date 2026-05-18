import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { ScrollText } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

/**
 * New POS refund — `/dashboard/crm/pos/refunds/new`.
 *
 * Server-component shell. Requires `?originalTransactionId=<id>` so
 * the cashier is always anchored to a specific sale. The shell hydrates
 * the original transaction and hands it to a `<PosRefundForm>` client
 * island for per-line refund-qty/amount entry.
 */

import Link from 'next/link';

import { getPosTransactionById } from '@/app/actions/crm-pos.actions';

import { PosRefundForm } from '../../_components/pos-refund-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ originalTransactionId?: string }>;
}

export default async function NewPosRefundPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const originalTransactionId = sp.originalTransactionId?.trim();
    if (!originalTransactionId) {
        return (
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="New refund"
                    subtitle="Refunds must be initiated from an existing transaction."
                    icon={ScrollText}
                    breadcrumbs={[
                        { label: 'CRM', href: '/dashboard/crm' },
                        { label: 'POS', href: '/dashboard/crm/pos' },
                        {
                            label: 'Refunds',
                            href: '/dashboard/crm/pos/refunds',
                        },
                        { label: 'New' },
                    ]}
                />
                <ZoruCard>
                    <ZoruCardContent className="flex flex-col items-center gap-2 p-8 text-center">
                        <p className="text-sm text-zoru-ink">
                            Provide a transaction id to start a refund.
                        </p>
                        <p className="text-[12px] text-zoru-ink-muted">
                            Open the session detail page and use “Start refund” on a transaction.
                        </p>
                        <ZoruButton size="sm" variant="outline" asChild>
                            <Link href="/dashboard/crm/pos/sessions">
                                Pick a session
                            </Link>
                        </ZoruButton>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        );
    }

    const original = await getPosTransactionById(originalTransactionId);
    if (!original) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Refund · ${original.transactionNumber}`}
                subtitle="Pick the lines and amounts to refund."
                icon={ScrollText}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'POS', href: '/dashboard/crm/pos' },
                    {
                        label: 'Refunds',
                        href: '/dashboard/crm/pos/refunds',
                    },
                    { label: 'New' },
                ]}
            />
            <PosRefundForm original={original} />
        </div>
    );
}
