'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Boxes,
  Compass,
  Home,
  LayoutGrid,
  Plug,
  ScanSearch,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/sabcrm/20ui';

interface Command {
  label: string;
  href: string;
  icon: LucideIcon;
}

const COMMANDS: Command[] = [
  { label: 'Home', href: '/dashboard/sabbi', icon: Home },
  { label: 'Connectors', href: '/dashboard/sabbi/connectors', icon: Plug },
  { label: 'Models & metrics', href: '/dashboard/sabbi/models', icon: Boxes },
  { label: 'Explore', href: '/dashboard/sabbi/explore', icon: Compass },
  { label: 'Query Lab', href: '/dashboard/sabbi/sql', icon: Terminal },
  { label: 'Boards', href: '/dashboard/sabbi/boards', icon: LayoutGrid },
  { label: 'X-ray', href: '/dashboard/sabbi/xray', icon: ScanSearch },
  { label: 'Copilot', href: '/dashboard/sabbi/copilot', icon: Sparkles },
  { label: 'Alerts', href: '/dashboard/sabbi/alerts', icon: Bell },
];

/** ⌘K / Ctrl+K navigation palette for SabBI. Mounted once in the layout. */
export function SabbiCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(
    () => COMMANDS.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  function go(href: string) {
    setOpen(false);
    setQ('');
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Search SabBI</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jump to…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) go(filtered[0].href);
          }}
        />
        <div className="mt-2 flex max-h-80 flex-col gap-1 overflow-auto">
          {filtered.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.href}
                type="button"
                onClick={() => go(c.href)}
                className="flex items-center gap-2 rounded-[var(--st-radius-sm)] p-2 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-surface-2)]"
              >
                <Icon size={16} aria-hidden="true" /> {c.label}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="p-2 text-sm text-[var(--st-text-secondary)]">No matches.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
