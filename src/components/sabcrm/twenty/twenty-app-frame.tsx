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
  type LucideIcon,
} from 'lucide-react';

import '@/styles/sabcrm-twenty.css';
import './twenty-activity.css';

import { TwentyCommandMenu } from './twenty-command-menu';
import { useCommandMenu } from './use-command-menu';
import { listSabcrmFavoritesTw } from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustFavorite } from '@/app/actions/sabcrm-twenty.actions.types';
import { useProject } from '@/context/project-context';

type ObjectNavItem = {
  slug: string;
  label: string;
  icon: LucideIcon;
};

const OBJECT_NAV: readonly ObjectNavItem[] = [
  { slug: 'companies', label: 'Companies', icon: Building2 },
  { slug: 'people', label: 'People', icon: Users },
  { slug: 'opportunities', label: 'Opportunities', icon: Briefcase },
  { slug: 'notes', label: 'Notes', icon: StickyNote },
  { slug: 'tasks', label: 'Tasks', icon: CheckCircle2 },
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
        <aside className="st-sidebar">
          <div className="st-sidebar__scroll">
            {/* Workspace switcher */}
            <button type="button" className="st-workspace-switcher">
              <span className="st-workspace-switcher__avatar">
                {WORKSPACE_NAME.charAt(0)}
              </span>
              <span className="st-workspace-switcher__name">{WORKSPACE_NAME}</span>
              <ChevronDown
                className="st-workspace-switcher__chevron"
                size={14}
                aria-hidden="true"
              />
            </button>

            {/* Search */}
            <button
              type="button"
              className="st-search-btn"
              onClick={() => setCommandMenuOpen(true)}
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

            {/* Workspace objects */}
            <div className="st-section-title">
              <span>Workspace</span>
            </div>
            <nav aria-label="Workspace">
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

          {/* Settings pinned to bottom */}
          <div className="st-sidebar__footer">
            <Link
              href="/sabcrm/settings"
              className={`st-nav-item${isActivePath(pathname, '/sabcrm/settings') ? ' active' : ''}`}
              aria-current={isActivePath(pathname, '/sabcrm/settings') ? 'page' : undefined}
            >
              <Settings className="st-nav-item__icon" size={16} aria-hidden="true" />
              <span className="st-nav-item__label">Settings</span>
            </Link>
          </div>
        </aside>

        <main className="st-main">{children}</main>
      </div>
    </div>
  );
}

export default TwentyAppFrame;
