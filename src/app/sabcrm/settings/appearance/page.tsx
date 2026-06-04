'use client';

/**
 * SabCRM — Appearance settings (`/sabcrm/settings/appearance`), Twenty-style.
 *
 * Local, device-scoped display controls:
 *   - Theme   — Light / Dark / System. Toggles `st-theme-dark` on the SabCRM
 *               frame root (handled inside `useCrmPrefs`); 'system' follows the
 *               OS `prefers-color-scheme` and live-updates.
 *   - Density — Comfortable / Compact. Compact toggles `st-density-compact` on
 *               the SabCRM frame root (handled inside `useCrmPrefs`) to tighten
 *               table + section rhythm immediately.
 *   - Language — display-only select (English only for now).
 *
 * All choices persist to BOTH the gated CRM settings document on the backend
 * (via `useSettingsSync('appearance', …)` → the `getCrmSettingsTw` /
 * `updateCrmSettingsTw` server actions) AND the local `useCrmPrefs` cache, so a
 * chosen theme follows the user across devices while the page never blocks. When
 * the Rust settings engine is down the page degrades to the device-local cache
 * and shows an "offline" note. Each change fires a lightweight toast.
 */

import * as React from 'react';
import { Palette, Sun, Moon, Monitor } from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import { useToast } from '@/hooks/use-toast';
import {
  useCrmPrefs,
  type CrmTheme,
  type CrmDensity,
} from '../use-crm-prefs';
import { useSettingsSync } from '../use-settings-sync';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import '../profile/profile.css';

/** The appearance slice persisted under the `'appearance'` settings key. */
interface AppearanceSlice {
  theme: CrmTheme;
  density: CrmDensity;
  language: string;
}

const THEMES: readonly CrmTheme[] = ['light', 'dark', 'system'];
const DENSITIES: readonly CrmDensity[] = ['comfortable', 'compact'];

/** Narrow the raw stored value into a usable appearance slice (or null). */
function coerceAppearance(raw: unknown): Partial<AppearanceSlice> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<AppearanceSlice> = {};
  if (THEMES.includes(o.theme as CrmTheme)) out.theme = o.theme as CrmTheme;
  if (DENSITIES.includes(o.density as CrmDensity))
    out.density = o.density as CrmDensity;
  if (typeof o.language === 'string') out.language = o.language;
  return Object.keys(out).length > 0 ? out : null;
}

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ElementType;
  disabled?: boolean;
}

function Segment<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (next: T) => void;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <div className="st-segment" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`st-segment__btn${active ? ' is-active' : ''}`}
            aria-pressed={active}
            disabled={opt.disabled}
            onClick={() => {
              if (!opt.disabled && !active) onChange(opt.value);
            }}
          >
            {Icon ? <Icon size={14} aria-hidden="true" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const THEME_OPTIONS: SegmentOption<CrmTheme>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const DENSITY_OPTIONS: SegmentOption<CrmDensity>[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

export default function SabcrmAppearanceSettingsPage(): React.JSX.Element {
  const { prefs, setPrefs } = useCrmPrefs();
  const { toast } = useToast();
  const sync = useSettingsSync<Partial<AppearanceSlice>>(
    'appearance',
    coerceAppearance,
  );

  // Keep the freshest prefs in a ref so a per-field save can persist the full
  // appearance slice without re-creating the save callbacks on every change.
  const prefsRef = React.useRef(prefs);
  prefsRef.current = prefs;

  // Adopt the server slice (source of truth) once it resolves, mirroring it into
  // the local cache so the theme/density classes apply immediately.
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote) return;
    setPrefs(sync.remote);
  }, [sync.phase, sync.remote, setPrefs]);

  // Persist the full appearance slice to the server (fire-and-forget; the local
  // cache already updated synchronously, so the UI is never blocked).
  const persist = React.useCallback(
    (patch: Partial<AppearanceSlice>) => {
      const next = prefsRef.current;
      void sync.save({
        theme: next.theme,
        density: next.density,
        language: next.language,
        ...patch,
      });
    },
    [sync],
  );

  const handleTheme = React.useCallback(
    (theme: CrmTheme) => {
      setPrefs({ theme });
      persist({ theme });
      toast({
        title: 'Theme updated',
        description:
          theme === 'system'
            ? 'SabCRM will follow your system setting.'
            : theme === 'dark'
              ? 'Using the dark theme.'
              : 'Using the light theme.',
      });
    },
    [setPrefs, persist, toast],
  );

  const handleDensity = React.useCallback(
    (density: CrmDensity) => {
      setPrefs({ density });
      persist({ density });
      toast({
        title: 'Density updated',
        description:
          density === 'compact'
            ? 'Compact spacing applied.'
            : 'Comfortable spacing applied.',
      });
    },
    [setPrefs, persist, toast],
  );

  const handleLanguage = React.useCallback(
    (language: string) => {
      setPrefs({ language });
      persist({ language });
    },
    [setPrefs, persist],
  );

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Appearance" icon={Palette} />
        <p className="st-settings__intro">
          Personalize how SabCRM looks for you. Saved to your workspace so your
          theme follows you across devices.
          {sync.phase === 'offline' ? (
            <span className="st-form-status st-form-status--err" style={{ display: 'block', marginTop: 4 }}>
              The settings service is offline — changes are kept on this device
              for now.
            </span>
          ) : null}
        </p>

        <div className="st-section">
          <div className="st-section__head">
            <h2 className="st-section__title">Theme</h2>
            <p className="st-section__hint">
              Choose a light or dark theme, or let System follow your OS
              preference.
            </p>
          </div>
          <Segment
            ariaLabel="Theme"
            value={prefs.theme}
            options={THEME_OPTIONS}
            onChange={handleTheme}
          />
        </div>

        <div className="st-section">
          <div className="st-section__head">
            <h2 className="st-section__title">Density</h2>
            <p className="st-section__hint">
              Control how much spacing tables and lists use.
            </p>
          </div>
          <Segment
            ariaLabel="Density"
            value={prefs.density}
            options={DENSITY_OPTIONS}
            onChange={handleDensity}
          />
        </div>

        <div className="st-section">
          <div className="st-section__head">
            <h2 className="st-section__title">Language</h2>
            <p className="st-section__hint">
              The language used across the SabCRM interface.
            </p>
          </div>
          <div className="st-field">
            <label className="st-field__label" htmlFor="crm-language">
              Display language
            </label>
            <select
              id="crm-language"
              className="st-select st-select--inline"
              value={prefs.language}
              onChange={(e) => handleLanguage(e.target.value)}
            >
              <option value="en">English</option>
            </select>
            <span className="st-field__help">
              More languages are coming soon.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
