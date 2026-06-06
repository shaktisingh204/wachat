'use client';

/**
 * SabCRM - Appearance settings (`/dashboard/settings/crm/appearance`).
 *
 * Local, device-scoped display controls:
 *   - Theme   - Light / Dark / System. Toggles `st-theme-dark` on the SabCRM
 *               frame root (handled inside `useCrmPrefs`); 'system' follows the
 *               OS `prefers-color-scheme` and live-updates.
 *   - Density - Comfortable / Compact. Compact toggles `st-density-compact` on
 *               the SabCRM frame root (handled inside `useCrmPrefs`) to tighten
 *               table + section rhythm immediately.
 *   - Language - display-only select (English only for now).
 *
 * All choices persist to BOTH the gated CRM settings document on the backend
 * (via `useSettingsSync('appearance', ...)` -> the `getCrmSettingsTw` /
 * `updateCrmSettingsTw` server actions) AND the local `useCrmPrefs` cache, so a
 * chosen theme follows the user across devices while the page never blocks. When
 * the Rust settings engine is down the page degrades to the device-local cache
 * and shows an "offline" note. Each change fires a lightweight toast.
 *
 * Pure 20ui: PageHeader, Card, SegmentedControl, Field, Select compound, Alert.
 */

import * as React from 'react';
import { Palette, Sun, Moon, Monitor } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  SegmentedControl,
  type SegmentedItem,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
} from '@/components/sabcrm/20ui';
import { useToast } from '@/hooks/use-toast';
import {
  useCrmPrefs,
  type CrmTheme,
  type CrmDensity,
} from '../use-crm-prefs';
import { useSettingsSync } from '../use-settings-sync';

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

const THEME_OPTIONS: ReadonlyArray<SegmentedItem<CrmTheme>> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const DENSITY_OPTIONS: ReadonlyArray<SegmentedItem<CrmDensity>> = [
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
    <div className="ui20 mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <Palette size={20} aria-hidden="true" />
            Appearance
          </PageTitle>
          <PageDescription>
            Personalize how SabCRM looks for you. Saved to your workspace so your
            theme follows you across devices.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {sync.phase === 'offline' ? (
        <Alert tone="warning" title="Settings service offline">
          Your changes are kept on this device for now and will sync once the
          service is back.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choose a light or dark theme, or let System follow your OS
            preference.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <SegmentedControl
            aria-label="Theme"
            value={prefs.theme}
            items={THEME_OPTIONS}
            onChange={handleTheme}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Density</CardTitle>
          <CardDescription>
            Control how much spacing tables and lists use.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <SegmentedControl
            aria-label="Density"
            value={prefs.density}
            items={DENSITY_OPTIONS}
            onChange={handleDensity}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language</CardTitle>
          <CardDescription>
            The language used across the SabCRM interface.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Field
            id="crm-language"
            label="Display language"
            help="More languages are coming soon."
          >
            <Select value={prefs.language} onValueChange={handleLanguage}>
              <SelectTrigger id="crm-language" aria-label="Display language">
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}
