'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Kbd } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * <KeyboardShortcuts/> — page-level keyboard layer for the CRM.
 *
 * Mount once near the CRM dashboard root (alongside `<CommandPaletteProvider>`).
 * Listens for two-character chord sequences à la Gmail/Linear:
 *
 *   - `g` + letter — "Go to" a list page (e.g. `gi` → invoices).
 *   - `c` + letter — "Create new" entity (e.g. `ci` → new invoice).
 *   - `?`          — toggle the cheat-sheet modal.
 *   - `Esc`        — close the cheat-sheet.
 *
 * Chord sequences time out after 600ms of idle, so a stray `g` won't
 * navigate on its own. Key events are ignored while the user is typing
 * into an input, textarea, select, or contentEditable element — this
 * keeps the layer transparent inside forms.
 *
 * @example
 * ```tsx
 * // In src/app/dashboard/crm/layout.tsx (client subtree)
 * <CommandPaletteProvider>
 *   <KeyboardShortcuts />
 *   {children}
 * </CommandPaletteProvider>
 * ```
 *
 * @example Suspend while a custom modal owns the keyboard
 * ```tsx
 * <KeyboardShortcuts enabled={!isMyModalOpen} />
 * ```
 */

import * as React from 'react';

export interface KeyboardShortcutsProps {
  /** Disable when a modal owns the keyboard, etc. */
  enabled?: boolean;
}

/**
 * Two-character chord → destination route. The route map is hoisted to the
 * module scope so the keydown listener has stable identity across renders
 * (avoids a re-bind on every parent re-render).
 */
const CHORD_ROUTE_MAP: Record<string, string> = {
  // Go to…
  gi: '/dashboard/crm/sales/invoices',
  gq: '/dashboard/crm/sales/quotations',
  gd: '/dashboard/crm/sales-crm/deals',
  gl: '/dashboard/crm/sales-crm/all-leads',
  gc: '/dashboard/crm/accounts',
  gv: '/dashboard/crm/purchases/vendors',
  gp: '/dashboard/crm/purchases/orders',
  ge: '/dashboard/hrm/payroll/employees',
  gt: '/dashboard/sabdesk',
  // Create new…
  ci: '/dashboard/crm/sales/invoices/new',
  cq: '/dashboard/crm/sales/quotations/new',
  cd: '/dashboard/crm/sales-crm/deals/new',
  cl: '/dashboard/crm/sales-crm/all-leads/new',
  cc: '/dashboard/crm/accounts/new',
  ce: '/dashboard/hrm/payroll/employees/new',
};

interface ShortcutRow {
  chord: string;
  label: string;
}

const GO_TO_ROWS: ShortcutRow[] = [
  { chord: 'g i', label: 'Invoices' },
  { chord: 'g q', label: 'Quotations' },
  { chord: 'g d', label: 'Deals' },
  { chord: 'g l', label: 'Leads' },
  { chord: 'g c', label: 'Accounts' },
  { chord: 'g v', label: 'Vendors' },
  { chord: 'g p', label: 'Purchase orders' },
  { chord: 'g e', label: 'Employees' },
  { chord: 'g t', label: 'Tickets' },
];

const CREATE_ROWS: ShortcutRow[] = [
  { chord: 'c i', label: 'New invoice' },
  { chord: 'c q', label: 'New quotation' },
  { chord: 'c d', label: 'New deal' },
  { chord: 'c l', label: 'New lead' },
  { chord: 'c c', label: 'New account' },
  { chord: 'c e', label: 'New employee' },
];

const CHORD_TIMEOUT_MS = 600;

export function KeyboardShortcuts({ enabled = true }: KeyboardShortcutsProps) {
  const router = useRouter();
  const [showHelp, setShowHelp] = React.useState(false);
  const seqRef = React.useRef<string>('');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable === true;

      // `?` toggles the cheat sheet from anywhere outside a text field.
      if (e.key === '?' && !inField) {
        e.preventDefault();
        setShowHelp((s) => !s);
        return;
      }

      // Always allow Esc to dismiss the cheat-sheet, even mid-typing.
      if (e.key === 'Escape') {
        setShowHelp(false);
        return;
      }

      if (inField) return;

      // Skip plain modifier keys, function keys, and anything with a
      // command/alt/ctrl modifier — those belong to other layers
      // (Cmd-K command palette, browser shortcuts, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;

      const lowered = e.key.toLowerCase();
      seqRef.current += lowered;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        seqRef.current = '';
        timerRef.current = null;
      }, CHORD_TIMEOUT_MS);

      const seq = seqRef.current;
      const dest = CHORD_ROUTE_MAP[seq];
      if (dest) {
        seqRef.current = '';
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        router.push(dest);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, router]);

  if (!showHelp) return null;
  return <ShortcutsCheatSheet onClose={() => setShowHelp(false)} />;
}

/* ------------------------------------------------------------------ */
/* Internals                                                            */
/* ------------------------------------------------------------------ */

function ShortcutsCheatSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press{' '}
            <Kbd>?</Kbd> any time to toggle this sheet. Sequences
            time out after a short pause.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <ShortcutGroup heading="Go to" rows={GO_TO_ROWS} />
          <ShortcutGroup heading="Create new" rows={CREATE_ROWS} />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutGroup({
  heading,
  rows,
}: {
  heading: string;
  rows: ShortcutRow[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--st-text-secondary)]">
        {heading}
      </h3>
      <ul className="flex flex-col divide-y divide-[var(--st-border)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        {rows.map((row) => (
          <li
            key={row.chord}
            className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-[var(--st-text)]"
          >
            <span className="truncate">{row.label}</span>
            <ChordKbd chord={row.chord} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChordKbd({ chord }: { chord: string }) {
  const parts = chord.split(' ');
  return (
    <span className="flex shrink-0 items-center gap-1">
      {parts.map((part, idx) => (
        <React.Fragment key={`${chord}-${idx}`}>
          <Kbd>{part}</Kbd>
          {idx < parts.length - 1 ? (
            <span aria-hidden className="text-[10px] text-[var(--st-text-tertiary)]">
              then
            </span>
          ) : null}
        </React.Fragment>
      ))}
    </span>
  );
}
