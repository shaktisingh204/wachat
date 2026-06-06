'use client';

/**
 * App theme — the single source of truth for SabNode's light/dark setting.
 *
 * The setting is stored as a class on the document root (`<html class="dark">`
 * / `"light"`), which drives BOTH design systems at once:
 *   - ZoruUI flips its `--zoru-*` tokens under `html.dark .zoruui` (zoruui.css).
 *   - 20ui chrome (the app rail + header) reads the resolved value via
 *     `useHtmlDark()` and renders inside a `.ui20 light|dark` scope.
 *
 * Persistence is localStorage (read by the no-FOUC bootstrap in the root
 * layout before first paint). Settings → Appearance remains the authoritative
 * editor and also writes here so the two never drift.
 */

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';

import { Button } from '../button';

export type AppTheme = 'light' | 'dark' | 'system';

/** localStorage key shared by the bootstrap script, the toggle, and Settings. */
export const THEME_STORAGE_KEY = 'sabnode-theme';

/** Resolve a stored theme to the concrete class applied to <html>. */
function resolveDark(theme: AppTheme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  // system
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
}

/**
 * Apply a theme: stamp an explicit `light`/`dark` class on <html> (never a
 * bare/unset state, so 20ui's prefers-color-scheme fallback can't fight the
 * choice) and persist the preference. Safe to call on the client only.
 */
export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolveDark(theme) ? 'dark' : 'light');
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable (private mode) — class is still applied */
  }
}

/** The current stored preference (defaults to "system"). */
export function getStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

/**
 * Subscribe to the live dark state by watching the `class` attribute on
 * <html>. Returns true when the document root is in dark mode. Used by the
 * shells to keep the 20ui `.ui20 light|dark` scope in lock-step with the rest
 * of the app, however the class was set (bootstrap, Settings, or the toggle).
 */
export function useHtmlDark(): boolean {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    const html = document.documentElement;
    const sync = (): void => setDark(html.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return dark;
}

export interface AppThemeToggleProps {
  /** Override the accessible label prefix. */
  className?: string;
}

/**
 * An icon button that flips light ⇄ dark from anywhere in the shell. Shows a
 * sun while dark (click → light) and a moon while light (click → dark). Built
 * on the ZoruUI ghost icon button so it shares the exact size (36px), ink, and
 * hover surface of its header neighbours (the notification bell + avatar) — no
 * cross-design-system seam in the trailing cluster. The choice persists via
 * {@link applyTheme}; `useHtmlDark()` subscribers re-render instantly because
 * <html>'s class changes.
 */
export function AppThemeToggle({ className }: AppThemeToggleProps): React.JSX.Element {
  const dark = useHtmlDark();
  const Icon = dark ? Sun : Moon;
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label={label}
      title={label}
      onClick={() => applyTheme(dark ? 'light' : 'dark')}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
