'use client';

import { Button, Card, CardBody, Input, Label, Textarea, toast } from '@/components/sabcrm/20ui';
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

    const terminalInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        // Safe client-side focus to avoid hydration mismatches with autoFocus attribute
        terminalInputRef.current?.focus();
    }, []);

    React.useEffect(() => {
        if (state.id) {
            toast.success(state.message ?? 'Session opened.');
            router.push(`/dashboard/crm/pos/sessions/${state.id}`);
        } else if (state.error) {
            toast.error(state.error);
        }
    }, [state, router]);

    return (
        <Card className="p-0">
            <CardBody className="p-5">
                <form action={formAction} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="terminalId">Terminal</Label>
                        <Input
                            ref={terminalInputRef}
                            id="terminalId"
                            name="terminalId"
                            placeholder="e.g. Counter-1, Kiosk-A"
                            required
                        />
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            Free-text identifier for this checkout point.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="openingCash">Opening cash (₹)</Label>
                        <Input
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
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            rows={3}
                            placeholder="Optional — observations at shift open."
                        />
                    </div>

                    {state.error ? (
                        <div className="rounded-md border border-[var(--st-border)]/30 bg-[var(--st-text)]/10 px-3 py-2 text-[12.5px] text-[var(--st-text)]">
                            {state.error}
                        </div>
                    ) : null}

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Opening…' : 'Open session'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}

