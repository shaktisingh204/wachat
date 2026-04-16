'use client';
import { useEffect, useCallback } from 'react';
import { LuX } from 'react-icons/lu';

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
      { keys: ['Del', '/\u00a0Backspace'], description: 'Delete selected' },
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
      <span className="text-[var(--gray-10)] text-xs select-none">{label}</span>
    );
  }
  return (
    <kbd
      className="
        inline-flex items-center justify-center
        px-1.5 py-0.5 min-w-[1.5rem]
        rounded border border-[var(--gray-6)]
        bg-[var(--gray-2)]
        text-[var(--gray-12)] text-[11px] font-mono font-medium
        shadow-[0_1px_0_var(--gray-6)]
        select-none
      "
    >
      {label}
    </kbd>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ShortcutsHelp({ isOpen, onClose }: Props) {
  // Close on Escape or '?' key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' || e.key === '?') {
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

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts reference"
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-black/40 backdrop-blur-sm
        animate-in fade-in duration-150
      "
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div
        className="
          relative
          w-full max-w-2xl mx-4
          max-h-[85vh] overflow-y-auto
          rounded-xl
          border border-[var(--gray-5)]
          bg-[var(--gray-1)]
          shadow-2xl
          animate-in zoom-in-95 duration-150
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--gray-5)]">
          <h2 className="text-sm font-semibold text-[var(--gray-12)] tracking-wide uppercase">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="
              flex h-7 w-7 items-center justify-center rounded-md
              text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]
              transition-colors
            "
          >
            <LuX size={15} />
          </button>
        </div>

        {/* Body — two-column grid of sections */}
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)] mb-2">
                {section.heading}
              </p>
              <table className="w-full border-collapse">
                <tbody>
                  {section.rows.map((row, i) => (
                    <tr
                      key={i}
                      className="group border-b border-[var(--gray-4)] last:border-b-0"
                    >
                      {/* Key combo cell */}
                      <td className="py-1.5 pr-4 align-middle whitespace-nowrap">
                        <span className="flex items-center gap-1 flex-wrap">
                          {row.keys.map((k, ki) => (
                            <KeyPill key={ki} label={k} />
                          ))}
                        </span>
                      </td>
                      {/* Description cell */}
                      <td className="py-1.5 align-middle text-xs text-[var(--gray-11)] group-hover:text-[var(--gray-12)] transition-colors">
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-[var(--gray-5)]">
          <p className="text-[11px] text-[var(--gray-9)] text-center">
            Press <KeyPill label="?" /> or <KeyPill label="Esc" /> to close
          </p>
        </div>
      </div>
    </div>
  );
}
