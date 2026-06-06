'use client';

import { Badge, Button, Popover, ZoruPopoverContent, ZoruPopoverTrigger, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  Tag,
  X } from 'lucide-react';

/**
 * <LeadTagsChips> — clickable tag list on the lead detail page.
 *
 * Renders each existing tag as a removable chip plus an inline
 * "+ Add tag" picker. Persists every mutation via `updateCrmLeadTags`
 * with optimistic update + toast on failure.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { updateCrmLeadTags } from '@/app/actions/crm-leads.actions';

interface LeadTagsChipsProps {
    leadId: string;
    tags: string[];
    onTagsChanged?: (next: string[]) => void;
}

export function LeadTagsChips({ leadId, tags, onTagsChanged }: LeadTagsChipsProps) {
    const { toast } = useZoruToast();
    const [localTags, setLocalTags] = React.useState<string[]>(tags);
    const [addOpen, setAddOpen] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();

    React.useEffect(() => {
        setLocalTags(tags);
    }, [tags]);

    const persist = React.useCallback(
        (next: string[]) => {
            const before = localTags;
            setLocalTags(next);
            startTransition(async () => {
                const res = await updateCrmLeadTags(leadId, next);
                if (!res.success) {
                    setLocalTags(before);
                    toast({
                        title: 'Tag update failed',
                        description: res.error,
                        variant: 'destructive',
                    });
                    return;
                }
                onTagsChanged?.(next);
            });
        },
        [leadId, localTags, onTagsChanged, toast],
    );

    const handleAdd = React.useCallback(
        (next: string | null) => {
            setAddOpen(false);
            if (!next) return;
            if (localTags.includes(next)) return;
            persist([...localTags, next]);
        },
        [localTags, persist],
    );

    const handleRemove = React.useCallback(
        (id: string) => {
            persist(localTags.filter((t) => t !== id));
        },
        [localTags, persist],
    );

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {localTags.length === 0 ? (
                <span className="text-[12px] text-[var(--st-text-secondary)]">No tags</span>
            ) : (
                localTags.map((tagId) => (
                    <span
                        key={tagId}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-0.5 text-[11.5px] text-[var(--st-text)]"
                    >
                        <EntityPickerChip entity="tag" id={tagId} fallback={tagId.slice(-6)} />
                        <button
                            type="button"
                            aria-label="Remove tag"
                            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                            onClick={() => handleRemove(tagId)}
                            disabled={isPending}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))
            )}
            <Popover open={addOpen} onOpenChange={setAddOpen}>
                <ZoruPopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[12px]">
                        <Tag className="h-3 w-3" /> + Add tag
                    </Button>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent align="start" className="w-64 space-y-2">
                    <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Add a tag
                    </p>
                    <EntityFormField
                        entity="tag"
                        name="newTag"
                        placeholder="Pick or create a tag…"
                        onChange={handleAdd}
                    />
                </ZoruPopoverContent>
            </Popover>
        </div>
    );
}

export default LeadTagsChips;
