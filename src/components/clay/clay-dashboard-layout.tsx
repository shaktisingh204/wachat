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
  LuMegaphone,
  LuTarget,
  LuImage,
  LuChartBar,
  LuFileText,
  LuZap,
  LuFlaskConical,
  LuPackage,
  LuScanLine,
  LuRadar,
  LuListChecks,
  LuReceipt,
  LuWrench,
  LuSplit,
  LuTrendingUp,
  LuEye,
  LuMousePointerClick,
  LuFacebook,
  LuInstagram,
  LuSquarePen,
  LuCalendarClock,
  LuRadio,
  LuMessageCircle,
  LuColumns3,
  LuShoppingCart,
  LuStore,
  LuMap,
  LuCalendarDays,
  LuContact,
  LuStar,
  LuImagePlay,
  LuMessageSquareDashed,
  LuShieldCheck,
  LuClapperboard,
  LuCirclePlay,
  LuUserCheck,
  LuQrCode,
  LuKey,
  LuBookmark,
  LuUserCog,
  LuTag,
  LuClock,
  LuStickyNote,
  LuFileDown,
  LuShield,
  LuGroup,
  LuBan,
  LuMessageSquareQuote,
  LuBrainCircuit,
  LuStarHalf,
  LuLink2,
  LuListFilter,
  LuFolderOpen,
  LuLink,
  LuEarth,
  LuLayoutTemplate,
  LuMessageSquare,
  LuPin,
  LuSlidersHorizontal,
  LuCloud,
  LuDatabase,
  LuBanknote,
  LuFileSpreadsheet,
  LuCalculator,
  LuWallet,
  LuCoins,
  LuNetwork,
  LuLayers,
  LuReceiptText,
  LuUmbrella,
  LuAward,
  LuClipboardList,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import {
  ClayShell,
  ClaySidebar,
  ClayTopbar,
  ClayButton,
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

export type ClayLayoutContext =
  | 'sabnode'
  | 'wachat'
  | 'meta-suite'
  | 'instagram'
  | 'ad-manager'
  | 'sabflow'
  | 'telegram'
  | 'url-shortener'
  | 'qr-code-maker'
  | 'team'
  | 'crm'
  | 'hrm'
  | 'settings';

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
    href: '/dashboard',
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
    href: '/dashboard/crm',
    matches: ['/dashboard/crm'],
  },
  {
    key: 'hrm',
    label: 'HRM',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm',
    matches: ['/dashboard/hrm'],
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
    icon: <LuBot className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabchat',
    matches: ['/dashboard/sabchat'],
  },
  {
    key: 'seo',
    label: 'SEO Suite',
    icon: <LuGlobe className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/seo',
    matches: ['/dashboard/seo'],
  },
  {
    key: 'email',
    label: 'Email',
    icon: <LuMail className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/email',
    matches: ['/dashboard/email'],
  },
  {
    key: 'sms',
    label: 'SMS',
    icon: <LuSmartphone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sms',
    matches: ['/dashboard/sms'],
  },
  {
    key: 'ad-manager',
    label: 'Ad Manager',
    icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/ad-manager/ad-accounts',
    matches: ['/dashboard/ad-manager'],
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/telegram',
    matches: ['/dashboard/telegram'],
  },
  {
    key: 'meta-suite',
    label: 'Meta Suite',
    icon: <LuFacebook className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/facebook/all-projects',
    matches: ['/dashboard/facebook', '/dashboard/meta-suite'],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: <LuInstagram className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/instagram/connections',
    matches: ['/dashboard/instagram'],
  },
  {
    key: 'templates',
    label: 'Templates',
    icon: <LuLayoutTemplate className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/templates',
    matches: ['/dashboard/templates'],
  },
  {
    key: 'ecommerce',
    label: 'E-commerce',
    icon: <LuShoppingBag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/shop',
    matches: ['/dashboard/shop'],
  },
  {
    key: 'url-shortener',
    label: 'URL Shortener',
    icon: <LuLink className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/url-shortener',
    matches: ['/dashboard/url-shortener'],
  },
  {
    key: 'qr-codes',
    label: 'QR Codes',
    icon: <LuQrCode className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/qr-code-maker',
    matches: ['/dashboard/qr-code-maker'],
  },
  {
    key: 'website-builder',
    label: 'Website Builder',
    icon: <LuEarth className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/website-builder',
    matches: ['/dashboard/website-builder'],
  },
  {
    key: 'team',
    label: 'Team',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team',
    matches: ['/dashboard/team'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: <LuBell className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/notifications',
    matches: ['/dashboard/notifications'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Wachat nav registry — loaded when context="wachat".
 *  Mirrors src/config/dashboard-config.ts `wachatMenuItems` but
 *  structured into the Clay sidebar's (primary + sub-groups) pattern.
 * ══════════════════════════════════════════════════════════════════ */

/* ── Primary: Core messaging & outreach ── */
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

/* ── Automate: Flow builders, auto-reply, bots ── */
const wachatAutomate: NavEntry[] = [
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
    key: 'wachat-auto-reply',
    label: 'Auto Reply',
    icon: <LuReply className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/auto-reply',
    matches: ['/dashboard/auto-reply'],
  },
  {
    key: 'wachat-auto-reply-rules',
    label: 'Reply Rules',
    icon: <LuListFilter className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/auto-reply-rules',
    matches: ['/dashboard/auto-reply-rules'],
  },
  {
    key: 'wachat-chatbot',
    label: 'Chatbot',
    icon: <LuBrainCircuit className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/chatbot',
    matches: ['/dashboard/chatbot'],
  },
  {
    key: 'wachat-automation',
    label: 'Conversational AI',
    icon: <LuBot className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/automation',
    matches: ['/dashboard/automation'],
  },
  {
    key: 'wachat-scheduled-messages',
    label: 'Scheduled Messages',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/scheduled-messages',
    matches: ['/dashboard/scheduled-messages'],
  },
];

/* ── Grow: Commerce, payments, links, QR ── */
const wachatGrow: NavEntry[] = [
  {
    key: 'wachat-catalog',
    label: 'Catalog',
    icon: <LuShoppingBag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/catalog',
    matches: ['/dashboard/catalog'],
  },
  {
    key: 'wachat-pay',
    label: 'WhatsApp Pay',
    icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/whatsapp-pay',
    matches: ['/dashboard/whatsapp-pay'],
  },
  {
    key: 'wachat-qr-codes',
    label: 'QR Codes',
    icon: <LuQrCode className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/qr-codes',
    matches: ['/dashboard/qr-codes'],
  },
  {
    key: 'wachat-analytics',
    label: 'Analytics',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/analytics',
    matches: ['/dashboard/analytics'],
  },
  { key: 'wachat-template-analytics', label: 'Template Analytics', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/template-analytics', matches: ['/dashboard/template-analytics'] },
  { key: 'wachat-message-analytics', label: 'Message Stats', icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/message-analytics', matches: ['/dashboard/message-analytics'] },
  { key: 'wachat-broadcast-segments', label: 'Segments', icon: <LuGroup className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/broadcast-segments', matches: ['/dashboard/broadcast-segments'] },
  { key: 'wachat-chat-labels', label: 'Chat Labels', icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/chat-labels', matches: ['/dashboard/chat-labels'] },
  { key: 'wachat-contact-groups', label: 'Contact Groups', icon: <LuFolderOpen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-groups', matches: ['/dashboard/contact-groups'] },
  { key: 'wachat-saved-replies', label: 'Saved Replies', icon: <LuMessageSquareQuote className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/saved-replies', matches: ['/dashboard/saved-replies'] },
  { key: 'wachat-media-library', label: 'Media Library', icon: <LuImage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/media-library', matches: ['/dashboard/media-library'] },
  { key: 'wachat-link-tracking', label: 'Link Tracking', icon: <LuLink2 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/link-tracking', matches: ['/dashboard/link-tracking'] },
  { key: 'wachat-chat-ratings', label: 'Chat Ratings', icon: <LuStarHalf className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/chat-ratings', matches: ['/dashboard/chat-ratings'] },
  { key: 'wachat-customer-satisfaction', label: 'Satisfaction', icon: <LuStarHalf className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/customer-satisfaction', matches: ['/dashboard/customer-satisfaction'] },
  { key: 'wachat-response-tracker', label: 'Response Times', icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/response-time-tracker', matches: ['/dashboard/response-time-tracker'] },
  { key: 'wachat-delivery-reports', label: 'Delivery Reports', icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/delivery-reports', matches: ['/dashboard/delivery-reports'] },
  { key: 'wachat-message-stats', label: 'Message Statistics', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/message-statistics', matches: ['/dashboard/message-statistics'] },
  { key: 'wachat-credit-usage', label: 'Credit Usage', icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/credit-usage', matches: ['/dashboard/credit-usage'] },
  { key: 'wachat-broadcast-history', label: 'Broadcast History', icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/broadcast-history', matches: ['/dashboard/broadcast-history'] },
  { key: 'wachat-broadcast-scheduler', label: 'Broadcast Scheduler', icon: <LuCalendar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/broadcast-scheduler', matches: ['/dashboard/broadcast-scheduler'] },
  { key: 'wachat-campaign-ab', label: 'A/B Test', icon: <LuSplit className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/campaign-ab-test', matches: ['/dashboard/campaign-ab-test'] },
  { key: 'wachat-wa-link-gen', label: 'Link Generator', icon: <LuLink2 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/whatsapp-link-generator', matches: ['/dashboard/whatsapp-link-generator'] },
  { key: 'wachat-bulk-messaging', label: 'Bulk Messaging', icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/bulk-messaging', matches: ['/dashboard/bulk-messaging'] },
];

/* ── Configure: Account, phone numbers, dev tools, project settings ── */
const wachatConfigure: NavEntry[] = [
  {
    key: 'wachat-numbers',
    label: 'Numbers',
    icon: <LuHash className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/numbers',
    matches: ['/dashboard/numbers'],
  },
  {
    key: 'wachat-calls',
    label: 'Calls',
    icon: <LuPhone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/calls',
    matches: ['/dashboard/calls'],
  },
  {
    key: 'wachat-health',
    label: 'Account Health',
    icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/health',
    matches: ['/dashboard/health'],
  },
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
    key: 'wachat-general-settings',
    label: 'General Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/general',
    matches: ['/dashboard/settings/general', '/dashboard/settings'],
  },
  {
    key: 'wachat-agents',
    label: 'Agents & Roles',
    icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/agents',
    matches: ['/dashboard/settings/agents'],
  },
  {
    key: 'wachat-attributes',
    label: 'User Attributes',
    icon: <LuKey className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/attributes',
    matches: ['/dashboard/settings/attributes'],
  },
  {
    key: 'wachat-canned',
    label: 'Canned Messages',
    icon: <LuBookmark className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/canned',
    matches: ['/dashboard/settings/canned'],
  },
  { key: 'wachat-business-hours', label: 'Business Hours', icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/business-hours', matches: ['/dashboard/business-hours'] },
  { key: 'wachat-opt-out', label: 'Opt-Out / DND', icon: <LuBan className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/opt-out', matches: ['/dashboard/opt-out'] },
  { key: 'wachat-blocked', label: 'Blocked Contacts', icon: <LuShield className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/blocked-contacts', matches: ['/dashboard/blocked-contacts'] },
  { key: 'wachat-team-perf', label: 'Team Performance', icon: <LuUserPlus className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/team-performance', matches: ['/dashboard/team-performance'] },
  { key: 'wachat-assignments', label: 'Assignments', icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/assignments', matches: ['/dashboard/assignments'] },
  { key: 'wachat-contact-notes', label: 'Contact Notes', icon: <LuStickyNote className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-notes', matches: ['/dashboard/contact-notes'] },
  { key: 'wachat-chat-export', label: 'Chat Export', icon: <LuFileDown className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/chat-export', matches: ['/dashboard/chat-export'] },
  { key: 'wachat-greeting', label: 'Greeting Message', icon: <LuMessageSquareQuote className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/greeting-messages', matches: ['/dashboard/greeting-messages'] },
  { key: 'wachat-away', label: 'Away Message', icon: <LuMessageSquareQuote className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/away-messages', matches: ['/dashboard/away-messages'] },
  { key: 'wachat-blacklist', label: 'Blacklist', icon: <LuBan className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-blacklist', matches: ['/dashboard/contact-blacklist'] },
  { key: 'wachat-notif-prefs', label: 'Notifications', icon: <LuBell className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/notification-preferences', matches: ['/dashboard/notification-preferences'] },
  { key: 'wachat-msg-tags', label: 'Message Tags', icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/message-tags', matches: ['/dashboard/message-tags'] },
  { key: 'wachat-import-history', label: 'Import History', icon: <LuFileDown className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-import-history', matches: ['/dashboard/contact-import-history'] },
  { key: 'wachat-conv-filters', label: 'Filters', icon: <LuListFilter className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/conversation-filters', matches: ['/dashboard/conversation-filters'] },
  { key: 'wachat-api-keys', label: 'API Keys', icon: <LuKey className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/api-keys', matches: ['/dashboard/api-keys'] },
  { key: 'wachat-agent-avail', label: 'Agent Status', icon: <LuUserPlus className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/agent-availability', matches: ['/dashboard/agent-availability'] },
  { key: 'wachat-phone-settings', label: 'Phone Settings', icon: <LuSmartphone className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/phone-number-settings', matches: ['/dashboard/phone-number-settings'] },
  { key: 'wachat-qr-cats', label: 'Reply Categories', icon: <LuFolderOpen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/quick-reply-categories', matches: ['/dashboard/quick-reply-categories'] },
  { key: 'wachat-webhook-logs', label: 'Webhook Logs', icon: <LuWebhook className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/webhook-logs', matches: ['/dashboard/webhook-logs'] },
  { key: 'wachat-conv-search', label: 'Search Chats', icon: <LuSearch className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/conversation-search', matches: ['/dashboard/conversation-search'] },
  { key: 'wachat-conv-kanban', label: 'Kanban Board', icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/conversation-kanban', matches: ['/dashboard/conversation-kanban'] },
  { key: 'wachat-conv-summary', label: 'Summaries', icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/conversation-summary', matches: ['/dashboard/conversation-summary'] },
  { key: 'wachat-contact-merge', label: 'Merge Contacts', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-merge', matches: ['/dashboard/contact-merge'] },
  { key: 'wachat-contact-timeline', label: 'Timeline', icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-timeline', matches: ['/dashboard/contact-timeline'] },
  { key: 'wachat-chat-transfer', label: 'Transfer Chat', icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/chat-transfer', matches: ['/dashboard/chat-transfer'] },
  { key: 'wachat-tpl-library', label: 'Template Library', icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/message-templates-library', matches: ['/dashboard/message-templates-library'] },
  { key: 'wachat-tpl-builder', label: 'Template Builder', icon: <LuSquarePen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/template-builder', matches: ['/dashboard/template-builder'] },
  { key: 'wachat-interactive', label: 'Interactive Msgs', icon: <LuSmartphone className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/interactive-messages', matches: ['/dashboard/interactive-messages'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Ad Manager nav registry — loaded when context="ad-manager".
 *  Dedicated sidebar for Meta Ads Manager (campaigns, audiences,
 *  pixels, insights, etc.). Separate from Meta Suite.
 * ══════════════════════════════════════════════════════════════════ */

const admPrimary: NavEntry[] = [
  { key: 'adm-overview', label: 'Overview', icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager', matches: ['/dashboard/ad-manager'] },
  { key: 'adm-insights', label: 'Performance', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/insights', matches: ['/dashboard/ad-manager/insights'] },
  { key: 'adm-reports', label: 'Reports', icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/reports', matches: ['/dashboard/ad-manager/reports'] },
];

const admAdvertise: NavEntry[] = [
  { key: 'adm-campaigns', label: 'Campaigns', icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/campaigns', matches: ['/dashboard/ad-manager/campaigns'] },
  { key: 'adm-adsets', label: 'Ad Sets', icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ad-sets', matches: ['/dashboard/ad-manager/ad-sets'] },
  { key: 'adm-ads', label: 'Ads', icon: <LuMousePointerClick className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ads', matches: ['/dashboard/ad-manager/ads'] },
  { key: 'adm-bulk', label: 'Bulk Editor', icon: <LuListChecks className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/bulk-editor', matches: ['/dashboard/ad-manager/bulk-editor'] },
  { key: 'adm-split', label: 'A/B Tests', icon: <LuSplit className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/split-tests', matches: ['/dashboard/ad-manager/split-tests'] },
  { key: 'adm-calendar', label: 'Calendar', icon: <LuCalendar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/calendar', matches: ['/dashboard/ad-manager/calendar'] },
  { key: 'adm-compare', label: 'Compare', icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/compare', matches: ['/dashboard/ad-manager/compare'] },
  { key: 'adm-budget', label: 'Budget Optimizer', icon: <LuTrendingUp className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/budget-optimizer', matches: ['/dashboard/ad-manager/budget-optimizer'] },
  { key: 'adm-previews', label: 'Ad Previews', icon: <LuEye className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ad-previews', matches: ['/dashboard/ad-manager/ad-previews'] },
  { key: 'adm-funnel', label: 'Conversion Funnel', icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/conversion-funnel', matches: ['/dashboard/ad-manager/conversion-funnel'] },
];

const admCreative: NavEntry[] = [
  { key: 'adm-creative', label: 'Creative Library', icon: <LuImage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/creative-library', matches: ['/dashboard/ad-manager/creative-library'] },
  { key: 'adm-ai-lab', label: 'AI Creative Lab', icon: <LuFlaskConical className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ai-lab', matches: ['/dashboard/ad-manager/ai-lab'] },
  { key: 'adm-catalogs', label: 'Product Catalogs', icon: <LuPackage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/catalogs', matches: ['/dashboard/ad-manager/catalogs'] },
  { key: 'adm-rules', label: 'Automated Rules', icon: <LuZap className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/automated-rules', matches: ['/dashboard/ad-manager/automated-rules'] },
];

const admAudiences: NavEntry[] = [
  { key: 'adm-audiences', label: 'Audiences', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/audiences', matches: ['/dashboard/ad-manager/audiences'] },
  { key: 'adm-customer-lists', label: 'Customer Lists', icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/customer-lists', matches: ['/dashboard/ad-manager/customer-lists'] },
  { key: 'adm-lead-forms', label: 'Lead Forms', icon: <LuInbox className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/lead-forms', matches: ['/dashboard/ad-manager/lead-forms'] },
];

const admMeasurement: NavEntry[] = [
  { key: 'adm-pixels', label: 'Pixels & Datasets', icon: <LuScanLine className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/pixels', matches: ['/dashboard/ad-manager/pixels'] },
  { key: 'adm-events', label: 'Events Manager', icon: <LuRadar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/events-manager', matches: ['/dashboard/ad-manager/events-manager'] },
  { key: 'adm-conversions', label: 'Custom Conversions', icon: <LuTrendingUp className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/custom-conversions', matches: ['/dashboard/ad-manager/custom-conversions'] },
  { key: 'adm-capi', label: 'Conversions API', icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/capi', matches: ['/dashboard/ad-manager/capi'] },
];

const admSettings: NavEntry[] = [
  { key: 'adm-accounts', label: 'Ad Accounts', icon: <LuServerCog className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ad-accounts', matches: ['/dashboard/ad-manager/ad-accounts'] },
  { key: 'adm-billing', label: 'Billing', icon: <LuReceipt className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/billing', matches: ['/dashboard/ad-manager/billing'] },
  { key: 'adm-settings', label: 'Settings', icon: <LuWrench className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/settings', matches: ['/dashboard/ad-manager/settings'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Meta Suite nav registry — loaded when context="meta-suite".
 *  Facebook pages, posts, messaging, broadcasts, subscribers,
 *  commerce + Instagram feed, stories, reels, DMs.
 * ══════════════════════════════════════════════════════════════════ */

const metaFbPrimary: NavEntry[] = [
  { key: 'ms-dashboard', label: 'Dashboard', icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook', matches: ['/dashboard/facebook'] },
  { key: 'ms-projects', label: 'Pages & Projects', icon: <LuGlobe className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/all-projects', matches: ['/dashboard/facebook/all-projects', '/dashboard/facebook/pages'] },
];

const metaFbContent: NavEntry[] = [
  { key: 'ms-posts', label: 'Posts', icon: <LuSquarePen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/posts', matches: ['/dashboard/facebook/posts', '/dashboard/facebook/create-post'] },
  { key: 'ms-scheduled', label: 'Scheduled', icon: <LuCalendarClock className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/scheduled', matches: ['/dashboard/facebook/scheduled'] },
  { key: 'ms-calendar', label: 'Calendar', icon: <LuCalendar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/calendar', matches: ['/dashboard/facebook/calendar'] },
  { key: 'ms-bulk-create', label: 'Bulk Create', icon: <LuPlus className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/bulk-create', matches: ['/dashboard/facebook/bulk-create'] },
  { key: 'ms-live', label: 'Live Studio', icon: <LuRadio className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/live-studio', matches: ['/dashboard/facebook/live-studio'] },
  { key: 'ms-randomizer', label: 'Post Randomizer', icon: <LuZap className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/post-randomizer', matches: ['/dashboard/facebook/post-randomizer'] },
  { key: 'ms-reels', label: 'Reels', icon: <LuClapperboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/reels', matches: ['/dashboard/facebook/reels'] },
  { key: 'ms-stories', label: 'Stories', icon: <LuCirclePlay className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/stories', matches: ['/dashboard/facebook/stories'] },
];

const metaFbEngage: NavEntry[] = [
  { key: 'ms-messages', label: 'Messages', icon: <LuMessageCircle className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/messages', matches: ['/dashboard/facebook/messages'] },
  { key: 'ms-kanban', label: 'Kanban', icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/kanban', matches: ['/dashboard/facebook/kanban'] },
  { key: 'ms-broadcasts', label: 'Broadcasts', icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/broadcasts', matches: ['/dashboard/facebook/broadcasts'] },
  { key: 'ms-subscribers', label: 'Subscribers', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/subscribers', matches: ['/dashboard/facebook/subscribers'] },
  { key: 'ms-auto-reply', label: 'Auto Reply', icon: <LuReply className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/auto-reply', matches: ['/dashboard/facebook/auto-reply'] },
  { key: 'ms-messenger-settings', label: 'Messenger Settings', icon: <LuMessageSquareDashed className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/messenger-settings', matches: ['/dashboard/facebook/messenger-settings'] },
];

const metaFbGrowth: NavEntry[] = [
  { key: 'ms-events', label: 'Events', icon: <LuCalendarDays className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/events', matches: ['/dashboard/facebook/events'] },
  { key: 'ms-leads', label: 'Lead Forms', icon: <LuContact className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/leads', matches: ['/dashboard/facebook/leads'] },
  { key: 'ms-reviews', label: 'Reviews', icon: <LuStar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/reviews', matches: ['/dashboard/facebook/reviews'] },
  { key: 'ms-insights', label: 'Insights', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/insights', matches: ['/dashboard/facebook/insights'] },
  { key: 'ms-media', label: 'Media Library', icon: <LuImagePlay className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/media', matches: ['/dashboard/facebook/media'] },
  { key: 'ms-moderation', label: 'Moderation', icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/moderation', matches: ['/dashboard/facebook/moderation'] },
  { key: 'ms-audience', label: 'Audience', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/audience', matches: ['/dashboard/facebook/audience'] },
  { key: 'ms-competitors', label: 'Competitors', icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/competitors', matches: ['/dashboard/facebook/competitors'] },
  { key: 'ms-visitor-posts', label: 'Visitor Posts', icon: <LuUserCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/visitor-posts', matches: ['/dashboard/facebook/visitor-posts'] },
];

const metaFbCommerce: NavEntry[] = [
  { key: 'ms-shops', label: 'Shops', icon: <LuStore className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/custom-ecommerce', matches: ['/dashboard/facebook/custom-ecommerce'] },
  { key: 'ms-products', label: 'Products', icon: <LuPackage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/commerce/products', matches: ['/dashboard/facebook/commerce'] },
  { key: 'ms-orders', label: 'Orders', icon: <LuShoppingCart className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/commerce/orders', matches: ['/dashboard/facebook/commerce/orders'] },
];

const metaFbAdvanced: NavEntry[] = [
  { key: 'ms-flows', label: 'Flow Builder', icon: <LuWorkflow className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/flow-builder', matches: ['/dashboard/facebook/flow-builder'] },
  { key: 'ms-agents', label: 'AI Agents', icon: <LuBot className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/agents', matches: ['/dashboard/facebook/agents'] },
  { key: 'ms-knowledge', label: 'Knowledge Base', icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/knowledge', matches: ['/dashboard/facebook/knowledge'] },
  { key: 'ms-webhooks', label: 'Webhooks', icon: <LuWebhook className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/webhooks', matches: ['/dashboard/facebook/webhooks'] },
  { key: 'ms-page-roles', label: 'Page Roles', icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/page-roles', matches: ['/dashboard/facebook/page-roles'] },
  { key: 'ms-fb-settings', label: 'Settings', icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/settings', matches: ['/dashboard/facebook/settings'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Instagram nav registry — loaded when context="instagram".
 *  Dedicated module for Instagram Graph API: feed, stories, reels,
 *  DMs, discovery, hashtag search, and account connections.
 * ══════════════════════════════════════════════════════════════════ */

const igPrimary: NavEntry[] = [
  { key: 'ig-dashboard', label: 'Dashboard', icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram', matches: ['/dashboard/instagram'] },
  { key: 'ig-connections', label: 'Connections', icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/connections', matches: ['/dashboard/instagram/connections', '/dashboard/instagram/setup'] },
];

const igContent: NavEntry[] = [
  { key: 'ig-feed', label: 'Feed', icon: <LuImage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/feed', matches: ['/dashboard/instagram/feed'] },
  { key: 'ig-stories', label: 'Stories', icon: <LuEye className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/stories', matches: ['/dashboard/instagram/stories'] },
  { key: 'ig-reels', label: 'Reels', icon: <LuRadio className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/reels', matches: ['/dashboard/instagram/reels'] },
  { key: 'ig-create', label: 'Create Post', icon: <LuSquarePen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/create-post', matches: ['/dashboard/instagram/create-post'] },
];

const igEngage: NavEntry[] = [
  { key: 'ig-messages', label: 'Messages', icon: <LuMessageCircle className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/messages', matches: ['/dashboard/instagram/messages'] },
];

const igGrowth: NavEntry[] = [
  { key: 'ig-discovery', label: 'Discovery', icon: <LuMap className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/discovery', matches: ['/dashboard/instagram/discovery'] },
  { key: 'ig-hashtags', label: 'Hashtag Search', icon: <LuHash className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/hashtag-search', matches: ['/dashboard/instagram/hashtag-search'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  SabFlow nav registry — loaded when context="sabflow".
 *  Mirrors the /dashboard/sabflow/* directory structure.
 * ══════════════════════════════════════════════════════════════════ */

const sabflowPrimary: NavEntry[] = [
  {
    key: 'sf-flow-builder',
    label: 'Flow Builder',
    icon: <LuWorkflow className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/flow-builder',
    matches: ['/dashboard/sabflow/flow-builder'],
  },
  {
    key: 'sf-connections',
    label: 'Connections',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/connections',
    matches: ['/dashboard/sabflow/connections'],
  },
  {
    key: 'sf-logs',
    label: 'Execution Logs',
    icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/logs',
    matches: ['/dashboard/sabflow/logs'],
  },
];

const sabflowManage: NavEntry[] = [
  {
    key: 'sf-settings',
    label: 'Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/settings',
    matches: ['/dashboard/sabflow/settings'],
  },
  {
    key: 'sf-docs',
    label: 'Docs',
    icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/docs',
    matches: ['/dashboard/sabflow/docs'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  URL Shortener nav registry — loaded when context="url-shortener".
 * ══════════════════════════════════════════════════════════════════ */

const urlShortenerPrimary: NavEntry[] = [
  {
    key: 'us-links',
    label: 'All Links',
    icon: <LuLink className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/url-shortener',
    matches: ['/dashboard/url-shortener'],
  },
];

const urlShortenerManage: NavEntry[] = [
  {
    key: 'us-domains',
    label: 'Custom Domains',
    icon: <LuGlobe className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/url-shortener/settings',
    matches: ['/dashboard/url-shortener/settings'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  QR Code Maker nav registry — loaded when context="qr-code-maker".
 * ══════════════════════════════════════════════════════════════════ */

const qrCodeMakerPrimary: NavEntry[] = [
  {
    key: 'qr-generator',
    label: 'Generator',
    icon: <LuQrCode className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/qr-code-maker',
    matches: ['/dashboard/qr-code-maker'],
  },
];

const qrCodeMakerManage: NavEntry[] = [
  {
    key: 'qr-tags',
    label: 'Tags',
    icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/qr-code-maker/settings',
    matches: ['/dashboard/qr-code-maker/settings'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Telegram nav registry — loaded when context="telegram".
 *  Dedicated module for Telegram Bot API, Business API, Mini Apps,
 *  Channels, Stars payments, and MTProto-backed flows.
 * ══════════════════════════════════════════════════════════════════ */

const tgPrimary: NavEntry[] = [
  { key: 'tg-dashboard', label: 'Dashboard', icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram', matches: ['/dashboard/telegram'] },
  { key: 'tg-connections', label: 'Connections', icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/connections', matches: ['/dashboard/telegram/connections'] },
];

const tgMessaging: NavEntry[] = [
  { key: 'tg-chat', label: 'Live Chat', icon: <LuMessageCircle className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/chat', matches: ['/dashboard/telegram/chat'] },
  { key: 'tg-contacts', label: 'Contacts', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/contacts', matches: ['/dashboard/telegram/contacts'] },
  { key: 'tg-broadcasts', label: 'Broadcasts', icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/broadcasts', matches: ['/dashboard/telegram/broadcasts'] },
  { key: 'tg-inbox', label: 'Business Inbox', icon: <LuInbox className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/business-inbox', matches: ['/dashboard/telegram/business-inbox'] },
];

const tgAutomate: NavEntry[] = [
  { key: 'tg-bots', label: 'Bots', icon: <LuBot className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/bots', matches: ['/dashboard/telegram/bots'] },
  { key: 'tg-commands', label: 'Commands', icon: <LuHash className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/commands', matches: ['/dashboard/telegram/commands'] },
  { key: 'tg-auto-reply', label: 'Auto Reply', icon: <LuReply className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/auto-reply', matches: ['/dashboard/telegram/auto-reply'] },
  { key: 'tg-flows', label: 'Flows', icon: <LuWorkflow className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/flows', matches: ['/dashboard/telegram/flows'] },
];

const tgContent: NavEntry[] = [
  { key: 'tg-channels', label: 'Channels', icon: <LuRadio className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/channels', matches: ['/dashboard/telegram/channels'] },
  { key: 'tg-stories', label: 'Stories', icon: <LuEye className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/stories', matches: ['/dashboard/telegram/stories'] },
  { key: 'tg-stickers', label: 'Stickers & Emoji', icon: <LuImage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/stickers', matches: ['/dashboard/telegram/stickers'] },
];

const tgGrow: NavEntry[] = [
  { key: 'tg-mini-apps', label: 'Mini Apps', icon: <LuPackage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/mini-apps', matches: ['/dashboard/telegram/mini-apps'] },
  { key: 'tg-payments', label: 'Payments & Stars', icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/payments', matches: ['/dashboard/telegram/payments'] },
  { key: 'tg-ads', label: 'Ads', icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/ads', matches: ['/dashboard/telegram/ads'] },
  { key: 'tg-analytics', label: 'Analytics', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/analytics', matches: ['/dashboard/telegram/analytics'] },
];

const tgConfigure: NavEntry[] = [
  { key: 'tg-webhooks', label: 'Webhooks', icon: <LuWebhook className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/webhooks', matches: ['/dashboard/telegram/webhooks'] },
  { key: 'tg-api-keys', label: 'API Credentials', icon: <LuServerCog className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/api-credentials', matches: ['/dashboard/telegram/api-credentials'] },
  { key: 'tg-settings', label: 'Settings', icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/telegram/settings', matches: ['/dashboard/telegram/settings'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Team nav registry — loaded when context="team".
 *  Workspace-scoped module for members, roles, invites, tasks, audit,
 *  team chat, and notifications.
 * ══════════════════════════════════════════════════════════════════ */

const teamPrimary: NavEntry[] = [
  {
    key: 'team-overview',
    label: 'Overview',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team',
    matches: ['/dashboard/team'],
  },
  {
    key: 'team-members',
    label: 'Members',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team/manage-users',
    matches: ['/dashboard/team/manage-users'],
  },
  {
    key: 'team-invites',
    label: 'Invitations',
    icon: <LuUserPlus className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team/invites',
    matches: ['/dashboard/team/invites'],
  },
];

const teamGovern: NavEntry[] = [
  {
    key: 'team-roles',
    label: 'Roles & Permissions',
    icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team/manage-roles',
    matches: ['/dashboard/team/manage-roles'],
  },
  {
    key: 'team-activity',
    label: 'Activity Log',
    icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team/activity',
    matches: ['/dashboard/team/activity'],
  },
];

const teamCollab: NavEntry[] = [
  {
    key: 'team-tasks',
    label: 'Tasks',
    icon: <LuListChecks className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team/tasks',
    matches: ['/dashboard/team/tasks'],
  },
  {
    key: 'team-chat',
    label: 'Team Chat',
    icon: <LuMessagesSquare className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team/team-chat',
    matches: ['/dashboard/team/team-chat'],
  },
  {
    key: 'team-notifications',
    label: 'Notifications',
    icon: <LuBell className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team/notifications',
    matches: ['/dashboard/team/notifications'],
  },
];

const teamConfigure: NavEntry[] = [
  {
    key: 'team-settings',
    label: 'Workspace Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team/settings',
    matches: ['/dashboard/team/settings'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Settings nav registry — loaded when context="settings".
 *  Account- and project-level configuration: profile, billing, API
 *  keys, notifications, appearance, plus the legacy project-settings
 *  sub-pages (general, agents, attributes, canned messages).
 * ══════════════════════════════════════════════════════════════════ */

const settingsPrimary: NavEntry[] = [
  {
    key: 'set-overview',
    label: 'Overview',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings',
    matches: ['/dashboard/settings'],
  },
  {
    key: 'set-profile',
    label: 'Profile',
    icon: <LuUser className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/profile',
    matches: ['/dashboard/settings/profile'],
  },
  {
    key: 'set-security',
    label: 'Security',
    icon: <LuShield className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/security',
    matches: ['/dashboard/settings/security'],
  },
  {
    key: 'set-notifications',
    label: 'Notifications',
    icon: <LuBell className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/notifications',
    matches: ['/dashboard/settings/notifications'],
  },
  {
    key: 'set-appearance',
    label: 'Appearance',
    icon: <LuEye className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/ui',
    matches: ['/dashboard/settings/ui', '/dashboard/settings/appearance'],
  },
];

// Project-scoped Wachat settings (General, Agents, Attributes, Canned
// Messages) intentionally stay in the Wachat sidebar and are NOT
// surfaced here — /dashboard/settings is the account-level SaaS
// surface (profile, security, billing, credits, API keys).

const settingsDeveloper: NavEntry[] = [
  {
    key: 'set-api-keys',
    label: 'API Keys',
    icon: <LuKey className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/api-keys',
    matches: ['/dashboard/settings/api-keys'],
  },
  {
    key: 'set-webhooks',
    label: 'Webhooks',
    icon: <LuWebhook className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/webhooks',
    matches: ['/dashboard/settings/webhooks'],
  },
  {
    key: 'set-integrations',
    label: 'Integrations',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/integrations',
    matches: ['/dashboard/settings/integrations'],
  },
];

const settingsBilling: NavEntry[] = [
  {
    key: 'set-billing',
    label: 'Billing & Plan',
    icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/billing',
    matches: ['/dashboard/settings/billing'],
  },
  {
    key: 'set-credits',
    label: 'Credits',
    icon: <LuStar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/credits',
    matches: ['/dashboard/settings/credits'],
  },
  {
    key: 'set-invoices',
    label: 'Invoices',
    icon: <LuReceipt className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/invoices',
    matches: ['/dashboard/settings/invoices'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  CRM nav registry — loaded when context="crm".
 *  Business-ops module: sales CRM, sales billing, contacts/deals/tasks,
 *  inventory, purchases, accounting, banking, HR-payroll, reports.
 * ══════════════════════════════════════════════════════════════════ */

const crmPrimary: NavEntry[] = [
  {
    key: 'crm-overview',
    label: 'Overview',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm',
    matches: ['/dashboard/crm'],
  },
  {
    key: 'crm-leads',
    label: 'Leads',
    icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/all-leads',
    matches: ['/dashboard/crm/sales-crm'],
  },
  {
    key: 'crm-contacts',
    label: 'Contacts',
    icon: <LuContact className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/contacts',
    matches: ['/dashboard/crm/contacts', '/dashboard/crm/accounts'],
  },
  {
    key: 'crm-deals',
    label: 'Deals',
    icon: <LuBriefcase className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/deals',
    matches: ['/dashboard/crm/deals'],
  },
  {
    key: 'crm-tasks',
    label: 'Tasks',
    icon: <LuListChecks className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/tasks',
    matches: ['/dashboard/crm/tasks'],
  },
  {
    key: 'crm-pinned',
    label: 'Pinned',
    icon: <LuPin className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/pinned',
    matches: ['/dashboard/crm/pinned'],
  },
  {
    key: 'crm-activity',
    label: 'Activity',
    icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/activity',
    matches: ['/dashboard/crm/activity'],
  },
  {
    key: 'crm-notifications',
    label: 'Notifications',
    icon: <LuBell className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/notifications',
    matches: ['/dashboard/crm/notifications'],
  },
];

const crmSales: NavEntry[] = [
  {
    key: 'crm-clients',
    label: 'Clients',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/clients',
    matches: ['/dashboard/crm/sales/clients'],
  },
  {
    key: 'crm-quotations',
    label: 'Quotations',
    icon: <LuMessageSquareQuote className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/quotations',
    matches: ['/dashboard/crm/sales/quotations', '/dashboard/crm/sales/proforma'],
  },
  {
    key: 'crm-orders',
    label: 'Orders',
    icon: <LuShoppingCart className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/orders',
    matches: ['/dashboard/crm/sales/orders', '/dashboard/crm/sales/delivery'],
  },
  {
    key: 'crm-invoices',
    label: 'Invoices',
    icon: <LuReceipt className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/invoices',
    matches: [
      '/dashboard/crm/sales/invoices',
      '/dashboard/crm/sales/receipts',
      '/dashboard/crm/sales/credit-notes',
    ],
  },
  {
    key: 'crm-pipelines',
    label: 'Pipelines',
    icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/pipelines',
    matches: ['/dashboard/crm/sales/pipelines'],
  },
  {
    key: 'crm-products',
    label: 'Products',
    icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/products',
    matches: ['/dashboard/crm/products'],
  },
  {
    key: 'crm-proposals',
    label: 'Proposals',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/proposals',
    matches: ['/dashboard/crm/sales/proposals'],
  },
  {
    key: 'crm-estimate-requests',
    label: 'Estimate Requests',
    icon: <LuInbox className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/estimate-requests',
    matches: ['/dashboard/crm/sales/estimate-requests'],
  },
  {
    key: 'crm-recurring-invoices',
    label: 'Recurring Invoices',
    icon: <LuCalendarClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/recurring-invoices',
    matches: ['/dashboard/crm/sales/recurring-invoices'],
  },
  {
    key: 'crm-promotions',
    label: 'Promotions',
    icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/promotions',
    matches: ['/dashboard/crm/sales/promotions'],
  },
  {
    key: 'crm-payments',
    label: 'Payments',
    icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/payments',
    matches: ['/dashboard/crm/sales/payments'],
  },
  {
    key: 'crm-estimate-templates',
    label: 'Estimate Templates',
    icon: <LuLayoutTemplate className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/estimates-templates',
    matches: ['/dashboard/crm/sales/estimates-templates'],
  },
  {
    key: 'crm-proposal-templates',
    label: 'Proposal Templates',
    icon: <LuLayoutTemplate className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/proposals/templates',
    matches: ['/dashboard/crm/sales/proposals/templates'],
  },
];

// New group: Sales CRM (leads pipeline)
const crmSalesCrm: NavEntry[] = [
  {
    key: 'crm-sc-all-leads',
    label: 'All Leads',
    icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/all-leads',
    matches: ['/dashboard/crm/sales-crm/all-leads'],
  },
  {
    key: 'crm-sc-leads',
    label: 'Leads',
    icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/leads',
    matches: ['/dashboard/crm/sales-crm/leads'],
  },
  {
    key: 'crm-sc-pipelines',
    label: 'Pipelines',
    icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/pipelines',
    matches: ['/dashboard/crm/sales-crm/pipelines'],
  },
  {
    key: 'crm-sc-all-pipelines',
    label: 'All Pipelines',
    icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/all-pipelines',
    matches: ['/dashboard/crm/sales-crm/all-pipelines'],
  },
  {
    key: 'crm-sc-forms',
    label: 'Forms',
    icon: <LuClipboardList className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/forms',
    matches: ['/dashboard/crm/sales-crm/forms'],
  },
  {
    key: 'crm-sc-sources',
    label: 'Sources',
    icon: <LuRadar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/sources',
    matches: ['/dashboard/crm/sales-crm/sources'],
  },
  {
    key: 'crm-sc-statuses',
    label: 'Statuses',
    icon: <LuListFilter className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/statuses',
    matches: ['/dashboard/crm/sales-crm/statuses'],
  },
  {
    key: 'crm-sc-categories',
    label: 'Categories',
    icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/categories',
    matches: ['/dashboard/crm/sales-crm/categories'],
  },
  {
    key: 'crm-sc-pipeline-stages',
    label: 'Pipeline Stages',
    icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/pipeline-stages',
    matches: ['/dashboard/crm/sales-crm/pipeline-stages'],
  },
  {
    key: 'crm-sc-custom-forms',
    label: 'Custom Forms',
    icon: <LuClipboardList className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/custom-forms',
    matches: ['/dashboard/crm/sales-crm/custom-forms'],
  },
  {
    key: 'crm-sc-settings',
    label: 'Lead Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/settings',
    matches: ['/dashboard/crm/sales-crm/settings'],
  },
  {
    key: 'crm-sc-notes',
    label: 'Lead Notes',
    icon: <LuStickyNote className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/notes',
    matches: ['/dashboard/crm/sales-crm/notes'],
  },
  {
    key: 'crm-sc-products',
    label: 'Lead Products',
    icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/products',
    matches: ['/dashboard/crm/sales-crm/products'],
  },
  {
    key: 'crm-sc-consent',
    label: 'Consent',
    icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/consent',
    matches: ['/dashboard/crm/sales-crm/consent'],
  },
  {
    key: 'crm-sc-leads-summary',
    label: 'Leads Summary',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/leads-summary',
    matches: ['/dashboard/crm/sales-crm/leads-summary'],
  },
  {
    key: 'crm-sc-lead-source-report',
    label: 'Lead Source Report',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/lead-source-report',
    matches: ['/dashboard/crm/sales-crm/lead-source-report'],
  },
  {
    key: 'crm-sc-team-sales-report',
    label: 'Team Sales Report',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/team-sales-report',
    matches: ['/dashboard/crm/sales-crm/team-sales-report'],
  },
  {
    key: 'crm-sc-client-performance-report',
    label: 'Client Performance Report',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/client-performance-report',
    matches: ['/dashboard/crm/sales-crm/client-performance-report'],
  },
];

// New group: Clients (account sub-pages)
const crmClients: NavEntry[] = [
  {
    key: 'crm-clients-list',
    label: 'Clients',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/clients',
    matches: ['/dashboard/crm/sales/clients'],
  },
  {
    key: 'crm-clients-categories',
    label: 'Client Categories',
    icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/clients/categories',
    matches: ['/dashboard/crm/sales/clients/categories'],
  },
  {
    key: 'crm-clients-contacts',
    label: 'Client Contacts',
    icon: <LuContact className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/clients/contacts',
    matches: ['/dashboard/crm/sales/clients/contacts'],
  },
  {
    key: 'crm-clients-documents',
    label: 'Client Documents',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/clients/documents',
    matches: ['/dashboard/crm/sales/clients/documents'],
  },
  {
    key: 'crm-clients-notes',
    label: 'Client Notes',
    icon: <LuStickyNote className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales/clients/notes',
    matches: ['/dashboard/crm/sales/clients/notes'],
  },
];

const crmCatalog: NavEntry[] = [
  {
    key: 'crm-inventory',
    label: 'Inventory',
    icon: <LuPackage className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/inventory/items',
    matches: ['/dashboard/crm/inventory'],
  },
  {
    key: 'crm-purchases',
    label: 'Purchases',
    icon: <LuShoppingBag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/purchases/orders',
    matches: ['/dashboard/crm/purchases'],
  },
  {
    key: 'crm-recurring-expenses',
    label: 'Recurring Expenses',
    icon: <LuCalendarClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/purchases/recurring-expenses',
    matches: ['/dashboard/crm/purchases/recurring-expenses'],
  },
];

const crmFinance: NavEntry[] = [
  {
    key: 'crm-accounting',
    label: 'Accounting',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/day-book',
    matches: ['/dashboard/crm/accounting'],
  },
  {
    key: 'crm-banking',
    label: 'Banking',
    icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/banking/bank-accounts',
    matches: ['/dashboard/crm/banking'],
  },
  {
    key: 'crm-bank-transactions',
    label: 'Bank Transactions',
    icon: <LuBanknote className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/banking/bank-transactions',
    matches: ['/dashboard/crm/banking/bank-transactions'],
  },
  {
    key: 'crm-day-book',
    label: 'Day Book',
    icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/day-book',
    matches: ['/dashboard/crm/accounting/day-book'],
  },
  {
    key: 'crm-trial-balance',
    label: 'Trial Balance',
    icon: <LuCalculator className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/trial-balance',
    matches: ['/dashboard/crm/accounting/trial-balance'],
  },
  {
    key: 'crm-income-statement',
    label: 'Income Statement',
    icon: <LuFileSpreadsheet className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/income-statement',
    matches: ['/dashboard/crm/accounting/income-statement'],
  },
  {
    key: 'crm-balance-sheet',
    label: 'Balance Sheet',
    icon: <LuFileSpreadsheet className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/balance-sheet',
    matches: ['/dashboard/crm/accounting/balance-sheet'],
  },
  {
    key: 'crm-cash-flow',
    label: 'Cash Flow',
    icon: <LuWallet className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/cash-flow',
    matches: ['/dashboard/crm/accounting/cash-flow'],
  },
  {
    key: 'crm-chart-of-accounts',
    label: 'Chart of Accounts',
    icon: <LuLayers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/charts',
    matches: ['/dashboard/crm/accounting/charts'],
  },
  {
    key: 'crm-account-groups',
    label: 'Account Groups',
    icon: <LuGroup className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/groups',
    matches: ['/dashboard/crm/accounting/groups'],
  },
  {
    key: 'crm-vouchers',
    label: 'Vouchers',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/vouchers',
    matches: ['/dashboard/crm/accounting/vouchers'],
  },
  {
    key: 'crm-pnl',
    label: 'P&L',
    icon: <LuTrendingUp className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/accounting/pnl',
    matches: ['/dashboard/crm/accounting/pnl'],
  },
];

const crmInsights: NavEntry[] = [
  {
    key: 'crm-analytics',
    label: 'Analytics',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/analytics',
    matches: ['/dashboard/crm/analytics'],
  },
  {
    key: 'crm-reports',
    label: 'GST',
    icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/reports/gstr-1',
    matches: ['/dashboard/crm/reports'],
  },
  {
    key: 'crm-gstr-1',
    label: 'GSTR-1',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/reports/gstr-1',
    matches: ['/dashboard/crm/reports/gstr-1'],
  },
  {
    key: 'crm-gstr-2b',
    label: 'GSTR-2B',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/reports/gstr-2b',
    matches: ['/dashboard/crm/reports/gstr-2b'],
  },
  {
    key: 'crm-finance-reports',
    label: 'Finance Reports',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/reports/income',
    matches: ['/dashboard/crm/reports/income'],
  },
  {
    key: 'crm-hr-reports',
    label: 'HR Reports',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/reports/attendance-report',
    matches: ['/dashboard/crm/reports/attendance-report'],
  },
  {
    key: 'crm-support-reports',
    label: 'Support Reports',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/reports/ticket-report',
    matches: ['/dashboard/crm/reports/ticket-report'],
  },
];

const crmHr: NavEntry[] = [
  {
    key: 'hr-overview',
    label: 'HR Overview',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr',
    matches: ['/dashboard/crm/hr'],
  },
  {
    key: 'crm-hr-payroll',
    label: 'Payroll & Attendance',
    icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll',
    matches: ['/dashboard/crm/hr-payroll'],
  },
  {
    key: 'hr-shifts',
    label: 'Shifts & Rotations',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/shifts',
    matches: [
      '/dashboard/crm/hr-payroll/shifts',
      '/dashboard/crm/hr-payroll/shift-rotations',
      '/dashboard/crm/hr-payroll/shift-change-requests',
    ],
  },
  {
    key: 'hr-jobs',
    label: 'Jobs & Candidates',
    icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/jobs',
    matches: [
      '/dashboard/crm/hr/jobs',
      '/dashboard/crm/hr/candidates',
      '/dashboard/crm/hr/interviews',
      '/dashboard/crm/hr/offers',
      '/dashboard/crm/hr/careers-page',
    ],
  },
  {
    key: 'hr-onboarding',
    label: 'Onboarding',
    icon: <LuUserCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/onboarding',
    matches: [
      '/dashboard/crm/hr/onboarding',
      '/dashboard/crm/hr/welcome-kit',
      '/dashboard/crm/hr/probation',
    ],
  },
  {
    key: 'hr-workspace',
    label: 'Workspace',
    icon: <LuMessagesSquare className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/announcements',
    matches: [
      '/dashboard/crm/hr/announcements',
      '/dashboard/crm/hr/policies',
      '/dashboard/crm/hr/directory',
      '/dashboard/crm/hr/org-chart',
    ],
  },
  {
    key: 'hr-documents',
    label: 'Documents',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/documents',
    matches: [
      '/dashboard/crm/hr/documents',
      '/dashboard/crm/hr/document-templates',
    ],
  },
  {
    key: 'hr-training',
    label: 'Training',
    icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/training',
    matches: [
      '/dashboard/crm/hr/training',
      '/dashboard/crm/hr/certifications',
      '/dashboard/crm/hr/learning-paths',
    ],
  },
  {
    key: 'hr-performance',
    label: 'Performance',
    icon: <LuStar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/okrs',
    matches: [
      '/dashboard/crm/hr/okrs',
      '/dashboard/crm/hr/feedback-360',
      '/dashboard/crm/hr/one-on-ones',
    ],
  },
  {
    key: 'hr-time',
    label: 'Time & Expense',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/timesheets',
    matches: [
      '/dashboard/crm/hr/timesheets',
      '/dashboard/crm/hr/travel',
      '/dashboard/crm/hr/expense-claims',
    ],
  },
  {
    key: 'hr-assets',
    label: 'Assets',
    icon: <LuPackage className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/assets',
    matches: [
      '/dashboard/crm/hr/assets',
      '/dashboard/crm/hr/asset-assignments',
    ],
  },
  {
    key: 'hr-engagement',
    label: 'Engagement',
    icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/recognition',
    matches: [
      '/dashboard/crm/hr/recognition',
      '/dashboard/crm/hr/surveys',
    ],
  },
  {
    key: 'hr-exit',
    label: 'Comp & Exit',
    icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/compensation-bands',
    matches: [
      '/dashboard/crm/hr/compensation-bands',
      '/dashboard/crm/hr/exits',
      '/dashboard/crm/hr/succession',
    ],
  },
  {
    key: 'hr-directory',
    label: 'Directory',
    icon: <LuContact className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/directory',
    matches: ['/dashboard/crm/hr/directory'],
  },
  {
    key: 'hr-org-chart',
    label: 'Org Chart',
    icon: <LuNetwork className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr/org-chart',
    matches: ['/dashboard/crm/hr/org-chart'],
  },
  {
    key: 'hr-leave',
    label: 'Leave Management',
    icon: <LuUmbrella className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/leave',
    matches: ['/dashboard/crm/hr-payroll/leave'],
  },
  {
    key: 'hr-leave-types',
    label: 'Leave Types',
    icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/leave/types',
    matches: ['/dashboard/crm/hr-payroll/leave/types'],
  },
  {
    key: 'hr-leave-balance',
    label: 'Leave Balance',
    icon: <LuCalculator className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/leave/balance',
    matches: ['/dashboard/crm/hr-payroll/leave/balance'],
  },
  {
    key: 'hr-leave-calendar',
    label: 'Leave Calendar',
    icon: <LuCalendarDays className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/leave/calendar',
    matches: ['/dashboard/crm/hr-payroll/leave/calendar'],
  },
  {
    key: 'hr-dept-hierarchy',
    label: 'Dept Hierarchy',
    icon: <LuNetwork className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/departments/hierarchy',
    matches: ['/dashboard/crm/hr-payroll/departments/hierarchy'],
  },
  {
    key: 'hr-designation-hierarchy',
    label: 'Designation Hierarchy',
    icon: <LuNetwork className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/designations/hierarchy',
    matches: ['/dashboard/crm/hr-payroll/designations/hierarchy'],
  },
  {
    key: 'hr-employee-documents',
    label: 'Employee Documents',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/employees/documents',
    matches: ['/dashboard/crm/hr-payroll/employees/documents'],
  },
  {
    key: 'hr-emergency-contacts',
    label: 'Emergency Contacts',
    icon: <LuPhone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/employees/emergency-contacts',
    matches: ['/dashboard/crm/hr-payroll/employees/emergency-contacts'],
  },
  {
    key: 'hr-visa-details',
    label: 'Visa Details',
    icon: <LuEarth className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/employees/visa-details',
    matches: ['/dashboard/crm/hr-payroll/employees/visa-details'],
  },
  {
    key: 'hr-skills',
    label: 'Skills',
    icon: <LuAward className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/employees/skills',
    matches: ['/dashboard/crm/hr-payroll/employees/skills'],
  },
  {
    key: 'hr-employee-skills',
    label: 'Employee Skills',
    icon: <LuAward className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/employees/employee-skills',
    matches: ['/dashboard/crm/hr-payroll/employees/employee-skills'],
  },
  {
    key: 'hr-teams',
    label: 'Teams',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/employees/teams',
    matches: ['/dashboard/crm/hr-payroll/employees/teams'],
  },
  {
    key: 'hr-leave-quotas',
    label: 'Leave Quotas',
    icon: <LuUmbrella className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/employees/leave-quotas',
    matches: ['/dashboard/crm/hr-payroll/employees/leave-quotas'],
  },
  {
    key: 'hr-attendance',
    label: 'Attendance',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/attendance',
    matches: ['/dashboard/crm/hr-payroll/attendance'],
  },
  {
    key: 'hr-holidays',
    label: 'Holidays',
    icon: <LuCalendarDays className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/holidays',
    matches: ['/dashboard/crm/hr-payroll/holidays'],
  },
  {
    key: 'hr-payroll-page',
    label: 'Payroll',
    icon: <LuBanknote className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/payroll',
    matches: ['/dashboard/crm/hr-payroll/payroll'],
  },
  {
    key: 'hr-payslips',
    label: 'Payslips',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/payslips',
    matches: ['/dashboard/crm/hr-payroll/payslips'],
  },
  {
    key: 'hr-salary-structure',
    label: 'Salary Structure',
    icon: <LuCoins className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/salary-structure',
    matches: ['/dashboard/crm/hr-payroll/salary-structure'],
  },
  {
    key: 'hr-pf-esi',
    label: 'PF/ESI',
    icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/pf-esi',
    matches: ['/dashboard/crm/hr-payroll/pf-esi'],
  },
  {
    key: 'hr-professional-tax',
    label: 'Professional Tax',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/professional-tax',
    matches: ['/dashboard/crm/hr-payroll/professional-tax'],
  },
  {
    key: 'hr-tds',
    label: 'TDS',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/tds',
    matches: ['/dashboard/crm/hr-payroll/tds'],
  },
  {
    key: 'hr-form-16',
    label: 'Form 16',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/form-16',
    matches: ['/dashboard/crm/hr-payroll/form-16'],
  },
  {
    key: 'hr-goal-setting',
    label: 'Goal Setting',
    icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/goal-setting',
    matches: ['/dashboard/crm/hr-payroll/goal-setting'],
  },
  {
    key: 'hr-appraisal-reviews',
    label: 'Appraisal Reviews',
    icon: <LuStar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/appraisal-reviews',
    matches: ['/dashboard/crm/hr-payroll/appraisal-reviews'],
  },
  {
    key: 'hr-kpi-tracking',
    label: 'KPI Tracking',
    icon: <LuTrendingUp className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/kpi-tracking',
    matches: ['/dashboard/crm/hr-payroll/kpi-tracking'],
  },
  {
    key: 'hr-settings',
    label: 'HR Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/settings',
    matches: ['/dashboard/crm/hr-payroll/settings'],
  },
  {
    key: 'hr-reports',
    label: 'HR Reports',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/hr-payroll/reports',
    matches: ['/dashboard/crm/hr-payroll/reports'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  HRM nav registry — loaded when context="hrm".
 *  Standalone HR module: recruitment, people, payroll, compliance.
 * ══════════════════════════════════════════════════════════════════ */

const hrmPrimary: NavEntry[] = [
  {
    key: 'hrm-overview',
    label: 'Overview',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm',
    matches: ['/dashboard/hrm'],
  },
  {
    key: 'hrm-employees',
    label: 'Employees',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/employees',
    matches: ['/dashboard/hrm/payroll/employees'],
  },
  {
    key: 'hrm-payroll',
    label: 'Payroll',
    icon: <LuBanknote className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/payroll',
    matches: ['/dashboard/hrm/payroll/payroll'],
  },
  {
    key: 'hrm-attendance',
    label: 'Attendance',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/attendance',
    matches: ['/dashboard/hrm/payroll/attendance'],
  },
  {
    key: 'hrm-leave',
    label: 'Leave',
    icon: <LuUmbrella className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/leave',
    matches: ['/dashboard/hrm/payroll/leave'],
  },
];

const hrmRecruitment: NavEntry[] = [
  {
    key: 'hrm-jobs',
    label: 'Job Postings',
    icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/jobs',
    matches: ['/dashboard/hrm/hr/jobs', '/dashboard/hrm/hr/candidates', '/dashboard/hrm/hr/interviews', '/dashboard/hrm/hr/offers'],
  },
  {
    key: 'hrm-careers-page',
    label: 'Careers Page',
    icon: <LuGlobe className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/careers-page',
    matches: ['/dashboard/hrm/hr/careers-page'],
  },
  {
    key: 'hrm-onboarding',
    label: 'Onboarding',
    icon: <LuUserCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/onboarding',
    matches: ['/dashboard/hrm/hr/onboarding', '/dashboard/hrm/hr/welcome-kit', '/dashboard/hrm/hr/probation'],
  },
];

const hrmPeople: NavEntry[] = [
  {
    key: 'hrm-directory',
    label: 'Directory',
    icon: <LuContact className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/directory',
    matches: ['/dashboard/hrm/hr/directory'],
  },
  {
    key: 'hrm-org-chart',
    label: 'Org Chart',
    icon: <LuNetwork className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/org-chart',
    matches: ['/dashboard/hrm/hr/org-chart'],
  },
  {
    key: 'hrm-departments',
    label: 'Departments',
    icon: <LuBriefcase className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/departments',
    matches: ['/dashboard/hrm/payroll/departments'],
  },
  {
    key: 'hrm-designations',
    label: 'Designations',
    icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/designations',
    matches: ['/dashboard/hrm/payroll/designations'],
  },
  {
    key: 'hrm-announcements',
    label: 'Announcements',
    icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/announcements',
    matches: ['/dashboard/hrm/hr/announcements', '/dashboard/hrm/hr/policies'],
  },
];

const hrmPayroll: NavEntry[] = [
  {
    key: 'hrm-payslips',
    label: 'Payslips',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/payslips',
    matches: ['/dashboard/hrm/payroll/payslips'],
  },
  {
    key: 'hrm-salary-structure',
    label: 'Salary Structure',
    icon: <LuCoins className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/salary-structure',
    matches: ['/dashboard/hrm/payroll/salary-structure'],
  },
  {
    key: 'hrm-shifts',
    label: 'Shifts & Rotations',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/shifts',
    matches: ['/dashboard/hrm/payroll/shifts', '/dashboard/hrm/payroll/shift-rotations', '/dashboard/hrm/payroll/shift-change-requests'],
  },
  {
    key: 'hrm-holidays',
    label: 'Holidays',
    icon: <LuCalendarDays className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/holidays',
    matches: ['/dashboard/hrm/payroll/holidays'],
  },
];

const hrmCompliance: NavEntry[] = [
  {
    key: 'hrm-pf-esi',
    label: 'PF & ESI',
    icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/pf-esi',
    matches: ['/dashboard/hrm/payroll/pf-esi'],
  },
  {
    key: 'hrm-tds',
    label: 'TDS',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/tds',
    matches: ['/dashboard/hrm/payroll/tds'],
  },
  {
    key: 'hrm-professional-tax',
    label: 'Professional Tax',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/professional-tax',
    matches: ['/dashboard/hrm/payroll/professional-tax'],
  },
  {
    key: 'hrm-form-16',
    label: 'Form 16',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/form-16',
    matches: ['/dashboard/hrm/payroll/form-16'],
  },
];

const hrmPerformance: NavEntry[] = [
  {
    key: 'hrm-okrs',
    label: 'OKRs & Goals',
    icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/okrs',
    matches: ['/dashboard/hrm/hr/okrs'],
  },
  {
    key: 'hrm-feedback-360',
    label: '360 Feedback',
    icon: <LuStar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/feedback-360',
    matches: ['/dashboard/hrm/hr/feedback-360', '/dashboard/hrm/hr/one-on-ones'],
  },
  {
    key: 'hrm-appraisals',
    label: 'Appraisals',
    icon: <LuStar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/appraisal-reviews',
    matches: ['/dashboard/hrm/payroll/appraisal-reviews', '/dashboard/hrm/payroll/kpi-tracking', '/dashboard/hrm/payroll/goal-setting'],
  },
  {
    key: 'hrm-training',
    label: 'Training & Learning',
    icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/training',
    matches: ['/dashboard/hrm/hr/training', '/dashboard/hrm/hr/certifications', '/dashboard/hrm/hr/learning-paths'],
  },
];

const hrmEngagement: NavEntry[] = [
  {
    key: 'hrm-recognition',
    label: 'Recognition',
    icon: <LuAward className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/recognition',
    matches: ['/dashboard/hrm/hr/recognition', '/dashboard/hrm/hr/surveys'],
  },
  {
    key: 'hrm-assets',
    label: 'Assets',
    icon: <LuPackage className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/assets',
    matches: ['/dashboard/hrm/hr/assets', '/dashboard/hrm/hr/asset-assignments'],
  },
  {
    key: 'hrm-documents',
    label: 'Documents',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/documents',
    matches: ['/dashboard/hrm/hr/documents', '/dashboard/hrm/hr/document-templates'],
  },
  {
    key: 'hrm-timesheets',
    label: 'Time & Expense',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/timesheets',
    matches: ['/dashboard/hrm/hr/timesheets', '/dashboard/hrm/hr/travel', '/dashboard/hrm/hr/expense-claims'],
  },
];

const hrmConfigure: NavEntry[] = [
  {
    key: 'hrm-reports',
    label: 'Reports',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/reports',
    matches: ['/dashboard/hrm/payroll/reports'],
  },
  {
    key: 'hrm-exits',
    label: 'Exit Management',
    icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/hr/exits',
    matches: ['/dashboard/hrm/hr/exits', '/dashboard/hrm/hr/succession', '/dashboard/hrm/hr/compensation-bands'],
  },
  {
    key: 'hrm-settings',
    label: 'HRM Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/hrm/payroll/settings',
    matches: ['/dashboard/hrm/payroll/settings'],
  },
];

const crmServices: NavEntry[] = [
  {
    key: 'crm-projects',
    label: 'Projects',
    icon: <LuFolderOpen className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/projects',
    matches: ['/dashboard/crm/projects'],
  },
  {
    key: 'crm-kanban',
    label: 'Task Kanban',
    icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/projects/kanban',
    matches: ['/dashboard/crm/projects/kanban'],
  },
  {
    key: 'crm-gantt',
    label: 'Gantt Chart',
    icon: <LuGitBranch className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/projects/gantt',
    matches: ['/dashboard/crm/projects/gantt'],
  },
  {
    key: 'crm-project-milestones',
    label: 'Project Milestones',
    icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/projects/milestones',
    matches: ['/dashboard/crm/projects/milestones'],
  },
  {
    key: 'crm-project-issues',
    label: 'Project Issues',
    icon: <LuBan className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/projects/issues',
    matches: ['/dashboard/crm/projects/issues'],
  },
  {
    key: 'crm-taskboard-columns',
    label: 'Task Board Columns',
    icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/projects/taskboard-columns',
    matches: ['/dashboard/crm/projects/taskboard-columns'],
  },
  {
    key: 'crm-time-tracking',
    label: 'Time Tracking',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/time-tracking',
    matches: ['/dashboard/crm/time-tracking'],
  },
  {
    key: 'crm-contracts',
    label: 'Contracts',
    icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/contracts',
    matches: ['/dashboard/crm/contracts'],
  },
  {
    key: 'crm-tickets',
    label: 'Tickets',
    icon: <LuInbox className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/tickets',
    matches: ['/dashboard/crm/tickets'],
  },
  {
    key: 'crm-workspace',
    label: 'Workspace',
    icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/workspace',
    matches: ['/dashboard/crm/workspace'],
  },
  {
    key: 'crm-messages',
    label: 'Messages',
    icon: <LuMessageCircle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/messages',
    matches: ['/dashboard/crm/messages', '/dashboard/crm/mentions'],
  },
  {
    key: 'crm-files',
    label: 'Files',
    icon: <LuFolderOpen className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/files',
    matches: ['/dashboard/crm/files'],
  },
  {
    key: 'crm-search',
    label: 'Search',
    icon: <LuSearch className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/search',
    matches: ['/dashboard/crm/search'],
  },
];

const crmConfigure: NavEntry[] = [
  {
    key: 'crm-email',
    label: 'Email',
    icon: <LuMail className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/email',
    matches: ['/dashboard/crm/email'],
  },
  {
    key: 'crm-integrations',
    label: 'Integrations',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/integrations',
    matches: ['/dashboard/crm/integrations'],
  },
  {
    key: 'crm-setup',
    label: 'Setup',
    icon: <LuWrench className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/setup',
    matches: ['/dashboard/crm/setup'],
  },
  {
    key: 'crm-settings',
    label: 'Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings',
    matches: ['/dashboard/crm/settings'],
  },
  {
    key: 'crm-company-profile',
    label: 'Company Profile',
    icon: <LuBriefcase className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/company-profile',
    matches: ['/dashboard/crm/settings/company-profile'],
  },
  {
    key: 'crm-company-addresses',
    label: 'Company Addresses',
    icon: <LuMap className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/company-addresses',
    matches: ['/dashboard/crm/settings/company-addresses'],
  },
  {
    key: 'crm-currencies',
    label: 'Currencies',
    icon: <LuCoins className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/currencies',
    matches: ['/dashboard/crm/settings/currencies'],
  },
  {
    key: 'crm-languages',
    label: 'Languages',
    icon: <LuLanguages className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/languages',
    matches: ['/dashboard/crm/settings/languages'],
  },
  {
    key: 'crm-global-settings',
    label: 'Global Settings',
    icon: <LuGlobe className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/global',
    matches: ['/dashboard/crm/settings/global'],
  },
  {
    key: 'crm-invoice-settings',
    label: 'Invoice Settings',
    icon: <LuReceipt className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/invoice-settings',
    matches: ['/dashboard/crm/settings/invoice-settings'],
  },
  {
    key: 'crm-task-settings',
    label: 'Task Settings',
    icon: <LuListChecks className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/task-settings',
    matches: ['/dashboard/crm/settings/task-settings'],
  },
  {
    key: 'crm-project-settings',
    label: 'Project Settings',
    icon: <LuFolderOpen className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/project-settings',
    matches: ['/dashboard/crm/settings/project-settings'],
  },
  {
    key: 'crm-project-statuses',
    label: 'Project Statuses',
    icon: <LuListFilter className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/project-statuses',
    matches: ['/dashboard/crm/settings/project-statuses'],
  },
  {
    key: 'crm-attendance-settings',
    label: 'Attendance Settings',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/attendance-settings',
    matches: ['/dashboard/crm/settings/attendance-settings'],
  },
  {
    key: 'crm-custom-fields',
    label: 'Custom Fields',
    icon: <LuSlidersHorizontal className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/custom-fields',
    matches: ['/dashboard/crm/settings/custom-fields'],
  },
  {
    key: 'crm-custom-links',
    label: 'Custom Links',
    icon: <LuLink className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/custom-links',
    matches: ['/dashboard/crm/settings/custom-links'],
  },
  {
    key: 'crm-taxes',
    label: 'Taxes',
    icon: <LuReceiptText className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/taxes',
    matches: ['/dashboard/crm/settings/taxes'],
  },
  {
    key: 'crm-unit-types',
    label: 'Unit Types',
    icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/unit-types',
    matches: ['/dashboard/crm/settings/unit-types'],
  },
  {
    key: 'crm-promotions-admin',
    label: 'Promotions (admin)',
    icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/promotions',
    matches: ['/dashboard/crm/settings/promotions'],
  },
  {
    key: 'crm-expense-categories',
    label: 'Expense Categories',
    icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/expense-categories',
    matches: ['/dashboard/crm/settings/expense-categories'],
  },
  {
    key: 'crm-expense-category-roles',
    label: 'Expense Category Roles',
    icon: <LuShield className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/expense-category-roles',
    matches: ['/dashboard/crm/settings/expense-category-roles'],
  },
  {
    key: 'crm-currency-formats',
    label: 'Currency Formats',
    icon: <LuCoins className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/currency-formats',
    matches: ['/dashboard/crm/settings/currency-formats'],
  },
  {
    key: 'crm-flags',
    label: 'Flags',
    icon: <LuEarth className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/flags',
    matches: ['/dashboard/crm/settings/flags'],
  },
  {
    key: 'crm-dashboard-widgets',
    label: 'Dashboard Widgets',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/dashboard-widgets',
    matches: ['/dashboard/crm/settings/dashboard-widgets'],
  },
  {
    key: 'crm-taskboard-preferences',
    label: 'Taskboard Prefs',
    icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/taskboard-preferences',
    matches: ['/dashboard/crm/settings/taskboard-preferences'],
  },
  {
    key: 'crm-leadboard-preferences',
    label: 'Leadboard Prefs',
    icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/leadboard-preferences',
    matches: ['/dashboard/crm/settings/leadboard-preferences'],
  },
  {
    key: 'crm-payment-gateways',
    label: 'Payment Gateways',
    icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/payment-gateways',
    matches: ['/dashboard/crm/settings/payment-gateways'],
  },
  {
    key: 'crm-offline-payment-methods',
    label: 'Offline Payment Methods',
    icon: <LuWallet className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/offline-payment-methods',
    matches: ['/dashboard/crm/settings/offline-payment-methods'],
  },
  {
    key: 'crm-public-payment',
    label: 'Public Payment',
    icon: <LuGlobe className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/public-payment',
    matches: ['/dashboard/crm/settings/public-payment'],
  },
  {
    key: 'crm-integrations-hub',
    label: 'Integrations Hub',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations',
    matches: ['/dashboard/crm/settings/integrations'],
  },
  {
    key: 'crm-int-slack',
    label: 'Slack',
    icon: <LuMessagesSquare className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/slack',
    matches: ['/dashboard/crm/settings/integrations/slack'],
  },
  {
    key: 'crm-int-smtp',
    label: 'SMTP',
    icon: <LuMail className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/smtp',
    matches: ['/dashboard/crm/settings/integrations/smtp'],
  },
  {
    key: 'crm-int-google-calendar',
    label: 'Google Calendar',
    icon: <LuCalendar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/google-calendar',
    matches: ['/dashboard/crm/settings/integrations/google-calendar'],
  },
  {
    key: 'crm-int-pusher',
    label: 'Pusher',
    icon: <LuRadio className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/pusher',
    matches: ['/dashboard/crm/settings/integrations/pusher'],
  },
  {
    key: 'crm-int-quickbooks',
    label: 'QuickBooks',
    icon: <LuCalculator className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/quickbooks',
    matches: ['/dashboard/crm/settings/integrations/quickbooks'],
  },
  {
    key: 'crm-int-storage',
    label: 'Storage',
    icon: <LuCloud className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/storage',
    matches: ['/dashboard/crm/settings/integrations/storage'],
  },
  {
    key: 'crm-int-social-auth',
    label: 'Social Auth',
    icon: <LuUserCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/social-auth',
    matches: ['/dashboard/crm/settings/integrations/social-auth'],
  },
  {
    key: 'crm-int-email-notifications',
    label: 'Email Notifications',
    icon: <LuMail className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/email-notifications',
    matches: ['/dashboard/crm/settings/integrations/email-notifications'],
  },
  {
    key: 'crm-int-push-notifications',
    label: 'Push Notifications',
    icon: <LuBell className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/push-notifications',
    matches: ['/dashboard/crm/settings/integrations/push-notifications'],
  },
  {
    key: 'crm-int-message-settings',
    label: 'Message Settings',
    icon: <LuMessageSquare className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/message-settings',
    matches: ['/dashboard/crm/settings/integrations/message-settings'],
  },
  {
    key: 'crm-int-ticket-email',
    label: 'Ticket Email',
    icon: <LuMail className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/integrations/ticket-email',
    matches: ['/dashboard/crm/settings/integrations/ticket-email'],
  },
  {
    key: 'crm-roles',
    label: 'Roles',
    icon: <LuShield className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/roles',
    matches: ['/dashboard/crm/settings/roles'],
  },
  {
    key: 'crm-permissions',
    label: 'Permissions',
    icon: <LuKey className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/permissions',
    matches: ['/dashboard/crm/settings/permissions'],
  },
  {
    key: 'crm-permission-types',
    label: 'Permission Types',
    icon: <LuKey className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/permission-types',
    matches: ['/dashboard/crm/settings/permission-types'],
  },
  {
    key: 'crm-modules',
    label: 'Modules',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/modules',
    matches: ['/dashboard/crm/settings/modules'],
  },
  {
    key: 'crm-custom-modules',
    label: 'Custom Modules',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/custom-modules',
    matches: ['/dashboard/crm/settings/custom-modules'],
  },
  {
    key: 'crm-menu-config',
    label: 'Menu Config',
    icon: <LuListFilter className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/menu',
    matches: ['/dashboard/crm/settings/menu'],
  },
  {
    key: 'crm-invitations',
    label: 'Invitations',
    icon: <LuUserPlus className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/invitations',
    matches: ['/dashboard/crm/settings/invitations'],
  },
  {
    key: 'crm-gdpr',
    label: 'GDPR',
    icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/gdpr',
    matches: ['/dashboard/crm/settings/gdpr'],
  },
  {
    key: 'crm-gdpr-purposes',
    label: 'GDPR Purposes',
    icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/gdpr/purposes',
    matches: ['/dashboard/crm/settings/gdpr/purposes'],
  },
  {
    key: 'crm-gdpr-consent-logs',
    label: 'GDPR Consent Logs',
    icon: <LuDatabase className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/gdpr/consent-logs',
    matches: ['/dashboard/crm/settings/gdpr/consent-logs'],
  },
  {
    key: 'crm-gdpr-removal-requests',
    label: 'GDPR Removal Requests',
    icon: <LuBan className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/settings/gdpr/removal-requests',
    matches: ['/dashboard/crm/settings/gdpr/removal-requests'],
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
 * SabFlow canvas `/dashboard/sabflow/flow-builder/<flowId>` is
 * likewise full-bleed, but the SabFlow list stays padded.
 */
const FULL_BLEED_PREFIXES = [
  '/dashboard/chat',
  '/dashboard/telegram/chat',
  '/dashboard/telegram/business-inbox',
];

/**
 * Human-friendly formatter for the topbar credit badge. Compacts to
 * `1.2k` / `3.4M` so the pill width stays stable even when a plan
 * has a huge included allotment.
 */
function formatCredits(n?: number): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return v.toLocaleString();
}

function isFullBleed(pathname: string | null): boolean {
  if (!pathname) return false;

  // SabFlow canvas — only sub-routes of flow-builder, not list / new
  const sfb = pathname.match(/^\/dashboard\/sabflow\/flow-builder\/([^/]+)/);
  if (sfb && sfb[1] !== 'new') return true;

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
    context === 'ad-manager'
      ? [admPrimary, admAdvertise, admCreative, admAudiences, admMeasurement, admSettings]
      : context === 'instagram'
        ? [igPrimary, igContent, igEngage, igGrowth]
        : context === 'meta-suite'
          ? [metaFbPrimary, metaFbContent, metaFbEngage, metaFbGrowth, metaFbCommerce, metaFbAdvanced]
          : context === 'wachat'
            ? [wachatPrimary, wachatAutomate, wachatGrow, wachatConfigure]
            : context === 'sabflow'
              ? [sabflowPrimary, sabflowManage]
              : context === 'telegram'
                ? [tgPrimary, tgMessaging, tgAutomate, tgContent, tgGrow, tgConfigure]
                : context === 'url-shortener'
                  ? [urlShortenerPrimary, urlShortenerManage]
                  : context === 'qr-code-maker'
                    ? [qrCodeMakerPrimary, qrCodeMakerManage]
                    : context === 'team'
                      ? [teamPrimary, teamGovern, teamCollab, teamConfigure]
                      : context === 'crm'
                        ? [crmPrimary, crmSales, crmSalesCrm, crmClients, crmServices, crmCatalog, crmFinance, crmInsights, crmConfigure]
                        : context === 'hrm'
                          ? [hrmPrimary, hrmRecruitment, hrmPeople, hrmPayroll, hrmCompliance, hrmPerformance, hrmEngagement, hrmConfigure]
                          : context === 'settings'
                            ? [settingsPrimary, settingsDeveloper, settingsBilling]
                            : [primaryNav, appsNav];
  let bestKey =
    context === 'ad-manager' ? 'adm-overview' :
    context === 'instagram' ? 'ig-dashboard' :
    context === 'meta-suite' ? 'ms-dashboard' :
    context === 'wachat' ? 'wachat-chat' :
    context === 'sabflow' ? 'sf-flow-builder' :
    context === 'telegram' ? 'tg-dashboard' :
    context === 'url-shortener' ? 'us-links' :
    context === 'qr-code-maker' ? 'qr-generator' :
    context === 'team' ? 'team-overview' :
    context === 'crm' ? 'crm-overview' :
    context === 'hrm' ? 'hrm-overview' :
    context === 'settings' ? 'set-overview' : 'home';
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

            {/* Plan badge — links to billing */}
            <button
              type="button"
              onClick={() => router.push('/dashboard/settings/billing')}
              aria-label={`Plan: ${plan?.name || 'Free'}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-clay-border bg-clay-surface pl-2 pr-3 text-[12px] font-medium text-clay-ink transition-colors hover:border-clay-border-strong"
              style={{
                background:
                  'linear-gradient(180deg, rgba(236,72,153,0.08) 0%, rgba(236,72,153,0.02) 100%)',
              }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, #F472B6 0%, #BE185D 100%)' }}
              >
                <LuStar className="h-3 w-3" strokeWidth={2.5} />
              </span>
              <span className="max-w-[90px] truncate">{plan?.name || 'Free'}</span>
              <span className="hidden text-clay-ink-muted sm:inline">plan</span>
            </button>

            {/* Credits badge — links to credits page */}
            <button
              type="button"
              onClick={() => router.push('/dashboard/settings/credits')}
              aria-label={`Credits: ${plan?.credits ?? 0}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-clay-border bg-clay-surface pl-2 pr-3 text-[12px] font-medium text-clay-ink transition-colors hover:border-clay-border-strong"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <LuZap className="h-3 w-3" strokeWidth={2.5} />
              </span>
              <span>{formatCredits(plan?.credits)}</span>
              <span className="hidden text-clay-ink-muted sm:inline">credits</span>
            </button>

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
            <CommandItem onSelect={() => jump('/dashboard')}>
              <LuMessagesSquare className="mr-2 h-4 w-4" /> Wachat
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
            <CommandItem onSelect={() => jump('/dashboard/ad-manager/ad-accounts')}>
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
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ClaySidebar
          groupTitle={
            context === 'ad-manager' ? 'Ad Manager' :
            context === 'instagram' ? 'Instagram' :
            context === 'meta-suite' ? 'Meta Suite' :
            context === 'wachat' ? 'Wachat' :
            context === 'sabflow' ? 'SabFlow' :
            context === 'telegram' ? 'Telegram' :
            context === 'url-shortener' ? 'URL Shortener' :
            context === 'qr-code-maker' ? 'QR Code Maker' :
            context === 'team' ? 'Team' :
            context === 'crm' ? 'CRM' :
            context === 'hrm' ? 'HRM' :
            context === 'settings' ? 'Settings' : 'SabNode'
          }
          brand={
            context === 'ad-manager' ? <ClayAdManagerBrand /> :
            context === 'instagram' ? <ClayInstagramBrand /> :
            context === 'meta-suite' ? <ClayMetaBrand /> :
            context === 'wachat' ? <ClayWachatBrand /> :
            context === 'sabflow' ? <ClaySabFlowBrand /> :
            context === 'telegram' ? <ClayTelegramBrand /> :
            context === 'url-shortener' ? <ClayUrlShortenerBrand /> :
            context === 'qr-code-maker' ? <ClayQrCodeMakerBrand /> :
            context === 'team' ? <ClayTeamBrand /> :
            context === 'crm' ? <ClayCrmBrand /> :
            context === 'hrm' ? <ClayCrmBrand /> :
            context === 'settings' ? <ClaySettingsBrand /> :
            undefined
          }
          groups={
            context === 'ad-manager'
              ? [
                  { items: admPrimary.map(toNavItem) },
                  { title: 'Advertise', addable: false, items: admAdvertise.map(toNavItem) },
                  { title: 'Creative & Planning', addable: false, items: admCreative.map(toNavItem) },
                  { title: 'Audiences', addable: false, items: admAudiences.map(toNavItem) },
                  { title: 'Measurement', addable: false, items: admMeasurement.map(toNavItem) },
                  { title: 'Settings', addable: false, items: admSettings.map(toNavItem) },
                ]
              : context === 'instagram'
                ? [
                    { items: igPrimary.map(toNavItem) },
                    { title: 'Content', addable: false, items: igContent.map(toNavItem) },
                    { title: 'Engagement', addable: false, items: igEngage.map(toNavItem) },
                    { title: 'Growth', addable: false, items: igGrowth.map(toNavItem) },
                  ]
                : context === 'meta-suite'
                  ? [
                      { items: metaFbPrimary.map(toNavItem) },
                      { title: 'Content', addable: false, items: metaFbContent.map(toNavItem) },
                      { title: 'Engagement', addable: false, items: metaFbEngage.map(toNavItem) },
                      { title: 'Growth', addable: false, items: metaFbGrowth.map(toNavItem) },
                      { title: 'Commerce', addable: false, items: metaFbCommerce.map(toNavItem) },
                      { title: 'Advanced', addable: false, items: metaFbAdvanced.map(toNavItem) },
                    ]
                  : context === 'wachat'
                ? [
                    { items: wachatPrimary.map(toNavItem) },
                    {
                      title: 'Automate',
                      addable: false,
                      items: wachatAutomate.map(toNavItem),
                    },
                    {
                      title: 'Grow',
                      addable: false,
                      items: wachatGrow.map(toNavItem),
                    },
                    {
                      title: 'Configure',
                      addable: true,
                      onAdd: () => router.push('/dashboard/integrations'),
                      items: wachatConfigure.map(toNavItem),
                    },
                  ]
                : context === 'sabflow'
                ? [
                    { items: sabflowPrimary.map(toNavItem) },
                    {
                      title: 'Manage',
                      addable: false,
                      items: sabflowManage.map(toNavItem),
                    },
                  ]
                : context === 'telegram'
                ? [
                    { items: tgPrimary.map(toNavItem) },
                    { title: 'Messaging', addable: false, items: tgMessaging.map(toNavItem) },
                    { title: 'Automate', addable: false, items: tgAutomate.map(toNavItem) },
                    { title: 'Content', addable: false, items: tgContent.map(toNavItem) },
                    { title: 'Grow', addable: false, items: tgGrow.map(toNavItem) },
                    {
                      title: 'Configure',
                      addable: true,
                      onAdd: () => router.push('/dashboard/telegram/connections'),
                      items: tgConfigure.map(toNavItem),
                    },
                  ]
                : context === 'url-shortener'
                ? [
                    { items: urlShortenerPrimary.map(toNavItem) },
                    { title: 'Manage', addable: false, items: urlShortenerManage.map(toNavItem) },
                  ]
                : context === 'qr-code-maker'
                ? [
                    { items: qrCodeMakerPrimary.map(toNavItem) },
                    { title: 'Manage', addable: false, items: qrCodeMakerManage.map(toNavItem) },
                  ]
                : context === 'team'
                ? [
                    { items: teamPrimary.map(toNavItem) },
                    { title: 'Govern', addable: false, items: teamGovern.map(toNavItem) },
                    {
                      title: 'Collaborate',
                      addable: false,
                      items: teamCollab.map(toNavItem),
                    },
                    {
                      title: 'Configure',
                      addable: true,
                      onAdd: () => router.push('/dashboard/team/manage-users'),
                      items: teamConfigure.map(toNavItem),
                    },
                  ]
                : context === 'crm'
                ? [
                    { items: crmPrimary.map(toNavItem) },
                    { title: 'Sales', addable: false, items: crmSales.map(toNavItem) },
                    { title: 'Sales CRM', addable: false, items: crmSalesCrm.map(toNavItem) },
                    { title: 'Clients', addable: false, items: crmClients.map(toNavItem) },
                    { title: 'Services', addable: false, items: crmServices.map(toNavItem) },
                    { title: 'Catalog', addable: false, items: crmCatalog.map(toNavItem) },
                    { title: 'Finance', addable: false, items: crmFinance.map(toNavItem) },
                    { title: 'Insights', addable: false, items: crmInsights.map(toNavItem) },
                    {
                      title: 'Configure',
                      addable: true,
                      onAdd: () => router.push('/dashboard/crm/integrations'),
                      items: crmConfigure.map(toNavItem),
                    },
                  ]
                : context === 'hrm'
                ? [
                    { items: hrmPrimary.map(toNavItem) },
                    { title: 'Recruitment', addable: false, items: hrmRecruitment.map(toNavItem) },
                    { title: 'People', addable: false, items: hrmPeople.map(toNavItem) },
                    { title: 'Payroll', addable: false, items: hrmPayroll.map(toNavItem) },
                    { title: 'Compliance', addable: false, items: hrmCompliance.map(toNavItem) },
                    { title: 'Performance', addable: false, items: hrmPerformance.map(toNavItem) },
                    { title: 'Engagement', addable: false, items: hrmEngagement.map(toNavItem) },
                    {
                      title: 'Configure',
                      addable: true,
                      onAdd: () => router.push('/dashboard/hrm/payroll/settings'),
                      items: hrmConfigure.map(toNavItem),
                    },
                  ]
                : context === 'settings'
                ? [
                    { items: settingsPrimary.map(toNavItem) },
                    { title: 'Developer', addable: false, items: settingsDeveloper.map(toNavItem) },
                    { title: 'Billing', addable: false, items: settingsBilling.map(toNavItem) },
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
            // Wachat & Meta Suite pages get generous consistent padding.
            // Page content uses the FULL available width (no max-width cap)
            // so tables and cards don't look shrink-wrapped on wide screens.
            (context === 'wachat' || context === 'meta-suite' || context === 'instagram' || context === 'ad-manager' || context === 'sabflow' || context === 'telegram' || context === 'url-shortener' || context === 'qr-code-maker' || context === 'team' || context === 'crm' || context === 'hrm' || context === 'settings') && !fullBleed && 'px-10 pt-8 pb-12',
          )}
        >
          {fullBleed ? (
            // Full-bleed: children get 100% width AND 100% height
            <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
              {children}
            </div>
          ) : (context === 'wachat' || context === 'meta-suite' || context === 'instagram' || context === 'ad-manager' || context === 'sabflow' || context === 'telegram' || context === 'url-shortener' || context === 'qr-code-maker' || context === 'team' || context === 'crm' || context === 'hrm' || context === 'settings') ? (
            // Wachat pages: full width AND full height — pages can fill
            // the entire available space. Each page's root <div> owns
            // its own clay-enter animation cascade so staggered child
            // reveals keep working.
            <div className="flex h-full w-full flex-col">{children}</div>
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

function WabaHealthDot({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const isGreen = s === 'available' || s === 'connected';
  const isAmber = s === 'limited' || s === 'flagged';
  const color = isGreen ? 'bg-emerald-500' : isAmber ? 'bg-amber-500' : 'bg-red-500';
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider leading-none',
      isGreen && 'bg-emerald-500/10 text-emerald-600',
      isAmber && 'bg-amber-500/10 text-amber-600',
      !isGreen && !isAmber && 'bg-red-500/10 text-red-600',
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
      {label}
    </span>
  );
}

function ClayWachatBrand() {
  const router = useRouter();
  const { projects, activeProject, setActiveProjectId } = useProject();
  const [healthStatus, setHealthStatus] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!activeProject?._id) { setHealthStatus(undefined); return; }
    let cancelled = false;
    (async () => {
      try {
        const { getWabaHealthStatus } = await import('@/app/actions/whatsapp.actions');
        const { healthStatus: hs } = await getWabaHealthStatus(activeProject._id.toString());
        if (!cancelled && hs?.can_send_message) {
          setHealthStatus(hs.can_send_message);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [activeProject?._id]);

  const onSelect = React.useCallback(
    (id: string) => {
      setActiveProjectId(id);
      setHealthStatus(undefined); // reset on switch
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
              <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-clay-ink-fade font-medium">
                Project
                <WabaHealthDot status={healthStatus} />
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

/* ── Ad Manager sidebar brand ──────────────────────────────────── */

function ClayAdManagerBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #C7D2FE 0%, #4F46E5 100%)' }}
        >
          <LuMegaphone className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Ad Manager</p>
          <p className="text-[11px] text-clay-ink-muted">Facebook & Instagram Ads</p>
        </div>
      </div>
    </div>
  );
}

/* ── Instagram sidebar brand ──────────────────────────────────── */

function ClayInstagramBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #F9CE34 0%, #EE2A7B 50%, #6228D7 100%)' }}
        >
          <LuImage className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Instagram</p>
          <p className="text-[11px] text-clay-ink-muted">Feed, Stories & Reels</p>
        </div>
      </div>
    </div>
  );
}

/* ── SabFlow sidebar brand ────────────────────────────────────── */

function ClaySabFlowBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)' }}
        >
          <LuWorkflow className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">SabFlow</p>
          <p className="text-[11px] text-clay-ink-muted">Visual automation engine</p>
        </div>
      </div>
    </div>
  );
}

/* ── Telegram sidebar brand ───────────────────────────────────── */

function ClaySettingsBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #94A3B8 0%, #475569 100%)' }}
        >
          <LuSettings className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Settings</p>
          <p className="text-[11px] text-clay-ink-muted">Account, billing & workspace</p>
        </div>
      </div>
    </div>
  );
}

function ClayTeamBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #F472B6 0%, #BE185D 100%)' }}
        >
          <LuUsers className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Team</p>
          <p className="text-[11px] text-clay-ink-muted">Members, Roles & Collaboration</p>
        </div>
      </div>
    </div>
  );
}

function ClayTelegramBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)' }}
        >
          <LuSend className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Telegram</p>
          <p className="text-[11px] text-clay-ink-muted">Bots, Channels & Business</p>
        </div>
      </div>
    </div>
  );
}

/* ── Meta Suite sidebar brand ─────────────────────────────────── */

function ClayMetaBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #1877F2 100%)' }}
        >
          <LuGlobe className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Meta Suite</p>
          <p className="text-[11px] text-clay-ink-muted">Facebook & Instagram</p>
        </div>
      </div>
    </div>
  );
}

/* ── URL Shortener sidebar brand ─────────────────────────────── */

function ClayUrlShortenerBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #34D399 0%, #059669 100%)' }}
        >
          <LuLink className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">URL Shortener</p>
          <p className="text-[11px] text-clay-ink-muted">Trackable short links</p>
        </div>
      </div>
    </div>
  );
}

/* ── CRM sidebar brand ───────────────────────────────────────── */

function ClayCrmBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #B07B7B 0%, #6F2E3A 100%)' }}
        >
          <LuBriefcase className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">CRM</p>
          <p className="text-[11px] text-clay-ink-muted">Sales, Ops & Accounting</p>
        </div>
      </div>
    </div>
  );
}

/* ── QR Code Maker sidebar brand ─────────────────────────────── */

function ClayQrCodeMakerBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)' }}
        >
          <LuQrCode className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">QR Code Maker</p>
          <p className="text-[11px] text-clay-ink-muted">Customizable QR codes</p>
        </div>
      </div>
    </div>
  );
}
