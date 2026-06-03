import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  Settings,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import './home.css';

export const metadata = {
  title: 'SabCRM',
};

/**
 * SabCRM landing (`/sabcrm`).
 *
 * Twenty itself redirects to the first object; here we render a tidy,
 * self-contained object grid instead — a clean entry surface that lets the
 * user jump straight into any of the five standard objects, plus quick links
 * to Settings, Tasks and Notes.
 *
 * Rendered inside the layout's `TwentyAppFrame` (`.sabcrm-twenty` scope), so
 * all visuals come from the `.st-*` Twenty design system. No ZoruUI / Tailwind.
 *
 * The object list mirrors `twenty-app-frame.tsx`'s sidebar nav — hardcoded to
 * the five standard objects so the page is fully static and self-contained.
 */

type ObjectNavItem = {
  slug: string;
  label: string;
  icon: LucideIcon;
};

const OBJECTS: readonly ObjectNavItem[] = [
  { slug: 'companies', label: 'Companies', icon: Building2 },
  { slug: 'people', label: 'People', icon: Users },
  { slug: 'opportunities', label: 'Opportunities', icon: Briefcase },
  { slug: 'notes', label: 'Notes', icon: StickyNote },
  { slug: 'tasks', label: 'Tasks', icon: CheckCircle2 },
] as const;

export default function SabcrmHomePage(): React.JSX.Element {
  return (
    <div className="st-home">
      <div className="st-home__inner">
        <TwentyPageHeader title="SabCRM" icon={Building2} />
        <p className="st-lead">
          Your data, organised by object. Open any object to browse, filter and
          manage its records.
        </p>

        <ul className="st-obj-grid">
          {OBJECTS.map(({ slug, label, icon: Icon }) => (
            <li key={slug} style={{ display: 'flex' }}>
              <Link
                href={`/sabcrm/${slug}`}
                className="st-obj-card"
                aria-label={`${label}, view all`}
              >
                <div className="st-obj-card__top">
                  <span className="st-obj-card__icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className="st-obj-card__label">{label}</span>
                </div>
                <span className="st-obj-card__cta">
                  View all
                  <ArrowRight size={13} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <nav className="st-quick" aria-label="Quick links">
          <Link href="/sabcrm/settings" className="st-quick-link">
            <Settings size={14} aria-hidden="true" />
            Settings
          </Link>
          <Link href="/sabcrm/tasks" className="st-quick-link">
            <CheckCircle2 size={14} aria-hidden="true" />
            Tasks
          </Link>
          <Link href="/sabcrm/notes" className="st-quick-link">
            <StickyNote size={14} aria-hidden="true" />
            Notes
          </Link>
        </nav>
      </div>
    </div>
  );
}
