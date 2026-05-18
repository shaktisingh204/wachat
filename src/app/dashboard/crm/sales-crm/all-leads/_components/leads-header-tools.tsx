'use client';

import { ZoruButton } from '@/components/zoruui';
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
            <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                <button
                    type="button"
                    onClick={() => onViewChange('table')}
                    aria-pressed={view === 'table'}
                    className={[
                        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                        view === 'table'
                            ? 'bg-zoru-surface text-zoru-ink'
                            : 'text-zoru-ink-muted hover:text-zoru-ink',
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
                            ? 'bg-zoru-surface text-zoru-ink'
                            : 'text-zoru-ink-muted hover:text-zoru-ink',
                    ].join(' ')}
                >
                    <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                </button>
            </div>
            <ZoruButton asChild variant="outline" size="sm">
                <Link href="/dashboard/crm/sales-crm/all-leads/duplicates">
                    <Copy className="h-3.5 w-3.5" /> Find duplicates
                </Link>
            </ZoruButton>
        </div>
    );
}

export default LeadsHeaderTools;
