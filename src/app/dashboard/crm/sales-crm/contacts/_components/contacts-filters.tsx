'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Label,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  Archive,
  X } from 'lucide-react';

/**
 * Filter row + bulk action bar for the contacts list page.
 *
 * Extracted to keep `page.tsx` well under the 600-line scope cap.
 * Pure presentation — concrete filter values are passed in by the
 * parent. The bulk bar emits semantic callbacks the parent translates
 * into mutation calls.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

/* ─── Status / lifecycle filter values ────────────────────────────────── */

export type ContactStatusFilter =
    | 'all'
    | 'new_lead'
    | 'contacted'
    | 'qualified'
    | 'unqualified'
    | 'customer'
    | 'imported'
    | 'archived';

export type ContactLifecycleFilter =
    | 'all'
    | 'subscriber'
    | 'lead'
    | 'mql'
    | 'sql'
    | 'opportunity'
    | 'customer'
    | 'evangelist';

export interface ContactsFiltersRowProps {
    statusFilter: ContactStatusFilter;
    onStatusChange: (v: ContactStatusFilter) => void;
    lifecycleFilter: ContactLifecycleFilter;
    onLifecycleChange: (v: ContactLifecycleFilter) => void;
    sourceFilter: string;
    onSourceChange: (v: string) => void;
    ownerFilter: string;
    onOwnerChange: (v: string) => void;
    accountFilter: string;
    onAccountChange: (v: string) => void;
    tagFilter: string;
    onTagChange: (v: string) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function ContactsFiltersRow(props: ContactsFiltersRowProps) {
    return (
        <ZoruCard>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Status
                    </ZoruLabel>
                    <EnumFilterField
                        enumName="contactStatus"
                        value={props.statusFilter}
                        onChange={(v) => props.onStatusChange(v as ContactStatusFilter)}
                        allLabel="All"
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Lifecycle
                    </ZoruLabel>
                    <EnumFilterField
                        enumName="lifecycleStage"
                        value={props.lifecycleFilter}
                        onChange={(v) => props.onLifecycleChange(v as ContactLifecycleFilter)}
                        allLabel="All stages"
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Source
                    </ZoruLabel>
                    <EntityFormField
                        entity="leadSource"
                        name="sourceFilter"
                        initialId={props.sourceFilter || null}
                        placeholder="Any source"
                        onChange={(next) => props.onSourceChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Owner
                    </ZoruLabel>
                    <EntityFormField
                        entity="user"
                        name="ownerFilter"
                        initialId={props.ownerFilter || null}
                        placeholder="Any owner"
                        onChange={(next) => props.onOwnerChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Account
                    </ZoruLabel>
                    <EntityFormField
                        entity="client"
                        name="accountFilter"
                        initialId={props.accountFilter || null}
                        placeholder="Any account"
                        onChange={(next) => props.onAccountChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Tag
                    </ZoruLabel>
                    <EntityFormField
                        entity="tag"
                        name="tagFilter"
                        initialId={props.tagFilter || null}
                        placeholder="Any tag"
                        onChange={(next) => props.onTagChange(next ?? '')}
                    />
                </div>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-3 lg:col-span-6">
                        <ZoruButton variant="ghost" size="sm" onClick={props.onClear}>
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </ZoruButton>
                    </div>
                ) : null}
            </ZoruCardContent>
        </ZoruCard>
    );
}

export interface ContactsBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onStatusChange: (s: string) => void;
    onExport: () => void;
    /** TODO 1D.1 — bulk assign-to-user / bulk add-tag pickers deferred. */
}

export function ContactsBulkBar({
    count,
    onClear,
    onArchive,
    onDelete,
    onStatusChange,
    onExport,
}: ContactsBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <ZoruBadge variant="info">{count} selected</ZoruBadge>
            <EnumFormField
                enumName="contactStatus"
                onChange={(v) => v && onStatusChange(v)}
                placeholder="Set status…"
            />
            <ZoruButton size="sm" variant="outline" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onExport}>
                Export CSV
            </ZoruButton>
            <ZoruButton size="sm" variant="destructive" onClick={onDelete}>
                Delete
            </ZoruButton>
            <ZoruButton size="sm" variant="ghost" onClick={onClear}>
                Clear
            </ZoruButton>
            {/* TODO 1D.1: bulk assign-to-user picker + tag-add deferred — both depend on a dialog wrapper we haven't shipped here. */}
        </div>
    );
}
