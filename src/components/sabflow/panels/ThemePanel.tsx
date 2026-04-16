'use client';

import { useState, useRef, useCallback } from 'react';
import type { SabFlowTheme } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  LuChevronDown,
  LuChevronRight,
  LuPalette,
  LuX,
} from 'react-icons/lu';

/* ── Props ───────────────────────────────────────────────── */

export interface ThemePanelProps {
  theme: SabFlowTheme;
  onThemeChange: (theme: SabFlowTheme) => void;
  onClose?: () => void;
}

/* ── Constants ───────────────────────────────────────────── */

const ACCENT = '#f76808';

const PALETTE = [
  '#ffffff', '#f8f8f8', '#f0f4ff', '#fff9f0',
  '#1a1a1a', '#0f172a', '#1e3a5f', '#3f1f00',
  '#f76808', '#0090ff', '#30a46c', '#e5484d',
  '#7c3aed', '#db2777', '#0ea5e9', '#f59e0b',
];

const FONTS = [
  'Inter',
  'System UI',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Georgia',
  'Courier New',
];

/* ── Shared input class ─────────────────────────────────── */

const inputCls = [
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]',
  'px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-9)]',
  'outline-none focus:border-[#f76808] focus:ring-1 focus:ring-[#f76808]/20 transition-colors',
].join(' ');

/* ── ColorSwatch ─────────────────────────────────────────── */

interface ColorSwatchProps {
  value: string;
  onChange: (v: string) => void;
}

function ColorSwatch({ value, onChange }: ColorSwatchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSwatchClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Colour dot — click opens native color picker */}
      <button
        type="button"
        title={value || 'Pick a colour'}
        onClick={handleSwatchClick}
        className="h-6 w-6 rounded-md border-2 border-[var(--gray-5)] shrink-0 transition-transform hover:scale-110"
        style={{ backgroundColor: value || '#ffffff' }}
      />
      {/* Hidden native color input */}
      <input
        ref={inputRef}
        type="color"
        value={value?.startsWith('#') ? value : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
      {/* Hex text input */}
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#hex"
        maxLength={7}
        className={cn(
          'w-[90px] rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)]',
          'px-2 py-1 text-[12px] font-mono text-[var(--gray-12)]',
          'outline-none focus:border-[#f76808] transition-colors',
        )}
      />
    </div>
  );
}

/* ── ColorField: label + swatch + palette swatches ────────── */

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
        {label}
      </label>
      <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-2.5 space-y-2">
        {/* Palette row */}
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange(c)}
              className={cn(
                'h-5 w-5 rounded border-2 transition-transform hover:scale-110',
                value === c
                  ? 'border-[#f76808] scale-110'
                  : 'border-transparent hover:border-[var(--gray-6)]',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        {/* Swatch + hex */}
        <ColorSwatch value={value} onChange={onChange} />
      </div>
    </div>
  );
}

/* ── Section (collapsible) ──────────────────────────────── */

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[var(--gray-5)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 bg-[var(--gray-2)] hover:bg-[var(--gray-3)] transition-colors"
      >
        <span className="text-[12.5px] font-semibold text-[var(--gray-11)] uppercase tracking-wide">
          {title}
        </span>
        {open
          ? <LuChevronDown className="h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={2.5} />
          : <LuChevronRight className="h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={2.5} />
        }
      </button>
      {open && (
        <div className="px-4 py-4 space-y-4 bg-[var(--gray-1)]">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── SubSection (inner group with title) ────────────────── */

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] p-3.5 space-y-3.5">
      <p className="text-[11px] font-semibold text-[var(--gray-10)] uppercase tracking-wide">
        {title}
      </p>
      {children}
    </div>
  );
}

/* ── ToggleRow ───────────────────────────────────────────── */

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[var(--gray-11)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
          checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
        )}
      >
        <span
          className={cn(
            'absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

/* ── ThemePanel ──────────────────────────────────────────── */

export function ThemePanel({ theme, onThemeChange, onClose }: ThemePanelProps) {
  /* ── Updater helpers ──────────────────────────────────── */

  const setGeneral = useCallback(
    (partial: Partial<NonNullable<SabFlowTheme['general']>>) => {
      onThemeChange({
        ...theme,
        general: { ...theme.general, ...partial },
      });
    },
    [theme, onThemeChange],
  );

  const setProgressBar = useCallback(
    (partial: Partial<NonNullable<NonNullable<SabFlowTheme['general']>['progressBar']>>) => {
      onThemeChange({
        ...theme,
        general: {
          ...theme.general,
          progressBar: { ...theme.general?.progressBar, ...partial },
        },
      });
    },
    [theme, onThemeChange],
  );

  const setBackground = useCallback(
    (partial: Partial<NonNullable<NonNullable<SabFlowTheme['general']>['background']>>) => {
      onThemeChange({
        ...theme,
        general: {
          ...theme.general,
          background: {
            type: theme.general?.background?.type ?? 'Color',
            ...theme.general?.background,
            ...partial,
          },
        },
      });
    },
    [theme, onThemeChange],
  );

  const setChat = useCallback(
    (partial: Partial<NonNullable<SabFlowTheme['chat']>>) => {
      onThemeChange({
        ...theme,
        chat: { ...theme.chat, ...partial },
      });
    },
    [theme, onThemeChange],
  );

  const setChatNested = useCallback(
    <K extends keyof NonNullable<SabFlowTheme['chat']>>(
      key: K,
      partial: Partial<NonNullable<NonNullable<SabFlowTheme['chat']>[K]>>,
    ) => {
      onThemeChange({
        ...theme,
        chat: {
          ...theme.chat,
          [key]: { ...(theme.chat?.[key] as object | undefined), ...partial },
        },
      });
    },
    [theme, onThemeChange],
  );

  /* ── Resolved values (with defaults) ─────────────────── */

  const bgType = theme.general?.background?.type ?? 'Color';
  const bgContent = theme.general?.background?.content ?? '#ffffff';
  const font = theme.general?.font ?? 'Inter';

  const progressBarEnabled = theme.general?.progressBar?.isEnabled ?? false;
  const progressBarColor = theme.general?.progressBar?.color ?? ACCENT;
  const progressBarPlacement = theme.general?.progressBar?.placement ?? 'top';

  const containerBg = theme.chat?.container?.backgroundColor ?? '#ffffff';
  const containerMaxWidth = theme.chat?.container?.maxWidth ?? '800px';

  const headerEnabled = theme.chat?.header?.isEnabled ?? true;
  const headerBg = theme.chat?.header?.backgroundColor ?? '#ffffff';
  const headerColor = theme.chat?.header?.color ?? '#161616';

  const hostBg = theme.chat?.hostBubble?.backgroundColor ?? '#f5f5f5';
  const hostColor = theme.chat?.hostBubble?.color ?? '#161616';

  const guestBg = theme.chat?.guestBubble?.backgroundColor ?? ACCENT;
  const guestColor = theme.chat?.guestBubble?.color ?? '#ffffff';

  const inputBg = theme.chat?.input?.backgroundColor ?? '#ffffff';
  const inputColor = theme.chat?.input?.color ?? '#161616';
  const inputPlaceholder = theme.chat?.input?.placeholderColor ?? '#a0a0a0';

  const buttonBg = theme.chat?.button?.backgroundColor ?? ACCENT;
  const buttonColor = theme.chat?.button?.color ?? '#ffffff';

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="w-[320px] shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
          style={{ backgroundColor: `${ACCENT}18` }}
        >
          <LuPalette className="h-4 w-4" strokeWidth={1.8} style={{ color: ACCENT }} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">Theme</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          >
            <LuX className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── General ──────────────────────────────────────── */}
        <Section title="General" defaultOpen>

          {/* Font */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
              Font family
            </label>
            <select
              value={font}
              onChange={(e) => setGeneral({ font: e.target.value })}
              className={inputCls}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Background */}
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
              Background
            </label>
            {/* Type switcher */}
            <div className="flex gap-1.5">
              {(['Color', 'Image', 'None'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBackground({ type: t, content: undefined })}
                  className={cn(
                    'flex-1 rounded-lg border py-1.5 text-[12px] font-medium transition-colors',
                    bgType === t
                      ? 'border-[#f76808] bg-[#f76808]/10 text-[#f76808]'
                      : 'border-[var(--gray-5)] text-[var(--gray-9)] hover:bg-[var(--gray-3)]',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {bgType === 'Color' && (
              <ColorField
                label="Background colour"
                value={bgContent}
                onChange={(v) => setBackground({ content: v })}
              />
            )}

            {bgType === 'Image' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
                  Image URL
                </label>
                <input
                  type="url"
                  value={bgContent}
                  onChange={(e) => setBackground({ content: e.target.value })}
                  placeholder="https://example.com/bg.jpg"
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] p-3.5 space-y-3">
            <ToggleRow
              label="Progress bar"
              checked={progressBarEnabled}
              onChange={(v) => setProgressBar({ isEnabled: v })}
            />
            {progressBarEnabled && (
              <>
                <ColorField
                  label="Progress bar colour"
                  value={progressBarColor}
                  onChange={(v) => setProgressBar({ color: v })}
                />
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
                    Placement
                  </label>
                  <div className="flex gap-1.5">
                    {(['top', 'bottom'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProgressBar({ placement: p })}
                        className={cn(
                          'flex-1 rounded-lg border py-1.5 text-[12px] font-medium transition-colors capitalize',
                          progressBarPlacement === p
                            ? 'border-[#f76808] bg-[#f76808]/10 text-[#f76808]'
                            : 'border-[var(--gray-5)] text-[var(--gray-9)] hover:bg-[var(--gray-3)]',
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* ── Chat ─────────────────────────────────────────── */}
        <Section title="Chat" defaultOpen>

          {/* Container */}
          <SubSection title="Container">
            <ColorField
              label="Background colour"
              value={containerBg}
              onChange={(v) => setChatNested('container', { backgroundColor: v })}
            />
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
                Max width
              </label>
              <input
                type="text"
                value={containerMaxWidth}
                onChange={(e) => setChatNested('container', { maxWidth: e.target.value })}
                placeholder="800px"
                className={inputCls}
              />
            </div>
          </SubSection>

          {/* Header */}
          <SubSection title="Header">
            <ToggleRow
              label="Show header"
              checked={headerEnabled}
              onChange={(v) => setChatNested('header', { isEnabled: v })}
            />
            {headerEnabled && (
              <>
                <ColorField
                  label="Background colour"
                  value={headerBg}
                  onChange={(v) => setChatNested('header', { backgroundColor: v })}
                />
                <ColorField
                  label="Text colour"
                  value={headerColor}
                  onChange={(v) => setChatNested('header', { color: v })}
                />
              </>
            )}
          </SubSection>

          {/* Host (bot) bubble */}
          <SubSection title="Bot bubble">
            <ColorField
              label="Background colour"
              value={hostBg}
              onChange={(v) => setChatNested('hostBubble', { backgroundColor: v })}
            />
            <ColorField
              label="Text colour"
              value={hostColor}
              onChange={(v) => setChatNested('hostBubble', { color: v })}
            />
          </SubSection>

          {/* Guest (user) bubble */}
          <SubSection title="User bubble">
            <ColorField
              label="Background colour"
              value={guestBg}
              onChange={(v) => setChatNested('guestBubble', { backgroundColor: v })}
            />
            <ColorField
              label="Text colour"
              value={guestColor}
              onChange={(v) => setChatNested('guestBubble', { color: v })}
            />
          </SubSection>

          {/* Input */}
          <SubSection title="Input field">
            <ColorField
              label="Background colour"
              value={inputBg}
              onChange={(v) => setChatNested('input', { backgroundColor: v })}
            />
            <ColorField
              label="Text colour"
              value={inputColor}
              onChange={(v) => setChatNested('input', { color: v })}
            />
            <ColorField
              label="Placeholder colour"
              value={inputPlaceholder}
              onChange={(v) => setChatNested('input', { placeholderColor: v })}
            />
          </SubSection>

          {/* Button */}
          <SubSection title="Button">
            <ColorField
              label="Background colour"
              value={buttonBg}
              onChange={(v) => setChat({ button: { ...theme.chat?.button, backgroundColor: v } })}
            />
            <ColorField
              label="Text colour"
              value={buttonColor}
              onChange={(v) => setChat({ button: { ...theme.chat?.button, color: v } })}
            />
          </SubSection>

        </Section>
      </div>
    </div>
  );
}
