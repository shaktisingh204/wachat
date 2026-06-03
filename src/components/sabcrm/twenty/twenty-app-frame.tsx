'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  Search,
  Settings,
  Star,
  ChevronDown,
  UserCheck,
  LayoutDashboard,
  Activity,
  Calendar,
  BarChart3,
  MapPin,
  Sparkles,
  Rocket,
  type LucideIcon,
} from 'lucide-react';

import '@/styles/sabcrm-twenty.css';
import './twenty-activity.css';
import './notifications.css';

import { TwentyCommandMenu } from './twenty-command-menu';
import { TwentyAppRail } from './twenty-app-rail';
import { NotificationsBell } from './notifications-bell';
import { useCommandMenu } from './use-command-menu';
import { listSabcrmFavoritesTw } from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustFavorite } from '@/app/actions/sabcrm-twenty.actions.types';
import { useProject } from '@/context/project-context';

type NavItem = {
  slug: string;
  label: string;
  icon: LucideIcon;
};

/**
 * "Workspace" group — the cross-cutting CRM surfaces (not record objects).
 * Each entry maps to a real `/sabcrm/*` page.
 */
const WORKSPACE_NAV: readonly NavItem[] = [
  { slug: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { slug: 'my-work', label: 'My Work', icon: UserCheck },
  { slug: 'activity', label: 'Activity', icon: Activity },
  { slug: 'calendar', label: 'Calendar', icon: Calendar },
  { slug: 'reports', label: 'Reports', icon: BarChart3 },
  { slug: 'map', label: 'Map', icon: MapPin },
  { slug: 'ai', label: 'Ask AI', icon: Sparkles },
] as const;

/**
 * "Records" group — the metadata-driven CRM objects. Also drives the
 * favorites label resolution below.
 */
const OBJECT_NAV: readonly NavItem[] = [
  { slug: 'companies', label: 'Companies', icon: Building2 },
  { slug: 'people', label: 'People', icon: Users },
  { slug: 'opportunities', label: 'Opportunities', icon: Briefcase },
  { slug: 'notes', label: 'Notes', icon: StickyNote },
  { slug: 'tasks', label: 'Tasks', icon: CheckCircle2 },
] as const;

/** Pinned-to-bottom entries below the scrolling nav. */
const FOOTER_NAV: readonly NavItem[] = [
  { slug: 'getting-started', label: 'Getting Started', icon: Rocket },
  { slug: 'settings', label: 'Settings', icon: Settings },
] as const;

const WORKSPACE_NAME = 'SabCRM';

type TwentyAppFrameProps = {
  children: React.ReactNode;
};

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A best-effort human label for a favorite that carries no record name. */
function favoriteLabel(fav: SabcrmRustFavorite): string {
  const objLabel =
    OBJECT_NAV.find((o) => o.slug === fav.object)?.label ?? fav.object;
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
            {/* Workspace switcher + notifications bell */}
            <div className="st-sidebar__header">
              <button
                type="button"
                className="st-workspace-switcher"
                aria-label={`Workspace: ${WORKSPACE_NAME}`}
              >
                <span className="st-workspace-switcher__avatar" aria-hidden="true">
                  {WORKSPACE_NAME.charAt(0)}
                </span>
                <span className="st-workspace-switcher__name">{WORKSPACE_NAME}</span>
                <ChevronDown
                  className="st-workspace-switcher__chevron"
                  size={14}
                  aria-hidden="true"
                />
              </button>
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

            {/* Workspace surfaces */}
            <div className="st-section-title">
              <span>Workspace</span>
            </div>
            <nav aria-label="Workspace">
              {WORKSPACE_NAV.map(({ slug, label, icon: Icon }) => {
                const href = `/sabcrm/${slug}`;
                const active = isActivePath(pathname, href);
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

            {/* Records */}
            <div className="st-section-title">
              <span>Records</span>
            </div>
            <nav aria-label="Records">
              {OBJECT_NAV.map(({ slug, label, icon: Icon }) => {
                const href = `/sabcrm/${slug}`;
                const active = isActivePath(pathname, href);
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

          {/* Getting Started + Settings pinned to bottom */}
          <div className="st-sidebar__footer">
            <nav aria-label="Workspace settings">
              {FOOTER_NAV.map(({ slug, label, icon: Icon }) => {
                const href = `/sabcrm/${slug}`;
                const active = isActivePath(pathname, href);
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
