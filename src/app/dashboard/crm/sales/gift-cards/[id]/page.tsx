import { Button, Card } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Gift card detail — `/dashboard/crm/sales/gift-cards/[id]`.
 *
 * Server component: fetches via `getGiftCardById`, renders the
 * `<EntityDetailShell>` with header (status pill + Edit), a Card
 * body, and an Activity footer for `entityKind: 'giftCard'`.
 */

import Link from 'next/link';
import QRCode from 'react-qr-code';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getGiftCardById } from '@/app/actions/crm-gift-cards.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { GiftCardActions } from './gift-card-actions';
import { fmtDate, fmtINR } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, EntityStatusTone> = {
    active: 'green',
    redeemed: 'blue',
    expired: 'red',
    cancelled: 'red',
    paused: 'amber',
};

function Field({
    label,
    children,
    fullWidth,
}: {
    label: string;
    children: React.ReactNode;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'sm:col-span-2' : undefined}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

export default async function GiftCardDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const result = await getGiftCardById(id);
    if (!result) notFound();
    const card: Record<string, any> = result!;

    const code = (card.code as string) || `Card ${id.slice(-6)}`;
    const status = (card.status as string) || 'active';
    const tone = STATUS_TONE[status] ?? 'neutral';

    return (
        <EntityDetailShell
            title={code}
            eyebrow="GIFT CARD"
            status={{ label: status, tone }}
            back={{ href: '/dashboard/crm/sales/gift-cards', label: 'Back to gift cards' }}
            actions={
                <Button asChild>
                    <Link href={`/dashboard/crm/sales/gift-cards/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
            audit={<EntityAuditTimeline entityKind="giftCard" entityId={id} />}
        >
            <Card className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Gift card details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Code">{code}</Field>
                    <Field label="Status">{status}</Field>
                    <Field label="Issued to">{(card.issuedTo as string) || '—'}</Field>
                    <Field label="Customer email">
                        {(card.issuedToEmail as string) || '—'}
                    </Field>
                    <Field label="Value">{fmtINR(card.value)}</Field>
                    <Field label="Balance">{fmtINR(card.balance)}</Field>
                    <Field label="Expiry">{fmtDate(card.expiryDate)}</Field>
                    <Field label="Transferable">
                        {card.transferable === true ? 'Yes' : 'No'}
                    </Field>
                    {card.notes ? (
                        <Field label="Notes" fullWidth>
                            <p className="whitespace-pre-wrap">{String(card.notes)}</p>
                        </Field>
                    ) : null}
                </div>
                <GiftCardActions id={id} balance={card.balance || 0} email={card.issuedToEmail || null} />
            </Card>

            <Card className="p-6 mt-6 print:block">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Gift Card QR Code
                </h2>
                <div className="flex flex-col items-center justify-center p-4">
                    <QRCode value={code} size={150} />
                    <p className="mt-4 font-mono text-lg tracking-widest">{code}</p>
                </div>
            </Card>
        </EntityDetailShell>
    );
}
