import Link from 'next/link';
import {
  Database,
  Users,
  KeyRound,
  Webhook,
  ArrowUpDown,
  LayoutGrid,
  Zap,
  ChevronRight,
  UserCircle,
  Palette,
  SlidersHorizontal,
  ShieldCheck,
  FlaskConical,
  CreditCard,
  Tag,
  Target,
  Sigma,
  Gauge,
  Lock,
  AtSign,
  Braces,
  Beaker,
  FileText,
  GitBranch,
  Bell,
  Globe,
  Network,
  Filter,
  HelpCircle,
  Boxes,
  ShieldAlert,
  Flag,
  MailOpen,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './settings-hub.css';

export const metadata = {
  title: 'Settings · SabNode',
};

/**
 * SabCRM Settings hub (`/dashboard/settings/crm`), 20ui.
 *
 * A settings index: grouped sections (Account / Workspace / Developers /
 * Data / Automation / Advanced) rendered as list rows (icon, label,
 * description, chevron), each linking to an existing
 * `/dashboard/settings/crm/*` route.
 *
 * Rendered inside the layout's `CrmSettingsShell` (which stamps the 20ui token
 * scope); header chrome comes from the 20ui `PageHeader` family and the rows
 * from the page-local `./settings-hub.css` (`.shub-*`, ported off the legacy
 * `.st-*` / `home.css` chrome).
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
    title: 'Account',
    rows: [
      {
        slug: 'profile',
        label: 'Profile',
        description: 'Your name, photo and personal details',
        icon: UserCircle,
      },
      {
        slug: 'appearance',
        label: 'Appearance',
        description: 'Theme, language and display options',
        icon: Palette,
      },
      {
        slug: 'security',
        label: 'Security',
        description: 'Password, two-factor and active sessions',
        icon: Lock,
      },
      {
        slug: 'accounts',
        label: 'Accounts',
        description: 'Connected email and calendar accounts',
        icon: AtSign,
      },
      {
        slug: 'notifications',
        label: 'Notifications',
        description: 'Email and in-app notification preferences',
        icon: Bell,
      },
      {
        slug: 'localization',
        label: 'Localization',
        description: 'Language, timezone and date formats',
        icon: Globe,
      },
      {
        slug: 'help',
        label: 'Help & Shortcuts',
        description: 'Keyboard shortcuts, docs and support',
        icon: HelpCircle,
      },
    ],
  },
  {
    title: 'Workspace',
    rows: [
      {
        slug: 'general',
        label: 'General',
        description: 'Workspace name, logo and defaults',
        icon: SlidersHorizontal,
      },
      {
        slug: 'billing',
        label: 'Billing & Plan',
        description: 'Your SabNode plan and CRM usage',
        icon: CreditCard,
      },
      {
        slug: 'members',
        label: 'Members',
        description: 'Workspace access and CRM roles',
        icon: Users,
      },
      {
        slug: 'roles',
        label: 'Roles',
        description: 'Permission sets and access control',
        icon: ShieldCheck,
      },
      {
        slug: 'data-model',
        label: 'Data model',
        description: 'Objects, fields and relations',
        icon: Database,
      },
      {
        slug: 'data-model/graph',
        label: 'Data model graph',
        description: 'Visual map of objects and their relations',
        icon: Network,
      },
      {
        slug: 'page-layouts',
        label: 'Record Layout',
        description: 'Tabs and widgets shown on record pages',
        icon: LayoutGrid,
      },
      {
        slug: 'templates',
        label: 'Templates',
        description: 'Reusable record and email templates',
        icon: FileText,
      },
      {
        slug: 'pipelines',
        label: 'Pipelines',
        description: 'Deal stages and pipeline configuration',
        icon: GitBranch,
      },
      {
        slug: 'scoring',
        label: 'Lead scoring',
        description: 'Rule-based lead and deal scoring',
        icon: Target,
      },
      {
        slug: 'win-loss',
        label: 'Win/loss reasons',
        description: 'Capture win/loss outcomes when a deal changes stage',
        icon: Flag,
      },
      {
        slug: 'email-tracking',
        label: 'Email tracking',
        description: 'Open and click tracking for outbound CRM email',
        icon: MailOpen,
      },
      {
        slug: 'booking',
        label: 'Booking links',
        description: 'Calendly-style public links that create CRM records',
        icon: CalendarClock,
      },
      {
        slug: 'validation',
        label: 'Validation rules',
        description: 'Block or warn on invalid record saves',
        icon: ShieldCheck,
      },
      {
        slug: 'flow-automations',
        label: 'SabFlow automations',
        description: 'Run a SabFlow flow when a CRM event fires',
        icon: Zap,
      },
      {
        slug: 'formulas',
        label: 'Formula fields',
        description: 'Computed fields from spreadsheet-style expressions',
        icon: Sigma,
      },
      {
        slug: 'rollups',
        label: 'Rollup fields',
        description: 'Aggregate related records onto a parent field',
        icon: Sigma,
      },
      {
        slug: 'forecast-adjustments',
        label: 'Forecast adjustments',
        description: 'Manager overlay on Commit / Best-case / Pipeline',
        icon: SlidersHorizontal,
      },
      {
        slug: 'tags',
        label: 'Tags',
        description: 'Labels for categorising records',
        icon: Tag,
      },
      {
        slug: 'segments',
        label: 'Segments',
        description: 'Saved record filters and audience segments',
        icon: Filter,
      },
      {
        slug: 'usage',
        label: 'Usage & Limits',
        description: 'Plan consumption and quotas',
        icon: Gauge,
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
      {
        slug: 'playground',
        label: 'API Playground',
        description: 'Test the REST record API live',
        icon: FlaskConical,
      },
      {
        slug: 'audit',
        label: 'Audit Log',
        description: 'Workspace change history',
        icon: ShieldCheck,
      },
      {
        slug: 'functions',
        label: 'Functions',
        description: 'Serverless functions and code hooks',
        icon: Braces,
      },
      {
        slug: 'applications',
        label: 'Applications',
        description: 'Installed apps and integrations',
        icon: Boxes,
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
  {
    title: 'Advanced',
    rows: [
      {
        slug: 'lab',
        label: 'Lab',
        description: 'Experimental and beta features',
        icon: Beaker,
      },
      {
        slug: 'admin',
        label: 'Admin Panel',
        description: 'Workspace administration and system controls',
        icon: ShieldAlert,
      },
    ],
  },
] as const;

export default function SabcrmSettingsPage(): React.JSX.Element {
  return (
    <div className="shub">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Settings</PageTitle>
          <PageDescription>
            Manage your account, workspace, billing and module settings — all
            from one place. Update your profile and security, control members
            and roles, issue API keys and webhooks, and configure each
            connected module.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {GROUPS.map((group) => (
        <section key={group.title} className="shub-group">
          <h2 className="shub-group__title">{group.title}</h2>
          <div className="shub-list">
            {group.rows.map(({ slug, label, description, icon: Icon }) => (
              <Link
                key={slug}
                href={`/dashboard/settings/crm/${slug}`}
                className="shub-row"
              >
                <span className="shub-row__icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="shub-row__text">
                  <span className="shub-row__label">{label}</span>
                  <span className="shub-row__desc">{description}</span>
                </span>
                <ChevronRight
                  className="shub-row__chevron"
                  size={16}
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
