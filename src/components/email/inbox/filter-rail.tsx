'use client';

import * as React from 'react';
import {
  Archive,
  Inbox,
  Mail,
  Star,
  Tag,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

import { Input, cn } from '@/components/zoruui';

export type InboxQuickFilter =
  | 'all'
  | 'unread'
  | 'starred'
  | 'assigned-to-me'
  | 'archived';

export interface FilterRailProps {
  active: InboxQuickFilter;
  onActiveChange: (filter: InboxQuickFilter) => void;
  label: string | null;
  onLabelChange: (label: string | null) => void;
  labels?: string[];
  counts?: Partial<Record<InboxQuickFilter, number>>;
}

const QUICK_FILTERS: Array<{
  id: InboxQuickFilter;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'all', label: 'All', icon: Inbox },
  { id: 'unread', label: 'Unread', icon: Mail },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'assigned-to-me', label: 'Assigned to me', icon: UserCheck },
  { id: 'archived', label: 'Archived', icon: Archive },
];

export function FilterRail({
  active,
  onActiveChange,
  label,
  onLabelChange,
  labels = [],
  counts,
}: FilterRailProps) {
  const [labelDraft, setLabelDraft] = React.useState(label ?? '');

  React.useEffect(() => {
    setLabelDraft(label ?? '');
  }, [label]);

  const commitLabel = React.useCallback(
    (value: string) => {
      const trimmed = value.trim();
      onLabelChange(trimmed.length ? trimmed : null);
    },
    [onLabelChange],
  );

  return (
    <div className="flex h-full flex-col gap-4 border-r border-zoru-line bg-zoru-surface/40 p-3">
      <nav className="flex flex-col gap-0.5">
        {QUICK_FILTERS.map((f) => {
          const Icon = f.icon;
          const isActive = active === f.id;
          const count = counts?.[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onActiveChange(f.id)}
              className={cn(
                'flex items-center gap-2 rounded-[var(--zoru-radius)] px-3 py-2 text-sm text-zoru-ink-muted transition-colors hover:bg-zoru-surface-raised hover:text-zoru-ink',
                isActive &&
                  'bg-zoru-ink text-zoru-on-primary hover:bg-zoru-ink hover:text-zoru-on-primary',
              )}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{f.label}</span>
              {count != null && count > 0 && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                    isActive
                      ? 'bg-zoru-on-primary text-zoru-ink'
                      : 'bg-zoru-surface-raised text-zoru-ink',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          <Tag className="h-3 w-3" /> Label
        </div>
        <Input
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => commitLabel(labelDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitLabel(labelDraft);
            }
          }}
          placeholder="Filter by label…"
        />
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1 px-0.5">
            {labels.slice(0, 12).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLabelChange(label === l ? null : l)}
                className={cn(
                  'rounded-full border border-zoru-line bg-zoru-bg px-2 py-0.5 text-[11px] text-zoru-ink-muted transition-colors hover:border-zoru-ink/30 hover:text-zoru-ink',
                  label === l &&
                    'border-zoru-ink bg-zoru-ink text-zoru-on-primary',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
