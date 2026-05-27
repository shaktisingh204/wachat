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
import { SabNodeLogo } from '@/components/zoruui-domain/logo';
import { getSession } from '@/app/actions';
import { LandingHeader } from '@/components/landing/landing-header';

/* -------------------------------------------------------------------------- */
/*  SabNode landing — light paper, indigo highlight.                          */
/*  Warm off-white, deep-ink text, indigo-600 accents + violet glints.        */
/*  Each product mock mirrors the real in-app layout so visitors recognize    */
/*  the product when they sign in.                                            */
/* -------------------------------------------------------------------------- */

export default function HomePageClient({ initialSession }: { initialSession: any }) {
  const session = initialSession;
  const loading = false;

  return (
    <div className="sn-root relative min-h-screen overflow-x-clip antialiased">
      <GlobalStyles />
      <AuroraBg />
      <PaperGrain />

      <div className="relative z-10">
        <LandingHeader session={session} loading={loading} />

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
        background: #F7F8FC;
        color: #121126;
        font-family: var(--font-sab-body), ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      .sn-root ::selection { background: #4F46E5; color: #fff; }

      .font-display {
        font-family: var(--font-sab-display), ui-sans-serif, system-ui, sans-serif;
        font-weight: 700;
        letter-spacing: -0.026em;
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
        box-shadow: 0 24px 70px -38px rgba(17,17,38,0.24), 0 1px 0 rgba(255,255,255,0.8) inset;
      }
      .sn-card-soft {
        background: rgba(255,255,255,0.82);
        border: 1px solid rgba(17,17,38,0.08);
        backdrop-filter: blur(16px);
        box-shadow: 0 24px 70px -42px rgba(17,17,38,0.28), 0 1px 0 rgba(255,255,255,0.85) inset;
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
        border-radius: 28px; overflow: hidden;
        background: #fff;
        border: 1px solid rgba(17,17,38,0.08);
        box-shadow:
          0 70px 150px -44px rgba(79,70,229,0.26),
          0 24px 60px -24px rgba(17,17,38,0.12),
          0 0 0 1px rgba(255,255,255,0.8) inset;
      }

      .sn-section-shell {
        border-radius: 36px;
        background: rgba(255,255,255,0.58);
        border: 1px solid rgba(17,17,38,0.07);
        box-shadow: 0 40px 120px -70px rgba(17,17,38,0.36), 0 1px 0 rgba(255,255,255,0.86) inset;
        backdrop-filter: blur(14px);
      }

      .sn-product-card {
        background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.76));
        border: 1px solid rgba(17,17,38,0.08);
        box-shadow: 0 28px 80px -44px rgba(17,17,38,0.28);
        transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
      }
      .sn-product-card:hover {
        transform: translateY(-3px);
        border-color: rgba(79,70,229,0.24);
        box-shadow: 0 36px 100px -48px rgba(79,70,229,0.34);
      }
    `}</style>
  );
}

function AuroraBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(1200px 620px at 10% -8%, rgba(99,102,241,0.16), transparent 60%),' +
          'radial-gradient(1000px 520px at 96% 4%, rgba(139,92,246,0.11), transparent 62%),' +
          'radial-gradient(900px 520px at 50% 100%, rgba(79,70,229,0.10), transparent 62%),' +
          '#F7F8FC',
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
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */

function Hero({ session, loading }: { session: any; loading: boolean }) {
  return (
    <section className="relative overflow-hidden pb-12 pt-10 md:pb-18 md:pt-16">
      {/* concentric orbits + integration logos */}
      <div aria-hidden className="absolute inset-x-0 top-8 md:top-16 bottom-0 pointer-events-none">
        <OrbitField />
      </div>

      <div className="container relative mx-auto px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          {/* trust ratings */}
          <div className="sn-reveal flex flex-wrap items-center justify-center gap-3 text-[12.5px]" style={{ animationDelay: '40ms' }}>
            <span className="sn-tag sn-tag-live">
              <span className="dot" /> Live across 4,812 workspaces
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GoogleGlyph className="h-[15px] w-[15px]" />
              <span className="font-semibold text-zoru-ink tabular-nums">4.8</span>
              <span className="text-zoru-ink">Google</span>
            </span>
            <span className="h-4 w-px bg-black/10" />
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-[15px] w-[15px] fill-zoru-ink text-zoru-ink" strokeWidth={0} />
              <span className="font-semibold text-zoru-ink tabular-nums">4.9</span>
              <span className="text-zoru-ink">Trustpilot</span>
            </span>
          </div>

          {/* headline */}
          <h1 className="sn-reveal mt-7 max-w-5xl font-display text-zoru-ink leading-[0.92] text-[13vw] sm:text-[9vw] md:text-[82px] lg:text-[102px]" style={{ animationDelay: '120ms' }}>
            The command center for
            <br />
            customer{' '}<span className="font-display-italic sn-gradient-text">operations.</span>
          </h1>

          {/* subtext */}
          <p className="sn-reveal mt-6 max-w-2xl text-[16px] leading-relaxed text-zoru-ink md:text-[18px]" style={{ animationDelay: '260ms' }}>
            Unify WhatsApp, web chat, AI agents, CRM, broadcasts, workflows,
            and analytics in one workspace built for teams that actually ship.
          </p>

          {/* CTAs */}
          <div className="sn-reveal mt-8 flex flex-col sm:flex-row items-center gap-3" style={{ animationDelay: '380ms' }}>
            {loading ? null : session?.user ? (
              <Link href="/wachat" className="sn-btn-dark inline-flex h-12 items-center gap-2 rounded-full px-7 text-[14px] font-semibold">
                Open workspace
              </Link>
            ) : (
              <Link href="/signup" className="sn-btn-primary inline-flex h-12 items-center gap-2 rounded-full px-7 text-[14px] font-semibold">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link
              href="#products"
              className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14px] font-semibold text-zoru-ink bg-white border sn-hair hover:bg-black/[0.03] transition"
            >
              Explore products
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <HeroProofGrid />

          {/* floating activity card */}
          <div className="sn-reveal relative mt-10 w-full max-w-md md:mt-14" style={{ animationDelay: '520ms' }}>
            <div
              aria-hidden
              className="absolute -inset-10 pointer-events-none"
              style={{
                background:
                  'radial-gradient(60% 50% at 50% 40%, rgba(99,102,241,0.28), transparent 70%)',
                filter: 'blur(24px)',
              }}
            />
            <ActivityCardStack />
          </div>

          {/* trusted by + logos */}
          <div className="sn-reveal mt-12 w-full md:mt-16" style={{ animationDelay: '640ms' }}>
            <p className="text-[11.5px] text-center text-zoru-ink tracking-wide">
              Trusted by teams replacing disconnected support, CRM, and automation tools
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-9 gap-y-4 opacity-80">
              {['Google', 'airbnb', 'coinbase', 'Notion', 'Gumroad', 'PayPal', 'upwork', 'shopify', 'stripe', 'ZOOM'].map((n) => (
                <span
                  key={n}
                  className="font-display text-[18px] md:text-[20px] tracking-[-0.04em] text-zoru-ink/60 hover:text-zoru-ink transition"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroProofGrid() {
  const proof = [
    { icon: MessageSquare, value: '14.2M', label: 'messages / month' },
    { icon: Clock, value: '52s', label: 'median first reply' },
    { icon: Shield, value: 'SOC 2', label: 'ready controls' },
  ];
  return (
    <div className="sn-reveal mt-8 grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-3" style={{ animationDelay: '450ms' }}>
      {proof.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="sn-card-soft rounded-2xl px-4 py-3 text-left">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zoru-surface text-zoru-ink">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="font-display text-[24px] leading-none text-zoru-ink tabular-nums">
                  {item.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.13em] text-zoru-ink">
                  {item.label}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — orbit field + integration logos                                    */
/* -------------------------------------------------------------------------- */

function OrbitField() {
  return (
    <div className="relative h-full w-full">
      {/* SVG rings — 5 concentric ellipses centered horizontally */}
      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] sm:w-[130%] md:w-[110%] max-w-none"
        viewBox="0 0 1400 760"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <ellipse cx="700" cy="380" rx="240" ry="170" stroke="rgba(17,17,38,0.07)" />
        <ellipse cx="700" cy="380" rx="370" ry="240" stroke="rgba(17,17,38,0.06)" />
        <ellipse cx="700" cy="380" rx="500" ry="305" stroke="rgba(17,17,38,0.05)" />
        <ellipse cx="700" cy="380" rx="630" ry="365" stroke="rgba(17,17,38,0.04)" />
        <ellipse cx="700" cy="380" rx="760" ry="420" stroke="rgba(17,17,38,0.035)" />
        {/* indigo accent arc */}
        <ellipse
          cx="700"
          cy="380"
          rx="370"
          ry="240"
          stroke="#4F46E5"
          strokeWidth="1"
          strokeDasharray="2 14"
          opacity="0.55"
        />
        <ellipse
          cx="700"
          cy="380"
          rx="630"
          ry="365"
          stroke="#8B5CF6"
          strokeWidth="1"
          strokeDasharray="2 18"
          opacity="0.35"
        />
      </svg>

      {/* logo bubbles — desktop only, anchored relative to the section */}
      <div className="absolute inset-0 hidden md:block">
        {ORBIT_LOGOS.map(({ key, ...rest }) => (
          <LogoBubble key={key} {...rest} />
        ))}
      </div>

      {/* condensed bubbles for small screens */}
      <div className="absolute inset-x-0 top-2 flex justify-between px-3 md:hidden">
        <LogoBubbleStatic glyph={<SlackGlyph />} size="sm" />
        <LogoBubbleStatic glyph={<MetaGlyph />} size="sm" />
        <LogoBubbleStatic glyph={<MailchimpGlyph />} size="sm" />
        <LogoBubbleStatic glyph={<NotionGlyph />} size="sm" />
      </div>
    </div>
  );
}

type LogoSpec = {
  key: string;
  top: string;
  left: string;
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
  glyph: React.ReactNode;
};

const ORBIT_LOGOS: LogoSpec[] = [
  { key: 'slack',    top: '4%',  left: '22%', size: 'lg', delay: 0,    glyph: <SlackGlyph /> },
  { key: 'zapier',   top: '4%',  left: '78%', size: 'lg', delay: 0.6,  glyph: <ZapierGlyph /> },
  { key: 'meta',     top: '32%', left: '12%', size: 'md', delay: 1.1,  glyph: <MetaGlyph /> },
  { key: 'aws',      top: '32%', left: '88%', size: 'md', delay: 1.7,  glyph: <AwsGlyph /> },
  { key: 'gcal',     top: '46%', left: '21%', size: 'md', delay: 2.2,  glyph: <GoogleCalendarGlyph /> },
  { key: 'figma',    top: '50%', left: '79%', size: 'md', delay: 2.6,  glyph: <FigmaGlyph /> },
  { key: 'mailchimp',top: '64%', left: '10%', size: 'md', delay: 0.4,  glyph: <MailchimpGlyph /> },
  { key: 'clickup',  top: '64%', left: '90%', size: 'md', delay: 1.3,  glyph: <ClickupGlyph /> },
  { key: 'gads',     top: '82%', left: '24%', size: 'md', delay: 2.0,  glyph: <GoogleAdsGlyph /> },
  { key: 'airtable', top: '84%', left: '76%', size: 'md', delay: 2.8,  glyph: <AirtableGlyph /> },
  { key: 'notion',   top: '20%', left: '46%', size: 'sm', delay: 1.9,  glyph: <NotionGlyph /> },
  { key: 'stripe',   top: '78%', left: '52%', size: 'sm', delay: 3.1,  glyph: <StripeGlyph /> },
];

function LogoBubble({ top, left, size = 'md', delay = 0, glyph }: Omit<LogoSpec, 'key'>) {
  const dim = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  return (
    <div
      className={`sn-float absolute ${dim} -translate-x-1/2 -translate-y-1/2 rounded-full bg-white flex items-center justify-center`}
      style={{
        top,
        left,
        boxShadow:
          '0 1px 2px rgba(17,17,38,0.06), 0 12px 28px -10px rgba(17,17,38,0.18), 0 0 0 1px rgba(17,17,38,0.05) inset',
        animationDelay: `${delay}s`,
      }}
    >
      <div className="flex items-center justify-center">{glyph}</div>
    </div>
  );
}

function LogoBubbleStatic({ glyph, size = 'md' }: { glyph: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  return (
    <div
      className={`${dim} rounded-full bg-white flex items-center justify-center`}
      style={{
        boxShadow:
          '0 1px 2px rgba(17,17,38,0.06), 0 12px 28px -10px rgba(17,17,38,0.18), 0 0 0 1px rgba(17,17,38,0.05) inset',
      }}
    >
      {glyph}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Activity card stack (hero overlay)                                        */
/* -------------------------------------------------------------------------- */

function ActivityCardStack() {
  return (
    <div className="relative">
      {/* row 1 — primary */}
      <div className="relative z-30 sn-card-soft rounded-2xl px-3.5 py-3 flex items-center gap-3" style={{
        boxShadow: '0 24px 48px -20px rgba(17,17,38,0.18), 0 2px 4px rgba(17,17,38,0.04)',
      }}>
        <div className="relative h-9 w-9 flex-shrink-0">
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#4F46E5,#8B5CF6)' }}>WC</div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-white flex items-center justify-center">
            <BadgeCheck className="h-3 w-3 text-zoru-ink" />
          </span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] text-zoru-ink truncate">
            <span className="font-semibold">Wei Chen</span>{' '}
            <span className="text-zoru-ink">joined to</span>{' '}
            <span className="font-semibold">Final Presentation</span>
          </div>
          <div className="text-[11px] text-zoru-ink mt-0.5 flex items-center gap-1.5">
            <span>8 min ago</span>
            <span className="text-zoru-ink/50">·</span>
            <span>SabNode CRM</span>
          </div>
        </div>
      </div>

      {/* row 2 — offset right */}
      <div className="relative z-20 -mt-2 ml-8 sn-card-soft rounded-2xl px-3.5 py-3 flex items-center gap-3" style={{
        boxShadow: '0 18px 38px -18px rgba(17,17,38,0.14)',
      }}>
        <div className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>MJ</div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] text-zoru-ink truncate font-semibold">Matthew Johnson</div>
          <div className="text-[11px] text-zoru-ink mt-0.5">Content Writer · @sabnode</div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-zoru-ink" />
      </div>

      {/* row 3 — offset left */}
      <div className="relative z-10 -mt-2 mr-10 sn-card-soft rounded-2xl px-3.5 py-3 flex items-center gap-3" style={{
        boxShadow: '0 14px 30px -16px rgba(17,17,38,0.12)',
      }}>
        <div className="h-9 w-9 rounded-full flex items-center justify-center bg-zoru-ink/10 flex-shrink-0">
          <GmailGlyph className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] text-zoru-ink truncate font-semibold">Terry Lipshutz</div>
          <div className="text-[11px] text-zoru-ink mt-0.5 truncate">Approved the design of the iOS app...</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Brand glyphs — small inline SVGs for the orbit logos                     */
/* -------------------------------------------------------------------------- */

function GoogleGlyph({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.3-5.2l-6.1-5c-2 1.4-4.5 2.2-7.2 2.2-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4.1 5.3l6.1 5C41.4 35.2 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function SlackGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      <path fill="#36C5F0" d="M16 38a4 4 0 1 1 0-8h4v4a4 4 0 0 1-4 4Zm2-12a4 4 0 0 1-4-4 4 4 0 0 1 4-4 4 4 0 0 1 4 4v4Z"/>
      <path fill="#2EB67D" d="M22 14a4 4 0 1 1 8 0v4h-4a4 4 0 0 1-4-4Zm12 2a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4h-4Z"/>
      <path fill="#ECB22E" d="M44 22a4 4 0 1 1 0 8h-4v-4a4 4 0 0 1 4-4Zm-2 12a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4v-4Z"/>
      <path fill="#E01E5A" d="M38 46a4 4 0 1 1-8 0v-4h4a4 4 0 0 1 4 4Zm-12-2a4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4h4Z"/>
    </svg>
  );
}

function ZapierGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#FF4F00"/>
      <path
        fill="#fff"
        d="M21 16a5 5 0 0 1-.3 1.7H17v3.7a5 5 0 0 1-2 0V17.7h-3.7a5 5 0 0 1 0-3.4H15V10.6a5 5 0 0 1 2 0v3.7h3.7a5 5 0 0 1 .3 1.7Z"
      />
      <path
        fill="#fff"
        d="m13.6 8.6 2-2 2 2-2 2-2-2Zm0 14.8 2-2 2 2-2 2-2-2ZM6 16l2-2 2 2-2 2-2-2Zm15.4 0 2-2 2 2-2 2-2-2Z"
      />
    </svg>
  );
}

function MetaGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 287 191" className={className} aria-hidden>
      <path
        fill="#0866FF"
        d="M31 96c0-13 7-23 17-23 7 0 13 4 21 16l16 24c-9 14-17 19-25 19-14 0-23-12-29-36ZM82 51c-15 0-27 11-35 27-10-12-20-27-32-27C5 51 0 78 0 96c0 19 8 41 27 41 13 0 23-7 36-29 6 11 12 17 21 25 4 4 11 4 14-2 4-7 0-12-5-16-9-7-13-13-19-26 11-22 19-33 29-33 9 0 18 7 18 24 0 11-3 23-8 33-3 7 1 14 9 14 4 0 7-2 9-6 9-19 13-43 13-58 0-30-15-52-44-52Z"
      />
    </svg>
  );
}

function AwsGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 30" className={className} aria-hidden>
      <path
        fill="#252F3E"
        d="M8.5 13.4c0 .4 0 .7.1.9.1.2.2.5.4.7 0 .1.1.2.1.3 0 .1-.1.2-.2.3l-.6.4h-.2l-.3-.2c-.2-.2-.3-.4-.4-.6-.1-.2-.2-.5-.4-.8-.7.9-1.7 1.3-2.8 1.3-.8 0-1.5-.2-2-.7-.5-.5-.7-1.1-.7-1.9 0-.8.3-1.5.9-2 .6-.5 1.4-.8 2.4-.8.3 0 .7 0 1 .1.4.1.7.1 1.1.2v-.7c0-.7-.2-1.2-.5-1.5-.3-.3-.9-.4-1.6-.4-.3 0-.7 0-1 .1-.3.1-.7.2-1 .3-.1.1-.3.1-.4.1-.1 0-.1 0-.2-.1l-.1-.2v-.5c0-.1 0-.2.1-.3.1-.1.2-.1.3-.2.3-.2.7-.3 1.2-.4.4-.1.9-.2 1.4-.2 1.1 0 1.9.2 2.4.7.5.5.7 1.2.7 2.2v3Zm-3.9 1.5c.3 0 .6 0 1-.2.4-.1.7-.3 1-.6.2-.2.3-.4.4-.6 0-.2.1-.5.1-.8v-.4c-.3-.1-.6-.1-.9-.2h-1c-.7 0-1.2.1-1.5.4-.3.3-.5.7-.5 1.2 0 .4.1.8.4 1 .2.1.5.2 1 .2Zm7.7 1c-.2 0-.3 0-.4-.1-.1-.1-.1-.2-.2-.4l-2-6.7v-.3c0-.1.1-.2.2-.2h.7c.2 0 .3 0 .4.1.1.1.1.2.2.4l1.5 5.7 1.4-5.7c0-.2.1-.3.1-.4.1-.1.2-.1.4-.1h.6c.2 0 .3 0 .4.1.1.1.2.2.2.4l1.4 5.8 1.5-5.8c0-.2.1-.3.2-.4.1-.1.2-.1.4-.1h.7c.1 0 .2.1.2.2v.3l-2 6.7c-.1.2-.1.3-.2.4-.1.1-.2.1-.4.1h-.7c-.2 0-.3 0-.4-.1-.1-.1-.2-.2-.2-.4L13.7 9l-1.4 5.6c0 .2-.1.3-.2.4-.1.1-.2.1-.4.1h-.4Zm12.2.2c-.5 0-1-.1-1.4-.2-.5-.1-.8-.2-1.1-.4-.2-.1-.3-.2-.3-.3v-.6c0-.2.1-.3.2-.3h.2c.1 0 .1.1.2.1.4.2.7.3 1.1.4.4.1.7.1 1.1.1.6 0 1-.1 1.3-.3.3-.2.5-.5.5-.9 0-.3-.1-.5-.3-.7-.2-.2-.5-.4-1-.5l-1.4-.4c-.7-.2-1.2-.5-1.5-1-.3-.4-.5-.9-.5-1.4 0-.4.1-.8.3-1.1.2-.3.4-.6.7-.8.3-.2.7-.4 1.1-.5.4-.1.8-.2 1.3-.2.2 0 .4 0 .7.1.2 0 .4.1.6.1.2 0 .4.1.5.2.2.1.3.1.4.2.1.1.2.2.2.3 0 .1.1.2.1.4v.5c0 .2-.1.3-.2.3-.1 0-.3 0-.5-.1-.6-.3-1.3-.4-2.1-.4-.5 0-.9.1-1.2.2-.3.1-.4.4-.4.8 0 .3.1.5.3.7.2.2.6.3 1.1.5l1.3.4c.7.2 1.2.5 1.5.9.3.4.5.8.5 1.4 0 .4-.1.8-.3 1.1-.2.3-.4.6-.7.9-.3.2-.7.4-1.1.6-.4 0-.8.1-1.3.1Z"
      />
      <path
        fill="#F90"
        d="M28 19.6c-3.4 2.5-8.3 3.8-12.5 3.8-5.9 0-11.2-2.2-15.3-5.8-.3-.3 0-.7.4-.4 4.4 2.5 9.7 4.1 15.3 4.1 3.7 0 7.8-.8 11.6-2.4.5-.2 1 .4.5.7Zm1.1-1.6c-.4-.5-2.9-.3-4-.1-.3 0-.4-.2-.1-.5 2-1.4 5.3-1 5.7-.5.4.5-.1 3.7-2 5.2-.3.2-.6.1-.4-.2.4-.9 1.2-3.4.8-3.9Z"
      />
    </svg>
  );
}

function GoogleCalendarGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <rect x="40" y="40" width="120" height="120" rx="8" fill="#fff"/>
      <path fill="#4285F4" d="M159 40h-118a4 4 0 0 0-4 4v32h126V44a4 4 0 0 0-4-4Z"/>
      <path fill="#34A853" d="M159 160h-32v-37h37v33a4 4 0 0 1-5 4Z"/>
      <path fill="#FBBC05" d="M127 160H45a4 4 0 0 1-4-4v-33h86v37Z"/>
      <path fill="#EA4335" d="M41 76h126v47H41z"/>
      <path fill="#1A73E8" d="M85 110c-3 0-6-1-8-3l3-4c1 1 3 2 5 2s4-1 4-3-2-3-4-3h-2v-4h2c2 0 3-1 3-2s-1-2-3-2-3 1-4 2l-3-3c2-2 4-3 7-3 4 0 7 2 7 5 0 2-1 4-3 4 2 1 3 3 3 5 0 4-3 6-7 6Zm17 0V90l-5 4-2-3 8-6h3v25h-4Z"/>
      <path fill="#188038" d="M159 165h5v-9l-5-1z"/>
    </svg>
  );
}

function FigmaGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 57" className={className} aria-hidden>
      <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z"/>
      <path fill="#0ACF83" d="M0 47.5C0 42.3 4.3 38 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z"/>
      <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z"/>
      <path fill="#F24E1E" d="M0 9.5C0 14.7 4.3 19 9.5 19H19V0H9.5C4.3 0 0 4.3 0 9.5Z"/>
      <path fill="#A259FF" d="M0 28.5C0 33.7 4.3 38 9.5 38H19V19H9.5C4.3 19 0 23.3 0 28.5Z"/>
    </svg>
  );
}

function MailchimpGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#FFE01B"/>
      <circle cx="12" cy="14" r="2" fill="#241C15"/>
      <circle cx="20" cy="14" r="2" fill="#241C15"/>
      <path d="M11 19c1.5 1.5 3 2.2 5 2.2s3.5-.7 5-2.2" stroke="#241C15" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function ClickupGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="cu" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8930FD"/>
          <stop offset=".5" stopColor="#49CCF9"/>
          <stop offset="1" stopColor="#FFC800"/>
        </linearGradient>
      </defs>
      <path fill="url(#cu)" d="m4 22 4-3c1.7 2.4 4.5 4 7.7 4 3.3 0 6-1.6 7.8-4l4 3c-2.6 3.5-6.8 5.8-11.8 5.8S6.6 25.5 4 22Zm11.7-12.3 7.5 6.4-3 3.5L16 15l-4.2 4.6-3-3.5 7-6.4Z"/>
    </svg>
  );
}

function GoogleAdsGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 192" className={className} aria-hidden>
      <path fill="#FBBC04" d="M70 13c-9 5-13 17-7 27l49 84c5 9 17 13 27 7 9-5 13-17 7-27L97 20c-5-9-17-13-27-7Z"/>
      <path fill="#4285F4" d="M64 178c11 7 25 3 31-8l49-84c7-11 3-25-8-31s-25-3-31 8l-49 84c-7 11-3 25 8 31Z"/>
      <circle fill="#34A853" cx="50" cy="153" r="25"/>
    </svg>
  );
}

function AirtableGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 170" className={className} aria-hidden>
      <path fill="#FCB400" d="m87 7-78 32c-5 2-5 8 0 10l78 32c8 3 17 3 25 0l78-32c5-2 5-8 0-10l-78-32c-8-3-17-3-25 0Z"/>
      <path fill="#18BFFF" d="m172 60-79 33v76c0 4 4 7 8 5l78-33c2-1 3-3 3-5V60Z"/>
      <path fill="#F82B60" d="M85 95 26 65 9 73c-3 1-3 5 0 7l69 35c4 2 8 2 11-1l4-3v-6c0-4-3-8-8-10Z"/>
      <path fill="#fff" opacity=".25" d="m172 60-79 33v9l79-33Z"/>
    </svg>
  );
}

function NotionGlyph({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="3" y="3" width="26" height="26" rx="3" fill="#fff" stroke="#111" strokeWidth="1.5"/>
      <path d="M11 9v14M11 9l10 14M21 9v14" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function StripeGlyph({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill="#635BFF"/>
      <path
        fill="#fff"
        d="M14.5 13.6c0-.7.5-1 1.4-1 1.3 0 3 .4 4.3 1.1V9.5a11.4 11.4 0 0 0-4.3-.8c-3.5 0-5.9 1.8-5.9 4.9 0 4.7 6.5 4 6.5 6 0 .8-.7 1.1-1.7 1.1-1.4 0-3.3-.6-4.7-1.4v4.2c1.6.7 3.2 1 4.7 1 3.6 0 6.1-1.7 6.1-4.9 0-5-6.5-4.2-6.5-6Z"
      />
    </svg>
  );
}

function GmailGlyph({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 193" className={className} aria-hidden>
      <path fill="#4285F4" d="M58 193V93l-29-22L0 96v83a14 14 0 0 0 14 14h44Z"/>
      <path fill="#34A853" d="M198 193h44a14 14 0 0 0 14-14V96l-29-25-29 22v100Z"/>
      <path fill="#EA4335" d="M58 93 51 60l7-31 70 53 70-53 7 33-7 31-70 53Z"/>
      <path fill="#FBBC04" d="M198 29v64L256 49V14c0-13-15-21-26-13l-32 28Z"/>
      <path fill="#C5221F" d="M0 49v44l58-2V29L26 1C15-7 0 1 0 14v35Z"/>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trust strip                                                               */
/* -------------------------------------------------------------------------- */

const TRUSTED = ['Folia', 'NorthPeak', 'Lumenly', 'Kintsugi', 'Helix & Co.', 'Brightwave', 'Atlaskit', 'Mockingbird'];

function TrustStrip() {
  return (
    <section className="relative py-10 md:py-14">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-10 bg-zoru-ink/15" />
          <p className="text-[11px] uppercase tracking-[0.22em] text-zoru-ink font-semibold">
            Shipping on SabNode this quarter
          </p>
          <span className="h-px w-10 bg-zoru-ink/15" />
        </div>
      </div>
      <div className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-zoru-surface via-zoru-surface/80 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-zoru-surface via-zoru-surface/80 to-transparent" />
        <div className="sn-marquee flex items-center gap-16 whitespace-nowrap w-max">
          {[...TRUSTED, ...TRUSTED].map((t, i) => (
            <span key={`${t}-${i}`} className="inline-flex items-center gap-16">
              <span className="font-display text-2xl md:text-3xl tracking-[-0.04em] text-zoru-ink/70">{t}</span>
              <span className="h-1 w-1 rounded-full bg-zoru-ink/60" />
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
    <section className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="sn-section-shell px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-12">
          <div className="max-w-xl">
            <Eyebrow label="What it does" />
            <h2 className="mt-4 font-display text-[40px] md:text-[64px] leading-[0.98] text-zoru-ink">
              A connected stack,{' '}
              <span className="font-display-italic sn-gradient-text">out of the box.</span>
            </h2>
          </div>
          <p className="md:max-w-sm text-[15px] text-zoru-ink leading-relaxed">
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
                <h3 className="relative mt-6 font-display text-[24px] md:text-[26px] leading-[1.1] text-zoru-ink">{b.title}</h3>
                <p className="relative mt-3 text-[14px] text-zoru-ink leading-relaxed max-w-xs">{b.body}</p>
                <div className="relative mt-6 flex items-center justify-between">
                  <Link href="#products" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-zoru-ink group/a">
                    Explore <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/a:translate-x-0.5 group-hover/a:-translate-y-0.5" />
                  </Link>
                  <span className="text-[10px] font-mono tabular-nums text-zoru-ink">0{i + 1} / 03</span>
                </div>
              </article>
            );
          })}
        </div>
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
    <section id="products" className="relative scroll-mt-24 py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-12">
          <Eyebrow label="Products" align="center" />
          <h2 className="mt-4 font-display text-[40px] md:text-[72px] leading-[0.98] text-zoru-ink">
            One workspace for the whole{' '}
            <span className="font-display-italic sn-gradient-text">customer loop.</span>
          </h2>
          <p className="mt-5 text-[15px] md:text-[17px] text-zoru-ink max-w-xl mx-auto">
            Start with chat, then connect flows, CRM, AI, campaigns, and
            analytics without asking your team to jump between tabs.
          </p>
        </div>

        <ProductCommandStrip />

        <div className="mt-12 space-y-16 md:mt-16 md:space-y-20">
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

function ProductCommandStrip() {
  const items = [
    { icon: MessageSquare, title: 'Inbox', meta: 'All channels' },
    { icon: Workflow, title: 'Flows', meta: 'Visual automation' },
    { icon: Users2, title: 'CRM', meta: 'Contact truth' },
    { icon: Bot, title: 'AI', meta: 'Private answers' },
    { icon: LineChart, title: 'Analytics', meta: 'Outcome pulse' },
  ];
  return (
    <div className="sn-section-shell mx-auto grid max-w-5xl grid-cols-1 gap-2 p-2 sm:grid-cols-5">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <a
            key={item.title}
            href="#products"
            className="group flex items-center gap-3 rounded-[24px] bg-white/70 px-4 py-3 text-left transition hover:bg-white hover:shadow-[0_18px_40px_-24px_rgba(79,70,229,0.32)]"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zoru-surface text-zoru-ink">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-zoru-ink">{item.title}</span>
              <span className="block truncate text-[11px] text-zoru-ink">{item.meta}</span>
            </span>
            <span className="ml-auto hidden text-[10px] font-mono text-zoru-ink lg:inline">
              0{index + 1}
            </span>
          </a>
        );
      })}
    </div>
  );
}

function ProductRow({ index, tag, tagColor, kicker, title, body, bullets, mock, reverse }: {
  index: string; tag: string; tagColor: string; kicker: string;
  title: string; body: string; bullets: string[]; mock: React.ReactNode; reverse: boolean;
}) {
  return (
    <article className={`sn-product-card grid items-center gap-8 rounded-[34px] p-4 md:grid-cols-12 md:gap-12 md:p-7 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
      <div className="md:col-span-5">
        <div className="flex items-center gap-3 mb-5">
          <span className="font-mono text-[10.5px] tabular-nums text-zoru-ink">{index}</span>
          <span className="h-px flex-1 max-w-12 bg-zoru-ink/15" />
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_-12px_rgba(17,17,38,0.5)]" style={{ background: tagColor }}>
            {tag}
          </span>
        </div>
        <div className="text-[12px] uppercase tracking-[0.18em] font-semibold text-zoru-ink mb-3">{kicker}</div>
        <h3 className="font-display text-[32px] md:text-[46px] leading-[1.02] text-zoru-ink">{title}</h3>
        <p className="mt-5 text-[15px] text-zoru-ink leading-relaxed max-w-md">{body}</p>
        <ul className="mt-6 space-y-2.5">
          {bullets.map(b => (
            <li key={b} className="flex items-start gap-2.5 text-[13.5px] text-zoru-ink/85">
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
          <Link href="/contact" className="inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium text-zoru-ink hover:text-zoru-ink">
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
              <span className="h-7 w-7 inline-flex items-center justify-center rounded-full text-zoru-ink"><MessageCircle className="h-3.5 w-3.5" /></span>
              <span className="h-7 w-7 inline-flex items-center justify-center rounded-full text-zoru-ink"><MoreHorizontal className="h-3.5 w-3.5" /></span>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-black/5">
            <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px]" style={{ background: '#F0F2F5', color: '#54656F' }}>
              <Search className="h-3.5 w-3.5" /> Search or start a new chat
            </div>
          </div>
          <div className="flex gap-1 px-2 py-2 overflow-x-auto text-[10px] font-semibold">
            {['All', 'Unread', 'Groups'].map((t, i) => (
              <button key={t} className={`flex-shrink-0 px-2.5 py-1 rounded-full ${i === 1 ? 'text-white' : 'text-zoru-ink'}`} style={i === 1 ? { background: '#008069' } : { background: '#F0F2F5' }}>
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
              <li key={r.n} className={`flex items-center gap-3 px-3 py-2.5 ${r.active ? 'bg-zoru-surface' : ''}`}>
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: r.a }}>
                  {r.n.split(' ').map(s => s[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[12.5px] font-semibold text-zoru-ink truncate">{r.n}</div>
                    <div className="text-[9.5px] text-zoru-ink font-mono tabular-nums">{r.t}</div>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="text-[11.5px] text-zoru-ink truncate">{r.m}</div>
                    {r.u && <span className="ml-2 flex-shrink-0 h-4 min-w-4 inline-flex items-center justify-center rounded-full bg-zoru-ink text-white text-[9.5px] font-bold px-1">{r.u}</span>}
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
              <div className="text-[13px] font-semibold text-zoru-ink">Priya Shah</div>
              <div className="text-[10.5px] text-zoru-ink font-medium flex items-center gap-1">
                typing
                <span className="flex gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-zoru-ink sn-float" />
                  <span className="h-1 w-1 rounded-full bg-zoru-ink sn-float" style={{ animationDelay: '0.15s' }} />
                  <span className="h-1 w-1 rounded-full bg-zoru-ink sn-float" style={{ animationDelay: '0.3s' }} />
                </span>
              </div>
            </div>
            <Search className="h-3.5 w-3.5 text-zoru-ink" />
            <MoreHorizontal className="h-4 w-4 text-zoru-ink" />
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
                      <div className="font-semibold text-zoru-ink text-[10.5px]">{p.n}</div>
                      <div className="text-[9.5px] text-zoru-ink">{p.p}</div>
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
            <Smile className="h-4 w-4 text-zoru-ink" />
            <Paperclip className="h-4 w-4 text-zoru-ink" />
            <div className="flex-1 h-9 rounded-lg bg-white flex items-center px-3 text-[11.5px]" style={{ color: '#54656F' }}>Type a message</div>
            <Mic className="h-5 w-5 text-zoru-ink" />
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
      <div className={`relative max-w-[70%] px-2.5 py-1.5 text-[11px] text-zoru-ink shadow-[0_1px_1px_rgba(0,0,0,0.08)] ${isIn ? 'rounded-lg rounded-tl-none' : 'rounded-lg rounded-tr-none'} ${ai ? 'border border-zoru-line/25' : ''}`} style={{ background: isIn ? '#fff' : '#DCF8C6' }}>
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
            <Link href="#" className="text-[11px] text-zoru-ink hover:text-zoru-ink inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3 rotate-180" /> Back
            </Link>
            <div className="h-4 w-px bg-black/10 mx-1" />
            <div className="text-[12.5px] font-semibold text-zoru-ink">Post-purchase journey</div>
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
              <button className="h-6 w-6 text-zoru-ink hover:bg-black/5 rounded"><Minus className="h-3 w-3 mx-auto" /></button>
              <span className="text-[10px] font-mono text-zoru-ink px-1">80%</span>
              <button className="h-6 w-6 text-zoru-ink hover:bg-black/5 rounded"><Plus className="h-3 w-3 mx-auto" /></button>
            </div>
          </div>
        </div>

        {/* properties panel */}
        <aside className="col-span-12 md:col-span-3 border-l sn-hair p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-bold text-zoru-ink">Properties</div>
            <button className="text-zoru-ink hover:text-zoru-ink">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          <div className="rounded-xl sn-card p-3 bg-zoru-surface border-zoru-line/15">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg flex items-center justify-center text-white" style={{ background: '#25D366' }}>
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-zoru-ink truncate">WhatsApp · thank-you</div>
                <div className="text-[9.5px] text-zoru-ink font-mono">node_04 · send</div>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zoru-ink font-bold">Template</label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border sn-hair px-2.5 py-1.5 text-[11.5px]">
                <span className="font-mono text-zoru-ink">order_confirm_v3</span>
                <ChevronsUpDown className="h-3 w-3 ml-auto text-zoru-ink" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zoru-ink font-bold">Variables</label>
              <div className="mt-1 space-y-1">
                {[
                  { k: '{{name}}', v: 'contact.first_name' },
                  { k: '{{order_id}}', v: 'trigger.order.id' },
                  { k: '{{eta}}', v: 'shopify.eta_date' },
                ].map(v => (
                  <div key={v.k} className="flex items-center justify-between rounded border sn-hair px-2 py-1 text-[10.5px]">
                    <span className="font-mono text-zoru-ink">{v.k}</span>
                    <span className="font-mono text-zoru-ink truncate ml-2">{v.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zoru-ink font-bold">Retry</label>
              <div className="mt-1 flex gap-1.5">
                {['1×', '3×', '5×'].map((o, i) => (
                  <button key={o} className={`flex-1 rounded-md py-1 text-[10.5px] font-semibold ${i === 1 ? 'bg-zoru-ink text-white' : 'bg-black/[0.04] text-zoru-ink'}`}>{o}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t sn-hair">
            <div className="text-[10px] uppercase tracking-widest text-zoru-ink font-bold mb-1.5">Last 7d · sent</div>
            <div className="flex items-end gap-[2px] h-10">
              {[40, 52, 65, 58, 72, 88, 94].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? '#4F46E5' : '#E0E7FF' }} />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[9.5px] font-mono text-zoru-ink">
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
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zoru-ink">
              <span className="h-1 w-1 rounded-full" style={{ background: n.color }} />
              {n.type}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0 text-white" style={{ background: n.color }}>
                <Icon className="h-3 w-3" strokeWidth={2.4} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-zoru-ink leading-tight truncate">{n.label}</div>
                <div className="text-[9.5px] text-zoru-ink truncate font-mono">{n.sub}</div>
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
        <div className="flex items-center gap-1.5 text-[11px] text-zoru-ink mb-3">
          <span>Dashboard</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zoru-ink font-medium">Contacts</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-[22px] text-zoru-ink leading-none">All contacts</h3>
            <p className="text-[12px] text-zoru-ink mt-1">Manage, tag, enrich and message every contact across channels.</p>
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
              <div className="text-[9.5px] uppercase tracking-widest text-zoru-ink font-bold">{s.k}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="font-display text-[24px] text-zoru-ink tabular-nums leading-none">{s.v}</div>
                <div className="text-[10.5px] font-semibold" style={{ color: s.c }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* filter bar */}
        <div className="rounded-xl sn-card p-2 flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1.5 text-[11.5px] flex-1">
            <Search className="h-3.5 w-3.5 text-zoru-ink" />
            <span className="text-zoru-ink">Name, phone, email…</span>
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
              <tr className="text-[9.5px] uppercase tracking-[0.14em] text-zoru-ink font-bold bg-zoru-surface border-b sn-hair">
                <th className="text-left px-3 py-2.5 font-bold">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" className="h-3 w-3 accent-zoru-ink" readOnly />
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
                <tr key={c.e} className="hover:bg-zoru-surface">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="h-3 w-3 accent-zoru-ink" readOnly />
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white flex-shrink-0" style={{ background: c.grad }}>
                        {c.n.split(' ').map(s => s[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-zoru-ink truncate">{c.n}</div>
                        <div className="text-[10px] text-zoru-ink truncate">{c.e}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-zoru-ink font-mono tabular-nums hidden sm:table-cell">{c.ph}</td>
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
                  <td className="px-3 py-2.5 text-right font-mono text-zoru-ink tabular-nums">{c.last}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-black/5 text-zoru-ink">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-2.5 border-t sn-hair text-[10.5px] text-zoru-ink">
            <span>1–20 of 3,284</span>
            <div className="flex items-center gap-1">
              {['‹', '1', '2', '3', '…', '164', '›'].map((p, i) => (
                <button key={i} className={`h-6 min-w-6 px-1.5 rounded font-mono ${p === '1' ? 'bg-zoru-ink text-white' : 'hover:bg-black/5'}`}>
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
        <div className="flex items-center gap-1.5 text-[11px] text-zoru-ink mb-3">
          <span>Dashboard</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zoru-ink font-medium">Chatbot</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-[22px] text-zoru-ink leading-none">Keyword responses</h3>
            <p className="text-[12px] text-zoru-ink mt-1">Instant auto-replies. Falls back to AI Studio for anything unmatched.</p>
          </div>
          <span className="sn-tag sn-tag-live"><span className="dot" /> live</span>
        </div>

        {/* create form */}
        <div className="rounded-xl sn-card p-4 mb-4">
          <div className="text-[10.5px] uppercase tracking-widest text-zoru-ink font-bold mb-3">New rule</div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-3">
              <label className="text-[10px] text-zoru-ink font-semibold">Trigger</label>
              <div className="mt-1 h-8 rounded-md border sn-hair bg-white px-2.5 flex items-center text-[11.5px] text-zoru-ink font-mono">refund</div>
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] text-zoru-ink font-semibold">Match type</label>
              <div className="mt-1 h-8 rounded-md border sn-hair bg-white px-2.5 flex items-center text-[11.5px] text-zoru-ink">
                Contains <ChevronDown className="h-3 w-3 ml-auto text-zoru-ink" />
              </div>
            </div>
            <div className="md:col-span-4">
              <label className="text-[10px] text-zoru-ink font-semibold">Response</label>
              <div className="mt-1 min-h-8 rounded-md border sn-hair bg-white px-2.5 py-1.5 text-[11.5px] text-zoru-ink leading-snug">
                Sorry to hear! Our refund window is 7 days from delivery — tap below to start.
              </div>
            </div>
            <div className="md:col-span-2 flex items-end justify-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold">
                <span className="relative inline-block w-7 h-4 rounded-full bg-zoru-ink">
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
            <div className="text-[12px] font-semibold text-zoru-ink">Active rules</div>
            <span className="text-[10.5px] font-mono text-zoru-ink">42 rules · 4/5 pages</span>
          </div>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-[9.5px] uppercase tracking-[0.14em] text-zoru-ink font-bold bg-zoru-surface border-b sn-hair">
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
                <tr key={r.t} className="hover:bg-zoru-surface">
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded bg-zoru-surface text-zoru-ink font-mono px-1.5 py-0.5 text-[10.5px]">
                      <Hash className="h-2.5 w-2.5" /> {r.t}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zoru-ink truncate max-w-[280px]">{r.r}</td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-widest rounded bg-black/[0.04] px-1.5 py-0.5 text-zoru-ink">{r.m}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.active ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: '#DCFCE7', color: '#166534' }}>
                        <span className="h-1 w-1 rounded-full bg-zoru-ink" /> active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        paused
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-zoru-ink tabular-nums hidden sm:table-cell">{r.h.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-zoru-surface-2 text-zoru-ink hover:text-zoru-ink">
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
/*  Analytics mock (mirrors /wachat/analytics)                             */
/* -------------------------------------------------------------------------- */

function AnalyticsMock() {
  return (
    <div className="relative sn-window">
      <WindowChrome title="dashboard / analytics · last 30 days" />
      <div className="p-4 md:p-5" style={{ background: '#FAF9F4' }}>
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-zoru-ink mb-1.5">
              <span>Dashboard</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zoru-ink font-medium">Analytics</span>
            </div>
            <h3 className="font-display text-[22px] text-zoru-ink leading-none">Overview</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-full sn-card p-1 text-[11px]">
              {['7d', '30d', '90d'].map((t, i) => (
                <button key={t} className={`px-2.5 py-1 rounded-full font-semibold ${i === 1 ? 'bg-zoru-ink text-white' : 'text-zoru-ink'}`}>{t}</button>
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
                <div className="mt-2 text-[9.5px] uppercase tracking-widest text-zoru-ink font-bold">{s.k}</div>
                <div className="mt-0.5 font-display text-[22px] text-zoru-ink tabular-nums leading-none">{s.v}</div>
              </div>
            );
          })}
        </div>

        {/* delivery performance + line chart */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-8 rounded-xl sn-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[12px] font-semibold text-zoru-ink">Messages · sent vs delivered vs read</div>
                <div className="text-[9.5px] font-mono text-zoru-ink">UTC · stacked</div>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                {[
                  { n: 'Sent', c: '#4F46E5' },
                  { n: 'Delivered', c: '#22C55E' },
                  { n: 'Read', c: '#10B981' },
                  { n: 'Failed', c: '#EF4444' },
                ].map(l => (
                  <div key={l.n} className="flex items-center gap-1 text-zoru-ink">
                    <span className="h-2 w-2 rounded-full" style={{ background: l.c }} />
                    {l.n}
                  </div>
                ))}
              </div>
            </div>
            <LineChartViz />
          </div>

          <div className="col-span-12 md:col-span-4 rounded-xl sn-card p-4">
            <div className="text-[12px] font-semibold text-zoru-ink mb-0.5">Delivery performance</div>
            <div className="text-[9.5px] font-mono text-zoru-ink mb-3">last 24 hours</div>
            <div className="space-y-3">
              {[
                { k: 'Delivered in <5s', v: '99.2%', c: '#22C55E' },
                { k: 'AI resolved',       v: '74%',   c: '#8B5CF6' },
                { k: 'Failed · retried',  v: '0.6%',  c: '#EF4444' },
              ].map(r => (
                <div key={r.k}>
                  <div className="flex items-center justify-between text-[11.5px] mb-1">
                    <span className="text-zoru-ink">{r.k}</span>
                    <span className="font-semibold text-zoru-ink tabular-nums font-mono">{r.v}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: r.v, background: r.c }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t sn-hair text-[11px] text-zoru-ink flex items-center justify-between">
              <span>Alerts</span>
              <span className="font-semibold text-zoru-ink">all ok</span>
            </div>
          </div>

          {/* daily breakdown */}
          <div className="col-span-12 rounded-xl sn-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b sn-hair">
              <div className="text-[12px] font-semibold text-zoru-ink">Daily breakdown</div>
              <button className="text-[10.5px] text-zoru-ink hover:text-zoru-ink font-semibold">View all</button>
            </div>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-[9.5px] uppercase tracking-[0.14em] text-zoru-ink font-bold bg-zoru-surface">
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
                  <tr key={r.d} className="text-zoru-ink">
                    <td className="px-3 py-2 font-mono text-zoru-ink tabular-nums">{r.d}</td>
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
      <div className="absolute inset-x-0 bottom-0 flex justify-between text-[9.5px] font-mono text-zoru-ink pt-1">
        <span>Mar 24</span>
        <span>Mar 31</span>
        <span>Apr 07</span>
        <span>Apr 14</span>
        <span className="text-zoru-ink font-semibold">Apr 22</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared mock primitives                                                    */
/* -------------------------------------------------------------------------- */

function WindowChrome({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b sn-hair bg-zoru-surface">
      <span className="h-2.5 w-2.5 rounded-full bg-zoru-ink" />
      <span className="h-2.5 w-2.5 rounded-full bg-zoru-surface-2" />
      <span className="h-2.5 w-2.5 rounded-full bg-zoru-ink" />
      <div className="ml-4 text-[10.5px] text-zoru-ink font-mono tabular-nums truncate">{title}</div>
      <div className="ml-auto hidden sm:flex items-center gap-1">
        <span className="h-6 w-20 rounded-md bg-black/[0.04]" />
        <span className="h-6 w-6 rounded-md bg-black/[0.04]" />
      </div>
    </div>
  );
}

function IconBtn({ children, sm }: { children: React.ReactNode; sm?: boolean }) {
  return (
    <button className={`inline-flex items-center justify-center rounded-md text-zoru-ink hover:bg-black/5 hover:text-zoru-ink transition-colors ${sm ? 'h-6 w-6' : 'h-7 w-7'}`}>
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
        isIn ? 'bg-white border sn-hair text-zoru-ink rounded-bl-sm' : 'text-white rounded-br-sm'
      } ${ai ? 'ring-1 ring-inset ring-zoru-line/25' : ''}`} style={{
        background: isIn ? '#fff' : 'linear-gradient(135deg, #4F46E5, #6366F1)',
      }}>
        {ai && (
          <div className="inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-widest text-zoru-ink-muted mb-0.5">
            <Sparkles className="h-2 w-2" /> AI
          </div>
        )}
        {ai && <br />}
        {children}
        <div className={`flex items-center gap-1 mt-1 text-[9.5px] ${isIn ? 'text-zoru-ink' : 'text-white/75'} tabular-nums font-mono`}>
          {time}
          {!isIn && (
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="text-zoru-ink-muted ml-0.5">
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
    <section id="data" className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="sn-section-shell px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <Eyebrow label="By the numbers" />
            <h2 className="mt-4 font-display text-[40px] md:text-[60px] leading-[1] text-zoru-ink">
              Data teams{' '}
              <span className="font-display-italic sn-gradient-text">trust</span>{' '}
              to run on.
            </h2>
          </div>
          <p className="md:max-w-sm text-[15px] text-zoru-ink leading-relaxed">
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
          <div className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink font-bold">Messages sent · all channels</div>
          <div className="flex items-baseline gap-3 mt-3 flex-wrap">
            <div className="font-display text-[56px] md:text-[84px] leading-[0.9] text-zoru-ink tabular-nums">14.2M</div>
            <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: '#DCFCE7', color: '#166534' }}>
              <ArrowUpRight className="h-3 w-3" /> +38% MoM
            </div>
          </div>
          <div className="text-[13px] text-zoru-ink mt-2 max-w-md">
            WhatsApp, web, SMS and email — outbound and inbound combined. Last 30 days.
          </div>
        </div>
        <div className="hidden sm:flex gap-1.5 flex-shrink-0">
          <button className="h-7 px-3 rounded-full bg-black/[0.04] text-[11px] font-semibold text-zoru-ink">7d</button>
          <button className="h-7 px-3 rounded-full bg-zoru-ink text-[11px] font-semibold text-white">30d</button>
          <button className="h-7 px-3 rounded-full bg-black/[0.04] text-[11px] font-semibold text-zoru-ink">90d</button>
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
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-bold text-white bg-zoru-ink px-2 py-0.5 rounded shadow-lg">
                    1.42M · Tue
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10.5px] text-zoru-ink tabular-nums font-mono">
        <span>Mar 24</span>
        <span>Apr 07</span>
        <span className="text-zoru-ink font-semibold">Apr 22</span>
      </div>
      <div className="mt-5 pt-4 border-t sn-hair grid grid-cols-3 gap-3 text-center">
        {[
          { v: '1.42M', k: 'Peak day' },
          { v: '473k', k: 'Avg / day' },
          { v: '99.4%', k: 'Delivered' },
        ].map((s, i) => (
          <div key={s.k} className={i === 1 ? 'border-x sn-hair' : ''}>
            <div className="font-display text-[20px] text-zoru-ink tabular-nums">{s.v}</div>
            <div className="text-[10px] uppercase tracking-widest text-zoru-ink">{s.k}</div>
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink font-bold">AI resolution</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-zoru-surface px-2 py-0.5 text-[10px] font-bold text-zoru-ink">
          <Sparkles className="h-2.5 w-2.5" /> 24h
        </span>
      </div>
      <div className="relative mt-3 flex items-center gap-4">
        <div className="flex-shrink-0 relative">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(17,17,38,0.08)" strokeWidth="9" />
            <circle cx="48" cy="48" r="42" fill="none" stroke="#8B5CF6" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} transform="rotate(-90 48 48)" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-display text-[24px] text-zoru-ink tabular-nums">74%</div>
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-zoru-ink leading-tight">Resolved without a human</div>
          <div className="text-[11.5px] text-zoru-ink mt-1 font-mono tabular-nums">188,412 / 254,690</div>
        </div>
      </div>
      <div className="relative mt-4 pt-3 border-t sn-hair flex items-center justify-between text-[11px]">
        <span className="text-zoru-ink">Median confidence</span>
        <span className="font-semibold text-zoru-ink tabular-nums font-mono">0.92</span>
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
        <span className="inline-flex items-center gap-1.5 text-[10px] text-zoru-ink-muted font-bold uppercase tracking-widest">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-zoru-surface-2 opacity-60 animate-ping" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-zoru-surface-2" />
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink font-bold">Global reach</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-zoru-surface px-2 py-0.5 text-[10px] font-bold text-zoru-ink">
          <Globe className="h-2.5 w-2.5" /> live
        </span>
      </div>
      <div className="relative flex items-baseline gap-2 mt-3">
        <div className="font-display text-[52px] tabular-nums text-zoru-ink leading-none">64</div>
        <div className="text-[13px] text-zoru-ink font-medium">countries live</div>
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
        <span className="text-zoru-ink">Top: IN · US · BR</span>
        <span className="text-zoru-ink font-semibold">+11 this Q</span>
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink font-bold">Channel mix · today</div>
        <span className="text-[10px] text-zoru-ink font-mono tabular-nums">n = 254k</span>
      </div>
      <div className="mt-4 flex rounded-full h-2.5 overflow-hidden ring-1 ring-black/5">
        {channels.map(c => <div key={c.name} className="h-full" style={{ width: `${c.pct}%`, background: c.color }} />)}
      </div>
      <ul className="mt-4 space-y-1.5">
        {channels.map(c => (
          <li key={c.name} className="flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              <span className="text-zoru-ink font-medium">{c.name}</span>
            </div>
            <span className="text-zoru-ink tabular-nums font-mono text-[11px]">{c.pct}%</span>
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink font-bold">Reply time · median</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-zoru-surface px-2 py-0.5 text-[10px] font-bold text-zoru-ink">
          <Clock className="h-2.5 w-2.5" /> live
        </span>
      </div>
      <div className="relative flex items-baseline gap-2 mt-3">
        <div className="font-display text-[52px] tabular-nums text-zoru-ink leading-none">
          52<span className="text-[20px] text-zoru-ink font-normal">s</span>
        </div>
        <div className="text-[11px] text-zoru-ink font-semibold">−38% vs. Q1</div>
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
      <div className="relative flex justify-between text-[9.5px] text-zoru-ink tabular-nums font-mono mt-1">
        <span>0s</span><span>30s</span><span className="text-zoru-ink font-bold">52s</span><span>2m</span><span>5m+</span>
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
        <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-zoru-ink">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-zoru-ink opacity-60 animate-ping" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-zoru-ink" />
          </span>
          Live events
        </span>
        <span className="flex-shrink-0 h-4 w-px bg-black/10" />
        <div className="flex-1 overflow-hidden relative">
          <div className="sn-marquee flex gap-10 whitespace-nowrap w-max" style={{ animationDuration: '48s' }}>
            {[...events, ...events].map((e, i) => {
              const Icon = e.icon;
              return (
                <span key={i} className="inline-flex items-center gap-2 text-[12.5px] text-zoru-ink/90">
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: e.color }} strokeWidth={2.2} />
                  <span className="font-medium">{e.text}</span>
                  <span className="text-zoru-ink tabular-nums font-mono text-[10.5px]">· {e.t} ago</span>
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
            <h2 className="mt-4 font-display text-[40px] md:text-[60px] leading-[1] text-zoru-ink">
              What teams{' '}
              <span className="font-display-italic sn-gradient-text">quietly</span>{' '}
              ship after the switch.
            </h2>
          </div>
          <p className="md:max-w-sm text-[15px] text-zoru-ink leading-relaxed">
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
                <blockquote className="-mt-3 text-[15px] md:text-[15.5px] text-zoru-ink/90 leading-[1.55] font-medium tracking-[-0.003em]">{t.quote}</blockquote>
                <figcaption className="mt-6 pt-5 border-t sn-hair flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-zoru-ink">{t.name}</div>
                    <div className="text-[12px] text-zoru-ink">{t.role}</div>
                  </div>
                  <div className="font-display text-[18px] tracking-[-0.04em] text-zoru-ink/70">{t.badge}</div>
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
        <div className="sn-section-shell px-5 py-8 md:px-8 md:py-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Eyebrow label="Pricing" align="center" />
          <h2 className="mt-4 font-display text-[40px] md:text-[64px] leading-[1] text-zoru-ink">
            Flexible plans for{' '}
            <span className="font-display-italic sn-gradient-text">every team.</span>
          </h2>
          <p className="mt-5 text-[15px] md:text-[17px] text-zoru-ink max-w-xl mx-auto">
            Start free. Upgrade only when the automation makes you money. All plans include unlimited seats.
          </p>
          <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full sn-card text-[12px]">
            <button className="px-4 py-1.5 rounded-full text-zoru-ink font-medium">Monthly</button>
            <button className="px-4 py-1.5 rounded-full sn-btn-primary font-semibold flex items-center gap-2">
              Annually <span className="text-white/80 text-[10px] font-bold bg-white/20 rounded px-1.5 py-0.5">−20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {plans.map(p => (
            <article key={p.name} className={`relative rounded-[24px] p-7 md:p-8 overflow-hidden ${p.dark ? 'text-white' : 'sn-card text-zoru-ink'}`} style={p.dark ? {
              background: 'linear-gradient(160deg, #4F46E5 0%, #6366F1 50%, #8B5CF6 100%)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 40px 100px -30px rgba(79,70,229,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
            } : { boxShadow: '0 24px 60px -28px rgba(17,17,38,0.18)' }}>
              {p.highlight && (
                <div className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-white text-zoru-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
                  <Flame className="h-3 w-3" /> Most loved
                </div>
              )}
              <div className={`text-[11px] uppercase tracking-[0.2em] font-bold ${p.dark ? 'text-white/80' : 'text-zoru-ink'}`}>{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className={`font-display text-[56px] md:text-[72px] leading-none tabular-nums ${p.dark ? 'text-white' : 'text-zoru-ink'}`}>{p.price}</span>
                {p.cadence && <span className={`text-[14px] ${p.dark ? 'text-white/75' : 'text-zoru-ink'}`}>{p.cadence}</span>}
              </div>
              <p className={`mt-2.5 text-[13.5px] leading-relaxed max-w-xs ${p.dark ? 'text-white/85' : 'text-zoru-ink'}`}>{p.tagline}</p>

              <ul className="mt-6 space-y-3">
                {p.features.map(f => (
                  <li key={f} className={`flex items-start gap-2.5 text-[13.5px] ${p.dark ? 'text-white/90' : 'text-zoru-ink/85'}`}>
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-shrink-0 ${p.dark ? 'text-white' : 'text-zoru-ink'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link href={p.name === 'Enterprise' ? '/contact' : '/signup'} className={`mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-transform hover:scale-[1.01] ${
                p.dark ? 'bg-white text-zoru-ink hover:bg-zoru-surface' : 'sn-btn-primary'
              }`}>
                {p.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
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
    <section id="faq" className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="sn-section-shell grid gap-10 px-5 py-8 md:grid-cols-12 md:px-8 md:py-10">
          <div className="md:col-span-5">
            <Eyebrow label="FAQ" />
            <h2 className="mt-4 font-display text-[40px] md:text-[60px] leading-[1] text-zoru-ink">
              Questions,<br />
              <span className="font-display-italic sn-gradient-text">answered.</span>
            </h2>
            <p className="mt-5 text-[15px] text-zoru-ink max-w-sm leading-relaxed">
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
                      <span className="font-display text-[22px] md:text-[26px] leading-[1.2] text-zoru-ink group-hover:text-zoru-ink transition-colors">{f.q}</span>
                      <span className={`mt-1 flex-shrink-0 h-9 w-9 rounded-full inline-flex items-center justify-center transition-all ${
                        isOpen ? 'bg-zoru-ink text-white rotate-180' : 'sn-card text-zoru-ink'
                      }`}>
                        {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                    <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-6' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden text-[15px] text-zoru-ink leading-relaxed max-w-2xl">{f.a}</div>
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
    <section className="relative py-14 md:py-20">
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
                <Sparkles className="h-3 w-3 text-zoru-ink" /> Join the SabNode beta
              </div>
              <h2 className="mt-6 font-display text-[44px] md:text-[88px] leading-[0.95] text-white tracking-[-0.03em]">
                Ready to quietly<br />
                <span className="font-display-italic sn-gradient-text">automate</span> the boring?
              </h2>
              <p className="mt-6 text-[15px] md:text-[17px] text-white/70 max-w-xl leading-relaxed">
                Launch your stack in an afternoon. Watch it run. Keep humans on the work that moves the number.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-[14px] font-semibold text-zoru-ink transition-transform hover:scale-[1.02]">
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
                  <BadgeCheck className="h-3.5 w-3.5 text-zoru-ink" />
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
              <p className="text-[14px] text-zoru-ink max-w-sm leading-relaxed">
                A connected platform for WhatsApp, marketing, sales and daily business operations. Built for execution.
              </p>
              <div className="flex items-center gap-2 pt-2">
                {[Twitter, Linkedin, Instagram, Github].map((I, i) => (
                  <a key={i} href="#" className="h-9 w-9 rounded-full sn-card inline-flex items-center justify-center text-zoru-ink hover:text-zoru-ink hover:border-zoru-line/30 transition-colors">
                    <I className="h-4 w-4" />
                  </a>
                ))}
              </div>
              <SystemStatusIndicator />
            </div>
            <div className="col-span-12 md:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-6">
              {cols.map(c => (
                <div key={c.h}>
                  <div className="text-[10.5px] uppercase tracking-[0.18em] text-zoru-ink font-bold mb-3">{c.h}</div>
                  <ul className="space-y-2">
                    {c.items.map(([t, h]) => (
                      <li key={t}>
                        <Link href={h} className="text-[13px] text-zoru-ink hover:text-zoru-ink transition-colors">{t}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 pt-6 border-t sn-hair flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[12px] text-zoru-ink">
            <div>© {new Date().getFullYear()} SabNode. Built for execution.</div>
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-zoru-ink" /> SOC 2 · GDPR · DPA</span>
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
    <div className={`inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.22em] font-bold text-zoru-ink ${align === 'center' ? 'justify-center' : ''}`}>
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-zoru-ink" />
      {label}
    </div>
  );
}


function SystemStatusIndicator() {
  const [statusText, setStatusText] = React.useState('Checking systems...');
  const [statusColor, setStatusColor] = React.useState('sn-tag');
  
  React.useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        const ind = data?.page?.status_indicator || data?.status?.indicator;
        if (ind === 'none' || ind === 'operational') {
          setStatusText('All systems operational');
          setStatusColor('sn-tag sn-tag-live');
        } else if (ind === 'minor' || ind === 'degraded') {
          setStatusText('Degraded performance');
          setStatusColor('sn-tag text-zoru-ink bg-zoru-surface-2 border-zoru-line');
        } else if (ind === 'major' || ind === 'critical') {
          setStatusText('System Outage');
          setStatusColor('sn-tag text-zoru-ink bg-zoru-surface-2 border-zoru-line');
        } else {
          setStatusText('All systems · 99.99%');
          setStatusColor('sn-tag sn-tag-live');
        }
      })
      .catch(() => {
        setStatusText('All systems · 99.99%');
        setStatusColor('sn-tag sn-tag-live');
      });
  }, []);

  return (
    <div className="pt-3 flex items-center gap-3">
      <Link href="/status" className={statusColor}>
        <span className="dot" style={statusColor.includes('yellow') ? { background: '#EAB308', boxShadow: '0 0 0 3px rgba(234,179,8,0.2)' } : statusColor.includes('red') ? { background: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.2)' } : {}} /> {statusText}
      </Link>
    </div>
  );
}
