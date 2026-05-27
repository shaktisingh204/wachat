'use client';

/* -------------------------------------------------------------------------- */
/*  Shared marketing-site header                                              */
/*                                                                            */
/*  Single source of truth for the public landing-site nav: Zoho-style        */
/*  mega-menu on desktop, expandable accordion drawer on mobile. Used by /,   */
/*  /products, /enterprise, /customers, /partners, /resources, /pricing,      */
/*  /features, /features/[slug] and every other marketing route.              */
/* -------------------------------------------------------------------------- */

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Bot,
  Brain,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  DollarSign,
  Download,
  Eye,
  FileText,
  Filter,
  GitBranch,
  Globe,
  Hash,
  Headphones,
  Image as ImageIcon,
  Inbox,
  Instagram,
  Layers,
  LineChart,
  Mail,
  Menu,
  MessageCircle,
  MessageSquare,
  Reply,
  Search,
  Send,
  Shield,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  Users2,
  Workflow,
  X,
  Zap,
} from 'lucide-react';

import { SabNodeLogo } from '@/components/zoruui-domain/logo';
import { getSession } from '@/app/actions';

/* -------------------------------------------------------------------------- */
/*  Catalog                                                                   */
/* -------------------------------------------------------------------------- */

type NavItem = { label: string; key: string; href: string; dropdown?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: 'Products', key: 'products', href: '/products', dropdown: true },
  { label: 'Features', key: 'features', href: '/features' },
  { label: 'Enterprise', key: 'enterprise', href: '/enterprise' },
  { label: 'Customers', key: 'customers', href: '/customers', dropdown: true },
  { label: 'Partners', key: 'partners', href: '/partners', dropdown: true },
  { label: 'Resources', key: 'resources', href: '/resources', dropdown: true },
  { label: 'Pricing', key: 'pricing', href: '/pricing' },
];

const FEATURE_SLUG_OVERRIDES: Record<string, string> = {
  Chat: 'shared-inbox',
  'WhatsApp API': 'whatsapp-business-api',
  Email: 'email-inbox',
  Chatbot: 'chatbot-rules',
  'A/B testing': 'ab-testing',
  'OAuth 2': 'oauth',
  'Meta Flow editor': 'meta-flow-editor',
  'MCP server': 'mcp-server',
  'REST API': 'rest-api',
  'Web chat widget': 'web-chat-widget',
  Analytics: 'dashboards',
};

function featureSlugFor(name: string): string {
  if (FEATURE_SLUG_OVERRIDES[name]) return FEATURE_SLUG_OVERRIDES[name];
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type Product = { icon: any; name: string; brand?: string; color: string; tint: string; desc: string };

const MEGA_CATEGORIES: Array<{ id: string; label: string; count: number }> = [
  { id: 'featured', label: 'Recent Launches', count: 8 },
  { id: 'conversations', label: 'Conversations', count: 8 },
  { id: 'automation', label: 'Automation', count: 6 },
  { id: 'customer', label: 'Customer data', count: 6 },
  { id: 'growth', label: 'Growth', count: 6 },
  { id: 'analytics', label: 'Analytics', count: 6 },
  { id: 'commerce', label: 'Commerce', count: 5 },
  { id: 'developer', label: 'Developer', count: 6 },
];

const MEGA_PRODUCTS: Record<string, Product[]> = {
  featured: [
    { icon: MessageSquare, name: 'Chat', brand: 'Wachat', color: '#25D366', tint: '#DCFCE7', desc: 'Unified WhatsApp, Instagram, email and web-chat inbox for your team.' },
    { icon: Workflow, name: 'Flow Builder', brand: 'SabFlow', color: '#4F46E5', tint: '#EEF2FF', desc: 'Drag-and-drop canvas for business automations. 42 node types, zero code.' },
    { icon: Users2, name: 'Contacts', brand: 'CRM', color: '#8B5CF6', tint: '#F3E8FF', desc: 'Auto-enriched contact records, pipeline, tags and segments.' },
    { icon: Bot, name: 'Chatbot', brand: 'Rules', color: '#EC4899', tint: '#FCE7F3', desc: 'Keyword triggers — contains, exact, regex — with instant auto-replies.' },
    { icon: Brain, name: 'AI Studio', brand: 'Private LLM', color: '#7C3AED', tint: '#EDE9FE', desc: 'Tenant-scoped models, tool-calling, retrieval — grounded on your data.' },
    { icon: Send, name: 'Broadcasts', brand: 'Campaigns', color: '#06B6D4', tint: '#CFFAFE', desc: 'Send Meta-approved templates to 100k+ contacts with delivery reporting.' },
    { icon: LineChart, name: 'Analytics', brand: 'Dashboards', color: '#F59E0B', tint: '#FEF3C7', desc: 'Real-time outcome dashboards stitched from every module.' },
    { icon: Zap, name: 'Webhooks', brand: 'Events', color: '#10B981', tint: '#D1FAE5', desc: 'Inbound and outbound event bridge with retries and signed payloads.' },
  ],
  conversations: [
    { icon: Inbox, name: 'Shared Inbox', color: '#4F46E5', tint: '#EEF2FF', desc: 'Every channel in one queue. Assign, route, resolve — together.' },
    { icon: MessageSquare, name: 'WhatsApp API', color: '#25D366', tint: '#DCFCE7', desc: 'Official Cloud API access. Templates, rich media, list and button messages.' },
    { icon: Instagram, name: 'Instagram DM', color: '#E4405F', tint: '#FCE7F3', desc: 'Reply to DMs, story mentions and comments in the same inbox.' },
    { icon: Mail, name: 'Email', color: '#8B5CF6', tint: '#F3E8FF', desc: 'Threaded email with gmail/Outlook connectors and signatures.' },
    { icon: MessageCircle, name: 'Web chat widget', color: '#06B6D4', tint: '#CFFAFE', desc: 'Embed a chat bubble on your site. Inherits the AI layer automatically.' },
    { icon: Clock, name: 'Business hours', color: '#F59E0B', tint: '#FEF3C7', desc: 'Route to humans in-hours, auto-reply otherwise — per team or channel.' },
    { icon: Reply, name: 'Canned replies', color: '#EC4899', tint: '#FCE7F3', desc: 'Shared library of reply snippets with merge fields and keyboard shortcuts.' },
    { icon: Tag, name: 'Chat labels', color: '#10B981', tint: '#D1FAE5', desc: 'Color-coded labels, auto-tagging rules and per-label SLA timers.' },
  ],
  automation: [
    { icon: Workflow, name: 'Flow Builder', color: '#4F46E5', tint: '#EEF2FF', desc: 'Triggers → conditions → actions on an infinite canvas with version history.' },
    { icon: Bot, name: 'Chatbot rules', color: '#EC4899', tint: '#FCE7F3', desc: 'Keyword-triggered replies with contains / exact / regex matching.' },
    { icon: Brain, name: 'AI Studio', color: '#7C3AED', tint: '#EDE9FE', desc: 'Private LLM with tools, retrieval and guardrails. Deploy anywhere.' },
    { icon: Zap, name: 'Triggers', color: '#F59E0B', tint: '#FEF3C7', desc: 'Fire a flow on order paid, message received, webhook call or schedule.' },
    { icon: GitBranch, name: 'A/B testing', color: '#8B5CF6', tint: '#F3E8FF', desc: 'Split traffic across flow variants. Pick the winner automatically.' },
    { icon: Calendar, name: 'Scheduler', color: '#06B6D4', tint: '#CFFAFE', desc: "One-off and recurring sends in the recipient's local timezone." },
  ],
  customer: [
    { icon: Users2, name: 'Contacts', color: '#8B5CF6', tint: '#F3E8FF', desc: 'Every conversation becomes a contact record — auto-deduplicated.' },
    { icon: Filter, name: 'Segments', color: '#4F46E5', tint: '#EEF2FF', desc: 'Dynamic audiences from any signal. Reuse across flows, broadcasts, AI.' },
    { icon: Tag, name: 'Tags', color: '#EC4899', tint: '#FCE7F3', desc: 'Multi-value tags with auto-apply rules and bulk edit.' },
    { icon: Layers, name: 'Kanban pipeline', color: '#F59E0B', tint: '#FEF3C7', desc: 'Lead → qualified → proposal → won. Drag, filter, score.' },
    { icon: Database, name: 'Custom fields', color: '#10B981', tint: '#D1FAE5', desc: 'Add structured properties to any contact or deal — text, date, number, JSON.' },
    { icon: Shield, name: 'Opt-in status', color: '#06B6D4', tint: '#CFFAFE', desc: 'Per-channel consent tracking with audit log and export.' },
  ],
  growth: [
    { icon: Send, name: 'Broadcasts', color: '#06B6D4', tint: '#CFFAFE', desc: 'Ship Meta-approved templates to 100k+ contacts. Live delivery reporting.' },
    { icon: FileText, name: 'Templates', color: '#4F46E5', tint: '#EEF2FF', desc: 'Template gallery with in-app approval flow and variable preview.' },
    { icon: Calendar, name: 'Scheduler', color: '#F59E0B', tint: '#FEF3C7', desc: 'Queue sends for time zones, business hours or specific dates.' },
    { icon: TrendingUp, name: 'Campaigns', color: '#EC4899', tint: '#FCE7F3', desc: 'Multi-step campaigns with A/B arms, holdouts and attribution.' },
    { icon: Globe, name: 'Landing pages', color: '#8B5CF6', tint: '#F3E8FF', desc: 'Capture opt-ins on hosted pages that sync straight to Contacts.' },
    { icon: ImageIcon, name: 'Catalog sync', color: '#10B981', tint: '#D1FAE5', desc: 'Keep WhatsApp Business catalog in sync with Shopify / Stripe.' },
  ],
  analytics: [
    { icon: LineChart, name: 'Dashboards', color: '#F59E0B', tint: '#FEF3C7', desc: 'Overview of sent, delivered, read, failed — with channel split.' },
    { icon: Activity, name: 'Flow analytics', color: '#4F46E5', tint: '#EEF2FF', desc: 'Per-node success, drop-off, revenue and SLA metrics.' },
    { icon: Star, name: 'CSAT', color: '#EC4899', tint: '#FCE7F3', desc: 'Collect and segment chat ratings. Auto-trigger on resolved conversations.' },
    { icon: Download, name: 'Exports', color: '#8B5CF6', tint: '#F3E8FF', desc: 'Download raw events, CSV exports or sync to your warehouse.' },
    { icon: Target, name: 'Attribution', color: '#7C3AED', tint: '#EDE9FE', desc: 'See which flow, campaign or channel actually drove the outcome.' },
    { icon: Eye, name: 'Heatmaps', color: '#06B6D4', tint: '#CFFAFE', desc: 'Visualize activity over time-of-day and day-of-week by channel.' },
  ],
  commerce: [
    { icon: DollarSign, name: 'Payments', color: '#10B981', tint: '#D1FAE5', desc: 'Collect payments inside the chat via Stripe, Razorpay and UPI.' },
    { icon: ImageIcon, name: 'Catalog', color: '#EC4899', tint: '#FCE7F3', desc: 'WhatsApp Business catalog manager with live stock + price sync.' },
    { icon: FileText, name: 'Orders', color: '#4F46E5', tint: '#EEF2FF', desc: 'Every order becomes a timeline event on the contact record.' },
    { icon: Reply, name: 'Cart recovery', color: '#F59E0B', tint: '#FEF3C7', desc: 'Template flow that messages abandoners 20 minutes after drop-off.' },
    { icon: BadgeCheck, name: 'Post-purchase', color: '#8B5CF6', tint: '#F3E8FF', desc: 'Confirmation, tracking, reorder and review prompts out of the box.' },
  ],
  developer: [
    { icon: Hash, name: 'REST API', color: '#4F46E5', tint: '#EEF2FF', desc: 'Typed REST + webhooks for every object and event. SDKs for JS, Python and Go.' },
    { icon: Zap, name: 'Webhooks', color: '#10B981', tint: '#D1FAE5', desc: 'Inbound and outbound, with retries, signing and dead-letter queue.' },
    { icon: FileText, name: 'Meta Flow editor', color: '#EC4899', tint: '#FCE7F3', desc: 'Design, publish and version Meta Flow screens from inside SabNode.' },
    { icon: Brain, name: 'MCP server', color: '#7C3AED', tint: '#EDE9FE', desc: 'Plug any LLM into your SabNode workspace via Model Context Protocol.' },
    { icon: Shield, name: 'OAuth 2', color: '#8B5CF6', tint: '#F3E8FF', desc: 'Scoped access tokens with audit log and granular permissions.' },
    { icon: GitBranch, name: 'Environments', color: '#F59E0B', tint: '#FEF3C7', desc: 'Sandbox → staging → production with per-env credentials and domains.' },
  ],
};

const SIMPLE_DROPDOWNS: Record<string, Array<{ label: string; sub: string; href: string; icon: any; color: string }>> = {
  customers: [
    { label: 'Case studies', sub: 'How teams ship faster on SabNode', href: '/customers', icon: BookOpen, color: '#4F46E5' },
    { label: 'Customer wall', sub: '4,812 workspaces and counting', href: '/customers', icon: Users2, color: '#8B5CF6' },
    { label: 'Reviews', sub: 'G2, Capterra, Product Hunt', href: '/customers', icon: Star, color: '#F59E0B' },
    { label: 'Community', sub: 'Join 8,000+ operators on Slack', href: '/customers', icon: MessageCircle, color: '#06B6D4' },
  ],
  partners: [
    { label: 'Solution partners', sub: 'Build on SabNode for clients', href: '/partners', icon: Users2, color: '#4F46E5' },
    { label: 'Referral program', sub: 'Earn 20% for 12 months', href: '/partners', icon: DollarSign, color: '#10B981' },
    { label: 'Affiliates', sub: 'Tracked links, monthly payouts', href: '/partners', icon: Globe, color: '#EC4899' },
    { label: 'App directory', sub: 'Publish your integration', href: '/partners', icon: Layers, color: '#8B5CF6' },
  ],
  resources: [
    { label: 'Docs', sub: 'API, webhooks, SDKs', href: '/resources', icon: BookOpen, color: '#4F46E5' },
    { label: 'Journal', sub: 'Product stories + deep dives', href: '/resources', icon: FileText, color: '#8B5CF6' },
    { label: 'Changelog', sub: 'Ship notes, every Friday', href: '/resources', icon: Sparkles, color: '#EC4899' },
    { label: 'Help center', sub: 'Guides + troubleshooting', href: '/resources', icon: Headphones, color: '#06B6D4' },
    { label: 'Status', sub: '99.99% · check uptime', href: '/resources', icon: Activity, color: '#10B981' },
    { label: 'Security', sub: 'SOC 2 · GDPR · DPA', href: '/resources', icon: Shield, color: '#F59E0B' },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Public header component                                                   */
/* -------------------------------------------------------------------------- */

type LandingHeaderProps = {
  /** Marks one nav item as the current page (e.g. "features", "pricing"). */
  active?: string;
  /** Optional session + loading; if omitted the header fetches its own. */
  session?: any;
  loading?: boolean;
};

export function LandingHeader({ active, session: sessionProp, loading: loadingProp }: LandingHeaderProps = {}) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [autoSession, setAutoSession] = React.useState<any>(null);
  const [autoLoading, setAutoLoading] = React.useState<boolean>(sessionProp === undefined);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Self-fetch session if caller didn't pass one — keeps the header drop-in
  // for any landing page without each route having to plumb auth state.
  React.useEffect(() => {
    if (sessionProp !== undefined) return;
    let cancelled = false;
    getSession()
      .then((s) => {
        if (!cancelled) {
          setAutoSession(s);
          setAutoLoading(false);
        }
      })
      .catch(() => !cancelled && setAutoLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sessionProp]);

  const session = sessionProp !== undefined ? sessionProp : autoSession;
  const loading = loadingProp !== undefined ? loadingProp : autoLoading;

  // Escape closes any open menu and the mobile drawer.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lock body scroll while the mobile drawer is open.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const close = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(null);
  }, []);

  // Small grace period so moving the cursor between trigger and panel
  // doesn't immediately close the menu (kills the flicker).
  const scheduleClose = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  }, []);

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openMenu = React.useCallback((key: string) => {
    cancelClose();
    setOpen(key);
  }, [cancelClose]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b sn-hair bg-white/88 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4 sm:h-16 sm:gap-4 md:gap-6 md:px-6">
          <Link href="/" className="flex flex-shrink-0 items-center gap-2" aria-label="SabNode home">
            <SabNodeLogo className="h-6 w-auto sm:h-7" />
          </Link>

          <nav
            className="ml-2 hidden items-center gap-0.5 rounded-full border border-black/[0.06] bg-black/[0.02] p-1 lg:flex"
            aria-label="Primary"
          >
            {NAV_ITEMS.map((item) => {
              const isOpen = open === item.key;
              const isActive = active === item.key;
              const hasDropdown = !!item.dropdown;
              const className = `inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition-colors ${
                isOpen || isActive
                  ? 'border border-[#4F46E5]/30 bg-white text-[#4F46E5] shadow-sm'
                  : 'text-[#121126] hover:text-[#4F46E5]'
              }`;
              if (hasDropdown) {
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onMouseEnter={() => openMenu(item.key)}
                    onFocus={() => openMenu(item.key)}
                    aria-expanded={isOpen}
                    aria-haspopup="menu"
                    className={className}
                  >
                    {item.label}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </Link>
                );
              }
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={className}
                  onMouseEnter={scheduleClose}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <button
              aria-label="Search"
              className="hidden h-9 w-9 items-center justify-center rounded-full text-[#4A4A6B] hover:bg-black/5 hover:text-[#121126] sm:inline-flex"
            >
              <Search className="h-4 w-4" />
            </button>
            <button className="hidden h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-[#4A4A6B] hover:bg-black/5 hover:text-[#121126] xl:inline-flex">
              <Globe className="h-3.5 w-3.5" /> English
            </button>
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-md bg-black/5" />
            ) : session?.user ? (
              <Link
                href="/wachat"
                className="sn-btn-primary inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold sm:px-4 sm:text-[13px]"
              >
                <span className="hidden sm:inline">Open workspace</span>
                <span className="sm:hidden">Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden h-9 items-center px-3 text-[13.5px] font-semibold text-[#121126] transition-colors hover:text-[#4F46E5] sm:inline-flex"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="sn-btn-primary inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold sm:px-4 sm:text-[13.5px]"
                >
                  Sign Up
                </Link>
              </>
            )}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 text-[#121126] lg:hidden"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open === 'products' && (
          <div onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
            <ProductsMegaMenu onClose={close} />
          </div>
        )}
        {open && open !== 'products' && SIMPLE_DROPDOWNS[open] && (
          <div onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
            <SimpleDropdown items={SIMPLE_DROPDOWNS[open]} onClose={close} />
          </div>
        )}
      </header>

      {open && (
        <div
          aria-hidden
          onClick={close}
          onMouseEnter={scheduleClose}
          className="fixed inset-0 z-40 animate-in fade-in bg-[#121126]/15 backdrop-blur-[1px] duration-150"
          style={{ top: '64px' }}
        />
      )}

      {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} session={session} />}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Products mega-menu                                                        */
/* -------------------------------------------------------------------------- */

function ProductsMegaMenu({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = React.useState<'apps' | 'suites' | 'workspace' | 'marketplace'>('apps');
  const [cat, setCat] = React.useState<string>('featured');
  const [search, setSearch] = React.useState('');

  const activeCat = MEGA_CATEGORIES.find((c) => c.id === cat)!;
  const items = MEGA_PRODUCTS[cat] ?? [];
  const filtered = search
    ? items.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.desc.toLowerCase().includes(search.toLowerCase()) ||
          (p.brand ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  return (
    <div className="absolute left-0 right-0 top-full border-t sn-hair bg-white shadow-[0_24px_60px_-20px_rgba(17,17,38,0.16)]">
      <div className="border-b sn-hair bg-[#FAF9F4]">
        <div className="container mx-auto flex h-12 items-center gap-6 px-4 md:px-6">
          {([
            ['apps', 'Apps'],
            ['suites', 'Suites'],
            ['workspace', 'SabNode One'],
            ['marketplace', 'Marketplace'],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative inline-flex h-12 items-center text-[13.5px] font-semibold transition-colors ${
                tab === k ? 'text-[#4F46E5]' : 'text-[#4A4A6B] hover:text-[#121126]'
              }`}
            >
              {l}
              {tab === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 rounded-t bg-[#4F46E5]" />}
            </button>
          ))}
          <span className="h-4 w-px bg-black/10" />
          <Link
            href="/products"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] hover:text-[#4338CA]"
          >
            Explore all products <ChevronRight className="h-3 w-3" />
          </Link>
          <button
            aria-label="Close"
            onClick={onClose}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[#4A4A6B] hover:bg-black/5 hover:text-[#121126]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 md:col-span-3 lg:col-span-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7878A1]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="I'm looking for…"
                className="h-10 w-full rounded-md border sn-hair bg-white pl-9 pr-3 text-[13px] text-[#121126] placeholder:text-[#7878A1] focus:border-[#4F46E5]/50 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
              />
            </div>

            <ul className="max-h-[440px] overflow-y-auto pr-1">
              {MEGA_CATEGORIES.map((c) => {
                const isActive = cat === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setCat(c.id)}
                      onMouseEnter={() => setCat(c.id)}
                      className={`flex h-9 w-full items-center justify-between rounded-md px-3 text-left text-[13px] font-semibold transition-colors ${
                        isActive ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-[#4A4A6B] hover:bg-black/[0.03] hover:text-[#121126]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5]" />}
                        {c.label}
                      </span>
                      <span className={`font-mono text-[10.5px] tabular-nums ${isActive ? 'text-[#4F46E5]/70' : 'text-[#7878A1]'}`}>
                        {c.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/products"
              onClick={onClose}
              className="sn-btn-primary mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md px-4 text-[12.5px] font-bold uppercase tracking-[0.1em]"
            >
              Explore all products <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </aside>

          <div className="col-span-12 md:col-span-9 lg:col-span-9">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h3 className="font-display text-[22px] leading-none text-[#121126] md:text-[26px]">{activeCat.label}</h3>
              <span className="font-mono text-[11px] tabular-nums text-[#7878A1]">
                {filtered.length} / {items.length}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#7878A1]">
                No products match "{search}" in {activeCat.label.toLowerCase()}.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => (
                  <MegaProductCard key={p.name} product={p} onClick={onClose} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MegaProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const Icon = product.icon;
  return (
    <article className="group rounded-xl border border-transparent bg-[#F7F9FC] p-4 transition-all hover:border-[#4F46E5]/10 hover:bg-white hover:shadow-[0_14px_30px_-14px_rgba(79,70,229,0.25)] hover:ring-1 hover:ring-[#4F46E5]/15">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white"
          style={{
            background: `linear-gradient(135deg, ${product.color}, ${product.color}cc)`,
            boxShadow: `0 6px 16px -6px ${product.color}66`,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          {product.brand && (
            <div className="text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-[#7878A1]">
              SabNode · {product.brand}
            </div>
          )}
          <div className={`truncate text-[14.5px] font-bold leading-tight text-[#121126] ${product.brand ? 'mt-0.5' : ''}`}>
            {product.name}
          </div>
        </div>
      </div>
      <p className="mb-3 min-h-[3.5em] text-[12.5px] leading-snug text-[#4A4A6B]">{product.desc}</p>
      <Link
        href={`/features/${featureSlugFor(product.name)}`}
        onClick={onClick}
        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F46E5] group-hover:text-[#4338CA]"
      >
        Learn more <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Simple dropdown (customers, partners, resources)                          */
/* -------------------------------------------------------------------------- */

function SimpleDropdown({
  items,
  onClose,
}: {
  items: Array<{ label: string; sub: string; href: string; icon: any; color: string }>;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-0 right-0 top-full border-t sn-hair bg-white shadow-[0_24px_60px_-20px_rgba(17,17,38,0.16)]">
      <div className="container mx-auto px-4 py-6 md:px-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                href={it.href}
                onClick={onClose}
                className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-[#F7F9FC]"
              >
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: `linear-gradient(135deg, ${it.color}, ${it.color}cc)` }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#121126]">
                    {it.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#4A4A6B]">{it.sub}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mobile drawer — expandable accordion mirroring the desktop mega-menu      */
/* -------------------------------------------------------------------------- */

function MobileNav({ onClose, session }: { onClose: () => void; session: any }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [productCat, setProductCat] = React.useState<string>('featured');

  return (
    <div
      className="fixed inset-0 z-[60] flex bg-black/40 lg:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ml-auto flex h-full w-[92%] max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <div className="flex h-14 items-center justify-between border-b sn-hair px-4 sm:h-16 sm:px-5">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <SabNodeLogo className="h-7 w-auto" />
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <nav className="p-3 sm:p-4" aria-label="Mobile primary">
            {NAV_ITEMS.map((item) => {
              const hasDropdown = !!item.dropdown;
              const isExpanded = expanded === item.key;
              return (
                <div key={item.key} className="border-b border-black/[0.06] last:border-b-0">
                  <div className="flex items-stretch">
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="flex-1 px-2 py-3 text-[15px] font-semibold text-[#121126] hover:text-[#4F46E5]"
                    >
                      {item.label}
                    </Link>
                    {hasDropdown && (
                      <button
                        onClick={() => setExpanded(isExpanded ? null : item.key)}
                        aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                        aria-expanded={isExpanded}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[#4A4A6B] hover:bg-black/5 hover:text-[#121126]"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {hasDropdown && isExpanded && (
                    <div className="pb-3">
                      {item.key === 'products' ? (
                        <MobileProductsPanel
                          cat={productCat}
                          onCat={setProductCat}
                          onClose={onClose}
                        />
                      ) : SIMPLE_DROPDOWNS[item.key] ? (
                        <MobileSimplePanel items={SIMPLE_DROPDOWNS[item.key]} onClose={onClose} />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t sn-hair p-4">
          {session?.user ? (
            <Link
              href="/wachat"
              onClick={onClose}
              className="sn-btn-primary col-span-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-md text-[14px] font-semibold"
            >
              Open workspace <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-md border border-black/10 text-[13px] font-semibold text-[#121126] hover:bg-black/5"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={onClose}
                className="sn-btn-primary inline-flex h-11 items-center justify-center rounded-md text-[13px] font-semibold"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileProductsPanel({
  cat,
  onCat,
  onClose,
}: {
  cat: string;
  onCat: (id: string) => void;
  onClose: () => void;
}) {
  const items = MEGA_PRODUCTS[cat] ?? [];
  return (
    <div className="space-y-3 rounded-xl bg-[#FAF9F4] p-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {MEGA_CATEGORIES.map((c) => {
          const isActive = cat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onCat(c.id)}
              className={`h-8 flex-shrink-0 rounded-full px-3 text-[12px] font-semibold transition-colors ${
                isActive
                  ? 'bg-[#121126] text-white'
                  : 'border border-black/10 bg-white text-[#4A4A6B] hover:text-[#121126]'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.name}
              href={`/features/${featureSlugFor(p.name)}`}
              onClick={onClose}
              className="flex items-start gap-2.5 rounded-lg bg-white p-3 transition-colors hover:bg-white"
            >
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white"
                style={{
                  background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                  boxShadow: `0 6px 16px -6px ${p.color}66`,
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-[#121126]">{p.name}</div>
                <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[#4A4A6B]">{p.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        href="/products"
        onClick={onClose}
        className="sn-btn-primary inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-[12px] font-bold uppercase tracking-[0.1em]"
      >
        Explore all products <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function MobileSimplePanel({
  items,
  onClose,
}: {
  items: Array<{ label: string; sub: string; href: string; icon: any; color: string }>;
  onClose: () => void;
}) {
  return (
    <div className="space-y-1.5 rounded-xl bg-[#FAF9F4] p-2">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Link
            key={it.label}
            href={it.href}
            onClick={onClose}
            className="flex items-start gap-3 rounded-lg bg-white p-3 transition-colors"
          >
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${it.color}, ${it.color}cc)` }}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-[#121126]">{it.label}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-[#4A4A6B]">{it.sub}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default LandingHeader;
