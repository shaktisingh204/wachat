import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';

/**
 * Invoice e-invoice (IRN) manager — `/dashboard/crm/sales/invoices/[id]/e-invoice`.
 *
 * Server component. Shows the current e-invoice block (or "Not generated"),
 * plus the Generate / Cancel client widget. The signed QR is rendered as
 * the decoded JSON payload + the base64 string (a real QR can be plotted
 * later without breaking this shell).
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getEInvoiceForInvoice } from '@/app/actions/crm-india-einvoice.actions';
import { EInvoiceActions } from './_components/e-invoice-actions';

export const dynamic = 'force-dynamic';

function decodeQrPayload(b64: string): Record<string, unknown> | null {
    try {
        return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

export default async function InvoiceEInvoicePage(props: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await props.params;
    if (!id) notFound();

    const block = await getEInvoiceForInvoice(id);

    return (
        <EntityDetailShell
            eyebrow="INVOICE"
            title="E-invoice (IRN)"
            back={{ href: `/dashboard/crm/sales/invoices/${id}`, label: 'Invoice' }}
        >

            {!block ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Not generated</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex flex-col gap-4">
                        <p className="text-[13px] text-muted-foreground">
                            No IRN has been issued for this invoice yet. Click below
                            to generate one via your configured e-invoice provider.
                        </p>
                        <EInvoiceActions invoiceId={id} hasIrn={false} cancelled={false} />
                    </ZoruCardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
                            <ZoruCardTitle>IRN</ZoruCardTitle>
                            {block.cancelled ? (
                                <Badge variant="danger">Cancelled</Badge>
                            ) : (
                                <Badge variant="success">{block.status}</Badge>
                            )}
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                                <Field label="IRN" value={block.irn} mono />
                                <Field label="Ack No" value={block.ackNo} mono />
                                <Field label="Ack Date" value={block.ackDate} />
                                <Field label="Provider" value={block.provider} />
                                <Field
                                    label="Generated at"
                                    value={
                                        block.generatedAt
                                            ? new Date(block.generatedAt as any).toISOString()
                                            : '—'
                                    }
                                />
                                {block.cancelled ? (
                                    <Field
                                        label="Cancelled at"
                                        value={
                                            block.cancelledAt
                                                ? new Date(block.cancelledAt as any).toISOString()
                                                : '—'
                                        }
                                    />
                                ) : null}
                                {block.cancelReason ? (
                                    <Field label="Cancel reason" value={block.cancelReason} />
                                ) : null}
                            </dl>
                        </ZoruCardContent>
                    </Card>

                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Signed QR</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="flex flex-col gap-3">
                            <p className="text-[12px] text-muted-foreground">
                                The QR payload from the IRP. Decoded JSON shown for clarity;
                                a real QR render can be wired in once the page is paired with a
                                client-side QR component.
                            </p>
                            <pre className="rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed overflow-x-auto">
                                {JSON.stringify(decodeQrPayload(block.qrCodeData) ?? {}, null, 2)}
                            </pre>
                            <details>
                                <summary className="cursor-pointer text-[12px] text-muted-foreground">
                                    Show raw base64
                                </summary>
                                <pre className="mt-2 break-all rounded-md border border-border bg-muted/30 p-2 text-[10px]">
                                    {block.qrCodeData}
                                </pre>
                            </details>
                        </ZoruCardContent>
                    </Card>

                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Actions</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <EInvoiceActions
                                invoiceId={id}
                                hasIrn={true}
                                cancelled={!!block.cancelled}
                            />
                        </ZoruCardContent>
                    </Card>
                </>
            )}
        </EntityDetailShell>
    );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            <span className={mono ? 'font-mono text-[12px] break-all' : 'text-[13px]'}>
                {value}
            </span>
        </div>
    );
}
