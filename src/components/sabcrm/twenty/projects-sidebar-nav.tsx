'use client';

/**
 * SabCRM sidebar — "Projects" collapsible nav item.
 *
 * A 20ui-styled expandable entry that sits in the sidebar's Workspace group and
 * reveals the project-management views (All projects / Board / Timeline) as a
 * submenu. It reuses the `.u-sidebar__button` look (so it's visually identical
 * to the sibling nav rows) and adds a rotating chevron + a smooth grid-rows
 * height reveal. Active state is path + `?view=`-aware.
 *
 * Self-contained: it reads the current route itself (no props) and is wrapped in
 * a `<Suspense>` by the frame so its `useSearchParams` read is properly bounded.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  FolderKanban,
  ChevronRight,
  Table2,
  Columns3,
  GanttChartSquare,
  type LucideIcon,
} from 'lucide-react';

import './projects-sidebar-nav.css';

const PROJECTS_PATH = '/sabcrm/projects';

type SubView = 'list' | 'board' | 'timeline';

interface SubItem {
  label: string;
  view: SubView;
  href: string;
  icon: LucideIcon;
}

const SUB_ITEMS: readonly SubItem[] = [
  { label: 'All projects', view: 'list', href: PROJECTS_PATH, icon: Table2 },
  { label: 'Board', view: 'board', href: `${PROJECTS_PATH}?view=board`, icon: Columns3 },
  { label: 'Timeline', view: 'timeline', href: `${PROJECTS_PATH}?view=timeline`, icon: GanttChartSquare },
];

function resolveView(v: string | null): SubView {
  return v === 'board' || v === 'timeline' ? v : 'list';
}

export function ProjectsSidebarNav(): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onProjects = pathname === PROJECTS_PATH || pathname.startsWith(`${PROJECTS_PATH}/`);
  const currentView = resolveView(searchParams.get('view'));

  // Expanded by default while inside Projects; otherwise user-toggleable.
  const [open, setOpen] = React.useState(onProjects);
  // Auto-open when navigating into Projects from elsewhere.
  React.useEffect(() => {
    if (onProjects) setOpen(true);
  }, [onProjects]);

  const panelId = React.useId();

  return (
    <li className="u-sidebar__item pm-nav">
      <button
        type="button"
        className={`u-sidebar__button pm-nav__trigger${onProjects ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <FolderKanban size={16} className="u-sidebar__button-icon" aria-hidden="true" />
        <span className="u-sidebar__button-label">Projects</span>
        <ChevronRight size={14} className={`pm-nav__chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>

      <div id={panelId} className="pm-nav__panel" data-open={open ? '' : undefined} role="region" aria-label="Project views">
        <ul className="u-sidebar__menu pm-nav__sub">
          {SUB_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = onProjects && currentView === item.view;
            return (
              <li key={item.view} className="u-sidebar__item">
                <Link
                  href={item.href}
                  className={`u-sidebar__button pm-nav__sublink${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  tabIndex={open ? undefined : -1}
                >
                  <Icon size={15} className="u-sidebar__button-icon" aria-hidden="true" />
                  <span className="u-sidebar__button-label">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}
