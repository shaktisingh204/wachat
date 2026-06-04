'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Users,
  Target,
  StickyNote,
  CheckSquare,
  Workflow,
  LayoutDashboard,
  Search,
  Settings,
  Star,
  UserCheck,
  Activity,
  Calendar,
  BarChart3,
  MapPin,
  Sparkles,
  Rocket,
  HelpCircle,
  Database,
  type LucideIcon,
} from 'lucide-react';

import '@/styles/sabcrm-twenty.css';
import './twenty-activity.css';
import './notifications.css';

import { TwentyCommandMenu } from './twenty-command-menu';
import { TwentyWorkspaceSwitcher } from './twenty-workspace-switcher';
import { NotificationsBell } from './notifications-bell';
import { useCommandMenu } from './use-command-menu';
import { listSabcrmFavoritesTw } from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustFavorite } from '@/app/actions/sabcrm-twenty.actions.types';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { ObjectMetadata } from '@/lib/rust-client/sabcrm-objects';
import { ZORU_ICONS } from '@/components/zoruui/icon-picker';
import { getCrmSettingsTw } from '@/app/actions/sabcrm-settings.actions';
import {
  SabcrmSettingsProvider,
  buildSabcrmFormatters,
  resolveSabcrmTheme,
  type SabcrmSettingsValue,
  type SabcrmGeneralPrefs,
  type SabcrmAppearancePrefs,
  type SabcrmLocalizationPrefs,
  type SabcrmNotificationPrefs,
} from './sabcrm-settings-context';
import { useProject } from '@/context/project-context';

type NavItem = {
  /** Stable key + default route segment (`/sabcrm/<slug>`). */
  slug: string;
  label: string;
  icon: LucideIcon;
  /** Explicit route override when the target isn't `/sabcrm/<slug>`. */
  href?: string;
};

/** Resolve a nav item's destination, defaulting to the `/sabcrm/<slug>` pattern. */
function navHref(item: NavItem): string {
  return item.href ?? `/sabcrm/${item.slug}`;
}

/**
 * Standard-object → lucide icon map, keyed by slug. Used to give the live
 * data-model objects their familiar Twenty icons in the sidebar; custom
 * objects fall back to the icon picked in the data model (resolved via
 * {@link ZORU_ICONS}) or, failing that, a generic {@link Database} glyph.
 */
const STANDARD_OBJECT_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  leads: Target,
  tasks: CheckSquare,
  notes: StickyNote,
};

/**
 * Resolve a data-model object's sidebar icon. Honours the icon chosen in the
 * data model first (`object.icon` is a {@link ZORU_ICONS} key — those values
 * are lucide icons at runtime, so the cast is safe and `size` still works),
 * then the standard per-slug icon, then a generic fallback.
 */
function objectNavIcon(object: ObjectMetadata): LucideIcon {
  const picked = object.icon
    ? (ZORU_ICONS[object.icon] as LucideIcon | undefined)
    : undefined;
  return picked ?? STANDARD_OBJECT_ICON[object.slug] ?? Database;
}

/**
 * Fallback "Workspace" objects — faithful to upstream Twenty's default
 * navigation (twenty-server `standard-navigation-menu-item.constant.ts`).
 * Rendered ONLY when the live data model can't be loaded (engine down / RBAC /
 * plan), so the sidebar never goes blank. When the data model IS available the
 * object rows are built dynamically from it instead (see {@link TwentyAppFrame}).
 */
const FALLBACK_OBJECT_NAV: readonly NavItem[] = [
  { slug: 'companies', label: 'Companies', icon: Building2 },
  { slug: 'people', label: 'People', icon: Users },
  { slug: 'leads', label: 'Leads', icon: Target },
  { slug: 'tasks', label: 'Tasks', icon: CheckSquare },
  { slug: 'notes', label: 'Notes', icon: StickyNote },
] as const;

/**
 * Non-object workspace surfaces — always appended after the (dynamic) object
 * rows. Dashboards/Workflows are SabCRM surfaces, not data-model objects, so
 * they're not part of the live object list and point at their nearest page.
 */
const WORKSPACE_EXTRA_NAV: readonly NavItem[] = [
  { slug: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, href: '/sabcrm/dashboard' },
  { slug: 'workflows', label: 'Workflows', icon: Workflow, href: '/dashboard/settings/crm/automations' },
] as const;

/**
 * "More" section — SabCRM surfaces that upstream Twenty doesn't ship as nav
 * objects but that exist as real `/sabcrm/*` pages in this port.
 */
const MORE_NAV: readonly NavItem[] = [
  { slug: 'my-work', label: 'My Work', icon: UserCheck },
  { slug: 'activity', label: 'Activity', icon: Activity },
  { slug: 'calendar', label: 'Calendar', icon: Calendar },
  { slug: 'reports', label: 'Reports', icon: BarChart3 },
  { slug: 'map', label: 'Map', icon: MapPin },
  { slug: 'ai', label: 'Ask AI', icon: Sparkles },
] as const;

/**
 * "Other" section — pinned to the bottom. Mirrors Twenty's
 * `NavigationDrawerOtherSection` (Settings + Documentation), plus SabCRM's
 * own Getting Started entry point.
 */
const OTHER_NAV: readonly NavItem[] = [
  { slug: 'getting-started', label: 'Getting Started', icon: Rocket },
  { slug: 'settings', label: 'Settings', icon: Settings },
  { slug: 'help', label: 'Documentation', icon: HelpCircle, href: '/dashboard/settings/crm/help' },
] as const;

type TwentyAppFrameProps = {
  children: React.ReactNode;
};

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Active-state where the *most specific* match wins. `/dashboard/settings/crm`
 * is a prefix of `/dashboard/settings/crm/automations`, so when a deeper nav
 * target also matches the current path the shallower "Settings" entry yields to
 * it instead of both lighting up. `allHrefs` is the full set of rendered nav
 * destinations (now including the dynamic object rows), passed in so the check
 * stays correct as the data model changes.
 */
function isBestActive(
  pathname: string | null,
  href: string,
  allHrefs: readonly string[],
): boolean {
  if (!isActivePath(pathname, href)) return false;
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      isActivePath(pathname, other),
  );
}

/**
 * A best-effort human label for a favorite that carries no record name.
 * `labelBySlug` resolves the object's plural label from the live data model,
 * falling back to the raw slug.
 */
function favoriteLabel(
  fav: SabcrmRustFavorite,
  labelBySlug: Record<string, string>,
): string {
  const objLabel = labelBySlug[fav.object] ?? fav.object;
  return `${objLabel} · ${fav.recordId.slice(-6)}`;
}

export function TwentyAppFrame({ children }: TwentyAppFrameProps): React.JSX.Element {
  const pathname = usePathname();
  const { open: commandMenuOpen, setOpen: setCommandMenuOpen } = useCommandMenu();
  const { activeProjectId } = useProject();

  const [favorites, setFavorites] = React.useState<SabcrmRustFavorite[]>([]);
  const [objects, setObjects] = React.useState<ObjectMetadata[] | null>(null);
  const [settingsData, setSettingsData] = React.useState<Record<
    string,
    unknown
  > | null>(null);
  const [systemDark, setSystemDark] = React.useState(false);

  // Load the caller's favorites (non-blocking, graceful when engine down).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listSabcrmFavoritesTw(activeProjectId ?? undefined);
      if (cancelled) return;
      setFavorites(res.ok ? res.data : []);
    })();
    return () => {
      cancelled = true;
    };
    // Re-load when the project changes or after navigation (favorites may
    // have been toggled on a record page).
  }, [activeProjectId, pathname]);

  // Load the live data model so the Workspace nav reflects it. Re-loads on
  // project change and on navigation, so creating / renaming / deleting an
  // object in the data-model settings replicates into the sidebar without a
  // full reload. Stays `null` (→ static fallback) until the first load lands,
  // and on any failure (engine down / RBAC / plan) so the sidebar never blanks.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      setObjects(res.ok ? res.data : null);
    })();
    return () => {
      cancelled = true;
    };
    // Keyed on the project only: the data-model editor lives under
    // `/dashboard/settings/crm` (a different layout), so returning to `/sabcrm`
    // remounts this frame and re-runs the load — picking up object changes
    // without re-fetching on every in-CRM navigation.
  }, [activeProjectId]);

  // Build the Workspace object rows from the live data model when available,
  // excluding internal/system objects (e.g. workspaceMembers); fall back to the
  // canonical Twenty objects otherwise. Non-object surfaces are always appended.
  const workspaceNav: NavItem[] = React.useMemo(() => {
    const objectRows: NavItem[] =
      objects && objects.length > 0
        ? objects
            // Hide system objects, and the renamed-away `opportunities` slug
            // (it's now `leads`) so a stale persisted copy never double-lists
            // alongside Leads until the data migration runs.
            .filter((o) => !o.isSystem && o.slug !== 'opportunities')
            .map((o) => ({
              slug: o.slug,
              label: o.labelPlural || o.slug,
              icon: objectNavIcon(o),
            }))
        : [...FALLBACK_OBJECT_NAV];
    return [...objectRows, ...WORKSPACE_EXTRA_NAV];
  }, [objects]);

  // Plural-label lookup for favorites, sourced from the live data model.
  const labelBySlug: Record<string, string> = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of objects ?? []) map[o.slug] = o.labelPlural || o.slug;
    for (const n of FALLBACK_OBJECT_NAV) map[n.slug] ??= n.label;
    return map;
  }, [objects]);

  // Full set of rendered nav destinations — feeds the most-specific active
  // resolution, recomputed as the dynamic object rows change.
  const allNavHrefs: string[] = React.useMemo(
    () => [...workspaceNav, ...MORE_NAV, ...OTHER_NAV].map(navHref),
    [workspaceNav],
  );

  // Load the persisted workspace settings ONCE per project (one blob read for
  // every section). This is what makes the settings actually "reflect": the
  // resolved value is provided to every /sabcrm surface + applied to the frame
  // root (theme + density) below. Fails closed → defaults until/if it lands.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getCrmSettingsTw();
      if (cancelled) return;
      setSettingsData(
        res.ok && res.data && typeof res.data === 'object'
          ? (res.data as Record<string, unknown>)
          : {},
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Track the OS colour scheme so the `system` theme (and unset) follows it.
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Resolve the raw settings document into the value consumers read.
  const settingsValue: SabcrmSettingsValue = React.useMemo(() => {
    const data = settingsData ?? {};
    const pick = <T,>(key: string): T => {
      const v = (data as Record<string, unknown>)[key];
      return (
        v && typeof v === 'object' && !Array.isArray(v) ? v : {}
      ) as unknown as T;
    };
    const general = pick<SabcrmGeneralPrefs>('general');
    const appearance = pick<SabcrmAppearancePrefs>('appearance');
    const localization = pick<SabcrmLocalizationPrefs>('localization');
    const notifications = pick<SabcrmNotificationPrefs>('notifications');
    const labRaw = pick<{ flags?: Record<string, boolean> }>('lab');
    const lab =
      labRaw.flags && typeof labRaw.flags === 'object' ? labRaw.flags : {};
    return {
      loaded: settingsData !== null,
      general,
      appearance,
      localization,
      notifications,
      lab,
      resolvedTheme: resolveSabcrmTheme(appearance.theme, lab.darkMode, systemDark),
      density: appearance.density === 'compact' ? 'compact' : 'comfortable',
      fmt: buildSabcrmFormatters(localization),
    };
  }, [settingsData, systemDark]);

  const rootClassName = `sabcrm-twenty${
    settingsValue.resolvedTheme === 'dark' ? ' st-theme-dark' : ''
  }${settingsValue.density === 'compact' ? ' st-density-compact' : ''}`;

  return (
    <SabcrmSettingsProvider value={settingsValue}>
    <div className={rootClassName}>
      <TwentyCommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
      <div className="st-shell">
        <aside className="st-sidebar" aria-label="SabCRM navigation">
          <div className="st-sidebar__scroll">
            {/* Workspace (project) switcher + notifications bell */}
            <div className="st-sidebar__header">
              <TwentyWorkspaceSwitcher />
              <NotificationsBell />
            </div>

            {/* CRM workspace identity (general settings) — reflects the name +
                icon configured in Settings → General. */}
            {settingsValue.general.workspaceName ? (
              <div className="st-ws-identity" title="CRM workspace">
                {settingsValue.general.iconEmoji ? (
                  <span className="st-ws-identity__icon" aria-hidden="true">
                    {settingsValue.general.iconEmoji}
                  </span>
                ) : null}
                <span className="st-ws-identity__name">
                  {settingsValue.general.workspaceName}
                </span>
              </div>
            ) : null}

            {/* Search */}
            <button
              type="button"
              className="st-search-btn"
              onClick={() => setCommandMenuOpen(true)}
              aria-label="Search (Command or Control + K)"
              aria-haspopup="dialog"
              aria-expanded={commandMenuOpen}
            >
              <Search className="st-search-btn__icon" size={16} aria-hidden="true" />
              <span className="st-search-btn__label">Search</span>
              <kbd className="st-kbd">⌘K</kbd>
            </button>

            {/* Favorites */}
            <div className="st-section-title">
              <Star className="st-section-title__chevron" size={12} aria-hidden="true" />
              <span>Favorites</span>
            </div>
            {favorites.length > 0 ? (
              <nav aria-label="Favorites">
                {favorites.map((fav) => {
                  const href = `/sabcrm/${fav.object}/${fav.recordId}`;
                  const active = isActivePath(pathname, href);
                  return (
                    <Link
                      key={fav.id}
                      href={href}
                      className={`st-nav-item${active ? ' active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Star
                        className="st-nav-item__icon"
                        size={16}
                        aria-hidden="true"
                      />
                      <span className="st-nav-item__label">
                        {favoriteLabel(fav, labelBySlug)}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            ) : (
              <div className="st-fav-empty">No favorites</div>
            )}

            {/* Workspace — faithful to Twenty's default object navigation */}
            <div className="st-section-title">
              <span>Workspace</span>
            </div>
            <nav aria-label="Workspace">
              {workspaceNav.map((item) => {
                const { slug, label, icon: Icon } = item;
                const href = navHref(item);
                const active = isBestActive(pathname, href, allNavHrefs);
                return (
                  <Link
                    key={slug}
                    href={href}
                    className={`st-nav-item${active ? ' active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="st-nav-item__icon" size={16} aria-hidden="true" />
                    <span className="st-nav-item__label">{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* More — SabCRM-specific surfaces beyond upstream Twenty */}
            <div className="st-section-title">
              <span>More</span>
            </div>
            <nav aria-label="More">
              {MORE_NAV.map((item) => {
                const { slug, label, icon: Icon } = item;
                const href = navHref(item);
                const active = isBestActive(pathname, href, allNavHrefs);
                return (
                  <Link
                    key={slug}
                    href={href}
                    className={`st-nav-item${active ? ' active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="st-nav-item__icon" size={16} aria-hidden="true" />
                    <span className="st-nav-item__label">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Other — mirrors Twenty's NavigationDrawerOtherSection, pinned bottom */}
          <div className="st-sidebar__footer">
            <div className="st-section-title">
              <span>Other</span>
            </div>
            <nav aria-label="Other">
              {OTHER_NAV.map((item) => {
                const { slug, label, icon: Icon } = item;
                const href = navHref(item);
                const active = isBestActive(pathname, href, allNavHrefs);
                return (
                  <Link
                    key={slug}
                    href={href}
                    className={`st-nav-item${active ? ' active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="st-nav-item__icon" size={16} aria-hidden="true" />
                    <span className="st-nav-item__label">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="st-main">{children}</main>
      </div>
    </div>
    </SabcrmSettingsProvider>
  );
}

export default TwentyAppFrame;
