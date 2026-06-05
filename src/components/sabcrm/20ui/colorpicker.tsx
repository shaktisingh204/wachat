'use client';

/**
 * 20ui — ColorPicker.
 *
 * A trigger swatch (showing the current colour) that opens a token-styled
 * Popover with three coordinated ways to pick a colour:
 *   - a preset swatch grid (each button has an aria-label of its colour and an
 *     aria-pressed state for the active one);
 *   - a native input[type=color] eyedropper, skinned to a square chip;
 *   - a validated hex text field that only commits a well-formed value.
 *
 * Mirrors ZoruUI's ColorPicker API (value / onChange / swatches / disabled),
 * reimplemented in 20ui style on top of the 20ui Popover. Deliberately avoids
 * react-color: the whole picker is a few native elements skinned with --st-* /
 * --u-* tokens, so it stays light, themable, and fully accessible.
 *
 * Controlled: `value` is the source of truth; `onChange` fires the moment a
 * colour is chosen (preset click, native picker) or a valid hex is committed
 * (Enter / blur). The hex text input keeps its own `draft` so a half-typed
 * value like "#2b6" never escapes as the committed colour.
 */

import * as React from 'react';
import { Pipette, Check } from 'lucide-react';

import { Popover, PopoverTrigger, PopoverContent } from './popover';
import './colorpicker.css';

/** A loose 3- or 6-digit hex (with or without leading #) accepted while typing. */
const HEX_RE = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normalise any accepted hex to a canonical lowercase 6-digit `#rrggbb`. */
function normalizeHex(raw: string): string | null {
  const v = raw.trim();
  if (!HEX_RE.test(v)) return null;
  let hex = v.startsWith('#') ? v.slice(1) : v;
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${hex.toLowerCase()}`;
}

/** Relative luminance check so the active tick contrasts on its own swatch. */
function isLightColor(hex: string): boolean {
  const n = normalizeHex(hex);
  if (!n) return true;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  // Perceived luminance (sRGB weighted). > 0.6 reads as a light fill.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6;
}

/** A calm, near-monochrome-plus-accent default palette (matches the 20ui feel). */
const DEFAULT_SWATCHES = [
  '#1b1b18',
  '#3f3f46',
  '#71717a',
  '#a1a1aa',
  '#d4d4d8',
  '#ffffff',
  '#c13c2c',
  '#ea580c',
  '#c77700',
  '#2e7d32',
  '#0891b2',
  '#2b6ef2',
  '#7c3aed',
  '#db2777',
  '#f43f5e',
  '#8b5cf6',
];

export interface ColorPickerProps
  extends Omit<
    React.HTMLAttributes<HTMLButtonElement>,
    'onChange' | 'color' | 'defaultValue'
  > {
  /** The current colour, as a hex string (e.g. "#2b6ef2"). */
  value?: string;
  /** Fired with a canonical `#rrggbb` whenever a new colour is chosen. */
  onChange?: (color: string) => void;
  /** Preset palette shown in the popover. Pass `[]` to hide the grid. */
  swatches?: string[];
  /** Disable the trigger (popover cannot open). */
  disabled?: boolean;
  /** Popover alignment against the trigger. */
  align?: 'start' | 'center' | 'end';
}

export const ColorPicker = React.forwardRef<HTMLButtonElement, ColorPickerProps>(
  function ColorPicker(
    {
      value = '#000000',
      onChange,
      swatches = DEFAULT_SWATCHES,
      disabled = false,
      align = 'start',
      className,
      ...rest
    },
    ref,
  ) {
    // Canonical committed value (always #rrggbb where possible).
    const committed = normalizeHex(value) ?? value;
    // The hex text field's own draft — lets the user type freely without
    // leaking a half-formed value to `onChange`.
    const [draft, setDraft] = React.useState(committed);

    // Resync the draft when the controlled value changes from outside (or the
    // user cancels by re-opening). Comparing against the *committed* form avoids
    // clobbering a valid in-progress edit on every render.
    React.useEffect(() => {
      setDraft(committed);
    }, [committed]);

    const commit = React.useCallback(
      (next: string) => {
        const norm = normalizeHex(next);
        if (!norm) return;
        setDraft(norm);
        // Only notify when the value actually changes — avoids redundant
        // controlled-update churn on repeated clicks of the active swatch.
        if (norm !== committed) onChange?.(norm);
      },
      [committed, onChange],
    );

    const draftValid = HEX_RE.test(draft.trim());
    // The native input requires a strict #rrggbb; fall back to black if the
    // committed value is somehow non-hex so the control never goes uncontrolled.
    const nativeValue = normalizeHex(committed) ?? '#000000';

    const hexInputId = React.useId();

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={['u-colorpicker__trigger', className]
              .filter(Boolean)
              .join(' ')}
            aria-label={`Pick a color. Current color ${committed}`}
            {...rest}
          >
            <span
              className="u-colorpicker__trigger-swatch"
              style={{ backgroundColor: committed }}
              aria-hidden="true"
            />
            <span className="u-colorpicker__trigger-hex">{committed}</span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align={align}
          className="u-colorpicker__panel"
          // Keep focus inside the panel on open; the hex input is the natural
          // first stop, but we let Radix focus the panel and the user Tab in.
        >
          <div className="u-colorpicker__row">
            <label
              className="u-colorpicker__native"
              style={{ backgroundColor: nativeValue }}
            >
              <span className="u-colorpicker__native-srlabel">
                Open the system color picker
              </span>
              <input
                type="color"
                className="u-colorpicker__native-input"
                value={nativeValue}
                onChange={(e) => commit(e.target.value)}
              />
              <Pipette
                className="u-colorpicker__native-icon"
                size={14}
                aria-hidden="true"
              />
            </label>

            <div className="u-colorpicker__hex">
              <label
                htmlFor={hexInputId}
                className="u-colorpicker__hex-label"
              >
                Hex
              </label>
              <input
                id={hexInputId}
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                className={[
                  'u-colorpicker__hex-input',
                  !draftValid && 'is-invalid',
                ]
                  .filter(Boolean)
                  .join(' ')}
                value={draft}
                placeholder="#2b6ef2"
                aria-invalid={!draftValid || undefined}
                aria-label="Hex color value"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  // On blur, commit if valid, otherwise snap back to committed.
                  if (draftValid) commit(draft);
                  else setDraft(committed);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draftValid) {
                    e.preventDefault();
                    commit(draft);
                  }
                }}
              />
            </div>
          </div>

          {swatches.length > 0 ? (
            <div
              className="u-colorpicker__grid"
              role="group"
              aria-label="Preset colors"
            >
              {swatches.map((swatch) => {
                const norm = normalizeHex(swatch) ?? swatch;
                const selected = norm.toLowerCase() === committed.toLowerCase();
                return (
                  <button
                    key={swatch}
                    type="button"
                    className={[
                      'u-colorpicker__swatch',
                      selected && 'is-selected',
                      isLightColor(norm) && 'is-light',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ backgroundColor: norm }}
                    aria-label={norm}
                    aria-pressed={selected}
                    onClick={() => commit(norm)}
                  >
                    {selected ? (
                      <Check
                        className="u-colorpicker__swatch-tick"
                        size={13}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    );
  },
);

export default ColorPicker;
