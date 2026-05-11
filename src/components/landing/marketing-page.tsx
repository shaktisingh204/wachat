import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  Code2,
  Database,
  FileText,
  Globe2,
  Headphones,
  HeartHandshake,
  Layers,
  LineChart,
  LockKeyhole,
  MessageSquare,
  Newspaper,
  Server,
  Shield,
  Sparkles,
  Store,
  Target,
  Users2,
  Workflow,
  Zap,
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';

type PageIcon = LucideIcon;

type Metric = {
  value: string;
  label: string;
};

type Highlight = {
  icon: PageIcon;
  title: string;
  body: string;
  tone: string;
};

type Section = {
  eyebrow: string;
  title: string;
  body: string;
  items: Highlight[];
};

type MarketingPageConfig = {
  navKey: string;
  eyebrow: string;
  titleStart: string;
  titleAccent: string;
  titleEnd?: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  metrics: Metric[];
  heroHighlights: Highlight[];
  sections: Section[];
  finalTitle: string;
  finalBody: string;
};

const navItems = [
  { label: 'Products', href: '/products' },
  { label: 'Enterprise', href: '/enterprise' },
  { label: 'Customers', href: '/customers' },
  { label: 'Partners', href: '/partners' },
  { label: 'Resources', href: '/resources' },
];

export const marketingPageConfigs: Record<string, MarketingPageConfig> = {
  products: {
    navKey: 'products',
    eyebrow: 'Product suite',
    titleStart: 'One workspace for every customer',
    titleAccent: 'operation',
    titleEnd: '.',
    description:
      'Bring conversations, automation, CRM, campaigns, commerce, and analytics into one fast operating layer for teams that need clarity without tool sprawl.',
    primaryCta: { label: 'Start free', href: '/signup' },
    secondaryCta: { label: 'View workspace', href: '/wachat' },
    metrics: [
      { value: '42+', label: 'automation nodes' },
      { value: '8', label: 'connected modules' },
      { value: '100k+', label: 'broadcast scale' },
    ],
    heroHighlights: [
      { icon: MessageSquare, title: 'Conversations', body: 'WhatsApp, Instagram, email, and web chat in a shared inbox.', tone: '#4F46E5' },
      { icon: Workflow, title: 'Automation', body: 'Trigger flows from messages, schedules, orders, and webhooks.', tone: '#10B981' },
      { icon: LineChart, title: 'Analytics', body: 'Track delivery, revenue, SLA, CSAT, and flow performance.', tone: '#F59E0B' },
    ],
    sections: [
      {
        eyebrow: 'Operate',
        title: 'All the front-office systems your team reaches for daily.',
        body: 'Each module is useful alone, stronger together, and designed around live customer work instead of admin theatre.',
        items: [
          { icon: Bot, title: 'AI studio', body: 'Deploy private agents with tools, retrieval, and guardrails attached to workspace data.', tone: '#7C3AED' },
          { icon: Users2, title: 'CRM records', body: 'Every chat, payment, tag, order, and opt-in lands on a clean customer timeline.', tone: '#EC4899' },
          { icon: Store, title: 'Commerce layer', body: 'Recover carts, collect payments, sync catalogs, and trigger post-purchase flows.', tone: '#06B6D4' },
        ],
      },
      {
        eyebrow: 'Build',
        title: 'Shape the platform around your existing stack.',
        body: 'SabNode gives operators a polished workspace while developers get APIs, webhooks, environments, and a clean integration surface.',
        items: [
          { icon: Code2, title: 'Developer APIs', body: 'Typed REST APIs and webhook retries for every important object and event.', tone: '#4F46E5' },
          { icon: Database, title: 'Custom data', body: 'Add structured properties, segments, scoring, and enrichment without schema drama.', tone: '#10B981' },
          { icon: Layers, title: 'Reusable suites', body: 'Bundle modules into workspaces for support, sales, marketing, and success teams.', tone: '#F59E0B' },
        ],
      },
    ],
    finalTitle: 'Launch the suite your team will actually use.',
    finalBody: 'Start with inbox, automation, CRM, or campaigns. Add the rest when your operation is ready.',
  },
  enterprise: {
    navKey: 'enterprise',
    eyebrow: 'Enterprise readiness',
    titleStart: 'Premium control for serious',
    titleAccent: 'scale',
    titleEnd: '.',
    description:
      'Run regulated, high-volume customer operations with security, governance, regional controls, and implementation support built into the platform.',
    primaryCta: { label: 'Talk to sales', href: '/contact' },
    secondaryCta: { label: 'Security overview', href: '/resources' },
    metrics: [
      { value: '99.99%', label: 'target uptime' },
      { value: '24/7', label: 'priority support' },
      { value: 'SOC 2', label: 'ready controls' },
    ],
    heroHighlights: [
      { icon: Shield, title: 'Governance', body: 'Role controls, audit logs, consent history, and workspace policies.', tone: '#4F46E5' },
      { icon: LockKeyhole, title: 'Security', body: 'SSO-ready access patterns, encrypted secrets, and scoped tokens.', tone: '#10B981' },
      { icon: Globe2, title: 'Regions', body: 'Deploy teams with regional data controls and compliance workflows.', tone: '#F59E0B' },
    ],
    sections: [
      {
        eyebrow: 'Secure',
        title: 'The control plane your IT and operations teams can share.',
        body: 'Enterprise teams need speed without losing visibility. SabNode keeps permissions, auditability, and platform limits legible.',
        items: [
          { icon: Server, title: 'Environment strategy', body: 'Separate sandbox, staging, and production credentials for safer releases.', tone: '#4F46E5' },
          { icon: BadgeCheck, title: 'Compliance workflows', body: 'Track opt-ins, templates, approvals, exports, and data retention policies.', tone: '#10B981' },
          { icon: Headphones, title: 'Implementation support', body: 'Solution reviews, migration assistance, launch QA, and success planning.', tone: '#EC4899' },
        ],
      },
      {
        eyebrow: 'Scale',
        title: 'Built for busy queues, large audiences, and multi-team operations.',
        body: 'High volume should make the system sharper, not slower. SabNode keeps queues, automation, and reporting coordinated.',
        items: [
          { icon: Zap, title: 'Throughput controls', body: 'Queue campaigns, throttle sends, retry events, and protect deliverability.', tone: '#F59E0B' },
          { icon: Building2, title: 'Multi-workspace orgs', body: 'Give each brand or region independence while finance and IT retain oversight.', tone: '#06B6D4' },
          { icon: LineChart, title: 'Executive reporting', body: 'Roll up channel, team, campaign, and SLA metrics across business units.', tone: '#7C3AED' },
        ],
      },
    ],
    finalTitle: 'Give enterprise teams speed with guardrails.',
    finalBody: 'Design the rollout, connect your stack, and give every customer-facing team one place to work.',
  },
  customers: {
    navKey: 'customers',
    eyebrow: 'Customer stories',
    titleStart: 'Teams use SabNode to turn busy channels into',
    titleAccent: 'revenue',
    titleEnd: '.',
    description:
      'From support queues to campaign operations, growing teams use SabNode to remove handoffs, respond faster, and prove what moved the business.',
    primaryCta: { label: 'Explore stories', href: '/resources' },
    secondaryCta: { label: 'Start your workspace', href: '/signup' },
    metrics: [
      { value: '4,812', label: 'active workspaces' },
      { value: '38%', label: 'faster response' },
      { value: '2.4x', label: 'campaign lift' },
    ],
    heroHighlights: [
      { icon: Users2, title: 'Support teams', body: 'Route conversations, manage SLAs, and keep customers out of limbo.', tone: '#4F46E5' },
      { icon: Target, title: 'Growth teams', body: 'Segment contacts, launch broadcasts, and attribute outcomes.', tone: '#EC4899' },
      { icon: Building2, title: 'Operators', body: 'Connect process, data, and reporting across the customer journey.', tone: '#10B981' },
    ],
    sections: [
      {
        eyebrow: 'Industries',
        title: 'Built for customer-heavy teams with no patience for scattered tools.',
        body: 'SabNode fits businesses where conversations, workflows, and customer records need to move as one.',
        items: [
          { icon: Store, title: 'Commerce', body: 'Recover carts, answer product questions, and trigger order updates in one flow.', tone: '#06B6D4' },
          { icon: Headphones, title: 'Services', body: 'Assign leads, qualify inquiries, follow up, and keep every handoff visible.', tone: '#F59E0B' },
          { icon: HeartHandshake, title: 'Community businesses', body: 'Broadcast updates, collect feedback, and personalize every reply.', tone: '#7C3AED' },
        ],
      },
      {
        eyebrow: 'Proof',
        title: 'The outcome is simple: fewer tabs, faster replies, clearer ownership.',
        body: 'SabNode makes the work visible so teams can coach, automate, and improve from the same source of truth.',
        items: [
          { icon: MessageSquare, title: 'Response quality', body: 'Canned replies, AI assistance, and full history keep replies accurate.', tone: '#4F46E5' },
          { icon: Workflow, title: 'Repeatable workflows', body: 'Turn manual follow-ups and routing habits into trackable automations.', tone: '#10B981' },
          { icon: LineChart, title: 'Measured impact', body: 'Connect campaign, conversation, and revenue metrics without spreadsheet glue.', tone: '#EC4899' },
        ],
      },
    ],
    finalTitle: 'Build the customer operation your next stage needs.',
    finalBody: 'Start small with one team, then expand the workflows that prove themselves.',
  },
  partners: {
    navKey: 'partners',
    eyebrow: 'Partner ecosystem',
    titleStart: 'Grow with a platform agencies and builders can',
    titleAccent: 'trust',
    titleEnd: '.',
    description:
      'Create client workspaces, package automations, publish integrations, and earn with programs designed for implementation partners, developers, and referrals.',
    primaryCta: { label: 'Become a partner', href: '/contact' },
    secondaryCta: { label: 'Browse resources', href: '/resources' },
    metrics: [
      { value: '20%', label: 'referral share' },
      { value: '3', label: 'partner tracks' },
      { value: '1:1', label: 'launch support' },
    ],
    heroHighlights: [
      { icon: HeartHandshake, title: 'Solution partners', body: 'Implement SabNode for clients with playbooks and launch reviews.', tone: '#4F46E5' },
      { icon: Code2, title: 'Developers', body: 'Build integrations and workflow packs on APIs and webhooks.', tone: '#10B981' },
      { icon: Sparkles, title: 'Referrals', body: 'Introduce customers and earn recurring revenue on eligible accounts.', tone: '#F59E0B' },
    ],
    sections: [
      {
        eyebrow: 'Programs',
        title: 'Pick the partner track that matches how you create value.',
        body: 'Whether you consult, integrate, or refer, the program gives you the enablement and commercial model to move confidently.',
        items: [
          { icon: Users2, title: 'Agency track', body: 'Client workspaces, implementation templates, training sessions, and co-selling support.', tone: '#4F46E5' },
          { icon: Code2, title: 'Builder track', body: 'API credentials, sandbox environments, app review, and integration visibility.', tone: '#10B981' },
          { icon: Target, title: 'Referral track', body: 'Tracked introductions, transparent status, and recurring commission reporting.', tone: '#EC4899' },
        ],
      },
      {
        eyebrow: 'Enablement',
        title: 'Everything needed to deliver polished customer operations.',
        body: 'Partners get the operational materials, product access, and technical support needed to ship reliable client outcomes.',
        items: [
          { icon: FileText, title: 'Playbooks', body: 'Reusable discovery, migration, launch, and success templates for common projects.', tone: '#F59E0B' },
          { icon: Workflow, title: 'Workflow packs', body: 'Package best-practice automations and import them into client workspaces.', tone: '#06B6D4' },
          { icon: BadgeCheck, title: 'Certification', body: 'Earn partner badges after completing product and implementation checks.', tone: '#7C3AED' },
        ],
      },
    ],
    finalTitle: 'Turn your expertise into repeatable SabNode delivery.',
    finalBody: 'Partner with the platform, ship stronger client systems, and grow a recurring services motion.',
  },
  resources: {
    navKey: 'resources',
    eyebrow: 'Resources',
    titleStart: 'Learn, launch, and keep improving with practical',
    titleAccent: 'guides',
    titleEnd: '.',
    description:
      'Find product docs, API references, workflow recipes, release notes, security information, and support paths for every stage of your SabNode rollout.',
    primaryCta: { label: 'Open docs', href: '/blog' },
    secondaryCta: { label: 'Contact support', href: '/contact' },
    metrics: [
      { value: '120+', label: 'launch guides' },
      { value: 'Friday', label: 'ship notes' },
      { value: '24h', label: 'support target' },
    ],
    heroHighlights: [
      { icon: BookOpen, title: 'Docs', body: 'Step-by-step guides for inbox, flows, CRM, broadcasts, and APIs.', tone: '#4F46E5' },
      { icon: Newspaper, title: 'Journal', body: 'Product thinking, launch notes, and operator playbooks.', tone: '#EC4899' },
      { icon: Shield, title: 'Trust center', body: 'Security, compliance, privacy, uptime, and data-handling resources.', tone: '#10B981' },
    ],
    sections: [
      {
        eyebrow: 'Learn',
        title: 'Documentation for teams that want to move quickly and correctly.',
        body: 'Every resource is written to help operators understand the workflow and help developers wire the right systems.',
        items: [
          { icon: BookOpen, title: 'Product docs', body: 'Clear setup paths for conversations, automations, CRM, commerce, and analytics.', tone: '#4F46E5' },
          { icon: Code2, title: 'API reference', body: 'Endpoints, webhook payloads, auth scopes, retries, SDKs, and examples.', tone: '#10B981' },
          { icon: Workflow, title: 'Recipes', body: 'Prebuilt flow patterns for lead routing, cart recovery, support triage, and follow-up.', tone: '#F59E0B' },
        ],
      },
      {
        eyebrow: 'Stay current',
        title: 'A living library for product changes and operational trust.',
        body: 'Teams can track what changed, how to adopt it, and where to get help when the stakes are high.',
        items: [
          { icon: Sparkles, title: 'Changelog', body: 'Weekly release notes with the product details teams need to adopt new features.', tone: '#EC4899' },
          { icon: Headphones, title: 'Help center', body: 'Troubleshooting, migration answers, account help, and practical support routes.', tone: '#06B6D4' },
          { icon: Shield, title: 'Security center', body: 'Compliance resources, data processing notes, uptime, and responsible disclosure.', tone: '#7C3AED' },
        ],
      },
    ],
    finalTitle: 'Give your team a cleaner path from setup to scale.',
    finalBody: 'Use the resource library to launch confidently, then keep improving as SabNode ships.',
  },
};

export function MarketingNavPage({ config }: { config: MarketingPageConfig }) {
  return (
    <div className="mp-root min-h-screen overflow-hidden text-[#121126]">
      <MarketingPageStyles />
      <div aria-hidden className="mp-bg" />

      <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-white/86 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <SabNodeLogo className="h-7 w-auto" />
          </Link>

          <nav className="ml-3 hidden items-center gap-1 rounded-full border border-black/[0.06] bg-black/[0.02] p-1 md:flex">
            {navItems.map((item) => {
              const active = item.href.slice(1) === config.navKey;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-white text-[#4F46E5] shadow-sm ring-1 ring-[#4F46E5]/20'
                      : 'text-[#4A4A6B] hover:text-[#121126]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="hidden h-9 items-center px-3 text-[13.5px] font-semibold text-[#121126] hover:text-[#4F46E5] sm:inline-flex">
              Sign In
            </Link>
            <Link href="/signup" className="mp-btn-primary inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-semibold">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-12 md:grid-cols-[1.05fr_0.95fr] md:px-6 md:pb-20 md:pt-20">
          <div className="flex flex-col justify-center">
            <span className="mp-kicker">
              <span /> {config.eyebrow}
            </span>
            <h1 className="mt-6 max-w-4xl font-display text-[54px] leading-[0.95] text-[#121126] sm:text-[72px] lg:text-[88px]">
              {config.titleStart}{' '}
              <span className="mp-gradient">{config.titleAccent}</span>
              {config.titleEnd}
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-8 text-[#4A4A6B]">
              {config.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={config.primaryCta.href} className="mp-btn-primary inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[14px] font-semibold">
                {config.primaryCta.label} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={config.secondaryCta.href} className="mp-btn-ghost inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[14px] font-semibold">
                {config.secondaryCta.label}
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {config.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-black/[0.07] bg-white/70 p-4 shadow-[0_20px_60px_-42px_rgba(17,17,38,0.34)]">
                  <div className="font-display text-[27px] leading-none text-[#121126]">{metric.value}</div>
                  <div className="mt-2 text-[12px] font-semibold leading-snug text-[#7878A1]">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <HeroVisual items={config.heroHighlights} />
        </section>

        {config.sections.map((section, index) => (
          <section key={section.eyebrow} className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
            <div className="mp-section grid gap-8 p-6 md:grid-cols-[0.78fr_1.22fr] md:p-8 lg:p-10">
              <div>
                <span className="mp-kicker">
                  <span /> {section.eyebrow}
                </span>
                <h2 className="mt-5 font-display text-[34px] leading-tight text-[#121126] md:text-[44px]">
                  {section.title}
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-[#4A4A6B]">
                  {section.body}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {section.items.map((item) => (
                  <FeatureCard key={item.title} item={item} index={index} />
                ))}
              </div>
            </div>
          </section>
        ))}

        <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6 md:pb-24">
          <div className="mp-final overflow-hidden rounded-[32px] border border-[#4F46E5]/15 p-7 md:p-10">
            <div className="max-w-2xl">
              <span className="mp-kicker mp-kicker-light">
                <span /> Ready when you are
              </span>
              <h2 className="mt-5 font-display text-[38px] leading-tight text-white md:text-[58px]">
                {config.finalTitle}
              </h2>
              <p className="mt-4 max-w-xl text-[16px] leading-7 text-white/72">
                {config.finalBody}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href={config.primaryCta.href} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-[14px] font-semibold text-[#121126]">
                  {config.primaryCta.label} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/" className="inline-flex h-11 items-center justify-center rounded-full border border-white/18 px-6 text-[14px] font-semibold text-white/84 hover:bg-white/10">
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function HeroVisual({ items }: { items: Highlight[] }) {
  return (
    <div className="relative flex items-center">
      <div className="mp-visual w-full rounded-[34px] p-4 md:p-5">
        <div className="rounded-[26px] border border-white/60 bg-white/84 p-4 shadow-[0_36px_120px_-58px_rgba(17,17,38,0.42)]">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#F87171]" />
              <span className="h-3 w-3 rounded-full bg-[#FBBF24]" />
              <span className="h-3 w-3 rounded-full bg-[#34D399]" />
            </div>
            <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#4F46E5]">
              Live workspace
            </span>
          </div>

          <div className="grid gap-3 pt-4">
            {items.map((item) => (
              <FeatureCard key={item.title} item={item} compact />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-black/[0.06] bg-[#121126] p-4 text-white">
            <div className="flex items-center justify-between text-[12px] text-white/62">
              <span>Operations signal</span>
              <span>+18.4%</span>
            </div>
            <div className="mt-4 flex h-24 items-end gap-2">
              {[42, 62, 48, 78, 55, 88, 71, 96].map((height, index) => (
                <span
                  key={height}
                  className="flex-1 rounded-t-md"
                  style={{
                    height: `${height}%`,
                    background: index % 3 === 0 ? '#6366F1' : index % 3 === 1 ? '#10B981' : '#F59E0B',
                    opacity: 0.82,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ item, compact = false }: { item: Highlight; index?: number; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <article className={`mp-card rounded-2xl border border-black/[0.07] bg-white/82 ${compact ? 'p-4' : 'p-5'}`}>
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_12px_24px_-14px_rgba(17,17,38,0.45)]"
        style={{ background: `linear-gradient(135deg, ${item.tone}, ${item.tone}cc)` }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <h3 className={`${compact ? 'mt-3 text-[15px]' : 'mt-5 text-[17px]'} font-bold leading-tight text-[#121126]`}>
        {item.title}
      </h3>
      <p className={`${compact ? 'mt-1 text-[12.5px]' : 'mt-3 text-[13.5px]'} leading-6 text-[#4A4A6B]`}>
        {item.body}
      </p>
    </article>
  );
}

function MarketingPageStyles() {
  return (
    <style>{`
      .mp-root {
        position: relative;
        background: #F7F8FC;
        font-family: var(--font-sab-body), ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      .mp-root ::selection { background: #4F46E5; color: #fff; }
      .font-display {
        font-family: var(--font-sab-display), ui-sans-serif, system-ui, sans-serif;
        font-weight: 700;
        letter-spacing: -0.026em;
      }
      .mp-bg {
        pointer-events: none;
        position: fixed;
        inset: 0;
        z-index: 0;
        background:
          radial-gradient(1000px 560px at 8% -6%, rgba(99,102,241,0.18), transparent 62%),
          radial-gradient(900px 520px at 98% 4%, rgba(16,185,129,0.10), transparent 62%),
          radial-gradient(820px 520px at 52% 104%, rgba(245,158,11,0.10), transparent 62%),
          linear-gradient(180deg, #F7F8FC 0%, #FFFFFF 58%, #F7F8FC 100%);
      }
      .mp-bg:after {
        content: "";
        position: absolute;
        inset: 0;
        opacity: 0.055;
        background-image:
          linear-gradient(rgba(17,17,38,0.55) 1px, transparent 1px),
          linear-gradient(90deg, rgba(17,17,38,0.55) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: radial-gradient(ellipse at center, black 42%, transparent 82%);
        -webkit-mask-image: radial-gradient(ellipse at center, black 42%, transparent 82%);
      }
      .mp-gradient {
        background: linear-gradient(90deg, #4F46E5 0%, #10B981 52%, #F59E0B 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
      }
      .mp-kicker {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        gap: 0.5rem;
        border-radius: 9999px;
        border: 1px solid rgba(79,70,229,0.18);
        background: #EEF2FF;
        padding: 5px 12px;
        color: #4F46E5;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .mp-kicker span {
        width: 6px;
        height: 6px;
        border-radius: 9999px;
        background: #4F46E5;
        box-shadow: 0 0 0 3px rgba(79,70,229,0.18);
      }
      .mp-kicker-light {
        border-color: rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.10);
        color: #fff;
      }
      .mp-kicker-light span {
        background: #10B981;
        box-shadow: 0 0 0 3px rgba(16,185,129,0.20);
      }
      .mp-btn-primary {
        background: linear-gradient(180deg, #6366F1 0%, #4F46E5 100%);
        color: #fff;
        box-shadow: 0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.15) inset, 0 14px 32px -12px rgba(79,70,229,0.45);
        transition: transform 200ms ease, filter 200ms ease;
      }
      .mp-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
      .mp-btn-ghost {
        border: 1px solid rgba(17,17,38,0.10);
        background: rgba(255,255,255,0.72);
        color: #121126;
        transition: transform 200ms ease, background 200ms ease;
      }
      .mp-btn-ghost:hover { transform: translateY(-1px); background: #fff; }
      .mp-visual {
        border: 1px solid rgba(17,17,38,0.08);
        background:
          linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,255,255,0.56)),
          radial-gradient(circle at 10% 20%, rgba(79,70,229,0.20), transparent 32%),
          radial-gradient(circle at 90% 0%, rgba(16,185,129,0.16), transparent 34%);
        box-shadow: 0 50px 150px -70px rgba(17,17,38,0.46), 0 1px 0 rgba(255,255,255,0.9) inset;
        backdrop-filter: blur(14px);
      }
      .mp-section {
        border-radius: 34px;
        border: 1px solid rgba(17,17,38,0.07);
        background: rgba(255,255,255,0.62);
        box-shadow: 0 40px 120px -72px rgba(17,17,38,0.38), 0 1px 0 rgba(255,255,255,0.88) inset;
        backdrop-filter: blur(14px);
      }
      .mp-card {
        box-shadow: 0 26px 80px -52px rgba(17,17,38,0.34);
        transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
      }
      .mp-card:hover {
        transform: translateY(-3px);
        border-color: rgba(79,70,229,0.20);
        box-shadow: 0 36px 100px -54px rgba(79,70,229,0.34);
      }
      .mp-final {
        position: relative;
        background:
          radial-gradient(780px 340px at 90% 0%, rgba(16,185,129,0.24), transparent 60%),
          radial-gradient(640px 320px at 0% 100%, rgba(245,158,11,0.18), transparent 58%),
          linear-gradient(135deg, #121126 0%, #27235C 100%);
        box-shadow: 0 54px 150px -72px rgba(18,17,38,0.58);
      }
    `}</style>
  );
}
