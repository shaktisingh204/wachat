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
 * All choices persist via `useCrmPrefs` (localStorage); each change fires a
 * lightweight toast so the user sees the preference took.
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

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import '../profile/profile.css';

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

  const handleTheme = React.useCallback(
    (theme: CrmTheme) => {
      setPrefs({ theme });
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
    [setPrefs, toast],
  );

  const handleDensity = React.useCallback(
    (density: CrmDensity) => {
      setPrefs({ density });
      toast({
        title: 'Density updated',
        description:
          density === 'compact'
            ? 'Compact spacing applied.'
            : 'Comfortable spacing applied.',
      });
    },
    [setPrefs, toast],
  );

  const handleLanguage = React.useCallback(
    (language: string) => {
      setPrefs({ language });
    },
    [setPrefs],
  );

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Appearance" icon={Palette} />
        <p className="st-settings__intro">
          Personalize how SabCRM looks for you. These preferences are stored on
          this device.
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
