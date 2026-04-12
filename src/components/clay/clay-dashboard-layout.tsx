'use client';

/**
 * ClayDashboardLayout — the shared Clay chrome used by every
 * authenticated SabNode route. Holds the topbar, sidebar, and
 * a main slot for route children.
 *
 * Reused by:
 *   - /home/layout.tsx
 *   - (later) /dashboard/layout.tsx — which will swap out the old
 *     AdminLayout in Phase 1 of the Clay rollout.
 */

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LuSearch,
  LuUserPlus,
  LuBell,
  LuEllipsis,
  LuLayoutDashboard,
  LuMessagesSquare,
  LuWorkflow,
  LuBriefcase,
  LuSettings,
  LuChevronDown,
  LuCalendar,
  LuRefreshCw,
  LuLogOut,
  LuUser,
  LuCircleHelp,
  LuKeyboard,
  LuSend,
  LuBot,
  LuMail,
  LuGlobe,
  LuSmartphone,
  LuPlus,
  LuLanguages,
  LuArrowLeft,
  LuUsers,
  LuInbox,
  LuBookCopy,
  LuPhone,
  LuGitBranch,
  LuShoppingBag,
  LuCreditCard,
  LuWebhook,
  LuBolt,
  LuActivity,
  LuServerCog,
  LuHash,
  LuPuzzle,
  LuReply,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import {
  ClayShell,
  ClaySidebar,
  ClayTopbar,
  ClayButton,
  ClayPromoCard,
  ClayUserCard,
  type ClayNavItem,
} from '@/components/clay';
import { useProject } from '@/context/project-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

/* ── types ──────────────────────────────────────────────────────── */

export type ClayLayoutUser = {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
};

export type ClayLayoutPlan = {
  name?: string | null;
  credits?: number;
};

export type ClayLayoutContext = 'sabnode' | 'wachat';

export interface ClayDashboardLayoutProps {
  user?: ClayLayoutUser;
  plan?: ClayLayoutPlan;
  /**
   * Which sidebar nav registry to render.
   * - `sabnode` (default) — top-level cross-app nav for /home
   * - `wachat` — WhatsApp module nav (Chat, Broadcasts, Templates, etc.)
   */
  context?: ClayLayoutContext;
  children: React.ReactNode;
}

/* ── nav registry ───────────────────────────────────────────────── */

type NavEntry = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  /** pathname prefixes that mark this item active */
  matches: string[];
};

const primaryNav: NavEntry[] = [
  {
    key: 'home',
    label: 'Home',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/home',
    matches: ['/home'],
  },
  {
    key: 'wachat',
    label: 'Wachat',
    icon: <LuMessagesSquare className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/chat',
    matches: [
      '/dashboard/chat',
      '/dashboard/broadcasts',
      '/dashboard/templates',
      '/dashboard/contacts',
      '/dashboard/wachat',
    ],
  },
  {
    key: 'sabflow',
    label: 'SabFlow',
    icon: <LuWorkflow className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow',
    matches: ['/dashboard/sabflow', '/dashboard/flow-builder', '/dashboard/flows'],
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: <LuBriefcase className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/leads',
    matches: ['/dashboard/crm'],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings',
    matches: ['/dashboard/settings', '/dashboard/profile', '/dashboard/team'],
  },
];

const appsNav: NavEntry[] = [
  {
    key: 'sabchat',
    label: 'SabChat',
    icon: (
      <span
        className="h-3 w-3 rounded-[4px]"
        style={{
          background: 'linear-gradient(135deg, #F9A8D4 0%, #C026D3 100%)',
        }}
      />
    ),
    href: '/dashboard/sabchat',
    matches: ['/dashboard/sabchat'],
  },
  {
    key: 'seo',
    label: 'SEO Suite',
    icon: (
      <span
        className="h-3 w-3 rounded-[4px]"
        style={{
          background: 'linear-gradient(135deg, #5EEAD4 0%, #0D9488 100%)',
        }}
      />
    ),
    href: '/dashboard/seo',
    matches: ['/dashboard/seo'],
  },
  {
    key: 'email',
    label: 'Email',
    icon: (
      <span
        className="h-3 w-3 rounded-[4px]"
        style={{
          background: 'linear-gradient(135deg, #BAE6FD 0%, #0284C7 100%)',
        }}
      />
    ),
    href: '/dashboard/email',
    matches: ['/dashboard/email'],
  },
  {
    key: 'sms',
    label: 'SMS',
    icon: (
      <span
        className="h-3 w-3 rounded-[4px]"
        style={{
          background: 'linear-gradient(135deg, #BEF264 0%, #65A30D 100%)',
        }}
      />
    ),
    href: '/dashboard/sms',
    matches: ['/dashboard/sms'],
  },
  {
    key: 'ad-manager',
    label: 'Ad Manager',
    icon: (
      <span
        className="h-3 w-3 rounded-[4px]"
        style={{
          background: 'linear-gradient(135deg, #C7D2FE 0%, #4F46E5 100%)',
        }}
      />
    ),
    href: '/dashboard/ad-manager',
    matches: ['/dashboard/ad-manager'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Wachat nav registry — loaded when context="wachat".
 *  Mirrors src/config/dashboard-config.ts `wachatMenuItems` but
 *  structured into the Clay sidebar's (primary + sub-groups) pattern.
 * ══════════════════════════════════════════════════════════════════ */

const wachatPrimary: NavEntry[] = [
  {
    key: 'wachat-overview',
    label: 'Overview',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/overview',
    matches: ['/dashboard/overview'],
  },
  {
    key: 'wachat-chat',
    label: 'Live Chat',
    icon: <LuInbox className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/chat',
    matches: ['/dashboard/chat'],
  },
  {
    key: 'wachat-contacts',
    label: 'Contacts',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/contacts',
    matches: ['/dashboard/contacts', '/dashboard/wachat/contacts'],
  },
  {
    key: 'wachat-broadcasts',
    label: 'Campaigns',
    icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/broadcasts',
    matches: ['/dashboard/broadcasts', '/dashboard/bulk'],
  },
  {
    key: 'wachat-templates',
    label: 'Templates',
    icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/templates',
    matches: ['/dashboard/templates', '/dashboard/canned-messages'],
  },
];

const wachatTools: NavEntry[] = [
  {
    key: 'wachat-flow-builder',
    label: 'Flow Builder',
    icon: <LuGitBranch className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/flow-builder',
    matches: ['/dashboard/flow-builder'],
  },
  {
    key: 'wachat-flows',
    label: 'Meta Flows',
    icon: <LuServerCog className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/flows',
    matches: ['/dashboard/flows'],
  },
  {
    key: 'wachat-catalog',
    label: 'Catalog',
    icon: <LuShoppingBag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/catalog',
    matches: ['/dashboard/catalog'],
  },
  {
    key: 'wachat-calls',
    label: 'Calls',
    icon: <LuPhone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/calls',
    matches: ['/dashboard/calls'],
  },
  {
    key: 'wachat-numbers',
    label: 'Numbers',
    icon: <LuHash className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/numbers',
    matches: ['/dashboard/numbers'],
  },
  {
    key: 'wachat-pay',
    label: 'WhatsApp Pay',
    icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/whatsapp-pay',
    matches: ['/dashboard/whatsapp-pay'],
  },
];

const wachatConfigure: NavEntry[] = [
  {
    key: 'wachat-integrations',
    label: 'Integrations',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/integrations',
    matches: ['/dashboard/integrations'],
  },
  {
    key: 'wachat-webhooks',
    label: 'Webhooks',
    icon: <LuWebhook className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/webhooks',
    matches: ['/dashboard/webhooks'],
  },
  {
    key: 'wachat-auto-reply',
    label: 'Auto Reply',
    icon: <LuReply className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/auto-reply',
    matches: ['/dashboard/auto-reply'],
  },
  {
    key: 'wachat-settings',
    label: 'Project Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings',
    matches: ['/dashboard/settings'],
  },
];

/**
 * Routes that should render without the Clay wachat container (no
 * padding, no max-width cap, no `overflow-y-auto` on main). Pages
 * like Live Chat and the flow-builder canvas manage their own
 * scrolling and need the full panel height to work properly.
 *
 * IMPORTANT: `/dashboard/flow-builder` (the LIST) and
 * `/dashboard/flow-builder/docs` stay padded — only the canvas
 * routes `/dashboard/flow-builder/<flowId>` are full-bleed.
 */
const FULL_BLEED_PREFIXES = [
  '/dashboard/chat',
  '/dashboard/sabflow',
];

function isFullBleed(pathname: string | null): boolean {
  if (!pathname) return false;

  // Flow-builder canvas — only sub-routes, and never /docs
  const fb = pathname.match(/^\/dashboard\/flow-builder\/([^/]+)/);
  if (fb && fb[1] !== 'docs') return true;

  return FULL_BLEED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

function useActiveKey(context: ClayLayoutContext = 'sabnode'): string {
  const pathname = usePathname() || '';
  const registry =
    context === 'wachat'
      ? [wachatPrimary, wachatTools, wachatConfigure]
      : [primaryNav, appsNav];
  // Longest-match wins so /dashboard/settings doesn't match /dashboard first
  let bestKey = context === 'wachat' ? 'wachat-chat' : 'home';
  let bestLen = 0;
  for (const group of registry) {
    for (const item of group) {
      for (const m of item.matches) {
        if (pathname.startsWith(m) && m.length > bestLen) {
          bestLen = m.length;
          bestKey = item.key;
        }
      }
    }
  }
  return bestKey;
}

/* ── layout ─────────────────────────────────────────────────────── */

export function ClayDashboardLayout({
  user,
  plan,
  context = 'sabnode',
  children,
}: ClayDashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = useActiveKey(context);
  const fullBleed = isFullBleed(pathname);

  /* ── Command palette state (Cmd+K / Ctrl+K) ── */
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /** Jump helper — closes search and navigates */
  const jump = React.useCallback(
    (href: string) => {
      setSearchOpen(false);
      router.push(href);
    },
    [router],
  );

  /** Refresh — refetches the current route's server data */
  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const toNavItem = React.useCallback(
    (entry: NavEntry): ClayNavItem => ({
      key: entry.key,
      label: entry.label,
      icon: entry.icon,
      href: entry.href,
      active: entry.key === activeKey,
    }),
    [activeKey],
  );

  const currentDate = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );

  const planName = plan?.name ?? null;
  const credits = plan?.credits ?? 0;
  const isPaidPlan = planName !== null && planName.toLowerCase() !== 'free';

  return (
    <ClayShell className="flex flex-col">
      {/* ── TOPBAR ── */}
      <ClayTopbar
        left={
          <>
            <BrandGlyph />
            <div className="ml-3 flex items-center gap-2">
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                onClick={() => setSearchOpen(true)}
              >
                Search
              </ClayButton>
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuUserPlus className="h-3.5 w-3.5" strokeWidth={2} />}
                onClick={() => router.push('/dashboard/wachat/contacts')}
              >
                Add contact
              </ClayButton>
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuBell className="h-3.5 w-3.5" strokeWidth={2} />}
                onClick={() => router.push('/dashboard/notifications')}
              >
                Notifications
              </ClayButton>

              {/* More (…) dropdown — workspace shortcuts */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ClayButton variant="pill" size="icon" aria-label="More">
                    <LuEllipsis className="h-4 w-4" />
                  </ClayButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => router.push('/dashboard/settings')}>
                    <LuSettings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push('/dashboard/team')}>
                    <LuUserPlus className="mr-2 h-4 w-4" /> Team
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push('/dashboard/integrations')}>
                    <LuPlus className="mr-2 h-4 w-4" /> Integrations
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                    <LuUser className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => window.open('https://docs.sabnode.com', '_blank')}
                  >
                    <LuCircleHelp className="mr-2 h-4 w-4" /> Help & docs
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSearchOpen(true)}>
                    <LuKeyboard className="mr-2 h-4 w-4" /> Keyboard shortcuts
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => (window.location.href = '/logout')}
                    className="text-clay-red focus:text-clay-red"
                  >
                    <LuLogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
        right={
          <>
            {/* Language dropdown (placeholder — real i18n not wired) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ClayButton
                  variant="pill"
                  size="sm"
                  trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
                >
                  En
                </ClayButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <LuLanguages className="mr-1 inline h-3.5 w-3.5" /> Language
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  English (default)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  हिन्दी · Hindi
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  Español · Spanish
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  Français · French
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date pill — click to refresh server data */}
            <ClayButton
              variant="pill"
              size="sm"
              leading={<LuCalendar className="h-3.5 w-3.5" strokeWidth={2} />}
              trailing={<LuRefreshCw className="h-3 w-3 opacity-60" />}
              onClick={refresh}
              aria-label="Refresh data"
            >
              {currentDate}
            </ClayButton>

            {/* Create dropdown — one-click entry into every creator */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ClayButton
                  variant="obsidian"
                  size="md"
                  className="px-5"
                  trailing={<LuChevronDown className="h-3.5 w-3.5 opacity-70" />}
                >
                  Create
                </ClayButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Create new</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/dashboard/broadcasts')}>
                  <LuSend className="mr-2 h-4 w-4" /> WhatsApp broadcast
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/sabflow')}>
                  <LuWorkflow className="mr-2 h-4 w-4" /> SabFlow automation
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push('/dashboard/crm/sales-crm/leads')}
                >
                  <LuBriefcase className="mr-2 h-4 w-4" /> CRM lead
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/templates')}>
                  <LuMessagesSquare className="mr-2 h-4 w-4" /> Message template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/dashboard/email')}>
                  <LuMail className="mr-2 h-4 w-4" /> Email campaign
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/sms')}>
                  <LuSmartphone className="mr-2 h-4 w-4" /> SMS campaign
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/sabchat')}>
                  <LuBot className="mr-2 h-4 w-4" /> SabChat bot
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/seo')}>
                  <LuGlobe className="mr-2 h-4 w-4" /> SEO project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Command palette — jump to any module from anywhere */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Jump to…  broadcasts, CRM, flows, SMS, SEO" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Primary">
            <CommandItem onSelect={() => jump('/home')}>
              <LuLayoutDashboard className="mr-2 h-4 w-4" /> Home
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/chat')}>
              <LuMessagesSquare className="mr-2 h-4 w-4" /> Wachat Chat
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/broadcasts')}>
              <LuSend className="mr-2 h-4 w-4" /> Broadcasts
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/sabflow')}>
              <LuWorkflow className="mr-2 h-4 w-4" /> SabFlow
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/crm/sales-crm/leads')}>
              <LuBriefcase className="mr-2 h-4 w-4" /> CRM
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Apps">
            <CommandItem onSelect={() => jump('/dashboard/sabchat')}>
              <LuBot className="mr-2 h-4 w-4" /> SabChat
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/seo')}>
              <LuGlobe className="mr-2 h-4 w-4" /> SEO Suite
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/email')}>
              <LuMail className="mr-2 h-4 w-4" /> Email
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/sms')}>
              <LuSmartphone className="mr-2 h-4 w-4" /> SMS
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/ad-manager')}>
              <LuSend className="mr-2 h-4 w-4" /> Ad Manager
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem onSelect={() => jump('/dashboard/notifications')}>
              <LuBell className="mr-2 h-4 w-4" /> Notifications
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/billing')}>
              <LuBriefcase className="mr-2 h-4 w-4" /> Billing &amp; credits
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/profile')}>
              <LuUser className="mr-2 h-4 w-4" /> Profile
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/settings')}>
              <LuSettings className="mr-2 h-4 w-4" /> Settings
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* ── BODY ── */}
      <div className="flex min-h-0 flex-1">
        <ClaySidebar
          groupTitle={context === 'wachat' ? 'Wachat' : 'SabNode'}
          brand={context === 'wachat' ? <ClayWachatBrand /> : undefined}
          groups={
            context === 'wachat'
              ? [
                  { items: wachatPrimary.map(toNavItem) },
                  {
                    title: 'Tools',
                    addable: false,
                    items: wachatTools.map(toNavItem),
                  },
                  {
                    title: 'Configure',
                    addable: true,
                    onAdd: () => router.push('/dashboard/integrations'),
                    items: wachatConfigure.map(toNavItem),
                  },
                ]
              : [
                  { items: primaryNav.map(toNavItem) },
                  {
                    title: 'Apps',
                    addable: true,
                    onAdd: () => router.push('/dashboard/integrations'),
                    items: appsNav.map(toNavItem),
                  },
                ]
          }
          footer={
            <>
              {isPaidPlan ? (
                <ClayPromoCard
                  title={`You're on ${planName}!`}
                  description="Enjoy advanced features, higher limits, and priority support."
                  discountLabel={`${credits.toLocaleString()} credits`}
                  discountNote="available now"
                  ctaLabel="Manage billing"
                  onCtaClick={() => router.push('/dashboard/billing')}
                />
              ) : (
                <ClayPromoCard
                  title="Upgrade to PRO"
                  description="Unlock unlimited broadcasts, SabFlow, and premium support."
                  discountLabel="-50%"
                  discountNote="for the first month"
                  ctaLabel="Explore PRO plans"
                  onCtaClick={() => router.push('/dashboard/billing')}
                />
              )}
              <ClayUserCard
                name={user?.name || 'SabNode user'}
                email={user?.email || undefined}
                avatarSrc={user?.avatar || undefined}
                onMenuClick={() => router.push('/dashboard/profile')}
              />
            </>
          }
        />

        <main
          className={cn(
            'min-w-0 flex-1',
            // Default: page handles its own scroll, container provides gutters
            !fullBleed && 'overflow-y-auto',
            // Full-bleed: page fills the panel edge-to-edge, manages own scroll
            fullBleed && 'flex h-full min-h-0 overflow-hidden',
            // Wachat pages get generous consistent padding by default.
            // Page content uses the FULL available width (no max-width cap)
            // so tables and cards don't look shrink-wrapped on wide screens.
            context === 'wachat' && !fullBleed && 'px-10 pt-8 pb-12',
          )}
        >
          {fullBleed ? (
            // Full-bleed: children get 100% width AND 100% height
            <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
              {children}
            </div>
          ) : context === 'wachat' ? (
            // Wachat pages: full width, min-full-height so cards can grow
            // and footers hit the panel bottom even when content is short.
            // Each page's root <div> owns its own clay-enter animation
            // cascade so staggered child reveals keep working.
            <div className="flex min-h-full w-full flex-col">{children}</div>
          ) : (
            children
          )}
        </main>
      </div>
    </ClayShell>
  );
}

/* ── brand glyph ────────────────────────────────────────────────── */

function BrandGlyph() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-clay-border bg-clay-surface shadow-clay-xs">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-clay-ink"
        aria-hidden
      >
        <path d="M3 3v10h3" />
        <path d="M3 3h10v4a2 2 0 0 1-2 2H8" />
        <path d="M13 13H8a2 2 0 0 1-2-2V9" />
      </svg>
    </div>
  );
}

/* ── Wachat sidebar brand — back-link + project switcher dropdown ── */

function ClayWachatBrand() {
  const router = useRouter();
  const { projects, activeProject, setActiveProjectId } = useProject();

  const onSelect = React.useCallback(
    (id: string) => {
      setActiveProjectId(id);
      try {
        localStorage.setItem('activeProjectId', id);
      } catch {
        /* ignore quota errors */
      }
    },
    [setActiveProjectId],
  );

  return (
    <div className="flex flex-col gap-2.5">
      {/* Back to Apps */}
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>

      {/* Project switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-[12px] border border-clay-border bg-clay-surface px-2.5 py-2 text-left hover:border-clay-border-strong hover:bg-clay-surface-2 transition-colors"
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-[8px] text-[10.5px] font-semibold uppercase',
                activeProject
                  ? 'bg-clay-rose-soft text-clay-rose-ink'
                  : 'bg-clay-bg-2 text-clay-ink-muted',
              )}
            >
              {(activeProject?.name || '—').slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] uppercase tracking-wide text-clay-ink-fade font-medium">
                Project
              </span>
              <span className="block truncate text-[12.5px] font-semibold text-clay-ink leading-tight">
                {activeProject?.name || 'Select a project'}
              </span>
            </span>
            <LuChevronDown
              className="h-3.5 w-3.5 shrink-0 text-clay-ink-fade"
              strokeWidth={2}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[216px]"
          sideOffset={6}
        >
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects.length === 0 ? (
            <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
          ) : (
            projects.slice(0, 10).map((p) => {
              const id = p._id.toString();
              const isActive = activeProject?._id?.toString() === id;
              return (
                <DropdownMenuItem
                  key={id}
                  onSelect={() => onSelect(id)}
                  className={cn(isActive && 'bg-clay-rose-soft/50')}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-clay-rose-soft text-[9px] font-semibold uppercase text-clay-rose-ink mr-2">
                    {(p.name || '?').slice(0, 2)}
                  </span>
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              );
            })
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push('/dashboard')}>
            <LuPlus className="mr-2 h-4 w-4" />
            Browse all projects
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
