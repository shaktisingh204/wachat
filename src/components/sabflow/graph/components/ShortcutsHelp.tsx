'use client';
import { useEffect, useCallback } from 'react';

import { Modal, Badge, Table, TBody, Tr, Td } from '@/components/sabcrm/20ui';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ShortcutRow = {
  keys: string[];
  description: string;
};

type ShortcutSection = {
  heading: string;
  rows: ShortcutRow[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/* ─── Data ───────────────────────────────────────────────────────────────── */

const isMac =
  typeof window !== 'undefined' && /mac/i.test(window.navigator.platform);

const MOD = isMac ? '⌘' : 'Ctrl';

const SECTIONS: ShortcutSection[] = [
  {
    heading: 'Canvas',
    rows: [
      { keys: ['Space', 'Drag'], description: 'Pan canvas' },
      { keys: [MOD, '='], description: 'Zoom in' },
      { keys: [MOD, '−'], description: 'Zoom out' },
      { keys: [MOD, '0'], description: 'Reset zoom to 100%' },
      { keys: [MOD, 'Shift', 'F'], description: 'Fit all nodes in view' },
    ],
  },
  {
    heading: 'Selection',
    rows: [
      { keys: [MOD, 'A'], description: 'Select all groups' },
      { keys: ['Click'], description: 'Select group' },
      { keys: ['Shift', 'Click'], description: 'Add to selection' },
      { keys: ['Drag'], description: 'Rubber-band select' },
      { keys: ['Esc'], description: 'Deselect all' },
    ],
  },
  {
    heading: 'Editing',
    rows: [
      { keys: [MOD, 'Z'], description: 'Undo' },
      { keys: [MOD, 'Shift', 'Z'], description: 'Redo' },
      { keys: [MOD, 'C'], description: 'Copy selected' },
      { keys: [MOD, 'X'], description: 'Cut selected' },
      { keys: [MOD, 'V'], description: 'Paste' },
      { keys: [MOD, 'D'], description: 'Duplicate selected' },
      { keys: ['Del', '/ Backspace'], description: 'Delete selected' },
      { keys: [MOD, 'S'], description: 'Save flow' },
    ],
  },
  {
    heading: 'Nudge (with selection)',
    rows: [
      { keys: ['↑ ↓ ← →'], description: 'Move by 10 px' },
      { keys: ['Shift', '↑ ↓ ← →'], description: 'Move by 50 px' },
    ],
  },
  {
    heading: 'Help',
    rows: [{ keys: ['?'], description: 'Toggle this shortcuts panel' }],
  },
];

/* ─── Key pill ───────────────────────────────────────────────────────────── */

function KeyPill({ label }: { label: string }) {
  const isPlain = label.startsWith('/');
  if (isPlain) {
    return (
      <span className="text-[var(--st-text-secondary)] text-xs select-none">
        {label}
      </span>
    );
  }
  return (
    <Badge tone="neutral" kind="outline" className="font-mono select-none">
      {label}
    </Badge>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ShortcutsHelp({ isOpen, onClose }: Props) {
  // The Modal already closes on Escape and overlay click; we additionally close
  // when the user presses '?' to toggle the panel off.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === '?') {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      size="lg"
      footer={
        <p className="w-full text-[11px] text-[var(--st-text-tertiary)] text-center">
          Press <KeyPill label="?" /> or <KeyPill label="Esc" /> to close
        </p>
      }
    >
      {/* Two-column grid of sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)] mb-2">
              {section.heading}
            </p>
            <Table density="compact" hover={false} className="w-full">
              <TBody>
                {section.rows.map((row, i) => (
                  <Tr key={i}>
                    {/* Key combo cell */}
                    <Td className="whitespace-nowrap align-middle">
                      <span className="flex items-center gap-1 flex-wrap">
                        {row.keys.map((k, ki) => (
                          <KeyPill key={ki} label={k} />
                        ))}
                      </span>
                    </Td>
                    {/* Description cell */}
                    <Td className="align-middle text-xs text-[var(--st-text-secondary)]">
                      {row.description}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        ))}
      </div>
    </Modal>
  );
}
