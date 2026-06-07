'use client';
/**
 * ShortcutHelp - keyboard-shortcut cheat sheet overlay.
 * Toggled by pressing "?" on the canvas.
 */
import { Modal, Kbd } from '@/components/sabcrm/20ui';

const SECTIONS: { title: string; shortcuts: [string, string][] }[] = [
  {
    title: 'Canvas',
    shortcuts: [
      ['Tab', 'Open node picker'],
      ['0', 'Reset zoom'],
      ['1', 'Fit to view'],
      ['⇧ S', 'Add sticky note'],
      ['⇧ ⌥ T', 'Tidy up (auto-layout)'],
      ['?', 'Show / hide this help'],
    ],
  },
  {
    title: 'Selection & navigation',
    shortcuts: [
      ['⌘ A', 'Select all'],
      ['Esc', 'Clear selection'],
      ['← ↑ → ↓', 'Hop between connected nodes'],
      ['Enter', 'Open selected node'],
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      ['⌘ C / ⌘ V', 'Copy / paste'],
      ['⌘ X', 'Cut'],
      ['⌘ D', 'Duplicate'],
      ['F2', 'Rename selected'],
      ['D', 'Toggle disabled'],
      ['P', 'Pin / unpin data'],
      ['Delete', 'Delete selected'],
    ],
  },
  {
    title: 'History',
    shortcuts: [
      ['⌘ Z', 'Undo'],
      ['⌘ ⇧ Z', 'Redo'],
      ['⌘ S', 'Save'],
    ],
  },
];

type Props = { open: boolean; onClose: () => void };

export function ShortcutHelp({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="lg">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--st-text-tertiary)]">
              {section.title}
            </div>
            <div className="flex flex-col gap-1.5">
              {section.shortcuts.map(([combo, desc]) => (
                <div
                  key={combo}
                  className="flex items-center justify-between gap-3 text-[12.5px] text-[var(--st-text)]"
                >
                  <span className="text-[var(--st-text-secondary)]">{desc}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {combo.split(' ').map((key, i) => (
                      <Kbd key={`${key}-${i}`}>{key}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
