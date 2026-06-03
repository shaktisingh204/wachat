import Link from 'next/link';
import {
  Settings,
  Database,
  Users,
  KeyRound,
  Webhook,
  ArrowUpDown,
  LayoutGrid,
  Zap,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import './../home.css';

export const metadata = {
  title: 'Settings · SabCRM',
};

/**
 * SabCRM Settings hub (`/sabcrm/settings`).
 *
 * A Twenty-faithful settings index: grouped sections (Workspace / Developers /
 * Data / Automation) rendered as list rows (icon, label, description, chevron),
 * each linking to an existing `/sabcrm/settings/*` route.
 *
 * Rendered inside the layout's `TwentyAppFrame` (`.sabcrm-twenty` scope); all
 * visuals come from the `.st-*` Twenty design system. No ZoruUI / Tailwind.
 *
 * Auth / onboarding / RBAC / project context are enforced by `../layout.tsx`;
 * each linked route independently re-runs its own gate.
 */

type SettingsRow = {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type SettingsGroup = {
  title: string;
  rows: readonly SettingsRow[];
};

const GROUPS: readonly SettingsGroup[] = [
  {
    title: 'Workspace',
    rows: [
      {
        slug: 'data-model',
        label: 'Data model',
        description: 'Objects, fields and relations',
        icon: Database,
      },
      {
        slug: 'members',
        label: 'Members',
        description: 'Workspace access and CRM roles',
        icon: Users,
      },
    ],
  },
  {
    title: 'Developers',
    rows: [
      {
        slug: 'api',
        label: 'API Keys',
        description: 'Issue and revoke REST API tokens',
        icon: KeyRound,
      },
      {
        slug: 'webhooks',
        label: 'Webhooks',
        description: 'Outbound event subscriptions',
        icon: Webhook,
      },
    ],
  },
  {
    title: 'Data',
    rows: [
      {
        slug: 'import-export',
        label: 'Import / Export',
        description: 'Bulk CSV import and export',
        icon: ArrowUpDown,
      },
      {
        slug: 'views',
        label: 'Views',
        description: 'Saved table and board views',
        icon: LayoutGrid,
      },
    ],
  },
  {
    title: 'Automation',
    rows: [
      {
        slug: 'automations',
        label: 'Automations',
        description: 'Event-driven rules and actions',
        icon: Zap,
      },
    ],
  },
] as const;

export default function SabcrmSettingsPage(): React.JSX.Element {
  return (
    <div className="st-home">
      <div className="st-home__inner">
        <nav className="st-crumbs" aria-label="Breadcrumb">
          <Link href="/sabcrm" className="st-crumbs__link">
            SabCRM
          </Link>
          <span className="st-crumbs__sep" aria-hidden="true">
            /
          </span>
          <span>Settings</span>
        </nav>

        <TwentyPageHeader title="Settings" icon={Settings} />
        <p className="st-lead">
          Configure your CRM workspace — manage the data model and members,
          issue API keys and webhooks, run imports, organise views, and build
          automations.
        </p>

        {GROUPS.map((group) => (
          <section key={group.title} className="st-settings-group">
            <h2 className="st-settings-group__title">{group.title}</h2>
            <div className="st-settings-list">
              {group.rows.map(({ slug, label, description, icon: Icon }) => (
                <Link
                  key={slug}
                  href={`/sabcrm/settings/${slug}`}
                  className="st-settings-row"
                >
                  <span className="st-settings-row__icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="st-settings-row__text">
                    <span className="st-settings-row__label">{label}</span>
                    <span className="st-settings-row__desc">{description}</span>
                  </span>
                  <ChevronRight
                    className="st-settings-row__chevron"
                    size={16}
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
