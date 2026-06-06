'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlignLeft,
  BarChart3,
  ClipboardList,
  Filter,
  Inbox,
  LayoutDashboard,
  List,
  Mail,
  Network,
  Send,
  Settings,
  ShieldCheck,
  SquarePen,
  Tag,
  User,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react';
import { Badge, Skeleton } from '@/components/sabcrm/20ui/compat';
import { ModuleLayout } from '@/components/zoruui-domain/module-layout';
import type { WithId, EmailSettings } from '@/lib/definitions';
import { getEmailSettings } from '@/app/actions/email.actions';
import { EmailSidebar, type EmailSidebarItem } from './email-sidebar';
import { EmailAccountSwitcher } from './email-account-switcher';
import { EmailContextBar } from './email-context-bar';

interface EmailSuiteLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS: EmailSidebarItem[] = [
  { href: '/dashboard/email',                 label: 'Overview',       icon: LayoutDashboard },
  {
    href: '/dashboard/email/audience',        label: 'Audience',       icon: Users,
    children: [
      { href: '/dashboard/email/audience',          label: 'Subscribers', icon: User },
      { href: '/dashboard/email/audience/lists',    label: 'Lists',       icon: List },
      { href: '/dashboard/email/audience/segments', label: 'Segments',    icon: Filter },
      { href: '/dashboard/email/audience/tags',     label: 'Tags',        icon: Tag },
      { href: '/dashboard/email/audience/fields',   label: 'Fields',      icon: AlignLeft },
      { href: '/dashboard/email/audience/signup',   label: 'Signup Forms', icon: UserPlus },
    ],
  },
  { href: '/dashboard/email/campaigns',       label: 'Campaigns',      icon: Send },
  { href: '/dashboard/email/journeys',        label: 'Journeys',       icon: Workflow },
  { href: '/dashboard/email/templates',       label: 'Templates',      icon: SquarePen },
  { href: '/dashboard/email/forms',           label: 'Forms',          icon: ClipboardList },
  { href: '/dashboard/sabmail/inbox',           label: 'Inbox',          icon: Inbox },
  { href: '/dashboard/email/reports',         label: 'Reports',        icon: BarChart3 },
  { href: '/dashboard/email/deliverability',  label: 'Deliverability', icon: ShieldCheck },
  { href: '/dashboard/email/integrations',    label: 'Integrations',   icon: Network },
  { href: '/dashboard/email/settings',        label: 'Settings',       icon: Settings },
];

export function EmailSuiteLayout({ children }: EmailSuiteLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentAccountId = searchParams.get('accountId');

  const [accounts, setAccounts] = useState<WithId<EmailSettings>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const data = await getEmailSettings();
      if (cancelled) return;
      setAccounts(data);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const activeAccount = currentAccountId
    ? accounts.find(a => a._id.toString() === currentAccountId)
    : undefined;

  const handleAccountChange = (newAccountId: string) => {
    if (newAccountId === 'back_to_list') {
      router.push('/dashboard/email');
      return;
    }
    if (newAccountId === 'connect_new') {
      router.push('/dashboard/email/settings?view=connect');
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('accountId', newAccountId);
    router.push(`${pathname}?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="flex gap-6 h-full">
        <Skeleton className="w-64 h-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // No account selected → render the children stripped of the account-scoped chrome.
  // Pages outside the per-account workflow (e.g. the overview account picker) own
  // their own framing.
  if (!activeAccount) {
    return (
      <div className="h-full">
        <EmailContextBar
          title="Email Suite"
          icon={Mail}
          right={
            accounts.length > 0
              ? <Badge variant="outline">{accounts.length} account{accounts.length === 1 ? '' : 's'}</Badge>
              : null
          }
        />
        <div className="p-4">{children}</div>
      </div>
    );
  }

  return (
    <ModuleLayout
      sidebar={
        <div className="flex flex-col h-full gap-4 py-2">
          <EmailAccountSwitcher
            accounts={accounts}
            activeAccount={activeAccount}
            onChange={handleAccountChange}
          />
          <EmailSidebar items={NAV_ITEMS} accountId={activeAccount._id.toString()} />
        </div>
      }
    >
      <div className="flex flex-col gap-6 min-h-full">
        <EmailContextBar
          title={activeAccount.fromName ?? 'Email account'}
          subtitle={activeAccount.fromEmail}
          icon={Activity}
        />
        <div>{children}</div>
      </div>
    </ModuleLayout>
  );
}
