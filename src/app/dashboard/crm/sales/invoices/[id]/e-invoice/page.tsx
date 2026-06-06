import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
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
import QRCode from 'react-qr-code';

export const dynamic = 'force-dynamic';

function decodeQrPayload(b64: string): Record<string, unknown> | null {
    try {
        return JSON.parse(atob(b64));
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
                    <CardHeader>
                        <CardTitle>Not generated</CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-4">
                        <p className="text-[13px] text-[var(--st-text-secondary)]">
                            No IRN has been issued for this invoice yet. Click below
                            to generate one via your configured e-invoice provider.
                        </p>
                        <EInvoiceActions invoiceId={id} hasIrn={false} cancelled={false} />
                    </CardBody>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                            <CardTitle>IRN</CardTitle>
                            {block.cancelled ? (
                                <Badge variant="danger">Cancelled</Badge>
                            ) : (
                                <Badge variant="success">{block.status}</Badge>
                            )}
                        </CardHeader>
                        <CardBody>
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
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Signed QR</CardTitle>
                        </CardHeader>
                        <CardBody className="flex flex-col gap-3">
                            <p className="text-[12px] text-[var(--st-text-secondary)]">
                                The signed QR payload issued by the IRP.
                            </p>
                            <div className="flex flex-wrap gap-6 items-start">
                                <div className="bg-white p-4 w-fit rounded-md border border-[var(--st-border)] shrink-0">
                                    <QRCode value={block.qrCodeData} size={150} />
                                </div>
                                {(() => {
                                    const decoded = decodeQrPayload(block.qrCodeData);
                                    if (!decoded) return null;
                                    return (
                                        <div className="flex-1 min-w-[280px]">
                                            <h4 className="text-[12px] font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-2">
                                                Decoded QR Details
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[var(--st-bg-muted)]/20 p-3 rounded-lg border border-[var(--st-border)]">
                                                {Object.entries(decoded).map(([k, v]) => (
                                                    <div key={k} className="flex flex-col gap-0.5">
                                                        <span className="font-mono text-[10px] text-[var(--st-text-secondary)] uppercase">{k}</span>
                                                        <span className="font-medium truncate" title={String(v)}>{String(v)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            <details className="mt-2">
                                <summary className="cursor-pointer text-[12px] text-[var(--st-text-secondary)] hover:underline">
                                    Show raw signed payload
                                </summary>
                                <pre className="mt-2 break-all rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/30 p-2 text-[10px] whitespace-pre-wrap font-mono text-[var(--st-text-secondary)]">
                                    {block.qrCodeData}
                                </pre>
                            </details>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <EInvoiceActions
                                invoiceId={id}
                                hasIrn={true}
                                cancelled={!!block.cancelled}
                            />
                        </CardBody>
                    </Card>
                </>
            )}
        </EntityDetailShell>
    );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </span>
            <span className={mono ? 'font-mono text-[12px] break-all' : 'text-[13px]'}>
                {value}
            </span>
        </div>
    );
}
