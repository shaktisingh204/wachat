'use client';

import { useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { LoaderCircle,
  X } from 'lucide-react';

import { StatusPill,
  statusToTone } from '@/components/crm/status-pill';
import { EnumFormField } from '@/components/crm/enum-form-field';

/**
 * <ReceiptInlineStatus> — clickable status pill on the receipt detail
 * page. Opens an inline `<EnumFormField enumName="paymentReceiptStatus">`
 * picker and round-trips the new value through the
 * `setPaymentReceiptStatus` server action.
 *
 * `paymentReceiptStatus` enumerates `received | cleared | bounced`,
 * matching the Rust DTO. The existing header has dedicated
 * `Mark cleared` / `Mark bounced` buttons; this component is the
 * §1D.2-aligned pill alternative. P1.1B Wave 2.
 */

import * as React from 'react';

import { setPaymentReceiptStatus } from '@/app/actions/crm/payment-receipts.actions';
import type { CrmReceiptStatus } from '@/lib/rust-client/crm-payment-receipts';

interface Props {
    id: string;
    status: string;
}

export function ReceiptInlineStatus({ id, status }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [editing, setEditing] = React.useState(false);
    const [optimistic, setOptimistic] = React.useState(status);
    const [pending, startTransition] = React.useTransition();
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        setOptimistic(status);
    }, [status]);

    React.useEffect(() => {
        if (!editing) return;
        function onDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setEditing(false);
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setEditing(false);
        }
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [editing]);

    const commit = (next: string | null) => {
        if (!next || next === optimistic) {
            setEditing(false);
            return;
        }
        const prev = optimistic;
        setOptimistic(next);
        startTransition(async () => {
            const res = await setPaymentReceiptStatus(id, next as CrmReceiptStatus);
            if (res.success) {
                toast({ title: `Marked ${next}` });
                setEditing(false);
                router.refresh();
            } else {
                setOptimistic(prev);
                toast({
                    title: 'Status update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    if (!editing) {
        return (
            <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-full outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
                aria-label="Change receipt status"
            >
                <StatusPill label={optimistic} tone={statusToTone(optimistic)} />
            </button>
        );
    }

    return (
        <div
            ref={containerRef}
            className="flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1 shadow-sm"
        >
            <div className="min-w-[180px]">
                <EnumFormField
                    enumName="paymentReceiptStatus"
                    name="__receipt_status_picker"
                    initialId={optimistic || null}
                    onChange={(next) => commit(next)}
                    allowInlineCreate={false}
                />
            </div>
            <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                aria-label="Cancel"
                disabled={pending}
            >
                {pending ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <X className="h-3.5 w-3.5" />
                )}
            </button>
        </div>
    );
}
