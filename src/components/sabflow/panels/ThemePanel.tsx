'use client';

import { useState, useRef, useCallback } from 'react';
import type { SabFlowTheme, ThemeColor } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  LuChevronDown,
  LuChevronRight,
  LuPalette,
  LuX,
  LuRotateCcw,
  LuLayoutGrid,
} from 'react-icons/lu';
import { ThemePresetPicker } from './ThemePresetPicker';

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */

const ACCENT = '#f76808';

const GOOGLE_FONTS = [
  'Inter',
  'System UI',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Nunito',
  'Raleway',
  'Montserrat',
  'Source Sans Pro',
  'Noto Sans',
  'Ubuntu',
  'Merriweather',
  'Playfair Display',
  'Georgia',
  'Courier New',
];

const PALETTE = [
  '#ffffff', '#f8f8f8', '#f0f4ff', '#fff9f0',
  '#1a1a1a', '#0f172a', '#1e3a5f', '#3f1f00',
  '#f76808', '#0090ff', '#30a46c', '#e5484d',
  '#7c3aed', '#db2777', '#0ea5e9', '#f59e0b',
];

const DEFAULT_THEME: SabFlowTheme = {
  general: {
    font: 'Inter',
    background: { type: 'Color', content: '#ffffff' },
    progressBar: { isEnabled: false, color: ACCENT, placement: 'top' },
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
      backgroundColor: { type: 'Color', value: ACCENT },
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
      backgroundColor: { type: 'Color', value: ACCENT },
      color: { type: 'Color', value: '#ffffff' },
      borderRadius: '12px',
    },
    roundness: 'Medium',
  },
};

/* ─────────────────────────────────────────────────────────────
   Shared helpers
───────────────────────────────────────────────────────────── */

const inputCls = [
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]',
  'px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-9)]',
  'outline-none focus:border-[#f76808] focus:ring-1 focus:ring-[#f76808]/20 transition-colors',
].join(' ');

/** Extract a plain hex string from a ThemeColor (falls back to empty). */
function colorValue(tc: ThemeColor | undefined, fallback = '#ffffff'): string {
  if (!tc) return fallback;
  if (tc.type === 'Color') return tc.value;
  return fallback;
}

/** Wrap a plain hex string in a ThemeColor. */
function asColor(value: string): ThemeColor {
  return { type: 'Color', value };
}

/* ─────────────────────────────────────────────────────────────
   ColorSwatch — compact inline color picker
───────────────────────────────────────────────────────────── */

interface ColorSwatchProps {
  value: string;
  onChange: (v: string) => void;
}

function ColorSwatch({ value, onChange }: ColorSwatchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title={value || 'Pick a colour'}
        onClick={open}
        className="h-6 w-6 rounded-md border-2 border-[var(--gray-5)] shrink-0 transition-transform hover:scale-110 cursor-pointer"
        style={{ backgroundColor: value || '#ffffff' }}
      />
      <input
        ref={inputRef}
        type="color"
        value={value?.startsWith('#') ? value : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#hex"
        maxLength={9}
        className={cn(
          'w-[90px] rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)]',
          'px-2 py-1 text-[12px] font-mono text-[var(--gray-12)]',
          'outline-none focus:border-[#f76808] transition-colors',
        )}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ColorField — label + palette swatches + swatch picker
───────────────────────────────────────────────────────────── */

interface ColorFieldProps {
  label: string;
  value: ThemeColor | undefined;
  fallback?: string;
  onChange: (v: ThemeColor) => void;
}

function ColorField({ label, value, fallback = '#ffffff', onChange }: ColorFieldProps) {
  const hex = colorValue(value, fallback);

  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
        {label}
      </label>
      <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-2.5 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange(asColor(c))}
              className={cn(
                'h-5 w-5 rounded border-2 transition-transform hover:scale-110',
                hex === c
                  ? 'border-[#f76808] scale-110'
                  : 'border-transparent hover:border-[var(--gray-6)]',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <ColorSwatch value={hex} onChange={(v) => onChange(asColor(v))} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   RadiusField — text input for border-radius
───────────────────────────────────────────────────────────── */

interface RadiusFieldProps {
  value: string | undefined;
  onChange: (v: string) => void;
}

function RadiusField({ value, onChange }: RadiusFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
        Border radius
      </label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 8px or 1rem"
        className={inputCls}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section — collapsible wrapper
───────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────
   SubSection — inner card with title
───────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────
   ToggleRow
───────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────
   RoundnessPreset
───────────────────────────────────────────────────────────── */

type Roundness = 'None' | 'Medium' | 'Large';

const ROUNDNESS_OPTIONS: { label: string; value: Roundness }[] = [
  { label: 'None',   value: 'None'   },
  { label: 'Medium', value: 'Medium' },
  { label: 'Large',  value: 'Large'  },
];

function RoundnessPreset({
  value,
  onChange,
}: {
  value: Roundness | undefined;
  onChange: (v: Roundness) => void;
}) {
  const active = value ?? 'Medium';
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
        Roundness
      </label>
      <div className="flex gap-1.5">
        {ROUNDNESS_OPTIONS.map(({ label, value: v }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'flex-1 py-1.5 text-[12px] font-medium transition-colors border',
              v === 'None'   && 'rounded',
              v === 'Medium' && 'rounded-lg',
              v === 'Large'  && 'rounded-full',
              active === v
                ? 'border-[#f76808] bg-[#f76808]/10 text-[#f76808]'
                : 'border-[var(--gray-5)] text-[var(--gray-9)] hover:bg-[var(--gray-3)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ThemePanel — main export
───────────────────────────────────────────────────────────── */

export interface ThemePanelProps {
  theme: SabFlowTheme;
  onThemeChange: (theme: SabFlowTheme) => void;
  onClose?: () => void;
}

export function ThemePanel({ theme, onThemeChange, onClose }: ThemePanelProps) {
  const [showPresets, setShowPresets] = useState(false);

  /* ── Updater helpers ────────────────────────────────── */

  const setGeneral = useCallback(
    (partial: Partial<NonNullable<SabFlowTheme['general']>>) => {
      onThemeChange({ ...theme, general: { ...theme.general, ...partial } });
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
      onThemeChange({ ...theme, chat: { ...theme.chat, ...partial } });
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

  /* ── Resolved values (with defaults) ────────────────── */

  const bgType    = theme.general?.background?.type    ?? 'Color';
  const bgContent = theme.general?.background?.content ?? '#ffffff';
  const font      = theme.general?.font                ?? 'Inter';

  const progressBarEnabled   = theme.general?.progressBar?.isEnabled  ?? false;
  const progressBarColor     = theme.general?.progressBar?.color       ?? ACCENT;
  const progressBarPlacement = theme.general?.progressBar?.placement   ?? 'top';

  const containerBg       = theme.chat?.container?.backgroundColor ?? '#ffffff';
  const containerMaxWidth = theme.chat?.container?.maxWidth        ?? '800px';

  const headerEnabled = theme.chat?.header?.isEnabled      ?? true;
  const headerBg      = theme.chat?.header?.backgroundColor ?? '#ffffff';
  const headerColor   = theme.chat?.header?.color           ?? '#161616';

  /* Rich typed fields — may come from the new ThemeColor shape or the legacy flat string */
  const hostBgColor   = theme.chat?.hostBubble?.backgroundColor
    ?? (theme.chat?.hostBubble as { backgroundColor?: string } | undefined)?.backgroundColor
      ? asColor((theme.chat?.hostBubble as { backgroundColor?: string }).backgroundColor ?? '#f5f5f5')
      : asColor('#f5f5f5');
  const hostTextColor = theme.chat?.hostBubble?.color
    ?? (typeof (theme.chat?.hostBubble as { color?: unknown })?.color === 'string'
        ? asColor((theme.chat?.hostBubble as { color?: string }).color ?? '#161616')
        : asColor('#161616'));
  const hostRadius = theme.chat?.hostBubble?.borderRadius ?? '18px';

  const guestBgColor   = theme.chat?.guestBubble?.backgroundColor
    ?? (typeof (theme.chat?.guestBubble as { backgroundColor?: unknown })?.backgroundColor === 'string'
        ? asColor((theme.chat?.guestBubble as { backgroundColor?: string }).backgroundColor ?? ACCENT)
        : asColor(ACCENT));
  const guestTextColor = theme.chat?.guestBubble?.color
    ?? (typeof (theme.chat?.guestBubble as { color?: unknown })?.color === 'string'
        ? asColor((theme.chat?.guestBubble as { color?: string }).color ?? '#ffffff')
        : asColor('#ffffff'));
  const guestRadius = theme.chat?.guestBubble?.borderRadius ?? '18px';

  const inputBgColor          = theme.chat?.input?.backgroundColor   ?? asColor('#ffffff');
  const inputTextColor        = theme.chat?.input?.color             ?? asColor('#161616');
  const inputBorderColor      = theme.chat?.input?.borderColor       ?? asColor('#e4e4e7');
  const inputPlaceholderColor = theme.chat?.input?.placeholderColor  ?? asColor('#a0a0a0');
  const inputRadius           = theme.chat?.input?.borderRadius      ?? '12px';

  const buttonBgColor   = theme.chat?.button?.backgroundColor ?? asColor(ACCENT);
  const buttonTextColor = theme.chat?.button?.color           ?? asColor('#ffffff');
  const buttonRadius    = theme.chat?.button?.borderRadius    ?? '12px';

  const roundness = theme.chat?.roundness ?? 'Medium';

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="w-[320px] shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden">

      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
          style={{ backgroundColor: `${ACCENT}18` }}
        >
          <LuPalette className="h-4 w-4" strokeWidth={1.8} style={{ color: ACCENT }} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">Theme</span>

        {/* Presets toggle */}
        <button
          type="button"
          title="Theme presets"
          onClick={() => setShowPresets((v) => !v)}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded transition-colors',
            showPresets
              ? 'bg-[#f76808]/15 text-[#f76808]'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
          )}
        >
          <LuLayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

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

      {/* ── Presets drawer ───────────────────────────── */}
      {showPresets && (
        <div className="border-b border-[var(--gray-4)] bg-[var(--gray-2)] px-4 py-4 shrink-0">
          <p className="mb-3 text-[11px] font-semibold text-[var(--gray-10)] uppercase tracking-wide">
            Presets
          </p>
          <ThemePresetPicker
            onApply={(preset) => {
              onThemeChange(preset);
              setShowPresets(false);
            }}
          />
        </div>
      )}

      {/* ── Scrollable body ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── General ────────────────────────────────── */}
        <Section title="General">

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
              {GOOGLE_FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Background */}
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
              Background
            </label>
            <div className="flex gap-1.5">
              {(['Color', 'Image', 'None'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    // The legacy `SabFlowTheme.general.background.type` accepts
                    // `'Color' | 'Image' | 'None' | 'Transparent'`; cast through
                    // `unknown` because the strict `GeneralTheme.background.type`
                    // setter is `'Color' | 'Transparent'` only.
                    setBackground({ type: t as unknown as 'Color' | 'Transparent', content: undefined })
                  }
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
                value={asColor(bgContent)}
                fallback="#ffffff"
                onChange={(tc) => setBackground({ content: colorValue(tc) })}
              />
            )}

            {(bgType as string) === 'Image' && (
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
                  value={asColor(progressBarColor)}
                  fallback={ACCENT}
                  onChange={(tc) => setProgressBar({ color: colorValue(tc) })}
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

        {/* ── Chat ───────────────────────────────────── */}
        <Section title="Chat">

          {/* Roundness */}
          <RoundnessPreset
            value={roundness}
            onChange={(v) => setChat({ roundness: v })}
          />

          {/* Container */}
          <SubSection title="Container">
            <ColorField
              label="Background colour"
              value={asColor(containerBg)}
              fallback="#ffffff"
              onChange={(tc) => setChatNested('container', { backgroundColor: colorValue(tc) })}
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
                  value={asColor(headerBg)}
                  fallback="#ffffff"
                  onChange={(tc) => setChatNested('header', { backgroundColor: colorValue(tc) })}
                />
                <ColorField
                  label="Text colour"
                  value={asColor(headerColor)}
                  fallback="#161616"
                  onChange={(tc) => setChatNested('header', { color: colorValue(tc) })}
                />
              </>
            )}
          </SubSection>

          {/* Bot bubble */}
          <SubSection title="Bot bubble">
            <ColorField
              label="Background colour"
              value={hostBgColor}
              fallback="#f5f5f5"
              onChange={(tc) => setChatNested('hostBubble', { backgroundColor: tc })}
            />
            <ColorField
              label="Text colour"
              value={hostTextColor}
              fallback="#161616"
              onChange={(tc) => setChatNested('hostBubble', { color: tc })}
            />
            <RadiusField
              value={hostRadius}
              onChange={(v) => setChatNested('hostBubble', { borderRadius: v })}
            />
          </SubSection>

          {/* User bubble */}
          <SubSection title="User bubble">
            <ColorField
              label="Background colour"
              value={guestBgColor}
              fallback={ACCENT}
              onChange={(tc) => setChatNested('guestBubble', { backgroundColor: tc })}
            />
            <ColorField
              label="Text colour"
              value={guestTextColor}
              fallback="#ffffff"
              onChange={(tc) => setChatNested('guestBubble', { color: tc })}
            />
            <RadiusField
              value={guestRadius}
              onChange={(v) => setChatNested('guestBubble', { borderRadius: v })}
            />
          </SubSection>

          {/* Input field */}
          <SubSection title="Input field">
            <ColorField
              label="Background colour"
              value={inputBgColor}
              fallback="#ffffff"
              onChange={(tc) => setChatNested('input', { backgroundColor: tc })}
            />
            <ColorField
              label="Text colour"
              value={inputTextColor}
              fallback="#161616"
              onChange={(tc) => setChatNested('input', { color: tc })}
            />
            <ColorField
              label="Border colour"
              value={inputBorderColor}
              fallback="#e4e4e7"
              onChange={(tc) => setChatNested('input', { borderColor: tc })}
            />
            <ColorField
              label="Placeholder colour"
              value={inputPlaceholderColor}
              fallback="#a0a0a0"
              onChange={(tc) => setChatNested('input', { placeholderColor: tc })}
            />
            <RadiusField
              value={inputRadius}
              onChange={(v) => setChatNested('input', { borderRadius: v })}
            />
          </SubSection>

          {/* Button */}
          <SubSection title="Button">
            <ColorField
              label="Background colour"
              value={buttonBgColor}
              fallback={ACCENT}
              onChange={(tc) => setChatNested('button', { backgroundColor: tc })}
            />
            <ColorField
              label="Text colour"
              value={buttonTextColor}
              fallback="#ffffff"
              onChange={(tc) => setChatNested('button', { color: tc })}
            />
            <RadiusField
              value={buttonRadius}
              onChange={(v) => setChatNested('button', { borderRadius: v })}
            />
          </SubSection>

        </Section>
      </div>

      {/* ── Footer: reset ────────────────────────────── */}
      <div className="shrink-0 border-t border-[var(--gray-4)] px-4 py-3">
        <button
          type="button"
          onClick={() => onThemeChange(DEFAULT_THEME)}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg border',
            'border-[var(--gray-5)] py-2 text-[12.5px] font-medium',
            'text-[var(--gray-9)] hover:border-[var(--gray-7)] hover:text-[var(--gray-12)]',
            'transition-colors active:scale-[0.98]',
          )}
        >
          <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Reset to defaults
        </button>
      </div>

    </div>
  );
}
