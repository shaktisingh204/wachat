'use client';

import { Badge, Card, cn } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';

/**
 * `<SearchResultsClient>` — interactive grid of grouped search results
 * for `/dashboard/crm/search`.
 *
 * Receives server-rendered `groups: SearchResultGroup[]` and:
 *  - Renders each group in its own `<Card>` with the entity kind as
 *    the card title.
 *  - Each row is an `<EntityPickerChip>`-style pill — avatar/initials +
 *    primary + secondary — clickable, navigates to the result's route.
 *  - Keyboard nav: ↑/↓ moves the focused row across the flattened list;
 *    Enter opens it. Focus wraps at both ends.
 */

import * as React from 'react';
import Link from 'next/link';

import type { SearchResult, SearchResultGroup } from '@/app/actions/crm-search.actions';

interface SearchResultsClientProps {
  groups: SearchResultGroup[];
  /** The currently-active query — surfaced for the count label. */
  query: string;
}

interface FlatRow extends SearchResult {
  groupIndex: number;
  rowIndex: number;
}

function initialsOf(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '·';
}

export function SearchResultsClient({
  groups,
  query,
}: SearchResultsClientProps): React.JSX.Element {
  const router = useRouter();

  // Flatten for keyboard navigation. Recomputed when groups change.
  const flat = React.useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    groups.forEach((g, gi) => {
      g.results.forEach((r, ri) => {
        out.push({ ...r, groupIndex: gi, rowIndex: ri });
      });
    });
    return out;
  }, [groups]);

  const [focusIdx, setFocusIdx] = React.useState<number>(-1);
  // Reset focus when the result set changes (new query).
  React.useEffect(() => {
    setFocusIdx(flat.length > 0 ? 0 : -1);
  }, [flat.length, query]);

  // Imperatively focus the active row so scroll-into-view + Enter both
  // work without us hand-rolling a roving tabindex.
  const rowRefs = React.useRef<Array<HTMLAnchorElement | null>>([]);
  React.useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, flat.length);
  }, [flat.length]);
  React.useEffect(() => {
    if (focusIdx < 0) return;
    const el = rowRefs.current[focusIdx];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [focusIdx]);

  // Capture ↑/↓/Enter at the container level so the user doesn't have
  // to tab into the list first.
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (flat.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx((i) => (i + 1) % flat.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx((i) => (i <= 0 ? flat.length - 1 : i - 1));
      } else if (e.key === 'Enter' && focusIdx >= 0) {
        e.preventDefault();
        const row = flat[focusIdx];
        if (row) router.push(row.route);
      }
    },
    [flat, focusIdx, router],
  );

  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      onKeyDown={onKeyDown}
      role="region"
      aria-label="Search results"
    >
      {groups.map((group, gi) => (
        <Card key={group.entityKind} className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--st-text)]">{group.label}</h2>
              <Badge variant="secondary">{group.results.length}</Badge>
            </div>
          </div>
          <ul className="flex flex-col gap-1">
            {group.results.map((r, ri) => {
              const flatIdx = flat.findIndex(
                (f) => f.groupIndex === gi && f.rowIndex === ri,
              );
              const isFocused = flatIdx === focusIdx;
              return (
                <li key={`${group.entityKind}-${r.id}`}>
                  <Link
                    href={r.route}
                    ref={(el) => {
                      if (flatIdx >= 0) rowRefs.current[flatIdx] = el;
                    }}
                    onFocus={() => {
                      if (flatIdx >= 0) setFocusIdx(flatIdx);
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors',
                      'hover:border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]',
                      'focus:border-[var(--st-text)] focus:bg-[var(--st-text)]/10 focus:outline-none',
                      isFocused && 'border-[var(--st-text)] bg-[var(--st-text)]/10',
                    )}
                  >
                    <Avatar avatarUrl={r.avatarUrl} fallback={initialsOf(r.primary)} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium text-[var(--st-text)]">
                        {r.primary}
                      </span>
                      {r.secondary ? (
                        <span className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                          {r.secondary}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Avatar({
  avatarUrl,
  fallback,
}: {
  avatarUrl?: string;
  fallback: string;
}): React.JSX.Element {
  if (avatarUrl) {
    // Plain <img> on purpose: avatars come from arbitrary tenant URLs
    // (R2/S3/external); using `next/image` would force a remotePatterns
    // entry per host. Mirrors the `<CommandPalette>` Avatar component.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[10px] font-medium text-[var(--st-text-secondary)]"
    >
      {fallback}
    </span>
  );
}
