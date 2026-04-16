'use client';

import type { SabFlowTheme } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────
   Preset definitions
───────────────────────────────────────────────────────────── */

type Preset = {
  id: string;
  label: string;
  /** Dot swatches shown on the card: [bg, hostBubble, guestBubble, button] */
  swatches: [string, string, string, string];
  theme: SabFlowTheme;
};

const PRESETS: Preset[] = [
  /* ── Default — white / orange ────────────────────────── */
  {
    id: 'default',
    label: 'Default',
    swatches: ['#ffffff', '#f5f5f5', '#f76808', '#f76808'],
    theme: {
      general: {
        font: 'Inter',
        background: { type: 'Color', content: '#ffffff' },
        progressBar: { isEnabled: false, color: '#f76808', placement: 'top' },
      },
      chat: {
        container: { backgroundColor: '#ffffff', maxWidth: '800px' },
        header: { backgroundColor: '#ffffff', color: '#161616', isEnabled: true },
        hostBubble: {
          backgroundColor: { type: 'Color', value: '#f5f5f5' },
          color: { type: 'Color', value: '#161616' },
          borderRadius: '18px',
        },
        guestBubble: {
          backgroundColor: { type: 'Color', value: '#f76808' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '18px',
        },
        input: {
          backgroundColor: { type: 'Color', value: '#ffffff' },
          color: { type: 'Color', value: '#161616' },
          borderColor: { type: 'Color', value: '#e4e4e7' },
          placeholderColor: { type: 'Color', value: '#a0a0a0' },
          borderRadius: '12px',
        },
        button: {
          backgroundColor: { type: 'Color', value: '#f76808' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '12px',
        },
        roundness: 'Medium',
      },
    },
  },

  /* ── Dark — slate / orange ───────────────────────────── */
  {
    id: 'dark',
    label: 'Dark',
    swatches: ['#0f172a', '#1e293b', '#f76808', '#f76808'],
    theme: {
      general: {
        font: 'Inter',
        background: { type: 'Color', content: '#0f172a' },
        progressBar: { isEnabled: false, color: '#f76808', placement: 'top' },
      },
      chat: {
        container: { backgroundColor: '#0f172a', maxWidth: '800px' },
        header: { backgroundColor: '#1e293b', color: '#f8fafc', isEnabled: true },
        hostBubble: {
          backgroundColor: { type: 'Color', value: '#1e293b' },
          color: { type: 'Color', value: '#f8fafc' },
          borderRadius: '18px',
        },
        guestBubble: {
          backgroundColor: { type: 'Color', value: '#f76808' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '18px',
        },
        input: {
          backgroundColor: { type: 'Color', value: '#1e293b' },
          color: { type: 'Color', value: '#f8fafc' },
          borderColor: { type: 'Color', value: '#334155' },
          placeholderColor: { type: 'Color', value: '#64748b' },
          borderRadius: '12px',
        },
        button: {
          backgroundColor: { type: 'Color', value: '#f76808' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '12px',
        },
        roundness: 'Medium',
      },
    },
  },

  /* ── Minimal — light grey / charcoal ─────────────────── */
  {
    id: 'minimal',
    label: 'Minimal',
    swatches: ['#fafafa', '#f4f4f5', '#18181b', '#18181b'],
    theme: {
      general: {
        font: 'Inter',
        background: { type: 'Color', content: '#fafafa' },
        progressBar: { isEnabled: false, color: '#18181b', placement: 'top' },
      },
      chat: {
        container: { backgroundColor: '#fafafa', maxWidth: '700px' },
        header: { backgroundColor: '#fafafa', color: '#18181b', isEnabled: false },
        hostBubble: {
          backgroundColor: { type: 'Color', value: '#f4f4f5' },
          color: { type: 'Color', value: '#18181b' },
          borderRadius: '6px',
        },
        guestBubble: {
          backgroundColor: { type: 'Color', value: '#18181b' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '6px',
        },
        input: {
          backgroundColor: { type: 'Color', value: '#ffffff' },
          color: { type: 'Color', value: '#18181b' },
          borderColor: { type: 'Color', value: '#d4d4d8' },
          placeholderColor: { type: 'Color', value: '#a1a1aa' },
          borderRadius: '6px',
        },
        button: {
          backgroundColor: { type: 'Color', value: '#18181b' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '6px',
        },
        roundness: 'None',
      },
    },
  },

  /* ── Elegant — cream / deep navy ─────────────────────── */
  {
    id: 'elegant',
    label: 'Elegant',
    swatches: ['#fdf8f0', '#fef3e2', '#1e3a5f', '#1e3a5f'],
    theme: {
      general: {
        font: 'Playfair Display',
        background: { type: 'Color', content: '#fdf8f0' },
        progressBar: { isEnabled: false, color: '#1e3a5f', placement: 'top' },
      },
      chat: {
        container: { backgroundColor: '#fdf8f0', maxWidth: '760px' },
        header: { backgroundColor: '#fdf8f0', color: '#1e3a5f', isEnabled: true },
        hostBubble: {
          backgroundColor: { type: 'Color', value: '#fef3e2' },
          color: { type: 'Color', value: '#1e3a5f' },
          borderRadius: '4px',
        },
        guestBubble: {
          backgroundColor: { type: 'Color', value: '#1e3a5f' },
          color: { type: 'Color', value: '#fdf8f0' },
          borderRadius: '4px',
        },
        input: {
          backgroundColor: { type: 'Color', value: '#ffffff' },
          color: { type: 'Color', value: '#1e3a5f' },
          borderColor: { type: 'Color', value: '#c7a96b' },
          placeholderColor: { type: 'Color', value: '#b0996a' },
          borderRadius: '4px',
        },
        button: {
          backgroundColor: { type: 'Color', value: '#1e3a5f' },
          color: { type: 'Color', value: '#fdf8f0' },
          borderRadius: '4px',
        },
        roundness: 'None',
      },
    },
  },

  /* ── Friendly — soft sky / violet ────────────────────── */
  {
    id: 'friendly',
    label: 'Friendly',
    swatches: ['#f0f7ff', '#e0f0ff', '#7c3aed', '#7c3aed'],
    theme: {
      general: {
        font: 'Nunito',
        background: { type: 'Color', content: '#f0f7ff' },
        progressBar: { isEnabled: true, color: '#7c3aed', placement: 'top' },
      },
      chat: {
        container: { backgroundColor: '#f0f7ff', maxWidth: '800px' },
        header: { backgroundColor: '#e0f0ff', color: '#1e1b4b', isEnabled: true },
        hostBubble: {
          backgroundColor: { type: 'Color', value: '#e0f0ff' },
          color: { type: 'Color', value: '#1e1b4b' },
          borderRadius: '24px',
        },
        guestBubble: {
          backgroundColor: { type: 'Color', value: '#7c3aed' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '24px',
        },
        input: {
          backgroundColor: { type: 'Color', value: '#ffffff' },
          color: { type: 'Color', value: '#1e1b4b' },
          borderColor: { type: 'Color', value: '#c4b5fd' },
          placeholderColor: { type: 'Color', value: '#a78bfa' },
          borderRadius: '24px',
        },
        button: {
          backgroundColor: { type: 'Color', value: '#7c3aed' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '24px',
        },
        roundness: 'Large',
      },
    },
  },

  /* ── Corporate — white / blue ────────────────────────── */
  {
    id: 'corporate',
    label: 'Corporate',
    swatches: ['#ffffff', '#f1f5f9', '#0090ff', '#0090ff'],
    theme: {
      general: {
        font: 'Roboto',
        background: { type: 'Color', content: '#ffffff' },
        progressBar: { isEnabled: true, color: '#0090ff', placement: 'top' },
      },
      chat: {
        container: { backgroundColor: '#ffffff', maxWidth: '820px' },
        header: { backgroundColor: '#0090ff', color: '#ffffff', isEnabled: true },
        hostBubble: {
          backgroundColor: { type: 'Color', value: '#f1f5f9' },
          color: { type: 'Color', value: '#0f172a' },
          borderRadius: '8px',
        },
        guestBubble: {
          backgroundColor: { type: 'Color', value: '#0090ff' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '8px',
        },
        input: {
          backgroundColor: { type: 'Color', value: '#ffffff' },
          color: { type: 'Color', value: '#0f172a' },
          borderColor: { type: 'Color', value: '#cbd5e1' },
          placeholderColor: { type: 'Color', value: '#94a3b8' },
          borderRadius: '8px',
        },
        button: {
          backgroundColor: { type: 'Color', value: '#0090ff' },
          color: { type: 'Color', value: '#ffffff' },
          borderRadius: '8px',
        },
        roundness: 'Medium',
      },
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   PresetCard
───────────────────────────────────────────────────────────── */

interface PresetCardProps {
  preset: Preset;
  onApply: (theme: SabFlowTheme) => void;
}

function PresetCard({ preset, onApply }: PresetCardProps) {
  const [bg, host, guest, button] = preset.swatches;

  return (
    <button
      type="button"
      onClick={() => onApply(preset.theme)}
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border border-[var(--gray-5)]',
        'bg-[var(--gray-1)] p-3 text-left transition-all',
        'hover:border-[#f76808] hover:shadow-sm hover:shadow-[#f76808]/10 active:scale-[0.98]',
      )}
    >
      {/* Mini chat preview */}
      <div
        className="w-full rounded-lg p-2 space-y-1.5 overflow-hidden"
        style={{ backgroundColor: bg, minHeight: 64 }}
      >
        {/* Host bubble */}
        <div
          className="h-2.5 w-[65%] rounded-full"
          style={{ backgroundColor: host }}
        />
        {/* Host bubble — second line */}
        <div
          className="h-2 w-[45%] rounded-full opacity-60"
          style={{ backgroundColor: host }}
        />
        {/* Guest bubble — right-aligned */}
        <div className="flex justify-end">
          <div
            className="h-2.5 w-[50%] rounded-full"
            style={{ backgroundColor: guest }}
          />
        </div>
        {/* Input bar */}
        <div className="flex items-center gap-1 mt-1">
          <div
            className="flex-1 h-2 rounded-full opacity-40"
            style={{ backgroundColor: host }}
          />
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: button }}
          />
        </div>
      </div>

      {/* Label */}
      <span className="text-[12px] font-medium text-[var(--gray-11)] group-hover:text-[var(--gray-12)] transition-colors text-center w-full">
        {preset.label}
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   ThemePresetPicker — main export
───────────────────────────────────────────────────────────── */

export interface ThemePresetPickerProps {
  onApply: (theme: SabFlowTheme) => void;
}

export function ThemePresetPicker({ onApply }: ThemePresetPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PRESETS.map((preset) => (
        <PresetCard key={preset.id} preset={preset} onApply={onApply} />
      ))}
    </div>
  );
}
