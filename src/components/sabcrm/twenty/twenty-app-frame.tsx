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
  type LucideIcon,
} from 'lucide-react';

import '@/styles/sabcrm-twenty.css';
import './twenty-activity.css';
import './notifications.css';

import { TwentyCommandMenu } from './twenty-command-menu';
import { TwentyAppRail } from './twenty-app-rail';
import { TwentyWorkspaceSwitcher } from './twenty-workspace-switcher';
import { NotificationsBell } from './notifications-bell';
import { useCommandMenu } from './use-command-menu';
import { listSabcrmFavoritesTw } from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustFavorite } from '@/app/actions/sabcrm-twenty.actions.types';
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
 * "Workspace" section — faithful to upstream Twenty's default navigation
 * (twenty-server `standard-navigation-menu-item.constant.ts`): the same
 * standard objects, in the same order, with lucide equivalents of Twenty's
 * tabler icons — Companies, People, Opportunities, Tasks, Notes, Dashboards,
 * Workflows. Dashboards/Workflows have no `/sabcrm/<slug>` record route yet,
 * so they point at their nearest SabCRM surface.
 */
const WORKSPACE_NAV: readonly NavItem[] = [
  { slug: 'companies', label: 'Companies', icon: Building2 },
  { slug: 'people', label: 'People', icon: Users },
  { slug: 'opportunities', label: 'Opportunities', icon: Target },
  { slug: 'tasks', label: 'Tasks', icon: CheckSquare },
  { slug: 'notes', label: 'Notes', icon: StickyNote },
  { slug: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, href: '/sabcrm/dashboard' },
  { slug: 'workflows', label: 'Workflows', icon: Workflow, href: '/sabcrm/settings/automations' },
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
  { slug: 'help', label: 'Documentation', icon: HelpCircle, href: '/sabcrm/settings/help' },
] as const;

type TwentyAppFrameProps = {
  children: React.ReactNode;
};

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Every static nav destination — used to resolve overlapping active states. */
const ALL_NAV_HREFS: readonly string[] = [
  ...WORKSPACE_NAV,
  ...MORE_NAV,
  ...OTHER_NAV,
].map(navHref);

/**
 * Active-state for the static nav items, where the *most specific* match wins.
 * `/sabcrm/settings` is a prefix of `/sabcrm/settings/automations`, so when a
 * deeper nav target also matches the current path the shallower "Settings"
 * entry yields to it instead of both lighting up.
 */
function isBestActive(pathname: string | null, href: string): boolean {
  if (!isActivePath(pathname, href)) return false;
  return !ALL_NAV_HREFS.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      isActivePath(pathname, other),
  );
}

/** A best-effort human label for a favorite that carries no record name. */
function favoriteLabel(fav: SabcrmRustFavorite): string {
  const objLabel =
    WORKSPACE_NAV.find((o) => o.slug === fav.object)?.label ?? fav.object;
  return `${objLabel} · ${fav.recordId.slice(-6)}`;
}

export function TwentyAppFrame({ children }: TwentyAppFrameProps): React.JSX.Element {
  const pathname = usePathname();
  const { open: commandMenuOpen, setOpen: setCommandMenuOpen } = useCommandMenu();
  const { activeProjectId } = useProject();

  const [favorites, setFavorites] = React.useState<SabcrmRustFavorite[]>([]);

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

  return (
    <div className="sabcrm-twenty">
      <TwentyCommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
      <div className="st-shell">
        <TwentyAppRail />
        <aside className="st-sidebar" aria-label="SabCRM navigation">
          <div className="st-sidebar__scroll">
            {/* Workspace (project) switcher + notifications bell */}
            <div className="st-sidebar__header">
              <TwentyWorkspaceSwitcher />
              <NotificationsBell />
            </div>

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
                        {favoriteLabel(fav)}
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
              {WORKSPACE_NAV.map((item) => {
                const { slug, label, icon: Icon } = item;
                const href = navHref(item);
                const active = isBestActive(pathname, href);
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
                const active = isBestActive(pathname, href);
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
                const active = isBestActive(pathname, href);
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
  );
}

export default TwentyAppFrame;
