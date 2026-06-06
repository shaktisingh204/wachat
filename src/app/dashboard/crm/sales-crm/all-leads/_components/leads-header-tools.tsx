'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { Copy, LayoutGrid, List } from 'lucide-react';

/**
 * Compound header tool group for the leads list page:
 *  • Saved-view dropdown (LeadsViewsMenu)
 *  • Table / Kanban view toggle
 *  • Find-duplicates outbound link
 */

import * as React from 'react';
import Link from 'next/link';

import { LeadsViewsMenu } from './leads-filters';

export type LeadsViewMode = 'table' | 'kanban';

interface LeadsHeaderToolsProps {
    view: LeadsViewMode;
    onViewChange: (v: LeadsViewMode) => void;
    activePresetId: string;
    onSelectPreset: (presetId: string) => void;
}

export function LeadsHeaderTools({
    view,
    onViewChange,
    activePresetId,
    onSelectPreset,
}: LeadsHeaderToolsProps) {
    return (
        <div className="flex items-center gap-2">
            <LeadsViewsMenu activePresetId={activePresetId} onSelect={onSelectPreset} />
            <div className="inline-flex rounded-md border border-[var(--st-border)] p-0.5">
                <button
                    type="button"
                    onClick={() => onViewChange('table')}
                    aria-pressed={view === 'table'}
                    className={[
                        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                        view === 'table'
                            ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                            : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                    ].join(' ')}
                >
                    <List className="h-3.5 w-3.5" /> Table
                </button>
                <button
                    type="button"
                    onClick={() => onViewChange('kanban')}
                    aria-pressed={view === 'kanban'}
                    className={[
                        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                        view === 'kanban'
                            ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                            : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                    ].join(' ')}
                >
                    <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                </button>
            </div>
            <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/crm/sales-crm/all-leads/duplicates">
                    <Copy className="h-3.5 w-3.5" /> Find duplicates
                </Link>
            </Button>
        </div>
    );
}

export default LeadsHeaderTools;
