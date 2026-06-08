'use client';

import { useState, useCallback } from 'react';
import type { SabFlowTheme, ThemeColor } from '@/lib/sabflow/types';
import {
  ChevronDown,
  Palette,
  X,
  RotateCcw,
  LayoutGrid,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardTitle,
  Field,
  Input,
  Switch,
  SegmentedControl,
  ColorPicker,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { ThemePresetPicker } from './ThemePresetPicker';

/* -------------------------------------------------------------------
   Constants
------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------
   Shared helpers
------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------
   ColorField - label + 20ui ColorPicker (swatch grid + native picker + hex)
------------------------------------------------------------------- */

interface ColorFieldProps {
  label: string;
  value: ThemeColor | undefined;
  fallback?: string;
  onChange: (v: ThemeColor) => void;
}

function ColorField({ label, value, fallback = '#ffffff', onChange }: ColorFieldProps) {
  const hex = colorValue(value, fallback);

  return (
    <Field label={label}>
      <ColorPicker
        value={hex}
        swatches={PALETTE}
        onChange={(v) => onChange(asColor(v))}
      />
    </Field>
  );
}

/* -------------------------------------------------------------------
   RadiusField - text input for border-radius
------------------------------------------------------------------- */

interface RadiusFieldProps {
  value: string | undefined;
  onChange: (v: string) => void;
}

function RadiusField({ value, onChange }: RadiusFieldProps) {
  return (
    <Field label="Border radius">
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 8px or 1rem"
      />
    </Field>
  );
}

/* -------------------------------------------------------------------
   Section - collapsible wrapper (20ui Collapsible)
------------------------------------------------------------------- */

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-[var(--st-radius)] border border-[var(--st-border)] overflow-hidden"
    >
      <CollapsibleTrigger className="w-full text-[12.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* -------------------------------------------------------------------
   SubSection - inner card with title
------------------------------------------------------------------- */

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined" padding="md" className="space-y-3.5">
      <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {title}
      </CardTitle>
      {children}
    </Card>
  );
}

/* -------------------------------------------------------------------
   RoundnessPreset
------------------------------------------------------------------- */

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
    <Field label="Roundness">
      <SegmentedControl<Roundness>
        aria-label="Roundness"
        fullWidth
        items={ROUNDNESS_OPTIONS}
        value={active}
        onChange={onChange}
      />
    </Field>
  );
}

/* -------------------------------------------------------------------
   ThemePanel - main export
------------------------------------------------------------------- */

export interface ThemePanelProps {
  theme: SabFlowTheme;
  onThemeChange: (theme: SabFlowTheme) => void;
  onClose?: () => void;
}

export function ThemePanel({ theme, onThemeChange, onClose }: ThemePanelProps) {
  const [showPresets, setShowPresets] = useState(false);

  /* -- Updater helpers ---------------------------------- */

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

  /* -- Resolved values (with defaults) ------------------ */

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

  /* Rich typed fields - may come from the new ThemeColor shape or the legacy flat string */
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

  const BG_TYPE_ITEMS = (['Color', 'Image', 'None'] as const).map((t) => ({ value: t, label: t }));
  const PLACEMENT_ITEMS = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
  ] as const;

  /* -- Render -------------------------------------------- */

  return (
    <div className="20ui w-[320px] shrink-0 flex flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)] z-20 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--st-border)] px-4 py-3 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] shrink-0">
          <Palette className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)]">Theme</span>

        {/* Presets toggle */}
        <IconButton
          label="Theme presets"
          icon={LayoutGrid}
          size="sm"
          onClick={() => setShowPresets((v) => !v)}
          aria-pressed={showPresets}
        />

        {onClose && (
          <IconButton
            label="Close theme panel"
            icon={X}
            size="sm"
            onClick={onClose}
          />
        )}
      </div>

      {/* Presets drawer */}
      {showPresets && (
        <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-4 shrink-0">
          <p className="mb-3 text-[11px] font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wide">
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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* General */}
        <Section title="General">

          {/* Font */}
          <Field label="Font family">
            <Select value={font} onValueChange={(v) => setGeneral({ font: v })}>
              <SelectTrigger aria-label="Font family">
                <SelectValue placeholder="Choose a font" />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_FONTS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Background */}
          <Field label="Background">
            <SegmentedControl
              aria-label="Background type"
              fullWidth
              items={BG_TYPE_ITEMS}
              value={bgType}
              onChange={(t) =>
                // The legacy `SabFlowTheme.general.background.type` accepts
                // 'Color' | 'Image' | 'None' | 'Transparent'; cast through
                // `unknown` because the strict `GeneralTheme.background.type`
                // setter is 'Color' | 'Transparent' only.
                setBackground({ type: t as unknown as 'Color' | 'Transparent', content: undefined })
              }
            />
          </Field>

          {bgType === 'Color' && (
            <ColorField
              label="Background colour"
              value={asColor(bgContent)}
              fallback="#ffffff"
              onChange={(tc) => setBackground({ content: colorValue(tc) })}
            />
          )}

          {(bgType as string) === 'Image' && (
            <Field label="Background image">
              <SabFileUrlInput
                accept="image"
                value={bgContent}
                onChange={(url) => setBackground({ content: url })}
                placeholder="Pick a background image"
                pickerTitle="Choose a background image"
              />
            </Field>
          )}

          {/* Progress bar */}
          <Card variant="outlined" padding="md" className="space-y-3">
            <Switch
              label="Progress bar"
              checked={progressBarEnabled}
              onCheckedChange={(v) => setProgressBar({ isEnabled: v })}
            />
            {progressBarEnabled && (
              <>
                <ColorField
                  label="Progress bar colour"
                  value={asColor(progressBarColor)}
                  fallback={ACCENT}
                  onChange={(tc) => setProgressBar({ color: colorValue(tc) })}
                />
                <Field label="Placement">
                  <SegmentedControl
                    aria-label="Progress bar placement"
                    fullWidth
                    items={PLACEMENT_ITEMS}
                    value={progressBarPlacement}
                    onChange={(p) => setProgressBar({ placement: p })}
                  />
                </Field>
              </>
            )}
          </Card>
        </Section>

        {/* Chat */}
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
            <Field label="Max width">
              <Input
                value={containerMaxWidth}
                onChange={(e) => setChatNested('container', { maxWidth: e.target.value })}
                placeholder="800px"
              />
            </Field>
          </SubSection>

          {/* Header */}
          <SubSection title="Header">
            <Switch
              label="Show header"
              checked={headerEnabled}
              onCheckedChange={(v) => setChatNested('header', { isEnabled: v })}
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

      {/* Footer: reset */}
      <div className="shrink-0 border-t border-[var(--st-border)] px-4 py-3">
        <Button
          variant="outline"
          block
          iconLeft={RotateCcw}
          onClick={() => onThemeChange(DEFAULT_THEME)}
        >
          Reset to defaults
        </Button>
      </div>

    </div>
  );
}
