'use client';

import { Button, Card, ZoruCardContent, Input, Label, Textarea, zoruSonnerToast } from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client form for opening a new POS session.
 * Posts to `openPosSession` server action via `useActionState`.
 */

import * as React from 'react';

import { openPosSession } from '@/app/actions/crm-pos.actions';

const initial: { message?: string; error?: string; id?: string } = {};

export function PosSessionNewForm() {
    const router = useRouter();
    const [state, formAction, isPending] = useActionState(
        openPosSession,
        initial,
    );

    React.useEffect(() => {
        if (state.id) {
            zoruSonnerToast.success(state.message ?? 'Session opened.');
            router.push(`/dashboard/crm/pos/sessions/${state.id}`);
        } else if (state.error) {
            zoruSonnerToast.error(state.error);
        }
    }, [state, router]);

    return (
        <ZoruCard>
            <ZoruCardContent className="p-5">
                <form action={formAction} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <ZoruLabel htmlFor="terminalId">Terminal</ZoruLabel>
                        <ZoruInput
                            id="terminalId"
                            name="terminalId"
                            placeholder="e.g. Counter-1, Kiosk-A"
                            required
                            autoFocus
                        />
                        <p className="text-[12px] text-zoru-ink-muted">
                            Free-text identifier for this checkout point.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <ZoruLabel htmlFor="openingCash">Opening cash (₹)</ZoruLabel>
                        <ZoruInput
                            id="openingCash"
                            name="openingCash"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={0}
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            rows={3}
                            placeholder="Optional — observations at shift open."
                        />
                    </div>

                    {state.error ? (
                        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-600">
                            {state.error}
                        </div>
                    ) : null}

                    <div className="flex justify-end gap-2">
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            onClick={() => router.back()}
                        >
                            Cancel
                        </ZoruButton>
                        <ZoruButton type="submit" disabled={isPending}>
                            {isPending ? 'Opening…' : 'Open session'}
                        </ZoruButton>
                    </div>
                </form>
            </ZoruCardContent>
        </ZoruCard>
    );
}
