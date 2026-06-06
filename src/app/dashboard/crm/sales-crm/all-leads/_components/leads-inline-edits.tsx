'use client';

import { Input, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui/compat';
import {
  ChevronDown } from 'lucide-react';

/**
 * Inline quick-edit popovers for the lead detail page right-rail.
 *
 *  • <InlineOwnerEdit>   — opens an EntityFormField over the owner chip.
 *  • <InlineStageEdit>   — opens a small input over the stage pill.
 *  • <InlineStatusEdit>  — opens a status select over the status pill.
 *
 * Each call persists optimistically and toasts on failure.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
    assignCrmLead,
    changeCrmLeadStatus,
    updateCrmLeadStage,
} from '@/app/actions/crm-leads.actions';

interface InlineOwnerEditProps {
    leadId: string;
    ownerId?: string | null;
    onSaved?: () => void;
}

export function InlineOwnerEdit({
    leadId,
    ownerId,
    onSaved,
}: InlineOwnerEditProps) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();

    const persist = React.useCallback(
        (next: string | null) => {
            startTransition(async () => {
                const res = await assignCrmLead(leadId, next);
                if (!res.success) {
                    toast({
                        title: 'Assignment failed',
                        description: res.error,
                        variant: 'destructive',
                    });
                    return;
                }
                toast({ title: next ? 'Owner updated' : 'Owner cleared' });
                setOpen(false);
                onSaved?.();
            });
        },
        [leadId, onSaved, toast],
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm hover:bg-[var(--st-bg-muted)] disabled:opacity-50"
                    aria-label="Change owner"
                    disabled={isPending}
                >
                    {ownerId ? (
                        <EntityPickerChip entity="user" id={ownerId} fallback="Unassigned" />
                    ) : (
                        <span className="text-[var(--st-text-secondary)]">Unassigned</span>
                    )}
                    <ChevronDown className="h-3 w-3 text-[var(--st-text-tertiary)]" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-2">
                <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Change owner
                </p>
                <EntityFormField
                    entity="user"
                    name="leadOwner"
                    initialId={ownerId ?? null}
                    placeholder="Pick a user…"
                    onChange={(next) => persist(next)}
                />
                <button
                    type="button"
                    className="text-[12px] text-[var(--st-text-secondary)] hover:underline"
                    onClick={() => persist(null)}
                    disabled={isPending}
                >
                    Unassign
                </button>
            </PopoverContent>
        </Popover>
    );
}

interface InlineStageEditProps {
    leadId: string;
    stage?: string | null;
    onSaved?: () => void;
}

export function InlineStageEdit({
    leadId,
    stage,
    onSaved,
}: InlineStageEditProps) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [draft, setDraft] = React.useState(stage ?? '');
    const [isPending, startTransition] = React.useTransition();

    React.useEffect(() => {
        if (open) setDraft(stage ?? '');
    }, [open, stage]);

    const persist = React.useCallback(() => {
        const next = draft.trim();
        if (next === (stage ?? '')) {
            setOpen(false);
            return;
        }
        startTransition(async () => {
            const res = await updateCrmLeadStage(leadId, next);
            if (!res.success) {
                toast({
                    title: 'Stage update failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            toast({ title: next ? `Stage set to ${next}` : 'Stage cleared' });
            setOpen(false);
            onSaved?.();
        });
    }, [draft, stage, leadId, onSaved, toast]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Change stage"
                    className="inline-flex items-center gap-1"
                    disabled={isPending}
                >
                    {stage ? (
                        <StatusPill label={stage} tone={statusToTone(stage)} />
                    ) : (
                        <span className="text-[var(--st-text-secondary)]">—</span>
                    )}
                    <ChevronDown className="h-3 w-3 text-[var(--st-text-tertiary)]" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 space-y-2">
                <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Change stage
                </p>
                <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            persist();
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            setOpen(false);
                        }
                    }}
                    placeholder="Stage name…"
                />
                <div className="flex items-center justify-end gap-1.5">
                    <button
                        type="button"
                        className="text-[12px] text-[var(--st-text-secondary)] hover:underline"
                        onClick={() => setOpen(false)}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="text-[12px] font-medium text-[var(--st-text)] hover:underline disabled:opacity-50"
                        onClick={persist}
                        disabled={isPending}
                    >
                        Save
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

const LEAD_STATUSES = [
    'New',
    'Contacted',
    'Qualified',
    'Unqualified',
    'Converted',
];

interface InlineStatusEditProps {
    leadId: string;
    status?: string | null;
    onSaved?: () => void;
}

export function InlineStatusEdit({
    leadId,
    status,
    onSaved,
}: InlineStatusEditProps) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();

    const apply = React.useCallback(
        (next: string) => {
            if (next === status) {
                setOpen(false);
                return;
            }
            startTransition(async () => {
                const res = await changeCrmLeadStatus(leadId, next);
                if (!res.success) {
                    toast({
                        title: 'Status update failed',
                        description: res.error,
                        variant: 'destructive',
                    });
                    return;
                }
                toast({ title: `Status set to ${next}` });
                setOpen(false);
                onSaved?.();
            });
        },
        [leadId, onSaved, status, toast],
    );

    const current = status || 'New';
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Change status"
                    className="inline-flex items-center gap-1"
                    disabled={isPending}
                >
                    <StatusPill label={current} tone={statusToTone(current)} />
                    <ChevronDown className="h-3 w-3 text-[var(--st-text-tertiary)]" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 space-y-1">
                {LEAD_STATUSES.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => apply(s)}
                        aria-pressed={s === current}
                        disabled={isPending}
                        className={[
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px]',
                            s === current
                                ? 'bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]'
                                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
                        ].join(' ')}
                    >
                        {s}
                        {s === current ? (
                            <span className="text-[11.5px] text-[var(--st-text-secondary)]">current</span>
                        ) : null}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}
