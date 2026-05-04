'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Workflow,
  Bot,
  Plus,
  Minus,
  Star,
  Shield,
  Globe,
  Clock,
  Target,
  Play,
  Users2,
  Send,
  Brain,
  Calendar,
  Paperclip,
  Zap,
  LineChart,
  BadgeCheck,
  Flame,
  Layers,
  ChevronRight,
  ChevronDown,
  Mic,
  Image as ImageIcon,
  Smile,
  MoreHorizontal,
  Menu,
  Search,
  Phone,
  Video,
  Settings,
  Filter,
  TrendingUp,
  DollarSign,
  Mail,
  MessageCircle,
  Hash,
  Tag,
  Download,
  Pencil,
  Inbox,
  FileText,
  Database,
  GitBranch,
  PlayCircle,
  Save,
  ExternalLink,
  Wand2,
  BookOpen,
  Headphones,
  Linkedin,
  Twitter,
  Instagram,
  Github,
  RefreshCw,
  SlidersHorizontal,
  ChevronsUpDown,
  Trash2,
  Eye,
  UserPlus,
  ArrowUp,
  ArrowDown,
  X,
  Reply,
  Activity,
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { getSession } from '@/app/actions';

/* -------------------------------------------------------------------------- */
/*  SabNode landing — light paper, indigo highlight.                          */
/*  Warm off-white, deep-ink text, indigo-600 accents + violet glints.        */
/*  Each product mock mirrors the real in-app layout so visitors recognize    */
/*  the product when they sign in.                                            */
/* -------------------------------------------------------------------------- */

export default function HomePage() {
  const [session, setSession] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  return (
    <div className="sn-root relative min-h-screen overflow-x-clip antialiased">
      <GlobalStyles />
      <AuroraBg />
      <PaperGrain />

      <div className="relative z-10">
        <Nav loading={loading} session={session} />

        <main className="pt-2">
          <Hero session={session} loading={loading} />
          <TrustStrip />
          <CapabilitiesSection />
          <ProductsShowcase />
          <BentoMetrics />
          <Testimonials />
          <StatsBanner />
          <PricingSection />
          <FaqSection />
          <FinalCTA />
        </main>

        <IndigoFooter />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Global styles                                                             */
/* -------------------------------------------------------------------------- */

function GlobalStyles() {
  return (
    <style>{`
      .sn-root {
        background: #F5F3EC;
        color: #121126;
        font-family: var(--font-sab-body), ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      .sn-root ::selection { background: #4F46E5; color: #fff; }

      .font-display {
        font-family: var(--font-sab-display), ui-sans-serif, system-ui, sans-serif;
        font-weight: 700;
        letter-spacing: -0.035em;
        font-feature-settings: "ss01", "ss02";
      }
      .font-display-italic {
        font-family: var(--font-sab-display), ui-sans-serif, system-ui, sans-serif;
        font-style: italic;
        font-weight: 500;
        letter-spacing: -0.03em;
      }
      .font-mono {
        font-family: var(--font-sab-mono), ui-monospace, Menlo, monospace;
      }

      @keyframes sn-fade-up { 0% { opacity: 0; transform: translateY(28px); } 100% { opacity: 1; transform: translateY(0); } }
      @keyframes sn-fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
      @keyframes sn-float-y { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes sn-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      @keyframes sn-aurora-drift { 0%, 100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(3%, -2%, 0) scale(1.06); } }

      .sn-reveal     { opacity: 0; animation: sn-fade-up 0.9s cubic-bezier(0.23,1,0.32,1) forwards; }
      .sn-reveal-in  { opacity: 0; animation: sn-fade-in 1.2s ease forwards; }
      .sn-float      { animation: sn-float-y 6s ease-in-out infinite; }
      .sn-marquee    { animation: sn-marquee 38s linear infinite; }
      .sn-aurora     { animation: sn-aurora-drift 22s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .sn-reveal, .sn-reveal-in, .sn-float, .sn-marquee, .sn-aurora {
          animation: none !important; opacity: 1 !important; transform: none !important;
        }
      }

      .sn-card {
        background: #fff;
        border: 1px solid rgba(17,17,38,0.08);
      }
      .sn-card-soft {
        background: rgba(255,255,255,0.75);
        border: 1px solid rgba(17,17,38,0.08);
        backdrop-filter: blur(10px);
      }
      .sn-hair { border-color: rgba(17,17,38,0.08); }

      .sn-btn-primary {
        background: linear-gradient(180deg, #6366F1 0%, #4F46E5 100%);
        color: #fff;
        box-shadow: 0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.15) inset, 0 14px 32px -12px rgba(79,70,229,0.45);
        transition: transform 200ms ease, box-shadow 300ms ease, filter 200ms ease;
      }
      .sn-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
      .sn-btn-dark {
        background: #121126; color: #fff;
        transition: transform 200ms ease, background 200ms ease;
      }
      .sn-btn-dark:hover { transform: translateY(-1px); background: #1f1e3c; }
      .sn-btn-ghost {
        background: rgba(17,17,38,0.04);
        color: #121126;
        border: 1px solid rgba(17,17,38,0.10);
        transition: background 200ms ease, transform 200ms ease;
      }
      .sn-btn-ghost:hover { background: rgba(17,17,38,0.07); transform: translateY(-1px); }

      .sn-tag {
        display: inline-flex; align-items: center; gap: 0.5rem;
        padding: 5px 12px; border-radius: 9999px;
        font-size: 11px; font-weight: 600;
        letter-spacing: 0.08em; text-transform: uppercase;
        color: #4F46E5;
        background: #EEF2FF;
        border: 1px solid rgba(79,70,229,0.18);
      }
      .sn-tag .dot {
        width: 6px; height: 6px; border-radius: 9999px;
        background: #4F46E5; box-shadow: 0 0 0 3px rgba(79,70,229,0.18);
      }
      .sn-tag-live {
        background: #DCFCE7; color: #166534;
        border-color: rgba(22,101,52,0.18);
      }
      .sn-tag-live .dot { background: #22C55E; box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }

      .sn-gradient-text {
        background: linear-gradient(90deg, #4F46E5 0%, #6366F1 40%, #8B5CF6 100%);
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent; color: transparent;
      }

      .sn-window {
        border-radius: 24px; overflow: hidden;
        background: #fff;
        border: 1px solid rgba(17,17,38,0.08);
        box-shadow:
          0 60px 140px -40px rgba(79,70,229,0.22),
          0 24px 60px -24px rgba(17,17,38,0.12),
          0 0 0 1px rgba(255,255,255,0.8) inset;
      }
    `}</style>
  );
}

function AuroraBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(1200px 600px at 10% -5%, rgba(99,102,241,0.18), transparent 60%),' +
          'radial-gradient(1000px 500px at 95% 8%, rgba(139,92,246,0.14), transparent 60%),' +
          'radial-gradient(900px 500px at 50% 100%, rgba(79,70,229,0.14), transparent 60%),' +
          '#F5F3EC',
      }} />
      <div className="sn-aurora absolute -top-32 -left-32 h-[44rem] w-[44rem] rounded-full opacity-55" style={{
        background: 'radial-gradient(circle, rgba(99,102,241,0.38), transparent 60%)', filter: 'blur(30px)',
      }} />
      <div className="sn-aurora absolute top-[18rem] -right-40 h-[38rem] w-[38rem] rounded-full opacity-45" style={{
        background: 'radial-gradient(circle, rgba(139,92,246,0.32), transparent 60%)', filter: 'blur(30px)', animationDelay: '-6s',
      }} />
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage:
          'linear-gradient(rgba(17,17,38,0.5) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(17,17,38,0.5) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
      }} />
    </div>
  );
}

function PaperGrain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] opacity-[0.10] mix-blend-multiply" style={{
      backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0.07 0 0 0 0 0.07 0 0 0 0 0.15 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
    }} />
  );
}

/* -------------------------------------------------------------------------- */
/*  Navigation — Zoho-style mega-menu header                                  */
/* -------------------------------------------------------------------------- */

const NAV_ITEMS: Array<{ label: string; key: string; dropdown?: boolean }> = [
  { label: 'Products', key: 'products', dropdown: true },
  { label: 'Enterprise', key: 'enterprise' },
  { label: 'Customers', key: 'customers', dropdown: true },
  { label: 'Partners', key: 'partners', dropdown: true },
  { label: 'Resources', key: 'resources', dropdown: true },
];

function Nav({ loading, session }: { loading: boolean; session: any }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // close on Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (setOpen(null), setMobileOpen(false));
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => setOpen(null);

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white border-b sn-hair">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center gap-6">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <SabNodeLogo className="h-7 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV_ITEMS.map(item => {
              const isActive = open === item.key;
              const hasDropdown = !!item.dropdown;
              const className = `inline-flex items-center gap-1 h-10 px-3.5 rounded-md text-[14px] font-semibold transition-colors ${
                isActive
                  ? 'text-[#4F46E5] border border-[#4F46E5]/40 bg-[#EEF2FF]/60'
                  : 'text-[#121126] hover:text-[#4F46E5]'
              }`;
              if (hasDropdown) {
                return (
                  <button
                    key={item.key}
                    onClick={() => setOpen(isActive ? null : item.key)}
                    onMouseEnter={() => setOpen(item.key)}
                    aria-expanded={isActive}
                    className={className}
                  >
                    {item.label}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isActive ? 'rotate-180' : ''}`} />
                  </button>
                );
              }
              return (
                <Link key={item.key} href="#" className={className} onMouseEnter={close}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 ml-auto">
            <button aria-label="Search" className="h-9 w-9 inline-flex items-center justify-center rounded-full text-[#4A4A6B] hover:bg-black/5 hover:text-[#121126]">
              <Search className="h-4 w-4" />
            </button>
            <button className="hidden sm:inline-flex h-9 items-center gap-1.5 px-2.5 rounded-full text-[13px] font-medium text-[#4A4A6B] hover:bg-black/5 hover:text-[#121126]">
              <Globe className="h-3.5 w-3.5" /> English
            </button>
            {loading ? (
              <div className="h-9 w-20 rounded-md bg-black/5 animate-pulse" />
            ) : session?.user ? (
              <Link href="/wachat" className="sn-btn-primary inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold">
                Open workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:inline-flex h-9 items-center px-3 text-[13.5px] font-semibold text-[#121126] hover:text-[#4F46E5] transition-colors">
                  Sign In
                </Link>
                <Link href="/signup" className="inline-flex h-9 items-center rounded-md px-4 text-[13.5px] font-semibold text-[#4F46E5] border border-[#4F46E5] hover:bg-[#4F46E5] hover:text-white transition-colors">
                  Sign Up
                </Link>
              </>
            )}
            <button onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu" className="md:hidden ml-1 h-9 w-9 inline-flex items-center justify-center rounded-md border border-black/10 text-[#121126]">
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* mega-menu panel lives inside the header so sticky stays cohesive */}
        {open === 'products' && <ProductsMegaMenu onClose={close} />}
        {open && open !== 'products' && <SimpleDropdown kind={open} onClose={close} />}
      </header>

      {/* backdrop (below header z-50, dims page only) */}
      {open && (
        <div
          aria-hidden
          onClick={close}
          onMouseEnter={close}
          className="fixed inset-0 z-40 bg-[#121126]/15 backdrop-blur-[1px] animate-in fade-in duration-150"
          style={{ top: '64px' }}
        />
      )}

      {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} />}
    </>
  );
}

/* ---------- Products mega-menu ---------- */

type Product = { icon: any; name: string; brand?: string; color: string; tint: string; desc: string };

const MEGA_CATEGORIES: Array<{ id: string; label: string; count: number }> = [
  { id: 'featured',      label: 'Recent Launches', count: 8 },
  { id: 'conversations', label: 'Conversations',   count: 8 },
  { id: 'automation',    label: 'Automation',      count: 6 },
  { id: 'customer',      label: 'Customer data',   count: 6 },
  { id: 'growth',        label: 'Growth',          count: 6 },
  { id: 'analytics',     label: 'Analytics',       count: 6 },
  { id: 'commerce',      label: 'Commerce',        count: 5 },
  { id: 'developer',     label: 'Developer',       count: 6 },
];

const MEGA_PRODUCTS: Record<string, Product[]> = {
  featured: [
    { icon: MessageSquare, name: 'Chat',       brand: 'Wachat',   color: '#25D366', tint: '#DCFCE7', desc: 'Unified WhatsApp, Instagram, email and web-chat inbox for your team.' },
    { icon: Workflow,      name: 'Flow Builder', brand: 'SabFlow', color: '#4F46E5', tint: '#EEF2FF', desc: 'Drag-and-drop canvas for business automations. 42 node types, zero code.' },
    { icon: Users2,        name: 'Contacts',   brand: 'CRM',      color: '#8B5CF6', tint: '#F3E8FF', desc: 'Auto-enriched contact records, pipeline, tags and segments.' },
    { icon: Bot,           name: 'Chatbot',    brand: 'Rules',    color: '#EC4899', tint: '#FCE7F3', desc: 'Keyword triggers — contains, exact, regex — with instant auto-replies.' },
    { icon: Brain,         name: 'AI Studio',  brand: 'Private LLM', color: '#7C3AED', tint: '#EDE9FE', desc: 'Tenant-scoped models, tool-calling, retrieval — grounded on your data.' },
    { icon: Send,          name: 'Broadcasts', brand: 'Campaigns',color: '#06B6D4', tint: '#CFFAFE', desc: 'Send Meta-approved templates to 100k+ contacts with delivery reporting.' },
    { icon: LineChart,     name: 'Analytics',  brand: 'Dashboards',color: '#F59E0B', tint: '#FEF3C7', desc: 'Real-time outcome dashboards stitched from every module.' },
    { icon: Zap,           name: 'Webhooks',   brand: 'Events',   color: '#10B981', tint: '#D1FAE5', desc: 'Inbound and outbound event bridge with retries and signed payloads.' },
  ],
  conversations: [
    { icon: Inbox,         name: 'Shared Inbox',    color: '#4F46E5', tint: '#EEF2FF', desc: 'Every channel in one queue. Assign, route, resolve — together.' },
    { icon: MessageSquare, name: 'WhatsApp API',    color: '#25D366', tint: '#DCFCE7', desc: 'Official Cloud API access. Templates, rich media, list and button messages.' },
    { icon: Instagram,     name: 'Instagram DM',    color: '#E4405F', tint: '#FCE7F3', desc: 'Reply to DMs, story mentions and comments in the same inbox.' },
    { icon: Mail,          name: 'Email',           color: '#8B5CF6', tint: '#F3E8FF', desc: 'Threaded email with gmail/Outlook connectors and signatures.' },
    { icon: MessageCircle, name: 'Web chat widget', color: '#06B6D4', tint: '#CFFAFE', desc: 'Embed a chat bubble on your site. Inherits the AI layer automatically.' },
    { icon: Clock,         name: 'Business hours',  color: '#F59E0B', tint: '#FEF3C7', desc: 'Route to humans in-hours, auto-reply otherwise — per team or channel.' },
    { icon: Reply,         name: 'Canned replies',  color: '#EC4899', tint: '#FCE7F3', desc: 'Shared library of reply snippets with merge fields and keyboard shortcuts.' },
    { icon: Tag,           name: 'Chat labels',     color: '#10B981', tint: '#D1FAE5', desc: 'Color-coded labels, auto-tagging rules and per-label SLA timers.' },
  ],
  automation: [
    { icon: Workflow,      name: 'Flow Builder',   color: '#4F46E5', tint: '#EEF2FF', desc: 'Triggers → conditions → actions on an infinite canvas with version history.' },
    { icon: Bot,           name: 'Chatbot rules',  color: '#EC4899', tint: '#FCE7F3', desc: 'Keyword-triggered replies with contains / exact / regex matching.' },
    { icon: Brain,         name: 'AI Studio',      color: '#7C3AED', tint: '#EDE9FE', desc: 'Private LLM with tools, retrieval and guardrails. Deploy anywhere.' },
    { icon: Zap,           name: 'Triggers',       color: '#F59E0B', tint: '#FEF3C7', desc: 'Fire a flow on order paid, message received, webhook call or schedule.' },
    { icon: GitBranch,     name: 'A/B testing',    color: '#8B5CF6', tint: '#F3E8FF', desc: 'Split traffic across flow variants. Pick the winner automatically.' },
    { icon: Calendar,      name: 'Scheduler',      color: '#06B6D4', tint: '#CFFAFE', desc: 'One-off and recurring sends in the recipient\'s local timezone.' },
  ],
  customer: [
    { icon: Users2,        name: 'Contacts',       color: '#8B5CF6', tint: '#F3E8FF', desc: 'Every conversation becomes a contact record — auto-deduplicated.' },
    { icon: Filter,        name: 'Segments',       color: '#4F46E5', tint: '#EEF2FF', desc: 'Dynamic audiences from any signal. Reuse across flows, broadcasts, AI.' },
    { icon: Tag,           name: 'Tags',           color: '#EC4899', tint: '#FCE7F3', desc: 'Multi-value tags with auto-apply rules and bulk edit.' },
    { icon: Layers,        name: 'Kanban pipeline',color: '#F59E0B', tint: '#FEF3C7', desc: 'Lead → qualified → proposal → won. Drag, filter, score.' },
    { icon: Database,      name: 'Custom fields',  color: '#10B981', tint: '#D1FAE5', desc: 'Add structured properties to any contact or deal — text, date, number, JSON.' },
    { icon: Shield,        name: 'Opt-in status',  color: '#06B6D4', tint: '#CFFAFE', desc: 'Per-channel consent tracking with audit log and export.' },
  ],
  growth: [
    { icon: Send,          name: 'Broadcasts',     color: '#06B6D4', tint: '#CFFAFE', desc: 'Ship Meta-approved templates to 100k+ contacts. Live delivery reporting.' },
    { icon: FileText,      name: 'Templates',      color: '#4F46E5', tint: '#EEF2FF', desc: 'Template gallery with in-app approval flow and variable preview.' },
    { icon: Calendar,      name: 'Scheduler',      color: '#F59E0B', tint: '#FEF3C7', desc: 'Queue sends for time zones, business hours or specific dates.' },
    { icon: TrendingUp,    name: 'Campaigns',      color: '#EC4899', tint: '#FCE7F3', desc: 'Multi-step campaigns with A/B arms, holdouts and attribution.' },
    { icon: Globe,         name: 'Landing pages',  color: '#8B5CF6', tint: '#F3E8FF', desc: 'Capture opt-ins on hosted pages that sync straight to Contacts.' },
    { icon: ImageIcon,     name: 'Catalog sync',   color: '#10B981', tint: '#D1FAE5', desc: 'Keep WhatsApp Business catalog in sync with Shopify / Stripe.' },
  ],
  analytics: [
    { icon: LineChart,     name: 'Dashboards',     color: '#F59E0B', tint: '#FEF3C7', desc: 'Overview of sent, delivered, read, failed — with channel split.' },
    { icon: Activity,      name: 'Flow analytics', color: '#4F46E5', tint: '#EEF2FF', desc: 'Per-node success, drop-off, revenue and SLA metrics.' },
    { icon: Star,          name: 'CSAT',           color: '#EC4899', tint: '#FCE7F3', desc: 'Collect and segment chat ratings. Auto-trigger on resolved conversations.' },
    { icon: Download,      name: 'Exports',        color: '#8B5CF6', tint: '#F3E8FF', desc: 'Download raw events, CSV exports or sync to your warehouse.' },
    { icon: Target,        name: 'Attribution',    color: '#7C3AED', tint: '#EDE9FE', desc: 'See which flow, campaign or channel actually drove the outcome.' },
    { icon: Eye,           name: 'Heatmaps',       color: '#06B6D4', tint: '#CFFAFE', desc: 'Visualize activity over time-of-day and day-of-week by channel.' },
  ],
  commerce: [
    { icon: DollarSign,    name: 'Payments',       color: '#10B981', tint: '#D1FAE5', desc: 'Collect payments inside the chat via Stripe, Razorpay and UPI.' },
    { icon: ImageIcon,     name: 'Catalog',        color: '#EC4899', tint: '#FCE7F3', desc: 'WhatsApp Business catalog manager with live stock + price sync.' },
    { icon: FileText,      name: 'Orders',         color: '#4F46E5', tint: '#EEF2FF', desc: 'Every order becomes a timeline event on the contact record.' },
    { icon: Reply,         name: 'Cart recovery',  color: '#F59E0B', tint: '#FEF3C7', desc: 'Template flow that messages abandoners 20 minutes after drop-off.' },
    { icon: BadgeCheck,    name: 'Post-purchase',  color: '#8B5CF6', tint: '#F3E8FF', desc: 'Confirmation, tracking, reorder and review prompts out of the box.' },
  ],
  developer: [
    { icon: Hash,          name: 'REST API',       color: '#4F46E5', tint: '#EEF2FF', desc: 'Typed REST + webhooks for every object. SDKs for JS, Python and Go.' },
    { icon: Zap,           name: 'Webhooks',       color: '#10B981', tint: '#D1FAE5', desc: 'Inbound and outbound, with retries, signing and dead-letter queue.' },
    { icon: FileText,      name: 'Meta Flow editor', color: '#EC4899', tint: '#FCE7F3', desc: 'Design, publish and version Meta Flow screens from inside SabNode.' },
    { icon: Brain,         name: 'MCP server',     color: '#7C3AED', tint: '#EDE9FE', desc: 'Plug any LLM into your SabNode workspace via Model Context Protocol.' },
    { icon: Shield,        name: 'OAuth 2',        color: '#8B5CF6', tint: '#F3E8FF', desc: 'Scoped access tokens with audit log and granular permissions.' },
    { icon: GitBranch,     name: 'Environments',   color: '#F59E0B', tint: '#FEF3C7', desc: 'Sandbox → staging → production with per-env credentials and domains.' },
  ],
};

function ProductsMegaMenu({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = React.useState<'apps' | 'suites' | 'workspace' | 'marketplace'>('apps');
  const [cat, setCat] = React.useState<string>('featured');
  const [search, setSearch] = React.useState('');

  const activeCat = MEGA_CATEGORIES.find(c => c.id === cat)!;
  const items = MEGA_PRODUCTS[cat] ?? [];
  const filtered = search
    ? items.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.desc.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div
      onMouseLeave={onClose}
      className="absolute left-0 right-0 top-full bg-white border-t sn-hair shadow-[0_24px_60px_-20px_rgba(17,17,38,0.16)]"
    >
      {/* tab strip */}
      <div className="border-b sn-hair bg-[#FAF9F4]">
        <div className="container mx-auto px-4 md:px-6 flex items-center gap-6 h-12">
          {([
            ['apps',        'Apps'],
            ['suites',      'Suites'],
            ['workspace',   'SabNode One'],
            ['marketplace', 'Marketplace'],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative h-12 inline-flex items-center text-[13.5px] font-semibold transition-colors ${
                tab === k ? 'text-[#4F46E5]' : 'text-[#4A4A6B] hover:text-[#121126]'
              }`}
            >
              {l}
              {tab === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-[#4F46E5] rounded-t" />}
            </button>
          ))}
          <span className="h-4 w-px bg-black/10" />
          <Link href="#products" onClick={onClose} className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] hover:text-[#4338CA]">
            Explore all products <ChevronRight className="h-3 w-3" />
          </Link>
          <button aria-label="Close" onClick={onClose} className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-black/5 text-[#4A4A6B] hover:text-[#121126]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* main body */}
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid grid-cols-12 gap-5">
          {/* left sidebar */}
          <aside className="col-span-12 md:col-span-3 lg:col-span-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7878A1]" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="I'm looking for…"
                className="w-full h-10 pl-9 pr-3 rounded-md border sn-hair bg-white text-[13px] text-[#121126] placeholder:text-[#7878A1] focus:outline-none focus:border-[#4F46E5]/50 focus:ring-2 focus:ring-[#4F46E5]/15"
              />
            </div>

            <ul className="max-h-[440px] overflow-y-auto pr-1">
              {MEGA_CATEGORIES.map(c => {
                const active = cat === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setCat(c.id)}
                      onMouseEnter={() => setCat(c.id)}
                      className={`w-full text-left px-3 h-9 rounded-md text-[13px] font-semibold flex items-center justify-between transition-colors ${
                        active
                          ? 'bg-[#EEF2FF] text-[#4F46E5]'
                          : 'text-[#4A4A6B] hover:bg-black/[0.03] hover:text-[#121126]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5]" />}
                        {c.label}
                      </span>
                      <span className={`text-[10.5px] font-mono tabular-nums ${active ? 'text-[#4F46E5]/70' : 'text-[#7878A1]'}`}>
                        {c.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Link
              href="#products"
              onClick={onClose}
              className="mt-4 sn-btn-primary inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md px-4 text-[12.5px] font-bold uppercase tracking-[0.1em]"
            >
              Explore all products <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </aside>

          {/* product grid */}
          <div className="col-span-12 md:col-span-9 lg:col-span-9">
            <div className="flex items-end justify-between mb-4 gap-3">
              <h3 className="font-display text-[22px] md:text-[26px] leading-none text-[#121126]">{activeCat.label}</h3>
              <span className="text-[11px] font-mono tabular-nums text-[#7878A1]">
                {filtered.length} / {items.length}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="text-[13px] text-[#7878A1] py-8 text-center">
                No products match "{search}" in {activeCat.label.toLowerCase()}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {filtered.map(p => (
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
    <article
      className="group rounded-xl p-4 bg-[#F7F9FC] hover:bg-white hover:shadow-[0_14px_30px_-14px_rgba(79,70,229,0.25)] hover:ring-1 hover:ring-[#4F46E5]/15 transition-all border border-transparent hover:border-[#4F46E5]/10"
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <span
          className="h-9 w-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${product.color}, ${product.color}cc)`,
            boxShadow: `0 6px 16px -6px ${product.color}66`,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          {product.brand && (
            <div className="text-[9.5px] uppercase tracking-[0.14em] text-[#7878A1] font-bold leading-none">
              SabNode · {product.brand}
            </div>
          )}
          <div className={`text-[14.5px] font-bold text-[#121126] leading-tight truncate ${product.brand ? 'mt-0.5' : ''}`}>
            {product.name}
          </div>
        </div>
      </div>
      <p className="text-[12.5px] text-[#4A4A6B] leading-snug min-h-[3.5em] mb-3">
        {product.desc}
      </p>
      <Link
        href="/signup"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.14em] uppercase text-[#4F46E5] group-hover:text-[#4338CA]"
      >
        Try now <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

/* ---------- Other nav dropdowns (simple) ---------- */

function SimpleDropdown({ kind, onClose }: { kind: string; onClose: () => void }) {
  const menus: Record<string, Array<{ label: string; sub: string; href: string; icon: any; color: string }>> = {
    customers: [
      { label: 'Case studies',    sub: 'How teams ship faster on SabNode', href: '/blog', icon: BookOpen,     color: '#4F46E5' },
      { label: 'Customer wall',   sub: '4,812 workspaces and counting',    href: '/blog', icon: Users2,       color: '#8B5CF6' },
      { label: 'Reviews',         sub: 'G2, Capterra, Product Hunt',        href: '/blog', icon: Star,         color: '#F59E0B' },
      { label: 'Community',       sub: 'Join 8,000+ operators on Slack',    href: '/contact', icon: MessageCircle, color: '#06B6D4' },
    ],
    partners: [
      { label: 'Solution partners', sub: 'Build on SabNode for clients',    href: '/contact', icon: Users2,     color: '#4F46E5' },
      { label: 'Referral program',  sub: 'Earn 20% for 12 months',           href: '/contact', icon: DollarSign, color: '#10B981' },
      { label: 'Affiliates',        sub: 'Tracked links, monthly payouts',   href: '/contact', icon: Globe,      color: '#EC4899' },
      { label: 'App directory',     sub: 'Publish your integration',         href: '/contact', icon: Layers,     color: '#8B5CF6' },
    ],
    resources: [
      { label: 'Docs',          sub: 'API, webhooks, SDKs',             href: '/blog',    icon: BookOpen, color: '#4F46E5' },
      { label: 'Journal',       sub: 'Product stories + deep dives',    href: '/blog',    icon: FileText, color: '#8B5CF6' },
      { label: 'Changelog',     sub: 'Ship notes, every Friday',        href: '/blog',    icon: Sparkles, color: '#EC4899' },
      { label: 'Help center',   sub: 'Guides + troubleshooting',        href: '/contact', icon: Headphones, color: '#06B6D4' },
      { label: 'Status',        sub: '99.99% · check uptime',           href: '/contact', icon: Activity, color: '#10B981' },
      { label: 'Security',      sub: 'SOC 2 · GDPR · DPA',              href: '/contact', icon: Shield,   color: '#F59E0B' },
    ],
  };
  const items = menus[kind] ?? [];
  return (
    <div
      onMouseLeave={onClose}
      className="absolute left-0 right-0 top-full bg-white border-t sn-hair shadow-[0_24px_60px_-20px_rgba(17,17,38,0.16)]"
    >
      <div className="container mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map(it => {
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                href={it.href}
                onClick={onClose}
                className="group flex items-start gap-3 rounded-lg p-3 hover:bg-[#F7F9FC] transition-colors"
              >
                <span
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${it.color}, ${it.color}cc)` }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-[#121126] flex items-center gap-1.5">
                    {it.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[12px] text-[#4A4A6B] mt-0.5">{it.sub}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Mobile nav drawer ---------- */

function MobileNav({ onClose }: { onClose: () => void }) {
  return (
    <div className="md:hidden fixed inset-0 z-[60] bg-black/30" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="absolute top-0 right-0 bottom-0 w-[84%] max-w-sm bg-white flex flex-col">
        <div className="flex items-center justify-between px-5 h-16 border-b sn-hair">
          <SabNodeLogo className="h-7 w-auto" />
          <button onClick={onClose} className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-black/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 text-[14px] font-semibold text-[#121126]">
          {['Products', 'Enterprise', 'Customers', 'Partners', 'Resources'].map(l => (
            <Link key={l} href="#products" onClick={onClose} className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[#EEF2FF] hover:text-[#4F46E5]">
              {l} <ChevronRight className="h-4 w-4" />
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t sn-hair grid grid-cols-2 gap-2">
          <Link href="/login" onClick={onClose} className="h-10 inline-flex items-center justify-center rounded-md text-[13px] font-semibold text-[#121126] border border-black/10">
            Sign In
          </Link>
          <Link href="/signup" onClick={onClose} className="sn-btn-primary h-10 inline-flex items-center justify-center rounded-md text-[13px] font-semibold">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */

function Hero({ session, loading }: { session: any; loading: boolean }) {
  return (
    <section className="relative pt-10 md:pt-16 pb-10 md:pb-20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          <div className="sn-reveal sn-tag sn-tag-live" style={{ animationDelay: '40ms' }}>
            <span className="dot" />
            SabNode v26.04 · 4,812 workspaces live
          </div>

          <h1 className="sn-reveal mt-7 font-display text-[#121126] leading-[0.90] text-[14vw] sm:text-[9vw] md:text-[100px] lg:text-[120px]" style={{ animationDelay: '120ms' }}>
            One platform for
            <br />
            every{' '}
            <span className="font-display-italic sn-gradient-text">conversation.</span>
          </h1>

          <p className="sn-reveal mt-7 text-base md:text-[18px] text-[#4A4A6B] max-w-2xl leading-relaxed" style={{ animationDelay: '260ms' }}>
            WhatsApp inbox, chatbots, workflows, CRM, broadcasts and analytics —
            every module shares the same contacts, the same data model and the
            same AI layer. Replace eight subscriptions with one bill.
          </p>

          <div className="sn-reveal mt-9 flex flex-col sm:flex-row items-center gap-3" style={{ animationDelay: '380ms' }}>
            {loading ? null : session?.user ? (
              <Link href="/wachat" className="sn-btn-primary inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14px] font-semibold">
                Open workspace <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link href="/signup" className="sn-btn-primary inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14px] font-semibold">
                Start free — no card <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link href="#products" className="sn-btn-ghost inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14px] font-semibold">
              <Play className="h-4 w-4 fill-current" /> See every module
            </Link>
          </div>

          <div className="sn-reveal mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-[#7878A1]" style={{ animationDelay: '500ms' }}>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#4F46E5]" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-[#4F46E5]" /> SOC 2 ready</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-[#4F46E5]" /> 10-min setup</span>
          </div>
        </div>

        <div className="sn-reveal relative mt-16 md:mt-20 max-w-6xl mx-auto" style={{ animationDelay: '640ms' }}>
          <div aria-hidden className="absolute -inset-10 blur-3xl opacity-60 pointer-events-none" style={{
            background: 'radial-gradient(60% 50% at 50% 40%, rgba(99,102,241,0.30), transparent 70%)',
          }} />
          <div className="relative">
            <ChatAppMock />
            <div className="hidden md:block absolute -right-4 md:-right-10 -top-8 sn-float">
              <WhatsappPhoneMock />
            </div>
          </div>
          <div className="hidden md:flex absolute -bottom-4 left-10 rotate-[-4deg]" aria-hidden>
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[12px] font-semibold text-white" style={{
              background: 'linear-gradient(135deg, #4F46E5, #8B5CF6)',
              boxShadow: '0 14px 30px -12px rgba(79,70,229,0.5)',
            }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-white opacity-60 animate-ping" />
                <span className="relative rounded-full h-2 w-2 bg-white" />
              </span>
              17 flows live · 254k chats today
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero mock — mirrors /wachat/chat (sidebar + thread + info panel)       */
/* -------------------------------------------------------------------------- */

function ChatAppMock() {
  return (
    <div className="relative sn-window">
      <WindowChrome title="app.sabnode.io / dashboard / chat" />
      <div className="grid grid-cols-12 min-h-[520px]">
        {/* left sidebar — app nav */}
        <aside className="hidden md:flex col-span-2 border-r sn-hair p-3 flex-col gap-0.5 bg-[#FAF9F4]">
          <div className="px-2 pb-2 text-[9.5px] uppercase tracking-[0.18em] font-bold text-[#7878A1]">Workspace</div>
          {[
            { icon: Inbox, label: 'Chat', n: '24', active: true },
            { icon: Workflow, label: 'Flows', n: '12' },
            { icon: Users2, label: 'Contacts', n: '3.2k' },
            { icon: Send, label: 'Broadcasts' },
            { icon: Bot, label: 'Chatbot' },
            { icon: LineChart, label: 'Analytics' },
          ].map(it => {
            const Icon = it.icon;
            return (
              <div key={it.label} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] ${
                it.active ? 'text-[#121126] font-semibold' : 'text-[#4A4A6B] hover:bg-black/5'
              }`} style={it.active ? { background: '#EEF2FF' } : undefined}>
                <Icon className={`h-3.5 w-3.5 ${it.active ? 'text-[#4F46E5]' : 'text-[#7878A1]'}`} strokeWidth={2} />
                <span className="flex-1 truncate">{it.label}</span>
                {it.n && (
                  <span className={`text-[9.5px] font-mono tabular-nums rounded px-1.5 py-[1px] ${
                    it.active ? 'bg-[#4F46E5] text-white' : 'bg-black/5 text-[#7878A1]'
                  }`}>{it.n}</span>
                )}
              </div>
            );
          })}
          <div className="mt-auto rounded-2xl p-3 text-white" style={{
            background: 'linear-gradient(160deg, #4F46E5 0%, #8B5CF6 100%)',
          }}>
            <div className="text-[9.5px] uppercase tracking-widest text-white/80 font-bold">Plan · Growth</div>
            <div className="mt-1 text-[11.5px] font-semibold">14 days left</div>
            <div className="mt-2 h-1 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full w-[68%] rounded-full bg-white" />
            </div>
          </div>
        </aside>

        {/* contact list (380px-ish) */}
        <div className="col-span-5 md:col-span-4 border-r sn-hair">
          <div className="px-3 py-2.5 border-b sn-hair flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-semibold text-[#121126]">Chats</div>
              <span className="text-[10px] font-mono tabular-nums rounded bg-black/5 text-[#4A4A6B] px-1.5 py-[1px]">142</span>
            </div>
            <div className="flex items-center gap-1">
              <IconBtn><UserPlus className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn><MoreHorizontal className="h-3.5 w-3.5" /></IconBtn>
            </div>
          </div>
          <div className="px-3 py-2 border-b sn-hair">
            <div className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-black/[0.04]">
              <Search className="h-3.5 w-3.5 text-[#7878A1]" />
              <div className="text-[11px] text-[#7878A1]">Search contacts or messages</div>
              <span className="ml-auto text-[9.5px] font-mono text-[#7878A1] bg-white rounded px-1.5 py-[1px] border sn-hair">⌘ K</span>
            </div>
          </div>
          <div className="flex gap-1 p-2 border-b sn-hair overflow-x-auto">
            {[
              { t: 'All', active: true, n: 142 },
              { t: 'Unread', n: 3 },
              { t: 'WhatsApp', n: 98, c: '#25D366' },
              { t: 'Instagram', n: 24, c: '#E4405F' },
              { t: 'Email', n: 14 },
            ].map(f => (
              <button key={f.t} className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium ${
                f.active ? 'bg-[#121126] text-white' : 'text-[#4A4A6B] bg-black/[0.04]'
              }`}>
                {f.c && <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.c }} />}
                {f.t}
                <span className="font-mono tabular-nums opacity-70">{f.n}</span>
              </button>
            ))}
          </div>
          <ul className="divide-y sn-hair">
            {[
              { n: 'Priya Shah', i: 'PS', m: 'Is the discount still valid for the large size?', t: '2m', grad: 'linear-gradient(135deg,#4F46E5,#8B5CF6)', ch: 'whatsapp', unread: true, typing: true, active: true },
              { n: 'Jordan Mateo', i: 'JM', m: "Great — send the invoice to billing@acme.co", t: '6m', grad: 'linear-gradient(135deg,#EC4899,#F472B6)', ch: 'email', unread: true },
              { n: 'Lee Park', i: 'LP', m: 'Need help setting up the post-purchase flow.', t: '12m', grad: 'linear-gradient(135deg,#06B6D4,#3B82F6)', ch: 'web' },
              { n: 'Ama Kusi', i: 'AK', m: 'Thanks — resolved on my end 🙌', t: '34m', grad: 'linear-gradient(135deg,#10B981,#059669)', ch: 'whatsapp' },
              { n: 'Nikhil R.', i: 'NR', m: 'Can we push the demo to Friday?', t: '1h', grad: 'linear-gradient(135deg,#F59E0B,#EAB308)', ch: 'instagram' },
            ].map(r => (
              <li key={r.n} className={`flex items-center gap-2.5 px-3 py-2.5 relative transition-colors ${r.active ? 'bg-[#EEF2FF]/60' : 'hover:bg-black/[0.02]'}`}>
                {r.active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#4F46E5]" />}
                <div className="relative flex-shrink-0">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white" style={{ background: r.grad }}>{r.i}</div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white flex items-center justify-center">
                    <ChannelDot type={r.ch} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[12.5px] font-semibold text-[#121126] truncate">{r.n}</div>
                    <div className="text-[9.5px] text-[#7878A1] font-mono tabular-nums flex-shrink-0">{r.t}</div>
                  </div>
                  {r.typing ? (
                    <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[#4F46E5] font-semibold">
                      typing
                      <span className="flex gap-0.5">
                        <span className="h-1 w-1 rounded-full bg-[#4F46E5] sn-float" style={{ animationDelay: '0s' }} />
                        <span className="h-1 w-1 rounded-full bg-[#4F46E5] sn-float" style={{ animationDelay: '0.15s' }} />
                        <span className="h-1 w-1 rounded-full bg-[#4F46E5] sn-float" style={{ animationDelay: '0.3s' }} />
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11.5px] text-[#7878A1] truncate mt-0.5">{r.m}</div>
                  )}
                </div>
                {r.unread && <span className="h-2 w-2 rounded-full bg-[#4F46E5] flex-shrink-0" />}
              </li>
            ))}
          </ul>
        </div>

        {/* message thread */}
        <section className="hidden md:flex col-span-6 lg:col-span-4 flex-col">
          <header className="px-4 py-2.5 border-b sn-hair flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#4F46E5,#8B5CF6)' }}>PS</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#121126] flex items-center gap-1.5">
                Priya Shah
                <BadgeCheck className="h-3 w-3 text-[#4F46E5]" />
                <span className="text-[10px] font-mono text-[#7878A1]">#C-47293</span>
              </div>
              <div className="text-[10.5px] text-[#7878A1] flex items-center gap-1">
                <ChannelDot type="whatsapp" /> WhatsApp · +91 98234 44211 · Mumbai
              </div>
            </div>
            <div className="flex items-center gap-1">
              <IconBtn><Phone className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn><Video className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn><MoreHorizontal className="h-3.5 w-3.5" /></IconBtn>
            </div>
          </header>

          <div className="flex-1 p-4 space-y-2.5 bg-[#FAF9F4]">
            <div className="text-center text-[9.5px] uppercase tracking-[0.18em] text-[#7878A1] font-semibold">Today</div>
            <ChatBubble side="in" time="9:32">Hi, is the XL size back in stock?</ChatBubble>
            <ChatBubble side="out" time="9:33" ai>Hey Priya 👋 Yes — XL is back in the Linen Crew and the Merino Tee. Want me to send the links?</ChatBubble>
            <ChatBubble side="in" time="9:36">Is the discount still valid for the large size?</ChatBubble>
            <div className="flex items-center gap-2 pl-1">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5] sn-float" style={{ animationDelay: '0s' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5] sn-float" style={{ animationDelay: '0.15s' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5] sn-float" style={{ animationDelay: '0.3s' }} />
              </div>
              <span className="text-[10.5px] text-[#4F46E5] font-semibold">SabNode AI is drafting a reply…</span>
            </div>
          </div>

          <div className="border-t sn-hair p-3">
            <div className="rounded-xl bg-[#EEF2FF] border border-[#4F46E5]/15 p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-widest text-[#4F46E5]">
                  <Sparkles className="h-2.5 w-2.5" /> AI suggests
                </span>
                <button className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#4F46E5] hover:text-[#4338CA] ml-auto">
                  Insert <ArrowRight className="h-3 w-3" />
                </button>
                <button className="text-[10.5px] text-[#7878A1] hover:text-[#121126]">Regenerate</button>
              </div>
              <div className="text-[12px] text-[#121126] leading-relaxed">
                Yes! <b>SAVE20</b> is valid on everything till Sun 28 Apr. Want me to apply it to your cart automatically?
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#4F46E5]/15">
                <div className="flex gap-1">
                  <IconBtn sm><Paperclip className="h-3 w-3" /></IconBtn>
                  <IconBtn sm><ImageIcon className="h-3 w-3" /></IconBtn>
                  <IconBtn sm><Smile className="h-3 w-3" /></IconBtn>
                </div>
                <div className="flex gap-1.5">
                  <button className="sn-btn-ghost inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10.5px] font-semibold">Save draft</button>
                  <button className="sn-btn-primary inline-flex h-7 items-center gap-1 rounded-full px-3 text-[10.5px] font-semibold">
                    Send <Send className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* right info panel */}
        <aside className="hidden lg:block col-span-2 border-l sn-hair p-3 bg-[#FAF9F4]">
          <div className="flex flex-col items-center pb-3 border-b sn-hair">
            <div className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-[16px]" style={{ background: 'linear-gradient(135deg,#4F46E5,#8B5CF6)' }}>PS</div>
            <div className="mt-2 text-[12px] font-semibold text-[#121126]">Priya Shah</div>
            <div className="text-[10px] text-[#7878A1]">Mumbai · IN</div>
          </div>
          <div className="py-3 space-y-2 border-b sn-hair">
            <div className="text-[9.5px] uppercase tracking-widest text-[#7878A1] font-bold">Tags</div>
            <div className="flex flex-wrap gap-1">
              {[
                { t: 'VIP', c: '#F59E0B' },
                { t: 'repeat', c: '#4F46E5' },
                { t: 'IN', c: '#8B5CF6' },
              ].map(tg => (
                <span key={tg.t} className="text-[9px] font-bold uppercase tracking-widest rounded px-1.5 py-[1px]" style={{ background: `${tg.c}15`, color: tg.c }}>
                  {tg.t}
                </span>
              ))}
            </div>
          </div>
          <div className="py-3 space-y-1.5">
            <div className="text-[9.5px] uppercase tracking-widest text-[#7878A1] font-bold mb-1">Last orders</div>
            {[
              { id: '#47293', v: '₹2,480', d: '2d' },
              { id: '#46188', v: '₹1,650', d: '3w' },
            ].map(o => (
              <div key={o.id} className="flex items-center justify-between text-[10.5px]">
                <span className="text-[#121126] font-mono">{o.id}</span>
                <span className="text-[#121126] font-semibold tabular-nums">{o.v}</span>
                <span className="text-[#7878A1] tabular-nums">{o.d}</span>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t sn-hair">
            <div className="text-[9.5px] uppercase tracking-widest text-[#7878A1] font-bold mb-1.5">Lifetime</div>
            <div className="font-display text-[22px] text-[#121126] tabular-nums leading-none">₹48,320</div>
            <div className="text-[10px] text-[#22C55E] font-semibold">+₹2,480 this month</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WhatsappPhoneMock() {
  return (
    <div className="relative w-[232px] h-[474px] rounded-[44px] p-[6px]" style={{
      background: 'linear-gradient(160deg, #2D2A4A 0%, #141128 30%, #07051F 100%)',
      boxShadow: '0 50px 100px -20px rgba(17,17,38,0.45), 0 0 0 1.5px rgba(255,255,255,0.08) inset',
    }}>
      <span aria-hidden className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l bg-[#2D2A4A]" />
      <span aria-hidden className="absolute -right-[3px] top-28 h-16 w-[3px] rounded-r bg-[#2D2A4A]" />
      <div className="relative w-full h-full rounded-[38px] overflow-hidden flex flex-col" style={{ background: '#E5DED5' }}>
        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 top-[6px] h-[22px] w-[82px] rounded-full bg-black z-20" />
        <div className="flex items-center justify-between px-5 pt-[10px] pb-1 text-[10.5px] font-semibold text-black tabular-nums">
          <span>9:41</span>
          <span className="opacity-0">·</span>
          <span className="flex items-center gap-1">
            <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
              <rect x="0" y="3" width="2" height="5" rx="0.5" fill="currentColor" />
              <rect x="3" y="2" width="2" height="6" rx="0.5" fill="currentColor" />
              <rect x="6" y="1" width="2" height="7" rx="0.5" fill="currentColor" />
              <rect x="9" y="0" width="2" height="8" rx="0.5" fill="currentColor" />
            </svg>
            <span className="text-[9px]">5G</span>
            <svg width="18" height="9" viewBox="0 0 18 9" fill="none">
              <rect x="0.5" y="0.5" width="14" height="8" rx="2" stroke="currentColor" />
              <rect x="2" y="2" width="10" height="5" rx="1" fill="currentColor" />
              <rect x="15" y="3" width="1.5" height="3" rx="0.5" fill="currentColor" />
            </svg>
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-2.5" style={{ background: '#075E54', color: '#fff' }}>
          <ChevronRight className="h-3.5 w-3.5 text-white rotate-180" strokeWidth={2.5} />
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: 'linear-gradient(135deg, #4F46E5, #8B5CF6)' }}>
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-semibold text-white truncate flex items-center gap-1">Northpeak</div>
            <div className="text-[9px] text-white/80">online · WhatsApp Business</div>
          </div>
          <Video className="h-3.5 w-3.5 text-white" />
          <Phone className="h-3.5 w-3.5 text-white" />
          <MoreHorizontal className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 px-2.5 py-3 overflow-hidden" style={{
          backgroundColor: '#ECE5DD',
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><circle cx='40' cy='40' r='1' fill='rgba(7,94,84,0.06)'/><circle cx='10' cy='15' r='0.8' fill='rgba(7,94,84,0.05)'/><circle cx='70' cy='65' r='0.8' fill='rgba(7,94,84,0.05)'/></svg>\")",
          backgroundSize: '60px 60px',
        }}>
          <div className="text-center py-1">
            <span className="inline-block text-[9px] font-medium px-2 py-0.5 rounded-md" style={{ background: '#FFF3C4', color: '#54583C' }}>TODAY</span>
          </div>

          <div className="mt-1.5 flex items-start">
            <div className="relative max-w-[82%] rounded-lg rounded-tl-none px-2.5 py-1.5 text-[10.5px] text-[#0B141A] shadow-[0_1px_1px_rgba(0,0,0,0.08)]" style={{ background: '#fff' }}>
              <span className="text-[9.5px] font-semibold" style={{ color: '#4F46E5' }}>Northpeak</span>
              <div>Hey Priya — your order #47293 just shipped 📦</div>
              <div className="text-[8.5px] text-black/45 text-right mt-0.5">9:38</div>
              <span aria-hidden className="absolute -left-[5px] top-0 w-2.5 h-2.5" style={{ background: '#fff', clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
            </div>
          </div>

          <div className="mt-1.5 flex items-start justify-end">
            <div className="relative max-w-[75%] rounded-lg rounded-tr-none px-2.5 py-1.5 text-[10.5px] text-[#0B141A]" style={{ background: '#DCF8C6' }}>
              Perfect! Is the SAVE20 code still valid for a reorder?
              <div className="flex items-center justify-end gap-0.5 mt-0.5 text-[8.5px] text-black/50">
                9:39
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ color: '#53BDEB' }}>
                  <path d="M1 4 L3.5 6.5 L7 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 4 L6.5 6.5 L11 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span aria-hidden className="absolute -right-[5px] top-0 w-2.5 h-2.5" style={{ background: '#DCF8C6', clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
            </div>
          </div>

          <div className="mt-1.5 flex items-start">
            <div className="relative max-w-[82%] rounded-lg rounded-tl-none px-2.5 py-1.5 text-[10.5px] text-[#0B141A] shadow-[0_1px_1px_rgba(0,0,0,0.08)]" style={{ background: '#fff' }}>
              <span className="inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-widest" style={{ color: '#4F46E5' }}>
                <Sparkles className="h-2 w-2" /> SabNode AI
              </span>
              <div className="mt-0.5">Yes — <b>SAVE20</b> works till Sun 28 Apr. Want me to prep a one-tap reorder?</div>
              <div className="text-[8.5px] text-black/45 text-right mt-0.5">9:40</div>
              <span aria-hidden className="absolute -left-[5px] top-0 w-2.5 h-2.5" style={{ background: '#fff', clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
            </div>
          </div>

          <div className="mt-1.5 flex justify-end gap-1">
            <button className="rounded-full px-2.5 py-1 text-[9.5px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.1)]" style={{ background: '#fff', color: '#075E54' }}>👍 Yes please</button>
            <button className="rounded-full px-2.5 py-1 text-[9.5px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]" style={{ background: '#fff', color: '#54656F' }}>Later</button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: '#F0F0F0' }}>
          <div className="flex-1 h-8 rounded-full bg-white flex items-center px-2.5 gap-2 text-[10.5px]" style={{ color: '#54656F' }}>
            <Smile className="h-3.5 w-3.5" />
            <span className="flex-1">Message</span>
            <Paperclip className="h-3.5 w-3.5" />
            <ImageIcon className="h-3.5 w-3.5" />
          </div>
          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: '#075E54' }}>
            <Mic className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
        <div aria-hidden className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-24 rounded-full bg-black/50" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trust strip                                                               */
/* -------------------------------------------------------------------------- */

const TRUSTED = ['Folia', 'NorthPeak', 'Lumenly', 'Kintsugi', 'Helix & Co.', 'Brightwave', 'Atlaskit', 'Mockingbird'];

function TrustStrip() {
  return (
    <section className="relative py-12 md:py-16">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-10 bg-[#121126]/15" />
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#7878A1] font-semibold">
            Shipping on SabNode this quarter
          </p>
          <span className="h-px w-10 bg-[#121126]/15" />
        </div>
      </div>
      <div className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-[#F5F3EC] via-[#F5F3EC]/80 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-[#F5F3EC] via-[#F5F3EC]/80 to-transparent" />
        <div className="sn-marquee flex items-center gap-16 whitespace-nowrap w-max">
          {[...TRUSTED, ...TRUSTED].map((t, i) => (
            <span key={`${t}-${i}`} className="inline-flex items-center gap-16">
              <span className="font-display text-2xl md:text-3xl tracking-[-0.04em] text-[#121126]/70">{t}</span>
              <span className="h-1 w-1 rounded-full bg-[#4F46E5]/60" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Capabilities                                                              */
/* -------------------------------------------------------------------------- */

function CapabilitiesSection() {
  const items = [
    { icon: MessageSquare, title: 'Every channel, one inbox', body: 'WhatsApp Cloud API, Instagram DM, web chat and email merge into a single thread per customer.', color: '#4F46E5', tint: '#EEF2FF' },
    { icon: Workflow, title: 'Build flows without code', body: 'Drag-and-drop canvas or plain-English prompt. Every node reports its own health in real time.', color: '#8B5CF6', tint: '#F3E8FF' },
    { icon: Brain, title: 'Private AI layer', body: 'Tenant-scoped models grounded on your own data. Never used to train anyone else.', color: '#EC4899', tint: '#FCE7F3' },
  ];
  return (
    <section className="relative py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-14">
          <div className="max-w-xl">
            <Eyebrow label="What it does" />
            <h2 className="mt-4 font-display text-[40px] md:text-[64px] leading-[0.98] text-[#121126]">
              A connected stack,{' '}
              <span className="font-display-italic sn-gradient-text">out of the box.</span>
            </h2>
          </div>
          <p className="md:max-w-sm text-[15px] text-[#4A4A6B] leading-relaxed">
            No more gluing eight SaaS subscriptions together. One identity, one
            schema, one workflow language across every module.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {items.map((b, i) => {
            const Icon = b.icon;
            return (
              <article key={b.title} className="group relative rounded-[24px] p-7 sn-card overflow-hidden transition-transform hover:-translate-y-0.5" style={{
                boxShadow: '0 18px 48px -24px rgba(17,17,38,0.18)',
              }}>
                <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-85 blur-xl" style={{ background: b.tint }} />
                <div className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{
                  background: b.color,
                  boxShadow: `0 10px 24px -8px ${b.color}66`,
                }}>
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <h3 className="relative mt-6 font-display text-[24px] md:text-[26px] leading-[1.1] text-[#121126]">{b.title}</h3>
                <p className="relative mt-3 text-[14px] text-[#4A4A6B] leading-relaxed max-w-xs">{b.body}</p>
                <div className="relative mt-6 flex items-center justify-between">
                  <Link href="#products" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#121126] group/a">
                    Explore <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/a:translate-x-0.5 group-hover/a:-translate-y-0.5" />
                  </Link>
                  <span className="text-[10px] font-mono tabular-nums text-[#7878A1]">0{i + 1} / 03</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Products showcase                                                         */
/* -------------------------------------------------------------------------- */

function ProductsShowcase() {
  return (
    <section id="products" className="relative py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Eyebrow label="Products" align="center" />
          <h2 className="mt-4 font-display text-[40px] md:text-[72px] leading-[0.98] text-[#121126]">
            Five apps. One{' '}
            <span className="font-display-italic sn-gradient-text">workspace.</span>
          </h2>
          <p className="mt-5 text-[15px] md:text-[17px] text-[#4A4A6B] max-w-xl mx-auto">
            Each mock below is the real in-product surface — not a marketing
            render. What you see is what loads when you sign in.
          </p>
        </div>

        <div className="space-y-24 md:space-y-32">
          <ProductRow
            index="01" tag="Chat · Wachat" tagColor="#25D366"
            kicker="Unified WhatsApp inbox"
            title="Own the channel your customers actually use."
            body="Run the full WhatsApp Cloud API: templates, rich media, interactive buttons, catalogs. AI drafts replies, humans step in on the edges."
            bullets={['Meta-verified templates, approved in-app', 'List, button and catalog messages', 'Voice notes, documents, location', 'Shared team inbox with typing indicators']}
            mock={<WachatMock />}
            reverse={false}
          />
          <ProductRow
            index="02" tag="Flow Builder" tagColor="#4F46E5"
            kicker="Visual automation canvas"
            title="Ship flows in an afternoon. Watch them run live."
            body="Drag triggers, conditions, delays, AI calls and channel sends onto an infinite canvas. Click a node to edit its properties mid-run."
            bullets={['42 node types · zero code', 'Live execution trace with per-step metrics', 'Branching, loops, human-in-the-loop', 'Version history with one-click rollback']}
            mock={<FlowBuilderMock />}
            reverse={true}
          />
          <ProductRow
            index="03" tag="Contacts" tagColor="#8B5CF6"
            kicker="CRM for operators"
            title="Every conversation becomes a contact record."
            body="Paginated table with stats, tag filters and inline messaging. Import from CSV, enrich from WhatsApp, export to the warehouse."
            bullets={['Live opt-in status per channel', 'Bulk tag + export + delete', 'Inline message from any row', 'Stats: totals, tagged %, active this week']}
            mock={<ContactsMock />}
            reverse={false}
          />
          <ProductRow
            index="04" tag="Chatbot" tagColor="#EC4899"
            kicker="Keyword + AI chatbot"
            title="Rules when you want them. LLMs when you don't."
            body="Start with keyword triggers (contains / exact / regex). Layer in retrieval + tool-calling when your replies need to branch across products."
            bullets={['Match types: contains, exact, regex', 'Active / paused toggle per rule', 'Inline delete with audit trail', 'Hands off to AI Studio for long-tail']}
            mock={<ChatbotMock />}
            reverse={true}
          />
          <ProductRow
            index="05" tag="Analytics" tagColor="#F59E0B"
            kicker="Outcome dashboards"
            title="See what moved — and what's about to."
            body="Real-time dashboards stitched from every module. Segment by channel, cohort, flow or campaign. Export to the warehouse you already run."
            bullets={['6-stat KPI grid', 'Sent / delivered / read / failed line chart', 'Daily breakdown table · sortable', 'Date range: 7d · 30d · 90d']}
            mock={<AnalyticsMock />}
            reverse={false}
          />
        </div>
      </div>
    </section>
  );
}

function ProductRow({ index, tag, tagColor, kicker, title, body, bullets, mock, reverse }: {
  index: string; tag: string; tagColor: string; kicker: string;
  title: string; body: string; bullets: string[]; mock: React.ReactNode; reverse: boolean;
}) {
  return (
    <article className={`grid md:grid-cols-12 gap-10 md:gap-14 items-center ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
      <div className="md:col-span-5">
        <div className="flex items-center gap-3 mb-5">
          <span className="font-mono text-[10.5px] tabular-nums text-[#7878A1]">{index}</span>
          <span className="h-px flex-1 max-w-12 bg-[#121126]/15" />
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white" style={{ background: tagColor }}>
            {tag}
          </span>
        </div>
        <div className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[#7878A1] mb-3">{kicker}</div>
        <h3 className="font-display text-[32px] md:text-[44px] leading-[1.02] text-[#121126]">{title}</h3>
        <p className="mt-5 text-[15px] text-[#4A4A6B] leading-relaxed max-w-md">{body}</p>
        <ul className="mt-6 space-y-2.5">
          {bullets.map(b => (
            <li key={b} className="flex items-start gap-2.5 text-[13.5px] text-[#121126]/85">
              <span className="mt-0.5 h-4 w-4 rounded-full flex-shrink-0 flex items-center justify-center text-white" style={{ background: tagColor }}>
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex items-center gap-3">
          <Link href="/signup" className="sn-btn-primary inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13px] font-semibold">
            Try it <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/contact" className="inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium text-[#4A4A6B] hover:text-[#121126]">
            Book a walkthrough <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <div className="md:col-span-7">
        <div className="relative">
          <div aria-hidden className="absolute -inset-6 blur-3xl opacity-60 pointer-events-none rounded-[40px]" style={{
            background: `radial-gradient(55% 50% at 50% 45%, ${tagColor}33, transparent 70%)`,
          }} />
          <div className="relative">{mock}</div>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Wachat (mirrors dashboard/chat WhatsApp view)                             */
/* -------------------------------------------------------------------------- */

function WachatMock() {
  return (
    <div className="relative sn-window">
      <WindowChrome title="dashboard / chat · +91 98234 44211" />
      <div className="grid grid-cols-12 gap-0 min-h-[460px]" style={{ background: '#EAE6DF' }}>
        <aside className="col-span-12 md:col-span-5 border-r border-black/10 bg-white">
          <div className="flex items-center gap-2 px-3.5 py-3 border-b border-black/10" style={{ background: '#F0F2F5' }}>
            <div className="h-8 w-8 rounded-full" style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }} />
            <div className="ml-auto flex items-center gap-1">
              <span className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#54656F]"><MessageCircle className="h-3.5 w-3.5" /></span>
              <span className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#54656F]"><MoreHorizontal className="h-3.5 w-3.5" /></span>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-black/5">
            <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px]" style={{ background: '#F0F2F5', color: '#54656F' }}>
              <Search className="h-3.5 w-3.5" /> Search or start a new chat
            </div>
          </div>
          <div className="flex gap-1 px-2 py-2 overflow-x-auto text-[10px] font-semibold">
            {['All', 'Unread', 'Groups'].map((t, i) => (
              <button key={t} className={`flex-shrink-0 px-2.5 py-1 rounded-full ${i === 1 ? 'text-white' : 'text-[#54656F]'}`} style={i === 1 ? { background: '#008069' } : { background: '#F0F2F5' }}>
                {t}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-black/5">
            {[
              { n: 'Priya Shah', m: 'Is the discount still valid?', t: '9:36', u: 2, a: 'linear-gradient(135deg,#25D366,#128C7E)', active: true },
              { n: 'Jordan Mateo', m: '✓✓ Great — send invoice', t: '9:12', a: 'linear-gradient(135deg,#4F46E5,#8B5CF6)' },
              { n: 'Ama Kusi', m: 'Thanks — resolved 🙌', t: '8:58', a: 'linear-gradient(135deg,#EC4899,#F472B6)' },
              { n: 'Lee Park', m: 'Need help with flows', t: 'Yest', a: 'linear-gradient(135deg,#10B981,#059669)' },
              { n: 'Nikhil R.', m: 'Can we push demo?', t: 'Yest', a: 'linear-gradient(135deg,#F59E0B,#EAB308)' },
            ].map(r => (
              <li key={r.n} className={`flex items-center gap-3 px-3 py-2.5 ${r.active ? 'bg-[#F0F2F5]' : ''}`}>
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: r.a }}>
                  {r.n.split(' ').map(s => s[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[12.5px] font-semibold text-[#111B21] truncate">{r.n}</div>
                    <div className="text-[9.5px] text-[#667781] font-mono tabular-nums">{r.t}</div>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="text-[11.5px] text-[#667781] truncate">{r.m}</div>
                    {r.u && <span className="ml-2 flex-shrink-0 h-4 min-w-4 inline-flex items-center justify-center rounded-full bg-[#25D366] text-white text-[9.5px] font-bold px-1">{r.u}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="hidden md:flex col-span-7 flex-col" style={{
          backgroundColor: '#ECE5DD',
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><circle cx='40' cy='40' r='1' fill='rgba(7,94,84,0.05)'/><circle cx='10' cy='15' r='0.8' fill='rgba(7,94,84,0.04)'/><circle cx='70' cy='65' r='0.8' fill='rgba(7,94,84,0.04)'/></svg>\")",
          backgroundSize: '60px 60px',
        }}>
          <header className="flex items-center gap-3 px-4 py-2.5 border-b border-black/10" style={{ background: '#F0F2F5' }}>
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#4F46E5,#8B5CF6)' }}>PS</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#111B21]">Priya Shah</div>
              <div className="text-[10.5px] text-[#008069] font-medium flex items-center gap-1">
                typing
                <span className="flex gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-[#008069] sn-float" />
                  <span className="h-1 w-1 rounded-full bg-[#008069] sn-float" style={{ animationDelay: '0.15s' }} />
                  <span className="h-1 w-1 rounded-full bg-[#008069] sn-float" style={{ animationDelay: '0.3s' }} />
                </span>
              </div>
            </div>
            <Search className="h-3.5 w-3.5 text-[#54656F]" />
            <MoreHorizontal className="h-4 w-4 text-[#54656F]" />
          </header>

          <div className="flex-1 px-4 py-3 space-y-1.5 overflow-hidden">
            <div className="text-center">
              <span className="inline-block text-[9px] font-medium px-2 py-0.5 rounded-md" style={{ background: '#FFF3C4', color: '#54583C' }}>TODAY</span>
            </div>
            <WaBubble side="in">Hi, is the XL size back in stock? <WaTime>9:30</WaTime></WaBubble>
            <WaBubble side="out">Hey Priya 👋 Yes — XL is back. Want the links?<WaTime read>9:31</WaTime></WaBubble>
            <WaBubble side="in" withTemplate>
              <div className="text-[10.5px] font-semibold mb-1" style={{ color: '#008069' }}>🛍️ Product list</div>
              <div className="space-y-1.5 text-[10.5px]">
                {[
                  { n: 'Linen Crew · XL', p: '₹2,480 · 12 in stock', c: 'linear-gradient(135deg,#8B5CF6,#4F46E5)' },
                  { n: 'Merino Tee · XL', p: '₹3,150 · 4 in stock', c: 'linear-gradient(135deg,#EC4899,#F472B6)' },
                ].map(p => (
                  <div key={p.n} className="flex items-center gap-2 rounded p-1.5" style={{ background: '#F0F2F5' }}>
                    <div className="h-8 w-8 rounded flex-shrink-0" style={{ background: p.c }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#111B21] text-[10.5px]">{p.n}</div>
                      <div className="text-[9.5px] text-[#667781]">{p.p}</div>
                    </div>
                  </div>
                ))}
              </div>
              <WaTime>9:32</WaTime>
            </WaBubble>
            <WaBubble side="out">Is the discount still valid for the large size?<WaTime read>9:36</WaTime></WaBubble>
            <WaBubble side="in" ai>
              <span className="inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#4F46E5' }}>
                <Sparkles className="h-2 w-2" /> SabNode AI
              </span>
              <div>Yes — <b>SAVE20</b> works till Sun 28 Apr. Apply to a fresh cart?</div>
              <div className="mt-1.5 flex gap-1.5">
                <span className="rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold" style={{ background: '#D0F0D8', color: '#075E54' }}>Yes please</span>
                <span className="rounded-full px-2.5 py-0.5 text-[9.5px]" style={{ background: '#F0F2F5', color: '#54656F' }}>Later</span>
              </div>
              <WaTime>9:38</WaTime>
            </WaBubble>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 border-t border-black/10" style={{ background: '#F0F2F5' }}>
            <Smile className="h-4 w-4 text-[#54656F]" />
            <Paperclip className="h-4 w-4 text-[#54656F]" />
            <div className="flex-1 h-9 rounded-lg bg-white flex items-center px-3 text-[11.5px]" style={{ color: '#54656F' }}>Type a message</div>
            <Mic className="h-5 w-5 text-[#54656F]" />
          </div>
        </section>
      </div>
    </div>
  );
}

function WaBubble({ side, children, ai, withTemplate }: { side: 'in' | 'out'; children: React.ReactNode; ai?: boolean; withTemplate?: boolean }) {
  const isIn = side === 'in';
  return (
    <div className={`flex ${isIn ? 'justify-start' : 'justify-end'}`}>
      <div className={`relative max-w-[70%] px-2.5 py-1.5 text-[11px] text-[#111B21] shadow-[0_1px_1px_rgba(0,0,0,0.08)] ${isIn ? 'rounded-lg rounded-tl-none' : 'rounded-lg rounded-tr-none'} ${ai ? 'border border-[#4F46E5]/25' : ''}`} style={{ background: isIn ? '#fff' : '#DCF8C6' }}>
        {children}
        <span aria-hidden className="absolute top-0 w-2.5 h-2.5" style={{
          background: isIn ? '#fff' : '#DCF8C6',
          left: isIn ? '-5px' : 'auto',
          right: isIn ? 'auto' : '-5px',
          clipPath: isIn ? 'polygon(100% 0, 0 0, 100% 100%)' : 'polygon(0 0, 100% 0, 0 100%)',
        }} />
      </div>
    </div>
  );
}

function WaTime({ children, read }: { children: React.ReactNode; read?: boolean }) {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[8.5px] text-black/45 align-middle">
      {children}
      {read && (
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ color: '#53BDEB' }}>
          <path d="M1 4 L3.5 6.5 L7 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 4 L6.5 6.5 L11 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Flow Builder mock (top bar + canvas + right properties panel)             */
/* -------------------------------------------------------------------------- */

function FlowBuilderMock() {
  return (
    <div className="relative sn-window">
      <WindowChrome title="dashboard / flow-builder / post-purchase" />
      <div className="grid grid-cols-12 min-h-[460px]">
        <div className="col-span-12 md:col-span-9 relative overflow-hidden" style={{ background: '#F8F7F2' }}>
          {/* top bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b sn-hair bg-white/60 backdrop-blur-sm">
            <Link href="#" className="text-[11px] text-[#7878A1] hover:text-[#121126] inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3 rotate-180" /> Back
            </Link>
            <div className="h-4 w-px bg-black/10 mx-1" />
            <div className="text-[12.5px] font-semibold text-[#121126]">Post-purchase journey</div>
            <span className="sn-tag sn-tag-live" style={{ padding: '2px 8px' }}>
              <span className="dot" /> active
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button className="sn-btn-ghost inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10.5px] font-semibold">
                <GitBranch className="h-3 w-3" /> v12
              </button>
              <button className="sn-btn-dark inline-flex h-7 items-center gap-1 rounded-full px-3 text-[10.5px] font-semibold">
                <Save className="h-3 w-3" /> Save
              </button>
            </div>
          </div>

          {/* canvas */}
          <div className="relative" style={{ height: 380 }}>
            <FlowCanvas />
            {/* FAB */}
            <button className="absolute bottom-4 left-4 h-10 w-10 rounded-full sn-btn-primary flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </button>
            {/* zoom */}
            <div className="absolute bottom-4 right-4 sn-card rounded-md px-1 py-1 flex items-center gap-0.5">
              <button className="h-6 w-6 text-[#7878A1] hover:bg-black/5 rounded"><Minus className="h-3 w-3 mx-auto" /></button>
              <span className="text-[10px] font-mono text-[#7878A1] px-1">80%</span>
              <button className="h-6 w-6 text-[#7878A1] hover:bg-black/5 rounded"><Plus className="h-3 w-3 mx-auto" /></button>
            </div>
          </div>
        </div>

        {/* properties panel */}
        <aside className="col-span-12 md:col-span-3 border-l sn-hair p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-bold text-[#7878A1]">Properties</div>
            <button className="text-[#7878A1] hover:text-red-600">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          <div className="rounded-xl sn-card p-3 bg-[#EEF2FF] border-[#4F46E5]/15">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg flex items-center justify-center text-white" style={{ background: '#25D366' }}>
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[#121126] truncate">WhatsApp · thank-you</div>
                <div className="text-[9.5px] text-[#7878A1] font-mono">node_04 · send</div>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#7878A1] font-bold">Template</label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border sn-hair px-2.5 py-1.5 text-[11.5px]">
                <span className="font-mono text-[#121126]">order_confirm_v3</span>
                <ChevronsUpDown className="h-3 w-3 ml-auto text-[#7878A1]" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#7878A1] font-bold">Variables</label>
              <div className="mt-1 space-y-1">
                {[
                  { k: '{{name}}', v: 'contact.first_name' },
                  { k: '{{order_id}}', v: 'trigger.order.id' },
                  { k: '{{eta}}', v: 'shopify.eta_date' },
                ].map(v => (
                  <div key={v.k} className="flex items-center justify-between rounded border sn-hair px-2 py-1 text-[10.5px]">
                    <span className="font-mono text-[#4F46E5]">{v.k}</span>
                    <span className="font-mono text-[#4A4A6B] truncate ml-2">{v.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#7878A1] font-bold">Retry</label>
              <div className="mt-1 flex gap-1.5">
                {['1×', '3×', '5×'].map((o, i) => (
                  <button key={o} className={`flex-1 rounded-md py-1 text-[10.5px] font-semibold ${i === 1 ? 'bg-[#121126] text-white' : 'bg-black/[0.04] text-[#4A4A6B]'}`}>{o}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t sn-hair">
            <div className="text-[10px] uppercase tracking-widest text-[#7878A1] font-bold mb-1.5">Last 7d · sent</div>
            <div className="flex items-end gap-[2px] h-10">
              {[40, 52, 65, 58, 72, 88, 94].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? '#4F46E5' : '#E0E7FF' }} />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[9.5px] font-mono text-[#7878A1]">
              {['M','T','W','T','F','S','S'].map((d, i) => <span key={i}>{d}</span>)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FlowCanvas() {
  const W = 640, H = 380;
  const nodes = [
    { id: 'n1', x: 30,  y: 150, w: 150, label: 'Order paid',       sub: '1,284 /day',       color: '#4F46E5', icon: Zap,           type: 'TRIGGER' },
    { id: 'n2', x: 220, y: 60,  w: 150, label: 'Branch · ₹2k+',    sub: '63% yes',          color: '#8B5CF6', icon: GitBranch,     type: 'LOGIC' },
    { id: 'n3', x: 220, y: 240, w: 150, label: 'Wait 24h',          sub: 'cooling window',   color: '#8B5CF6', icon: Clock,         type: 'DELAY' },
    { id: 'n4', x: 420, y: 60,  w: 160, label: 'WhatsApp · thanks', sub: '94% delivered',    color: '#25D366', icon: MessageSquare, type: 'SEND' },
    { id: 'n5', x: 420, y: 240, w: 160, label: 'AI · reorder',      sub: 'LLM + tools',      color: '#EC4899', icon: Bot,           type: 'AI' },
  ];

  const edges = [
    { from: { x: 180, y: 175 }, to: { x: 220, y: 85 },  color: '#4F46E5', live: true },
    { from: { x: 180, y: 175 }, to: { x: 220, y: 265 }, color: '#8B5CF6', live: true },
    { from: { x: 370, y: 85 },  to: { x: 420, y: 85 },  color: '#25D366', live: true },
    { from: { x: 370, y: 265 }, to: { x: 420, y: 265 }, color: '#EC4899', live: false },
  ];

  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const cx1 = a.x + (b.x - a.x) * 0.5;
    const cx2 = b.x - (b.x - a.x) * 0.5;
    return `M ${a.x} ${a.y} C ${cx1} ${a.y}, ${cx2} ${b.y}, ${b.x} ${b.y}`;
  };

  return (
    <div className="absolute inset-0">
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id="fgrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(17,17,38,0.18)" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#fgrid)" />
        {edges.map((e, i) => {
          const d = curve(e.from, e.to);
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="rgba(17,17,38,0.08)" strokeWidth="4" strokeLinecap="round" />
              <path d={d} fill="none" stroke={e.color} strokeWidth="1.8" strokeLinecap="round" strokeDasharray={e.live ? '6 5' : '2 5'} opacity={e.live ? 1 : 0.5}>
                {e.live && <animate attributeName="stroke-dashoffset" from="0" to="-33" dur="1.6s" repeatCount="indefinite" />}
              </path>
              {e.live && <circle r="3" fill={e.color}><animateMotion dur="2.4s" repeatCount="indefinite" path={d} /></circle>}
              <circle cx={e.from.x} cy={e.from.y} r="3.5" fill="#fff" stroke={e.color} strokeWidth="1.5" />
              <circle cx={e.to.x}   cy={e.to.y}   r="3.5" fill="#fff" stroke={e.color} strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>

      {nodes.map(n => {
        const Icon = n.icon;
        return (
          <div key={n.id} className="absolute rounded-lg p-2 bg-white border sn-hair shadow-[0_6px_16px_-6px_rgba(17,17,38,0.15)]" style={{
            left: `${(n.x / W) * 100}%`,
            top: `${(n.y / H) * 100}%`,
            width: `${(n.w / W) * 100}%`,
          }}>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#7878A1]">
              <span className="h-1 w-1 rounded-full" style={{ background: n.color }} />
              {n.type}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0 text-white" style={{ background: n.color }}>
                <Icon className="h-3 w-3" strokeWidth={2.4} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[#121126] leading-tight truncate">{n.label}</div>
                <div className="text-[9.5px] text-[#7878A1] truncate font-mono">{n.sub}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Contacts mock (mirrors /wachat/contacts table + stats)                 */
/* -------------------------------------------------------------------------- */

function ContactsMock() {
  const contacts = [
    { n: 'Priya Shah', e: 'priya@folia.in', ph: '+91 98234 44211', optin: true, tags: ['VIP', 'repeat'], last: '2m', grad: 'linear-gradient(135deg,#4F46E5,#8B5CF6)' },
    { n: 'Jordan Mateo', e: 'jordan@northpeak.co', ph: '+1 415 223 8801', optin: true, tags: ['sales'], last: '6m', grad: 'linear-gradient(135deg,#EC4899,#F472B6)' },
    { n: 'Lee Park', e: 'lee@helix.io', ph: '+1 212 555 0134', optin: false, tags: ['enterprise'], last: '12m', grad: 'linear-gradient(135deg,#10B981,#059669)' },
    { n: 'Ama Kusi', e: 'ama@brightwave.co', ph: '+233 24 887 2191', optin: true, tags: ['beta'], last: '34m', grad: 'linear-gradient(135deg,#F59E0B,#EAB308)' },
    { n: 'Nikhil Rao', e: 'nikhil@kintsugi.in', ph: '+91 90234 22091', optin: true, tags: ['VIP'], last: '1h', grad: 'linear-gradient(135deg,#06B6D4,#3B82F6)' },
    { n: 'Hana Tanaka', e: 'hana@lumenly.jp', ph: '+81 3 5544 0192', optin: true, tags: ['repeat', 'JP'], last: '2h', grad: 'linear-gradient(135deg,#8B5CF6,#A78BFA)' },
  ];
  return (
    <div className="relative sn-window">
      <WindowChrome title="dashboard / contacts · 3,284 total" />
      <div className="p-4 md:p-5" style={{ background: '#FAF9F4' }}>
        {/* breadcrumb + header */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#7878A1] mb-3">
          <span>Dashboard</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#121126] font-medium">Contacts</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-[22px] text-[#121126] leading-none">All contacts</h3>
            <p className="text-[12px] text-[#4A4A6B] mt-1">Manage, tag, enrich and message every contact across channels.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="sn-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button className="sn-btn-primary inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[11.5px] font-semibold">
              <UserPlus className="h-3.5 w-3.5" /> Add contact
            </button>
          </div>
        </div>

        {/* stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { k: 'Total contacts', v: '3,284', d: '+82 this week', c: '#4F46E5' },
            { k: 'Tagged',         v: '82%',   d: '2,691 / 3,284', c: '#8B5CF6' },
            { k: 'Active · 7d',     v: '1,124', d: '+14% vs last week', c: '#22C55E' },
          ].map(s => (
            <div key={s.k} className="rounded-xl sn-card p-3">
              <div className="text-[9.5px] uppercase tracking-widest text-[#7878A1] font-bold">{s.k}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="font-display text-[24px] text-[#121126] tabular-nums leading-none">{s.v}</div>
                <div className="text-[10.5px] font-semibold" style={{ color: s.c }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* filter bar */}
        <div className="rounded-xl sn-card p-2 flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1.5 text-[11.5px] flex-1">
            <Search className="h-3.5 w-3.5 text-[#7878A1]" />
            <span className="text-[#7878A1]">Name, phone, email…</span>
          </div>
          <button className="sn-btn-ghost inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold">
            <Tag className="h-3 w-3" /> Tag · 3
          </button>
          <button className="sn-btn-ghost inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold">
            <SlidersHorizontal className="h-3 w-3" /> Filters
          </button>
        </div>

        {/* table */}
        <div className="rounded-xl sn-card overflow-hidden">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-[9.5px] uppercase tracking-[0.14em] text-[#7878A1] font-bold bg-[#FAF9F4] border-b sn-hair">
                <th className="text-left px-3 py-2.5 font-bold">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" className="h-3 w-3 accent-[#4F46E5]" readOnly />
                    Name
                  </div>
                </th>
                <th className="text-left px-3 py-2.5 font-bold hidden sm:table-cell">Phone</th>
                <th className="text-left px-3 py-2.5 font-bold">Tags</th>
                <th className="text-center px-3 py-2.5 font-bold">Opt-in</th>
                <th className="text-right px-3 py-2.5 font-bold">Last</th>
                <th className="text-right px-3 py-2.5 font-bold w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y sn-hair">
              {contacts.map(c => (
                <tr key={c.e} className="hover:bg-[#FAF9F4]">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="h-3 w-3 accent-[#4F46E5]" readOnly />
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white flex-shrink-0" style={{ background: c.grad }}>
                        {c.n.split(' ').map(s => s[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#121126] truncate">{c.n}</div>
                        <div className="text-[10px] text-[#7878A1] truncate">{c.e}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[#4A4A6B] font-mono tabular-nums hidden sm:table-cell">{c.ph}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map(t => (
                        <span key={t} className="text-[9px] font-bold uppercase tracking-widest rounded px-1.5 py-[1px]" style={{
                          background: t === 'VIP' ? '#FEF3C7' : '#EEF2FF',
                          color:      t === 'VIP' ? '#B45309' : '#4F46E5',
                        }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {c.optin ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: '#DCFCE7', color: '#166534' }}>
                        <Check className="h-2.5 w-2.5" strokeWidth={3} /> yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                        no
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#7878A1] tabular-nums">{c.last}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-black/5 text-[#7878A1]">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-2.5 border-t sn-hair text-[10.5px] text-[#7878A1]">
            <span>1–20 of 3,284</span>
            <div className="flex items-center gap-1">
              {['‹', '1', '2', '3', '…', '164', '›'].map((p, i) => (
                <button key={i} className={`h-6 min-w-6 px-1.5 rounded font-mono ${p === '1' ? 'bg-[#121126] text-white' : 'hover:bg-black/5'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chatbot mock (mirrors /wachat/chatbot form + rules table)              */
/* -------------------------------------------------------------------------- */

function ChatbotMock() {
  return (
    <div className="relative sn-window">
      <WindowChrome title="dashboard / chatbot · 42 active rules" />
      <div className="p-4 md:p-5" style={{ background: '#FAF9F4' }}>
        <div className="flex items-center gap-1.5 text-[11px] text-[#7878A1] mb-3">
          <span>Dashboard</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#121126] font-medium">Chatbot</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-[22px] text-[#121126] leading-none">Keyword responses</h3>
            <p className="text-[12px] text-[#4A4A6B] mt-1">Instant auto-replies. Falls back to AI Studio for anything unmatched.</p>
          </div>
          <span className="sn-tag sn-tag-live"><span className="dot" /> live</span>
        </div>

        {/* create form */}
        <div className="rounded-xl sn-card p-4 mb-4">
          <div className="text-[10.5px] uppercase tracking-widest text-[#7878A1] font-bold mb-3">New rule</div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-3">
              <label className="text-[10px] text-[#7878A1] font-semibold">Trigger</label>
              <div className="mt-1 h-8 rounded-md border sn-hair bg-white px-2.5 flex items-center text-[11.5px] text-[#121126] font-mono">refund</div>
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] text-[#7878A1] font-semibold">Match type</label>
              <div className="mt-1 h-8 rounded-md border sn-hair bg-white px-2.5 flex items-center text-[11.5px] text-[#121126]">
                Contains <ChevronDown className="h-3 w-3 ml-auto text-[#7878A1]" />
              </div>
            </div>
            <div className="md:col-span-4">
              <label className="text-[10px] text-[#7878A1] font-semibold">Response</label>
              <div className="mt-1 min-h-8 rounded-md border sn-hair bg-white px-2.5 py-1.5 text-[11.5px] text-[#121126] leading-snug">
                Sorry to hear! Our refund window is 7 days from delivery — tap below to start.
              </div>
            </div>
            <div className="md:col-span-2 flex items-end justify-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold">
                <span className="relative inline-block w-7 h-4 rounded-full bg-[#4F46E5]">
                  <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-white" />
                </span>
                Active
              </span>
              <button className="sn-btn-primary inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-semibold">
                <Plus className="h-3 w-3" /> Create
              </button>
            </div>
          </div>
        </div>

        {/* rules table */}
        <div className="rounded-xl sn-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b sn-hair">
            <div className="text-[12px] font-semibold text-[#121126]">Active rules</div>
            <span className="text-[10.5px] font-mono text-[#7878A1]">42 rules · 4/5 pages</span>
          </div>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-[9.5px] uppercase tracking-[0.14em] text-[#7878A1] font-bold bg-[#FAF9F4] border-b sn-hair">
                <th className="text-left px-3 py-2.5 font-bold">Trigger</th>
                <th className="text-left px-3 py-2.5 font-bold">Response</th>
                <th className="text-left px-3 py-2.5 font-bold hidden md:table-cell">Match</th>
                <th className="text-center px-3 py-2.5 font-bold">Status</th>
                <th className="text-right px-3 py-2.5 font-bold hidden sm:table-cell">Hits · 7d</th>
                <th className="text-right px-3 py-2.5 font-bold w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y sn-hair">
              {[
                { t: 'hello', r: 'Hey 👋 How can we help today?', m: 'Contains', active: true, h: 1842 },
                { t: 'price', r: 'Our pricing starts at ₹499/mo. View all plans below.', m: 'Contains', active: true, h: 924 },
                { t: 'refund', r: 'Refund window is 7 days from delivery — tap to start.', m: 'Contains', active: true, h: 341 },
                { t: '^track\\s+\\#?\\d+', r: "I'll pull up that order — one sec.", m: 'Regex', active: true, h: 218 },
                { t: 'human', r: 'Connecting you to a human teammate now…', m: 'Exact', active: false, h: 92 },
              ].map(r => (
                <tr key={r.t} className="hover:bg-[#FAF9F4]">
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#4F46E5] font-mono px-1.5 py-0.5 text-[10.5px]">
                      <Hash className="h-2.5 w-2.5" /> {r.t}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[#4A4A6B] truncate max-w-[280px]">{r.r}</td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-widest rounded bg-black/[0.04] px-1.5 py-0.5 text-[#4A4A6B]">{r.m}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.active ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: '#DCFCE7', color: '#166534' }}>
                        <span className="h-1 w-1 rounded-full bg-[#22C55E]" /> active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        paused
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#4A4A6B] tabular-nums hidden sm:table-cell">{r.h.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-red-50 text-[#7878A1] hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Analytics mock (mirrors /dashboard/analytics)                             */
/* -------------------------------------------------------------------------- */

function AnalyticsMock() {
  return (
    <div className="relative sn-window">
      <WindowChrome title="dashboard / analytics · last 30 days" />
      <div className="p-4 md:p-5" style={{ background: '#FAF9F4' }}>
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#7878A1] mb-1.5">
              <span>Dashboard</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[#121126] font-medium">Analytics</span>
            </div>
            <h3 className="font-display text-[22px] text-[#121126] leading-none">Overview</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-full sn-card p-1 text-[11px]">
              {['7d', '30d', '90d'].map((t, i) => (
                <button key={t} className={`px-2.5 py-1 rounded-full font-semibold ${i === 1 ? 'bg-[#121126] text-white' : 'text-[#4A4A6B]'}`}>{t}</button>
              ))}
            </div>
            <button className="sn-btn-ghost inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-semibold">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        </div>

        {/* 6-stat KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 mb-4">
          {[
            { k: 'Sent',       v: '14.2M', d: '+38%', c: '#4F46E5', icon: Send },
            { k: 'Delivered',  v: '14.1M', d: '99.4%', c: '#22C55E', icon: CheckCircle2 },
            { k: 'Read',       v: '11.8M', d: '83%', c: '#10B981', icon: Eye },
            { k: 'Failed',     v: '0.6%', d: '−12%', c: '#EF4444', icon: ArrowDown },
            { k: 'Incoming',   v: '2.8M', d: '+22%', c: '#F59E0B', icon: ArrowUp },
            { k: 'Resolved',   v: '74%', d: 'by AI', c: '#8B5CF6', icon: Sparkles },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.k} className="rounded-xl sn-card p-3">
                <div className="flex items-center justify-between">
                  <span className="h-6 w-6 rounded flex items-center justify-center text-white" style={{ background: s.c }}>
                    <Icon className="h-3 w-3" strokeWidth={2.4} />
                  </span>
                  <span className="text-[10.5px] font-bold" style={{ color: s.c }}>{s.d}</span>
                </div>
                <div className="mt-2 text-[9.5px] uppercase tracking-widest text-[#7878A1] font-bold">{s.k}</div>
                <div className="mt-0.5 font-display text-[22px] text-[#121126] tabular-nums leading-none">{s.v}</div>
              </div>
            );
          })}
        </div>

        {/* delivery performance + line chart */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-8 rounded-xl sn-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[12px] font-semibold text-[#121126]">Messages · sent vs delivered vs read</div>
                <div className="text-[9.5px] font-mono text-[#7878A1]">UTC · stacked</div>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                {[
                  { n: 'Sent', c: '#4F46E5' },
                  { n: 'Delivered', c: '#22C55E' },
                  { n: 'Read', c: '#10B981' },
                  { n: 'Failed', c: '#EF4444' },
                ].map(l => (
                  <div key={l.n} className="flex items-center gap-1 text-[#4A4A6B]">
                    <span className="h-2 w-2 rounded-full" style={{ background: l.c }} />
                    {l.n}
                  </div>
                ))}
              </div>
            </div>
            <LineChartViz />
          </div>

          <div className="col-span-12 md:col-span-4 rounded-xl sn-card p-4">
            <div className="text-[12px] font-semibold text-[#121126] mb-0.5">Delivery performance</div>
            <div className="text-[9.5px] font-mono text-[#7878A1] mb-3">last 24 hours</div>
            <div className="space-y-3">
              {[
                { k: 'Delivered in <5s', v: '99.2%', c: '#22C55E' },
                { k: 'AI resolved',       v: '74%',   c: '#8B5CF6' },
                { k: 'Failed · retried',  v: '0.6%',  c: '#EF4444' },
              ].map(r => (
                <div key={r.k}>
                  <div className="flex items-center justify-between text-[11.5px] mb-1">
                    <span className="text-[#4A4A6B]">{r.k}</span>
                    <span className="font-semibold text-[#121126] tabular-nums font-mono">{r.v}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: r.v, background: r.c }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t sn-hair text-[11px] text-[#7878A1] flex items-center justify-between">
              <span>Alerts</span>
              <span className="font-semibold text-[#22C55E]">all ok</span>
            </div>
          </div>

          {/* daily breakdown */}
          <div className="col-span-12 rounded-xl sn-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b sn-hair">
              <div className="text-[12px] font-semibold text-[#121126]">Daily breakdown</div>
              <button className="text-[10.5px] text-[#4F46E5] hover:text-[#4338CA] font-semibold">View all</button>
            </div>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-[9.5px] uppercase tracking-[0.14em] text-[#7878A1] font-bold bg-[#FAF9F4]">
                  <th className="text-left px-3 py-2 font-bold">Date</th>
                  <th className="text-right px-3 py-2 font-bold">Sent</th>
                  <th className="text-right px-3 py-2 font-bold" style={{ color: '#22C55E' }}>Delivered</th>
                  <th className="text-right px-3 py-2 font-bold" style={{ color: '#10B981' }}>Read</th>
                  <th className="text-right px-3 py-2 font-bold" style={{ color: '#EF4444' }}>Failed</th>
                  <th className="text-right px-3 py-2 font-bold hidden sm:table-cell" style={{ color: '#F59E0B' }}>Incoming</th>
                  <th className="text-right px-3 py-2 font-bold">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y sn-hair">
                {[
                  { d: 'Apr 22', s: '1.42M', dl: '1.41M', r: '1.19M', f: '0.4%', inc: '284k', spark: [30, 38, 42, 50, 58, 64, 72, 80] },
                  { d: 'Apr 21', s: '1.28M', dl: '1.27M', r: '1.06M', f: '0.5%', inc: '262k', spark: [40, 52, 48, 55, 60, 68, 72, 78] },
                  { d: 'Apr 20', s: '1.18M', dl: '1.17M', r: '0.98M', f: '0.6%', inc: '240k', spark: [20, 28, 34, 38, 46, 52, 58, 62] },
                  { d: 'Apr 19', s: '1.22M', dl: '1.21M', r: '1.02M', f: '0.5%', inc: '256k', spark: [18, 24, 32, 40, 44, 50, 54, 58] },
                ].map(r => (
                  <tr key={r.d} className="text-[#121126]">
                    <td className="px-3 py-2 font-mono text-[#4A4A6B] tabular-nums">{r.d}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums font-mono">{r.s}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono" style={{ color: '#166534' }}>{r.dl}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono" style={{ color: '#047857' }}>{r.r}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono" style={{ color: '#B91C1C' }}>{r.f}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono hidden sm:table-cell" style={{ color: '#B45309' }}>{r.inc}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-block w-16 h-5">
                        <Sparkline points={r.spark} color="#4F46E5" mini />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points, color, mini }: { points: number[]; color: string; mini?: boolean }) {
  const max = Math.max(...points);
  const coords = points.map((p, i) => `${(i / (points.length - 1)) * 100},${100 - (p / max) * 90}`).join(' ');
  const safeId = color.replace('#', '');
  return (
    <div className={`relative ${mini ? 'h-full' : 'mt-3 h-10'}`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sparkFill-${safeId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${coords} 100,100`} fill={`url(#sparkFill-${safeId})`} />
        <polyline points={coords} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function LineChartViz() {
  const days = 30;
  const series = [
    { n: 'sent', c: '#4F46E5', data: Array.from({ length: days }, (_, i) => 60 + Math.sin(i * 0.4) * 10 + i * 1.2) },
    { n: 'del',  c: '#22C55E', data: Array.from({ length: days }, (_, i) => 58 + Math.sin(i * 0.4) * 9 + i * 1.1) },
    { n: 'read', c: '#10B981', data: Array.from({ length: days }, (_, i) => 48 + Math.sin(i * 0.4) * 8 + i * 0.9) },
    { n: 'fail', c: '#EF4444', data: Array.from({ length: days }, (_, i) => 6 + Math.cos(i * 0.5) * 2) },
  ];
  const maxV = Math.max(...series.flatMap(s => s.data));
  return (
    <div className="relative h-44 md:h-52 w-full">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1="0" x2="300" y1={f * 120} y2={f * 120} stroke="rgba(17,17,38,0.06)" strokeWidth="0.5" />
        ))}
        {series.map((s, si) => {
          const points = s.data.map((v, i) => `${(i / (days - 1)) * 300},${120 - (v / maxV) * 110}`).join(' ');
          return <polyline key={si} points={points} fill="none" stroke={s.c} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />;
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex justify-between text-[9.5px] font-mono text-[#7878A1] pt-1">
        <span>Mar 24</span>
        <span>Mar 31</span>
        <span>Apr 07</span>
        <span>Apr 14</span>
        <span className="text-[#121126] font-semibold">Apr 22</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared mock primitives                                                    */
/* -------------------------------------------------------------------------- */

function WindowChrome({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b sn-hair bg-[#FAF9F4]">
      <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
      <div className="ml-4 text-[10.5px] text-[#7878A1] font-mono tabular-nums truncate">{title}</div>
      <div className="ml-auto hidden sm:flex items-center gap-1">
        <span className="h-6 w-20 rounded-md bg-black/[0.04]" />
        <span className="h-6 w-6 rounded-md bg-black/[0.04]" />
      </div>
    </div>
  );
}

function IconBtn({ children, sm }: { children: React.ReactNode; sm?: boolean }) {
  return (
    <button className={`inline-flex items-center justify-center rounded-md text-[#7878A1] hover:bg-black/5 hover:text-[#121126] transition-colors ${sm ? 'h-6 w-6' : 'h-7 w-7'}`}>
      {children}
    </button>
  );
}

function ChannelDot({ type }: { type: string }) {
  if (type === 'whatsapp') return <span className="h-2 w-2 rounded-full" style={{ background: '#25D366' }} />;
  if (type === 'instagram') return <span className="h-2 w-2 rounded-full" style={{ background: '#E4405F' }} />;
  if (type === 'email') return <span className="h-2 w-2 rounded-full" style={{ background: '#4F46E5' }} />;
  if (type === 'web') return <span className="h-2 w-2 rounded-full" style={{ background: '#06B6D4' }} />;
  return <span className="h-2 w-2 rounded-full bg-black/30" />;
}

function ChatBubble({ side, children, time, ai }: { side: 'in' | 'out'; children: React.ReactNode; time: string; ai?: boolean }) {
  const isIn = side === 'in';
  return (
    <div className={`flex ${isIn ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11.5px] leading-snug ${
        isIn ? 'bg-white border sn-hair text-[#121126] rounded-bl-sm' : 'text-white rounded-br-sm'
      } ${ai ? 'ring-1 ring-inset ring-[#4F46E5]/25' : ''}`} style={{
        background: isIn ? '#fff' : 'linear-gradient(135deg, #4F46E5, #6366F1)',
      }}>
        {ai && (
          <div className="inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-widest text-[#CFFF5E] mb-0.5">
            <Sparkles className="h-2 w-2" /> AI
          </div>
        )}
        {ai && <br />}
        {children}
        <div className={`flex items-center gap-1 mt-1 text-[9.5px] ${isIn ? 'text-[#7878A1]' : 'text-white/75'} tabular-nums font-mono`}>
          {time}
          {!isIn && (
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="text-[#CFFF5E] ml-0.5">
              <path d="M1 4 L3.5 6.5 L7 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 4 L6.5 6.5 L11 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data bento                                                                */
/* -------------------------------------------------------------------------- */

function BentoMetrics() {
  return (
    <section id="data" className="relative py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <Eyebrow label="By the numbers" />
            <h2 className="mt-4 font-display text-[40px] md:text-[60px] leading-[1] text-[#121126]">
              Data teams{' '}
              <span className="font-display-italic sn-gradient-text">trust</span>{' '}
              to run on.
            </h2>
          </div>
          <p className="md:max-w-sm text-[15px] text-[#4A4A6B] leading-relaxed">
            Aggregated across <b>4,812</b> live workspaces. Refreshed every 60
            seconds — the numbers below are today's.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5" style={{ gridAutoRows: 'minmax(200px, auto)' }}>
          <MessagesChartCard />
          <AIResolutionCard />
          <UptimeCard />
          <CountriesCard />
          <ChannelMixCard />
          <ReplyTimeCard />
        </div>

        <ActivityTicker />
      </div>
    </section>
  );
}

function MessagesChartCard() {
  const bars = [42, 38, 55, 48, 62, 58, 72, 65, 78, 82, 75, 88, 80, 92, 85, 95, 92, 100, 96, 108, 102, 112, 105, 118, 114, 122, 118, 128, 126, 142];
  const max = 148;
  return (
    <div className="md:col-span-4 md:row-span-2 rounded-[24px] p-6 md:p-8 sn-card relative overflow-hidden" style={{
      boxShadow: '0 24px 60px -28px rgba(17,17,38,0.2)',
    }}>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#7878A1] font-bold">Messages sent · all channels</div>
          <div className="flex items-baseline gap-3 mt-3 flex-wrap">
            <div className="font-display text-[56px] md:text-[84px] leading-[0.9] text-[#121126] tabular-nums">14.2M</div>
            <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: '#DCFCE7', color: '#166534' }}>
              <ArrowUpRight className="h-3 w-3" /> +38% MoM
            </div>
          </div>
          <div className="text-[13px] text-[#4A4A6B] mt-2 max-w-md">
            WhatsApp, web, SMS and email — outbound and inbound combined. Last 30 days.
          </div>
        </div>
        <div className="hidden sm:flex gap-1.5 flex-shrink-0">
          <button className="h-7 px-3 rounded-full bg-black/[0.04] text-[11px] font-semibold text-[#7878A1]">7d</button>
          <button className="h-7 px-3 rounded-full bg-[#121126] text-[11px] font-semibold text-white">30d</button>
          <button className="h-7 px-3 rounded-full bg-black/[0.04] text-[11px] font-semibold text-[#7878A1]">90d</button>
        </div>
      </div>
      <div className="relative h-40 md:h-56">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map(i => <div key={i} className="w-full border-t border-dashed border-black/[0.08]" />)}
        </div>
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {bars.map((b, i) => {
            const isPeak = i === bars.length - 1;
            return (
              <div key={i} className="flex-1 rounded-[3px] relative" style={{
                height: `${(b / max) * 100}%`,
                background: isPeak
                  ? 'linear-gradient(180deg, #4F46E5, #6366F1)'
                  : i >= bars.length - 6
                  ? 'linear-gradient(180deg, rgba(139,92,246,0.6), rgba(139,92,246,0.25))'
                  : 'linear-gradient(180deg, rgba(17,17,38,0.18), rgba(17,17,38,0.06))',
              }}>
                {isPeak && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-bold text-white bg-[#4F46E5] px-2 py-0.5 rounded shadow-lg">
                    1.42M · Tue
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10.5px] text-[#7878A1] tabular-nums font-mono">
        <span>Mar 24</span>
        <span>Apr 07</span>
        <span className="text-[#121126] font-semibold">Apr 22</span>
      </div>
      <div className="mt-5 pt-4 border-t sn-hair grid grid-cols-3 gap-3 text-center">
        {[
          { v: '1.42M', k: 'Peak day' },
          { v: '473k', k: 'Avg / day' },
          { v: '99.4%', k: 'Delivered' },
        ].map((s, i) => (
          <div key={s.k} className={i === 1 ? 'border-x sn-hair' : ''}>
            <div className="font-display text-[20px] text-[#121126] tabular-nums">{s.v}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#7878A1]">{s.k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIResolutionCard() {
  const pct = 74;
  const circ = 2 * Math.PI * 42;
  return (
    <div className="md:col-span-2 rounded-[24px] p-6 sn-card relative overflow-hidden">
      <div aria-hidden className="absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-60" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)' }} />
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#8B5CF6] font-bold">AI resolution</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-bold text-[#7C3AED]">
          <Sparkles className="h-2.5 w-2.5" /> 24h
        </span>
      </div>
      <div className="relative mt-3 flex items-center gap-4">
        <div className="flex-shrink-0 relative">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(17,17,38,0.08)" strokeWidth="9" />
            <circle cx="48" cy="48" r="42" fill="none" stroke="#8B5CF6" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} transform="rotate(-90 48 48)" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-display text-[24px] text-[#121126] tabular-nums">74%</div>
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#121126] leading-tight">Resolved without a human</div>
          <div className="text-[11.5px] text-[#7878A1] mt-1 font-mono tabular-nums">188,412 / 254,690</div>
        </div>
      </div>
      <div className="relative mt-4 pt-3 border-t sn-hair flex items-center justify-between text-[11px]">
        <span className="text-[#7878A1]">Median confidence</span>
        <span className="font-semibold text-[#121126] tabular-nums font-mono">0.92</span>
      </div>
    </div>
  );
}

function UptimeCard() {
  const subsystems = [
    { name: 'Inbox', incidents: [] as number[] },
    { name: 'Flows', incidents: [17] },
    { name: 'AI', incidents: [] },
    { name: 'Webhooks', incidents: [23] },
  ];
  return (
    <div className="md:col-span-2 rounded-[24px] p-6 relative overflow-hidden text-white" style={{
      background: 'linear-gradient(160deg, #121126 0%, #1F1E4F 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div aria-hidden className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-40" style={{
        background: 'radial-gradient(circle, rgba(99,102,241,0.55), transparent 70%)',
      }} />
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-bold">Uptime · 90 days</div>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#86EFAC] font-bold uppercase tracking-widest">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-[#86EFAC] opacity-60 animate-ping" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-[#86EFAC]" />
          </span>
          ok
        </span>
      </div>
      <div className="relative font-display text-[60px] text-white tabular-nums mt-2 leading-none">
        99.99<span className="text-[24px] text-white/50">%</span>
      </div>
      <div className="relative mt-4 space-y-2">
        {subsystems.map(s => (
          <div key={s.name} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-white/85 w-16 flex-shrink-0">{s.name}</span>
            <div className="flex-1 flex gap-[1.5px]">
              {Array.from({ length: 30 }).map((_, i) => {
                const inc = s.incidents.includes(i);
                return <span key={i} className="h-3 flex-1 rounded-[1px]" style={{ background: inc ? '#F472B6' : '#86EFAC' }} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
        <span className="text-white/60">2 minor incidents</span>
        <span className="text-white/60 font-mono tabular-nums">4m 12s total</span>
      </div>
    </div>
  );
}

function CountriesCard() {
  const cities = [
    { x: 20, y: 32, s: 6 }, { x: 17, y: 38, s: 4 }, { x: 48, y: 28, s: 5 }, { x: 52, y: 34, s: 4 },
    { x: 56, y: 40, s: 3 }, { x: 70, y: 42, s: 7 }, { x: 77, y: 40, s: 5 }, { x: 84, y: 36, s: 5 },
    { x: 38, y: 66, s: 4 }, { x: 57, y: 56, s: 3 }, { x: 88, y: 70, s: 4 },
  ];
  const gridDots: Array<{ x: number; y: number }> = [];
  for (let y = 8; y <= 72; y += 4) {
    for (let x = 6; x <= 94; x += 3.5) {
      const inLand =
        (x > 12 && x < 28 && y > 18 && y < 48) ||
        (x > 28 && x < 44 && y > 56 && y < 76) ||
        (x > 44 && x < 58 && y > 18 && y < 42) ||
        (x > 50 && x < 66 && y > 42 && y < 64) ||
        (x > 58 && x < 90 && y > 28 && y < 52) ||
        (x > 80 && x < 92 && y > 60 && y < 76);
      if (inLand) gridDots.push({ x, y });
    }
  }
  return (
    <div className="md:col-span-2 rounded-[24px] p-6 sn-card relative overflow-hidden">
      <div aria-hidden className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-45" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.22), transparent 70%)' }} />
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#EC4899] font-bold">Global reach</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FCE7F3] px-2 py-0.5 text-[10px] font-bold text-[#9D174D]">
          <Globe className="h-2.5 w-2.5" /> live
        </span>
      </div>
      <div className="relative flex items-baseline gap-2 mt-3">
        <div className="font-display text-[52px] tabular-nums text-[#121126] leading-none">64</div>
        <div className="text-[13px] text-[#4A4A6B] font-medium">countries live</div>
      </div>
      <div className="relative mt-4 h-24">
        <svg viewBox="0 0 100 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {gridDots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="0.55" fill="rgba(17,17,38,0.22)" />)}
          {cities.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={c.s * 0.4} fill="#EC4899" opacity="0.4">
                <animate attributeName="r" values={`${c.s * 0.4};${c.s * 1.3};${c.s * 0.4}`} dur="2.4s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
                <animate attributeName="opacity" values="0.55;0;0.55" dur="2.4s" repeatCount="indefinite" begin={`${i * 0.2}s`} />
              </circle>
              <circle cx={c.x} cy={c.y} r={c.s * 0.32} fill="#EC4899" />
            </g>
          ))}
        </svg>
      </div>
      <div className="relative mt-3 pt-3 border-t sn-hair flex items-center justify-between text-[11px] font-mono tabular-nums">
        <span className="text-[#7878A1]">Top: IN · US · BR</span>
        <span className="text-[#121126] font-semibold">+11 this Q</span>
      </div>
    </div>
  );
}

function ChannelMixCard() {
  const channels = [
    { name: 'WhatsApp', pct: 58, color: '#25D366' },
    { name: 'Instagram DM', pct: 14, color: '#E4405F' },
    { name: 'Web chat', pct: 12, color: '#4F46E5' },
    { name: 'Email', pct: 10, color: '#8B5CF6' },
    { name: 'SMS', pct: 6, color: '#F59E0B' },
  ];
  return (
    <div className="md:col-span-2 rounded-[24px] p-6 sn-card">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#7878A1] font-bold">Channel mix · today</div>
        <span className="text-[10px] text-[#7878A1] font-mono tabular-nums">n = 254k</span>
      </div>
      <div className="mt-4 flex rounded-full h-2.5 overflow-hidden ring-1 ring-black/5">
        {channels.map(c => <div key={c.name} className="h-full" style={{ width: `${c.pct}%`, background: c.color }} />)}
      </div>
      <ul className="mt-4 space-y-1.5">
        {channels.map(c => (
          <li key={c.name} className="flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              <span className="text-[#121126] font-medium">{c.name}</span>
            </div>
            <span className="text-[#7878A1] tabular-nums font-mono text-[11px]">{c.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReplyTimeCard() {
  const points = Array.from({ length: 48 }).map((_, i) => {
    const x = (i / 47) * 100;
    const mean = 38; const std = 12;
    const y = 80 - 68 * Math.exp(-Math.pow((x - mean) / std, 2) * 0.5);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return (
    <div className="md:col-span-2 rounded-[24px] p-6 sn-card relative overflow-hidden">
      <div aria-hidden className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-45" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)' }} />
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#4F46E5] font-bold">Reply time · median</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold text-[#4F46E5]">
          <Clock className="h-2.5 w-2.5" /> live
        </span>
      </div>
      <div className="relative flex items-baseline gap-2 mt-3">
        <div className="font-display text-[52px] tabular-nums text-[#121126] leading-none">
          52<span className="text-[20px] text-[#7878A1] font-normal">s</span>
        </div>
        <div className="text-[11px] text-[#22C55E] font-semibold">−38% vs. Q1</div>
      </div>
      <div className="relative mt-3 h-16">
        <svg viewBox="0 0 100 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="replyFill2" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,80 ${points} 100,80`} fill="url(#replyFill2)" />
          <polyline points={points} fill="none" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="38" x2="38" y1="14" y2="80" stroke="#121126" strokeWidth="0.5" strokeDasharray="2 2" />
          <circle cx="38" cy="14" r="1.6" fill="#121126" />
        </svg>
      </div>
      <div className="relative flex justify-between text-[9.5px] text-[#7878A1] tabular-nums font-mono mt-1">
        <span>0s</span><span>30s</span><span className="text-[#121126] font-bold">52s</span><span>2m</span><span>5m+</span>
      </div>
    </div>
  );
}

function ActivityTicker() {
  const events = [
    { icon: MessageSquare, text: 'Flow "cart-recovery" triggered · Mumbai', t: '2s', color: '#4F46E5' },
    { icon: Bot, text: 'AI resolved billing query · Folia', t: '4s', color: '#8B5CF6' },
    { icon: Send, text: 'Broadcast 12,400 contacts · Lagos', t: '11s', color: '#EC4899' },
    { icon: CheckCircle2, text: 'Onboarding step 4 done · Brightwave', t: '18s', color: '#22C55E' },
    { icon: Workflow, text: '"post-purchase" flow · 94% delivered', t: '22s', color: '#4F46E5' },
    { icon: Users2, text: 'AI → human handoff in 4s · Helix & Co.', t: '29s', color: '#F59E0B' },
    { icon: Zap, text: 'New webhook registered · NorthPeak', t: '35s', color: '#06B6D4' },
    { icon: Sparkles, text: 'LLM-drafted reply accepted · Lumenly', t: '41s', color: '#8B5CF6' },
  ];
  return (
    <div className="mt-5 rounded-full sn-card overflow-hidden relative">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[130px] z-10 w-14 bg-gradient-to-r from-white to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent" />
      <div className="flex items-center gap-3 pl-5 pr-6 py-2.5">
        <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#4F46E5]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-[#4F46E5] opacity-60 animate-ping" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-[#4F46E5]" />
          </span>
          Live events
        </span>
        <span className="flex-shrink-0 h-4 w-px bg-black/10" />
        <div className="flex-1 overflow-hidden relative">
          <div className="sn-marquee flex gap-10 whitespace-nowrap w-max" style={{ animationDuration: '48s' }}>
            {[...events, ...events].map((e, i) => {
              const Icon = e.icon;
              return (
                <span key={i} className="inline-flex items-center gap-2 text-[12.5px] text-[#121126]/90">
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: e.color }} strokeWidth={2.2} />
                  <span className="font-medium">{e.text}</span>
                  <span className="text-[#7878A1] tabular-nums font-mono text-[10.5px]">· {e.t} ago</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Testimonials                                                              */
/* -------------------------------------------------------------------------- */

function Testimonials() {
  const items = [
    { quote: 'We cut three tools from our stack and moved to SabNode in a weekend. Reply time dropped from hours to under ninety seconds.', name: 'Priya Raghavan', role: 'COO · Folia', badge: 'Folia', accent: '#4F46E5', tint: '#EEF2FF' },
    { quote: "The flow builder is the first no-code tool that scales past the toy phase. It quietly runs our entire post-sale journey now.", name: 'Marco DeLuca', role: 'Head of Ops · NorthPeak', badge: 'NorthPeak', accent: '#8B5CF6', tint: '#F3E8FF' },
    { quote: 'The AI layer feels genuinely private. Grounded on our own data, never leaking — and better answers than the old bot.', name: 'Hana Tanaka', role: 'CTO · Lumenly', badge: 'Lumenly', accent: '#EC4899', tint: '#FCE7F3' },
  ];
  return (
    <section className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <Eyebrow label="Testimonials" />
            <h2 className="mt-4 font-display text-[40px] md:text-[60px] leading-[1] text-[#121126]">
              What teams{' '}
              <span className="font-display-italic sn-gradient-text">quietly</span>{' '}
              ship after the switch.
            </h2>
          </div>
          <p className="md:max-w-sm text-[15px] text-[#4A4A6B] leading-relaxed">
            Direct quotes from operators who moved their support, ops and
            marketing onto SabNode.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {items.map(t => (
            <figure key={t.name} className="relative rounded-[24px] p-7 sn-card overflow-hidden">
              <div aria-hidden className="absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-80 blur-xl" style={{ background: t.tint }} />
              <div className="relative">
                <div className="font-display text-6xl leading-none" style={{ color: t.accent, opacity: 0.25 }}>&ldquo;</div>
                <blockquote className="-mt-3 text-[15px] md:text-[15.5px] text-[#121126]/90 leading-[1.55] font-medium tracking-[-0.003em]">{t.quote}</blockquote>
                <figcaption className="mt-6 pt-5 border-t sn-hair flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-[#121126]">{t.name}</div>
                    <div className="text-[12px] text-[#7878A1]">{t.role}</div>
                  </div>
                  <div className="font-display text-[18px] tracking-[-0.04em] text-[#121126]/70">{t.badge}</div>
                </figcaption>
                <div className="mt-4 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5" style={{ fill: t.accent, color: t.accent }} />
                  ))}
                </div>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stats banner                                                              */
/* -------------------------------------------------------------------------- */

function StatsBanner() {
  const stats = [
    { v: '4,812', k: 'Workspaces live', d: '+127 this week', trend: 'up' as const },
    { v: '14.2M', k: 'Messages · Apr', d: '+38% MoM', trend: 'up' as const },
    { v: '99.99%', k: 'Uptime · 90d', d: '2 minor · 4m12s', trend: 'flat' as const },
    { v: '74%', k: 'Resolved by AI', d: '188k / 254k chats', trend: 'up' as const },
    { v: '52s', k: 'Median reply', d: '−38% vs. Q1', trend: 'down' as const },
    { v: '64', k: 'Countries', d: '+11 this quarter', trend: 'up' as const },
  ];
  return (
    <section className="relative py-10 md:py-16">
      <div className="container mx-auto px-6">
        <div className="relative rounded-[28px] overflow-hidden" style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 40%, #8B5CF6 75%, #EC4899 100%)',
          boxShadow: '0 40px 100px -30px rgba(79,70,229,0.45), 0 20px 50px -20px rgba(236,72,153,0.28)',
        }}>
          <div aria-hidden className="absolute inset-0 opacity-[0.14]" style={{
            backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }} />
          <div aria-hidden className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full opacity-45" style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 60%)', filter: 'blur(40px)',
          }} />

          <div className="relative px-6 md:px-10 pt-8 md:pt-10 pb-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-white opacity-70 animate-ping" />
                  <span className="relative rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                Platform pulse · refreshed 00:04 ago
              </div>
              <h3 className="mt-4 font-display text-white text-[28px] md:text-[40px] leading-[1.05]">A working system, in public.</h3>
            </div>
            <div className="text-[12.5px] text-white/85 md:max-w-xs font-mono tabular-nums">
              <span className="font-sans font-semibold">Source:</span> telemetry from every workspace. No sampling.
            </div>
          </div>

          <div className="relative grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/20 mt-6">
            {stats.map((s, i) => (
              <div key={s.k} className="px-5 md:px-6 py-8 md:py-10 text-white relative" style={{ background: 'rgba(79,70,229,0.02)' }}>
                <span className="absolute top-3 right-3 text-[10px] font-bold tabular-nums text-white/55 font-mono">0{i + 1}</span>
                <div className="font-display text-[44px] md:text-[56px] leading-[0.95] tabular-nums tracking-[-0.035em]">{s.v}</div>
                <div className="mt-2.5 text-[11px] uppercase tracking-[0.16em] font-semibold text-white/95 max-w-[16ch] leading-snug">{s.k}</div>
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold text-white tabular-nums">
                  {s.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : s.trend === 'down' ? <ArrowUpRight className="h-3 w-3 rotate-90" /> : <span className="h-0.5 w-2 bg-white rounded-full" />}
                  {s.d}
                </div>
              </div>
            ))}
          </div>

          <div className="relative px-6 md:px-10 py-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-[12.5px] text-white/90">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="inline-flex items-center gap-1.5 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Replaces 8.4 tools on avg.</span>
              <span className="inline-flex items-center gap-1.5 font-semibold"><Flame className="h-3.5 w-3.5" /> $11,300 saved / team / mo</span>
              <span className="inline-flex items-center gap-1.5 font-semibold"><Clock className="h-3.5 w-3.5" /> 4.2 days to first flow</span>
            </div>
            <Link href="/signup" className="inline-flex items-center gap-1.5 text-white font-bold hover:gap-2 transition-all">
              See the full benchmark <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                   */
/* -------------------------------------------------------------------------- */

function PricingSection() {
  const plans = [
    { name: 'Starter', price: 'Free', cadence: 'forever', tagline: 'For solo builders getting started with automation.', highlight: false, dark: false,
      features: ['Up to 3 active flows', 'WhatsApp sandbox', '500 AI messages / mo', 'Community support'], cta: 'Get started' },
    { name: 'Pro', price: '$19', cadence: '/month', tagline: 'For growing teams running their business on SabNode.', highlight: true, dark: true,
      features: ['Unlimited flows & inboxes', 'Full WhatsApp Cloud API', '25k AI messages / mo', 'Private tenant-scoped models', 'Priority support · <4h'], cta: 'Start 14-day trial' },
    { name: 'Enterprise', price: '$49', cadence: '/month', tagline: 'For high-volume, regulated or multi-brand operators.', highlight: false, dark: false,
      features: ['SSO, audit logs, SCIM', 'Dedicated infra + region pick', 'Custom data residency', 'Slack-connect support'], cta: 'Talk to sales' },
  ];
  return (
    <section id="pricing" className="relative py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Eyebrow label="Pricing" align="center" />
          <h2 className="mt-4 font-display text-[40px] md:text-[64px] leading-[1] text-[#121126]">
            Flexible plans for{' '}
            <span className="font-display-italic sn-gradient-text">every team.</span>
          </h2>
          <p className="mt-5 text-[15px] md:text-[17px] text-[#4A4A6B] max-w-xl mx-auto">
            Start free. Upgrade only when the automation makes you money. All plans include unlimited seats.
          </p>
          <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full sn-card text-[12px]">
            <button className="px-4 py-1.5 rounded-full text-[#7878A1] font-medium">Monthly</button>
            <button className="px-4 py-1.5 rounded-full sn-btn-primary font-semibold flex items-center gap-2">
              Annually <span className="text-white/80 text-[10px] font-bold bg-white/20 rounded px-1.5 py-0.5">−20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {plans.map(p => (
            <article key={p.name} className={`relative rounded-[24px] p-7 md:p-8 overflow-hidden ${p.dark ? 'text-white' : 'sn-card text-[#121126]'}`} style={p.dark ? {
              background: 'linear-gradient(160deg, #4F46E5 0%, #6366F1 50%, #8B5CF6 100%)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 40px 100px -30px rgba(79,70,229,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
            } : { boxShadow: '0 24px 60px -28px rgba(17,17,38,0.18)' }}>
              {p.highlight && (
                <div className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-white text-[#4F46E5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
                  <Flame className="h-3 w-3" /> Most loved
                </div>
              )}
              <div className={`text-[11px] uppercase tracking-[0.2em] font-bold ${p.dark ? 'text-white/80' : 'text-[#7878A1]'}`}>{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className={`font-display text-[56px] md:text-[72px] leading-none tabular-nums ${p.dark ? 'text-white' : 'text-[#121126]'}`}>{p.price}</span>
                {p.cadence && <span className={`text-[14px] ${p.dark ? 'text-white/75' : 'text-[#7878A1]'}`}>{p.cadence}</span>}
              </div>
              <p className={`mt-2.5 text-[13.5px] leading-relaxed max-w-xs ${p.dark ? 'text-white/85' : 'text-[#4A4A6B]'}`}>{p.tagline}</p>

              <ul className="mt-6 space-y-3">
                {p.features.map(f => (
                  <li key={f} className={`flex items-start gap-2.5 text-[13.5px] ${p.dark ? 'text-white/90' : 'text-[#121126]/85'}`}>
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-shrink-0 ${p.dark ? 'text-white' : 'text-[#4F46E5]'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link href={p.name === 'Enterprise' ? '/contact' : '/signup'} className={`mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-transform hover:scale-[1.01] ${
                p.dark ? 'bg-white text-[#4F46E5] hover:bg-[#F5F3EC]' : 'sn-btn-primary'
              }`}>
                {p.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                       */
/* -------------------------------------------------------------------------- */

function FaqSection() {
  const [open, setOpen] = React.useState<number | null>(0);
  const faqs = [
    { q: 'How long does setup take?', a: 'Most teams go live in 10–30 minutes. Connect a channel, import contacts, pick a template flow — done.' },
    { q: 'Do I need to migrate off my existing stack?', a: "No. SabNode can sit beside what you have, or replace parts gradually. Every module has import + webhook fallbacks." },
    { q: 'Is my data used to train your models?', a: "Never. The AI layer is tenant-scoped — your context stays private and is never used to train shared models." },
    { q: 'Can I self-host or choose a region?', a: "Yes, on Enterprise. EU, US or India residency, or deploy into your own cluster with our installer." },
  ];
  return (
    <section id="faq" className="relative py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <Eyebrow label="FAQ" />
            <h2 className="mt-4 font-display text-[40px] md:text-[60px] leading-[1] text-[#121126]">
              Questions,<br />
              <span className="font-display-italic sn-gradient-text">answered.</span>
            </h2>
            <p className="mt-5 text-[15px] text-[#4A4A6B] max-w-sm leading-relaxed">
              Still unsure? A human replies within a few hours — not a bot pretending to be one.
            </p>
            <Link href="/contact" className="mt-6 sn-btn-ghost inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-semibold">
              Contact support <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="md:col-span-7">
            <ul className="divide-y sn-hair border-y sn-hair">
              {faqs.map((f, i) => {
                const isOpen = open === i;
                return (
                  <li key={f.q}>
                    <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="w-full flex items-start justify-between gap-6 py-6 text-left group">
                      <span className="font-display text-[22px] md:text-[26px] leading-[1.2] text-[#121126] group-hover:text-[#4F46E5] transition-colors">{f.q}</span>
                      <span className={`mt-1 flex-shrink-0 h-9 w-9 rounded-full inline-flex items-center justify-center transition-all ${
                        isOpen ? 'bg-[#4F46E5] text-white rotate-180' : 'sn-card text-[#121126]'
                      }`}>
                        {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                    <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-6' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden text-[15px] text-[#4A4A6B] leading-relaxed max-w-2xl">{f.a}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Final CTA                                                                 */
/* -------------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="relative py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="relative rounded-[32px] overflow-hidden px-8 py-14 md:px-16 md:py-20" style={{
          background: 'linear-gradient(135deg, #121126 0%, #1F1E4F 50%, #3B3683 100%)',
          boxShadow: '0 60px 140px -40px rgba(17,17,38,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset',
        }}>
          <div aria-hidden className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full opacity-60" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.7), transparent 60%)', filter: 'blur(30px)' }} />
          <div aria-hidden className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full opacity-55" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.55), transparent 60%)', filter: 'blur(30px)' }} />
          <div aria-hidden className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

          <div className="relative grid md:grid-cols-12 gap-10 items-end">
            <div className="md:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/85 font-semibold">
                <Sparkles className="h-3 w-3 text-[#A78BFA]" /> Join the SabNode beta
              </div>
              <h2 className="mt-6 font-display text-[44px] md:text-[88px] leading-[0.95] text-white tracking-[-0.03em]">
                Ready to quietly<br />
                <span className="font-display-italic sn-gradient-text">automate</span> the boring?
              </h2>
              <p className="mt-6 text-[15px] md:text-[17px] text-white/70 max-w-xl leading-relaxed">
                Launch your stack in an afternoon. Watch it run. Keep humans on the work that moves the number.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-[14px] font-semibold text-[#121126] transition-transform hover:scale-[1.02]">
                  Request beta access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="#products" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-[14px] font-semibold text-white hover:bg-white/10 transition-colors">
                  See every module
                </Link>
              </div>
            </div>

            <div className="md:col-span-4">
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/60 font-bold">Average new account</div>
                <div className="mt-3 grid grid-cols-3 gap-4">
                  {[
                    { v: '10m', k: 'to first flow' },
                    { v: '4d', k: 'to replace 2 tools' },
                    { v: '3×', k: 'reply speed' },
                  ].map(s => (
                    <div key={s.k}>
                      <div className="font-display text-[28px] text-white leading-none tabular-nums">{s.v}</div>
                      <div className="mt-1 text-[10.5px] text-white/60 leading-tight">{s.k}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/70">
                  <BadgeCheck className="h-3.5 w-3.5 text-[#A78BFA]" />
                  No credit card · cancel anytime
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Indigo footer                                                             */
/* -------------------------------------------------------------------------- */

function IndigoFooter() {
  const cols = [
    { h: 'Product', items: [['Chat', '#products'], ['Flow Builder', '#products'], ['Contacts', '#products'], ['Chatbot', '#products'], ['Analytics', '#products']] },
    { h: 'Company', items: [['About', '/about-us'], ['Journal', '/blog'], ['Careers', '/careers'], ['Contact', '/contact']] },
    { h: 'Legal', items: [['Terms', '/terms-and-conditions'], ['Privacy', '/privacy-policy'], ['DPA', '/contact'], ['Security', '/contact']] },
  ];
  return (
    <footer className="relative pt-20 pb-10">
      <div className="container mx-auto px-6">
        <div className="rounded-[28px] sn-card p-8 md:p-12" style={{ boxShadow: '0 24px 60px -28px rgba(17,17,38,0.18)' }}>
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 md:col-span-5 space-y-4">
              <SabNodeLogo className="h-8 w-auto" />
              <p className="text-[14px] text-[#4A4A6B] max-w-sm leading-relaxed">
                A connected platform for WhatsApp, marketing, sales and daily business operations. Built for execution.
              </p>
              <div className="flex items-center gap-2 pt-2">
                {[Twitter, Linkedin, Instagram, Github].map((I, i) => (
                  <a key={i} href="#" className="h-9 w-9 rounded-full sn-card inline-flex items-center justify-center text-[#4A4A6B] hover:text-[#121126] hover:border-[#4F46E5]/30 transition-colors">
                    <I className="h-4 w-4" />
                  </a>
                ))}
              </div>
              <div className="pt-3 flex items-center gap-3">
                <span className="sn-tag sn-tag-live">
                  <span className="dot" /> All systems · 99.99%
                </span>
              </div>
            </div>
            <div className="col-span-12 md:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-6">
              {cols.map(c => (
                <div key={c.h}>
                  <div className="text-[10.5px] uppercase tracking-[0.18em] text-[#7878A1] font-bold mb-3">{c.h}</div>
                  <ul className="space-y-2">
                    {c.items.map(([t, h]) => (
                      <li key={t}>
                        <Link href={h} className="text-[13px] text-[#4A4A6B] hover:text-[#121126] transition-colors">{t}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 pt-6 border-t sn-hair flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[12px] text-[#7878A1]">
            <div>© {new Date().getFullYear()} SabNode. Built for execution.</div>
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-[#4F46E5]" /> SOC 2 · GDPR · DPA</span>
              <span className="font-mono tabular-nums">v26.04.22</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared primitives                                                         */
/* -------------------------------------------------------------------------- */

function Eyebrow({ label, align = 'left' }: { label: string; align?: 'left' | 'center' }) {
  return (
    <div className={`inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.22em] font-bold text-[#4F46E5] ${align === 'center' ? 'justify-center' : ''}`}>
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#4F46E5]" />
      {label}
    </div>
  );
}
