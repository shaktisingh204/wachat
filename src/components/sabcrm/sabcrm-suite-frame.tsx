'use client';

/**
 * SabcrmSuiteFrame — the 20ui shell for the SabCRM suite.
 *
 * Replaces `TwentyAppFrame` as the inner column of `/sabcrm/*`: same gating,
 * same `SabcrmSettingsProvider` (theme / density / formatters), same
 * `.sabcrm-twenty ui20` token root — but the navigation drawer is the 20ui
 * `SabAppSidebar`, organised into suite groups (Sales / Insights / Finance /
 * Other) instead of the Twenty-faithful drawer.
 *
 * The `.sabcrm-twenty` class (and the `st-theme-dark` / `st-density-compact`
 * companions) MUST stay on the root until the last `.st-*` page is rebuilt on
 * 20ui — every not-yet-migrated page styles off that scope. Suite groups grow
 * here as suites ship (Supply / Commerce / People); entries must point at
 * routes that exist.
 *
 * Lives OUTSIDE the 20ui barrel tree on purpose: it imports Twenty pieces
 * (command menu, settings context) which themselves import the 20ui barrel,
 * so re-exporting this file from the barrel would form the self-cycle that
 * Turbopack resolves to an empty object.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileText,
  Database,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Receipt,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Star,
  StickyNote,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import '@/components/sabcrm/20ui/surface-crm-base.css';

import {
  SabAppSidebar,
  type SabSidebarGroup,
  type SabSidebarLeaf,
} from '@/components/sabcrm/20ui/composites/shell/app-sidebar';
import { TwentyCommandMenu } from '@/components/sabcrm/twenty/twenty-command-menu';
import { useCommandMenu } from '@/components/sabcrm/twenty/use-command-menu';
import { TwentyWorkspaceSwitcher } from '@/components/sabcrm/twenty/twenty-workspace-switcher';
import {
  SabcrmSettingsProvider,
  buildSabcrmFormatters,
  resolveSabcrmTheme,
  type SabcrmSettingsValue,
  type SabcrmGeneralPrefs,
  type SabcrmAppearancePrefs,
  type SabcrmLocalizationPrefs,
  type SabcrmNotificationPrefs,
} from '@/components/sabcrm/twenty/sabcrm-settings-context';
import { ICONS } from '@/components/sabcrm/20ui';
import { listSabcrmFavoritesTw } from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustFavorite } from '@/app/actions/sabcrm-twenty.actions.types';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { ObjectMetadata } from '@/lib/rust-client/sabcrm-objects';
import { getCrmSettingsTw } from '@/app/actions/sabcrm-settings.actions';
import { useProject } from '@/context/project-context';

const STANDARD_OBJECT_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  leads: Target,
  tasks: CheckSquare,
  notes: StickyNote,
};

function objectNavIcon(object: ObjectMetadata): LucideIcon {
  const picked = object.icon
    ? (ICONS[object.icon] as LucideIcon | undefined)
    : undefined;
  return picked ?? STANDARD_OBJECT_ICON[object.slug] ?? Database;
}

/** Fallback object rows when the live data model can't load (engine/RBAC/plan). */
const FALLBACK_OBJECTS: Array<{ slug: string; label: string; icon: LucideIcon }> = [
  { slug: 'companies', label: 'Companies', icon: Building2 },
  { slug: 'people', label: 'People', icon: Users },
  { slug: 'leads', label: 'Leads', icon: Target },
  { slug: 'tasks', label: 'Tasks', icon: CheckSquare },
  { slug: 'notes', label: 'Notes', icon: StickyNote },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Most-specific match wins, so "Settings" yields to deeper settings leaves. */
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

function favoriteLabel(
  fav: SabcrmRustFavorite,
  labelBySlug: Record<string, string>,
): string {
  const objLabel = labelBySlug[fav.object] ?? fav.object;
  return `${objLabel} · ${fav.recordId.slice(-6)}`;
}

export function SabcrmSuiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { open: commandMenuOpen, setOpen: setCommandMenuOpen } = useCommandMenu();
  const { activeProjectId } = useProject();

  const [favorites, setFavorites] = React.useState<SabcrmRustFavorite[]>([]);
  const [objects, setObjects] = React.useState<ObjectMetadata[] | null>(null);
  const [settingsData, setSettingsData] = React.useState<Record<string, unknown> | null>(null);
  const [systemDark, setSystemDark] = React.useState(false);

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
  }, [activeProjectId, pathname]);

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
  }, [activeProjectId]);

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

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

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

  const labelBySlug: Record<string, string> = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of objects ?? []) map[o.slug] = o.labelPlural || o.slug;
    for (const n of FALLBACK_OBJECTS) map[n.slug] ??= n.label;
    return map;
  }, [objects]);

  const groups: SabSidebarGroup[] = React.useMemo(() => {
    const objectLeaves =
      objects && objects.length > 0
        ? objects
            .filter(
              (o) =>
                !o.isSystem &&
                o.slug !== 'opportunities' &&
                o.slug !== 'projects',
            )
            .map((o) => ({
              slug: o.slug,
              label: o.labelPlural || o.slug,
              icon: objectNavIcon(o),
            }))
        : FALLBACK_OBJECTS;

    const entries: Array<{ group: string } & { id: string; label: string; href?: string; icon: LucideIcon; onClick?: () => void }> = [
      ...objectLeaves.map((o) => ({
        group: 'sales',
        id: `obj-${o.slug}`,
        label: o.label,
        href: `/sabcrm/${o.slug}`,
        icon: o.icon,
      })),
      { group: 'sales', id: 'projects', label: 'Projects', href: '/sabcrm/projects', icon: ListChecks },
      { group: 'sales', id: 'forms', label: 'Forms', href: '/sabcrm/forms', icon: ClipboardList },
      { group: 'sales', id: 'approvals', label: 'Approvals', href: '/sabcrm/approvals', icon: ShieldCheck },
      { group: 'sales', id: 'sequences', label: 'Sequences', href: '/sabcrm/sequences', icon: Send },
      { group: 'sales', id: 'routing', label: 'Routing', href: '/sabcrm/routing', icon: Shuffle },
      { group: 'finance', id: 'invoices', label: 'Invoices', href: '/sabcrm/finance/invoices', icon: Receipt },
      { group: 'finance', id: 'quotations', label: 'Quotations', href: '/sabcrm/finance/quotations', icon: FileText },
      { group: 'finance', id: 'sales-orders', label: 'Sales orders', href: '/sabcrm/finance/sales-orders', icon: FileText },
      { group: 'finance', id: 'proforma-invoices', label: 'Proforma invoices', href: '/sabcrm/finance/proforma-invoices', icon: FileText },
      { group: 'finance', id: 'credit-notes', label: 'Credit notes', href: '/sabcrm/finance/credit-notes', icon: FileText },
      { group: 'finance', id: 'debit-notes', label: 'Debit notes', href: '/sabcrm/finance/debit-notes', icon: FileText },
      { group: 'finance', id: 'bills', label: 'Bills', href: '/sabcrm/finance/bills', icon: Wallet },
      { group: 'finance', id: 'payment-receipts', label: 'Payment receipts', href: '/sabcrm/finance/payment-receipts', icon: CreditCard },
      { group: 'finance', id: 'payment-accounts', label: 'Payment accounts', href: '/sabcrm/finance/payment-accounts', icon: Wallet },
      { group: 'finance', id: 'bank-transactions', label: 'Bank transactions', href: '/sabcrm/finance/bank-transactions', icon: CreditCard },
      { group: 'finance', id: 'recurring-invoices', label: 'Recurring invoices', href: '/sabcrm/finance/recurring-invoices', icon: Receipt },
      { group: 'finance', id: 'expenses', label: 'Expenses', href: '/sabcrm/finance/expenses', icon: Wallet },
      { group: 'finance', id: 'payouts', label: 'Payouts', href: '/sabcrm/finance/payouts', icon: CreditCard },
      { group: 'finance', id: 'vouchers', label: 'Voucher books', href: '/sabcrm/finance/vouchers', icon: FileText },
      { group: 'finance', id: 'petty-cash', label: 'Petty cash', href: '/sabcrm/finance/petty-cash', icon: Wallet },
      { group: 'finance', id: 'budgets', label: 'Budgets', href: '/sabcrm/finance/budgets', icon: TrendingUp },
      { group: 'finance', id: 'reconciliation', label: 'Reconciliation', href: '/sabcrm/finance/reconciliation', icon: CheckSquare },
      { group: 'insights', id: 'forecast', label: 'Forecast', href: '/sabcrm/forecast', icon: TrendingUp },
      { group: 'insights', id: 'dashboards', label: 'Dashboards', href: '/sabcrm/dashboard', icon: LayoutDashboard },
      { group: 'insights', id: 'reports', label: 'Reports', href: '/sabcrm/reports', icon: BarChart3 },
      { group: 'insights', id: 'activity', label: 'Activity', href: '/sabcrm/activity', icon: Activity },
      { group: 'insights', id: 'calendar', label: 'Calendar', href: '/sabcrm/calendar', icon: Calendar },
      { group: 'insights', id: 'map', label: 'Map', href: '/sabcrm/map', icon: MapPin },
      { group: 'insights', id: 'my-work', label: 'My Work', href: '/sabcrm/my-work', icon: UserCheck },
      { group: 'insights', id: 'ai', label: 'Ask AI', href: '/sabcrm/ai', icon: Sparkles },
      { group: 'other', id: 'getting-started', label: 'Getting Started', href: '/sabcrm/getting-started', icon: Rocket },
      { group: 'other', id: 'automations', label: 'Automations', href: '/dashboard/settings/crm/automations', icon: Workflow },
      { group: 'other', id: 'settings', label: 'Settings', href: '/dashboard/settings/crm', icon: Settings },
      { group: 'other', id: 'help', label: 'Documentation', href: '/dashboard/settings/crm/help', icon: HelpCircle },
    ];

    const allHrefs = entries.flatMap((e) => (e.href ? [e.href] : []));

    const toLeaf = (e: (typeof entries)[number]): SabSidebarLeaf => {
      const Icon = e.icon;
      return {
        id: e.id,
        label: e.label,
        href: e.href,
        onClick: e.onClick,
        icon: <Icon />,
        active: e.href ? isBestActive(pathname, e.href, allHrefs) : false,
      };
    };

    const favoriteLeaves: SabSidebarLeaf[] = favorites.map((fav) => {
      const href = `/sabcrm/${fav.object}/${fav.recordId}`;
      return {
        id: `fav-${fav.id}`,
        label: favoriteLabel(fav, labelBySlug),
        href,
        icon: <Star />,
        active: isActivePath(pathname, href),
      };
    });

    const searchLeaf: SabSidebarLeaf = {
      id: 'command-search',
      label: 'Search',
      icon: <Search />,
      badge: '⌘K',
      onClick: () => setCommandMenuOpen(true),
    };

    const result: SabSidebarGroup[] = [];
    result.push({ id: 'top', items: [searchLeaf] });
    if (favoriteLeaves.length > 0) {
      result.push({ id: 'favorites', label: 'Favorites', items: favoriteLeaves });
    }
    result.push({
      id: 'sales',
      label: 'Sales',
      items: entries.filter((e) => e.group === 'sales').map(toLeaf),
    });
    result.push({
      id: 'finance',
      label: 'Finance',
      items: entries.filter((e) => e.group === 'finance').map(toLeaf),
    });
    result.push({
      id: 'insights',
      label: 'Insights',
      items: entries.filter((e) => e.group === 'insights').map(toLeaf),
    });
    result.push({
      id: 'other',
      label: 'Other',
      items: entries.filter((e) => e.group === 'other').map(toLeaf),
    });
    return result;
  }, [objects, favorites, labelBySlug, pathname, setCommandMenuOpen]);

  const rootClassName = `sabcrm-twenty ui20${
    settingsValue.resolvedTheme === 'dark' ? ' st-theme-dark dark' : ' light'
  }${settingsValue.density === 'compact' ? ' st-density-compact' : ''}`;

  return (
    <SabcrmSettingsProvider value={settingsValue}>
      <div className={rootClassName}>
        <TwentyCommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
        <div className="st-shell">
          {/* Workspace switcher lives in the footer slot: the heading slot
              renders inside a <p>, and the switcher's root is a <div>. */}
          <SabAppSidebar
            heading="SabCRM"
            caption={settingsValue.general.workspaceName || 'Suite workspace'}
            groups={groups}
            searchPlaceholder="Filter navigation…"
            footer={<TwentyWorkspaceSwitcher />}
          />
          <main className="st-main">{children}</main>
        </div>
      </div>
    </SabcrmSettingsProvider>
  );
}

export default SabcrmSuiteFrame;
