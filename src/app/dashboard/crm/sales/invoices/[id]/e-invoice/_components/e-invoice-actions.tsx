'use client';

import { Button } from '@/components/zoruui';
import {
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Client widget that drives the e-invoice generate/cancel actions.
 * Stays minimal: a single Generate or Cancel button with a confirm
 * dialog + cancel-reason prompt.
 */

import {
    cancelIrn,
    generateIrn,
} from '@/app/actions/crm-india-einvoice.actions';

interface Props {
    invoiceId: string;
    hasIrn: boolean;
    cancelled: boolean;
}

export function EInvoiceActions({ invoiceId, hasIrn, cancelled }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function onGenerate() {
        setError(null);
        startTransition(async () => {
            const r = await generateIrn(invoiceId);
            if (!r.ok) {
                setError(r.error);
                return;
            }
            router.refresh();
        });
    }

    function onCancel() {
        setError(null);
        const reason = (typeof window !== 'undefined'
            ? window.prompt('Cancel reason (max 100 chars):', 'Data entry mistake')
            : null);
        if (!reason || !reason.trim()) return;
        startTransition(async () => {
            const r = await cancelIrn(invoiceId, reason.trim());
            if (!r.ok) {
                setError(r.error);
                return;
            }
            router.refresh();
        });
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {!hasIrn ? (
                    <Button disabled={pending} onClick={onGenerate}>
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Generate IRN
                    </Button>
                ) : !cancelled ? (
                    <Button
                        disabled={pending}
                        onClick={onCancel}
                        variant="outline"
                    >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Cancel IRN
                    </Button>
                ) : (
                    <p className="text-[12px] text-muted-foreground">
                        This IRN is cancelled. Generate a new invoice to obtain a fresh IRN.
                    </p>
                )}
            </div>
            {error ? (
                <p className="text-[12px] text-red-600">{error}</p>
            ) : null}
        </div>
    );
}
