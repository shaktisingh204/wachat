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

import { Badge, Button, Input, cn } from '@/components/sabcrm/20ui';

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
    <div className="flex h-full flex-col gap-4 border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-3">
      <nav className="flex flex-col gap-0.5" aria-label="Inbox filters">
        {QUICK_FILTERS.map((f) => {
          const isActive = active === f.id;
          const count = counts?.[f.id];
          return (
            <Button
              key={f.id}
              variant={isActive ? 'primary' : 'ghost'}
              block
              iconLeft={f.icon}
              onClick={() => onActiveChange(f.id)}
              aria-pressed={isActive}
              className="justify-start"
            >
              <span className="flex w-full items-center gap-2">
                <span className="flex-1 text-left">{f.label}</span>
                {count != null && count > 0 && (
                  <Badge tone={isActive ? 'accent' : 'neutral'} kind="soft">
                    {count}
                  </Badge>
                )}
              </span>
            </Button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          <Tag className="h-3 w-3" aria-hidden="true" /> Label
        </div>
        <Input
          aria-label="Filter by label"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => commitLabel(labelDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitLabel(labelDraft);
            }
          }}
          placeholder="Filter by label"
        />
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1 px-0.5">
            {labels.slice(0, 12).map((l) => {
              const isSelected = label === l;
              return (
                <Button
                  key={l}
                  size="sm"
                  variant={isSelected ? 'primary' : 'outline'}
                  onClick={() => onLabelChange(isSelected ? null : l)}
                  aria-pressed={isSelected}
                  className={cn('rounded-full', !isSelected && 'border-[var(--st-border)] text-[var(--st-text-secondary)]')}
                >
                  {l}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
