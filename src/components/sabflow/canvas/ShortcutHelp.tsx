'use client';
/**
 * ShortcutHelp — keyboard-shortcut cheat sheet overlay.
 * Toggled by pressing "?" on the canvas.
 */
import { LuX } from 'react-icons/lu';

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
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(0,0,0,0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'var(--gray-1)',
          border: '1px solid var(--gray-5)',
          borderRadius: 14,
          boxShadow: '0 20px 50px -10px rgba(0,0,0,0.28)',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, flex: 1, color: 'var(--gray-12)' }}>
            Keyboard shortcuts
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--gray-10)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px 24px',
          }}
        >
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--gray-9)',
                  marginBottom: 8,
                }}
              >
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {section.shortcuts.map(([combo, desc]) => (
                  <div
                    key={combo}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12.5,
                      color: 'var(--gray-12)',
                    }}
                  >
                    <span style={{ color: 'var(--gray-11)' }}>{desc}</span>
                    <span
                      style={{
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 11,
                        color: 'var(--gray-10)',
                        background: 'var(--gray-3)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {combo}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
