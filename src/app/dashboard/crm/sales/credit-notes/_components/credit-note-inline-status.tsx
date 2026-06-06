'use client';

import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { LoaderCircle,
  X } from 'lucide-react';

import { StatusPill,
  statusToTone } from '@/components/crm/status-pill';
import { EnumFormField } from '@/components/crm/enum-form-field';

/**
 * <CreditNoteInlineStatus> — clickable status pill on the CN detail
 * page that opens an inline `<EnumFormField enumName="creditNoteStatusV2">`
 * picker and round-trips the new value through the
 * `setCreditNoteStatus` server action.
 *
 * Mirrors the `<SalesOrderInlineStatus>` pattern. Uses
 * `creditNoteStatusV2` (the Rust-aligned enum: `draft | issued |
 * refunded | cancelled`) rather than the legacy `creditNoteStatus`.
 * Implements §1D.2 inline-status-change for credit notes — P1.1B Wave 2.
 */

import * as React from 'react';

import { setCreditNoteStatus } from '@/app/actions/crm/credit-notes.actions';
import type { CreditNoteStatus } from '@/lib/rust-client/crm-credit-notes';

interface Props {
    id: string;
    status: string;
}

export function CreditNoteInlineStatus({ id, status }: Props) {
    const router = useRouter();
    const { toast } = useZoruToast();
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
            const res = await setCreditNoteStatus(id, next as CreditNoteStatus);
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
                aria-label="Change credit-note status"
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
                    enumName="creditNoteStatusV2"
                    name="__cn_status_picker"
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
