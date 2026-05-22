'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import {
  Input,
  ZoruKbd,
  Popover,
  ZoruPopoverAnchor,
  ZoruPopoverContent,
} from '@/components/zoruui';
import { searchAll, type UniversalSearchResult } from '@/app/actions/universal-search.actions';
import { cn } from '@/components/zoruui/lib/cn';

const SECTIONS: Array<{
  key: keyof UniversalSearchResult;
  label: string;
}> = [
  { key: 'leads', label: 'Leads' },
  { key: 'deals', label: 'Deals' },
  { key: 'clients', label: 'Clients' },
  { key: 'projects', label: 'Projects' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'tickets', label: 'Tickets' },
];

const DEBOUNCE_MS = 250;

export interface UniversalSearchProps {
  className?: string;
}

export function UniversalSearch({ className }: UniversalSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<UniversalSearchResult | null>(null);

  // Cmd+K / Ctrl+K — focus the input from anywhere in the app.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Debounced search.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchAll(q, 5);
        if (!cancelled) setResults(res);
      } catch {
        if (!cancelled) setResults(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const totalHits = React.useMemo(() => {
    if (!results) return 0;
    return SECTIONS.reduce((sum, s) => sum + results[s.key].length, 0);
  }, [results]);

  const showDropdown = open && (query.trim().length >= 2 || query.length === 0);

  return (
    <Popover open={showDropdown} onOpenChange={setOpen}>
      <ZoruPopoverAnchor asChild>
        <div className={cn('w-full max-w-md', className)}>
          <Input
            ref={inputRef}
            placeholder="Search leads, deals, clients…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            leadingSlot={<Search />}
            trailingSlot={<ZoruKbd>⌘K</ZoruKbd>}
            aria-label="Universal search"
          />
        </div>
      </ZoruPopoverAnchor>
      <ZoruPopoverContent
        align="start"
        sideOffset={6}
        className="w-[480px] max-w-[90vw] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Don't close when clicking the input itself.
          const t = e.target as Node | null;
          if (t && inputRef.current?.contains(t)) e.preventDefault();
        }}
      >
        {query.trim().length < 2 ? (
          <div className="p-6 text-sm text-zoru-ink-muted">
            <p className="text-zoru-ink">Type to search…</p>
            <ul className="mt-3 space-y-1.5 text-[12.5px]">
              <li>• Try a contact name or company</li>
              <li>• Search invoice numbers like <code>INV-2024-001</code></li>
              <li>• Find tickets by subject keyword</li>
            </ul>
            <p className="mt-4 text-[11px] text-zoru-ink-subtle">
              Press <ZoruKbd>⌘K</ZoruKbd> anywhere to focus
            </p>
          </div>
        ) : loading && !results ? (
          <div className="p-6 text-sm text-zoru-ink-muted">Searching…</div>
        ) : totalHits === 0 ? (
          <div className="p-6 text-sm text-zoru-ink-muted">
            No results for <span className="text-zoru-ink">"{query}"</span>
          </div>
        ) : (
          <div className="max-h-[480px] overflow-auto py-1">
            {SECTIONS.map((section) => {
              const hits = results?.[section.key] ?? [];
              if (hits.length === 0) return null;
              return (
                <div key={section.key} className="py-1">
                  <p className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-wider text-zoru-ink-subtle">
                    {section.label}
                  </p>
                  <ul>
                    {hits.map((hit) => (
                      <li key={`${section.key}-${hit._id}`}>
                        <Link
                          href={hit.href}
                          onClick={() => setOpen(false)}
                          className="flex flex-col gap-0.5 px-3 py-2 text-sm text-zoru-ink hover:bg-zoru-surface"
                        >
                          <span className="truncate">{hit.title}</span>
                          {hit.subtitle && (
                            <span className="truncate text-[11px] text-zoru-ink-muted">
                              {hit.subtitle}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </ZoruPopoverContent>
    </Popover>
  );
}
