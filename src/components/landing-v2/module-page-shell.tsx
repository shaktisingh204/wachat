'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import {
    ArrowRight,
    ArrowUpRight,
    Check,
    ChevronDown,
    Sparkles,
    Shield,
    Lock,
    Globe2,
    Database,
    Webhook,
    Cpu,
    BarChart3,
    Zap,
    Layers,
    GitBranch,
    PlayCircle,
    Quote,
    Building2,
    Briefcase,
    Users as UsersIcon,
    Store,
    GraduationCap,
    Headphones,
    Activity,
    type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { LandingNav } from './landing-nav';
import { LandingFooter } from './landing-footer';
import { MODULES, MODULES_BY_SLUG, type ModuleSlug } from './modules-data';
import { CategoryMockup, AutomationMockup, AuditMockup } from './mockups';
import {
    ConversationBespoke, MarketingBespoke, CommerceBespoke, SuccessBespoke,
    PeopleBespoke, ProductivityBespoke, EngineeringBespoke, AnalyticsBespoke,
    FilesBespoke, AcquisitionBespoke, CategoryBackdrop,
} from './category-sections';
import {
    BroadcastComposer, BotBuilder, CallQueue, StorefrontPreview, ApiPlayground,
    KnowledgeBase, QrStudio, RecordingLibrary, FunnelChart, VaultEntries, ESignFlow,
    RoadmapKanban, SlideEditor, SheetPreview, TablesPreview, LoyaltyRings,
    CommunityFeed, BookingCalendar, AffiliateBoard, AbTestRunner, FieldJobsMap,
    ClientPortal, OpsCommand,
} from './bespoke-extras';
import { recipeFor, type BespokeId, type SectionId } from './module-recipes';

interface ModulePageShellProps {
    slug: ModuleSlug;
    session?: { user?: unknown } | null;
    heroVisual: ReactNode;
}

export function ModulePageShell({ slug, session, heroVisual }: ModulePageShellProps) {
    const mod = MODULES_BY_SLUG[slug];
    const Icon = mod.icon;
    const others = MODULES.filter((mo) => mo.slug !== slug).slice(0, 8);

    const recipe = recipeFor(mod.slug);
    const bespokeNode = renderBespoke(recipe.bespoke, mod);

    return (
        <div className="relative min-h-screen overflow-x-clip bg-zoru-surface text-zoru-ink antialiased">
            {/* category-themed backdrop */}
            <CategoryBackdrop mod={mod} />
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                    background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${mod.glow}, transparent 60%)`,
                    opacity: 0.3,
                }}
            />

            <LandingNav session={session} />

            <main className="relative z-10">
                <Hero mod={mod} Icon={Icon} session={session} heroVisual={heroVisual} />
                {recipe.sections.map((id, i) => {
                    switch (id as SectionId) {
                        case 'trust':
                            return <TrustBar key={`${id}-${i}`} mod={mod} />;
                        case 'problem':
                            return <ProblemSection key={`${id}-${i}`} mod={mod} />;
                        case 'flow':
                            return <FlowSection key={`${id}-${i}`} mod={mod} />;
                        case 'stats':
                            return <StatsBanner key={`${id}-${i}`} mod={mod} />;
                        case 'features':
                            return <FeaturesGrid key={`${id}-${i}`} mod={mod} />;
                        case 'spotlights':
                            return <FeatureSpotlights key={`${id}-${i}`} mod={mod} />;
                        case 'use-cases':
                            return <UseCases key={`${id}-${i}`} mod={mod} />;
                        case 'ai':
                            return <AiCapabilities key={`${id}-${i}`} mod={mod} />;
                        case 'integrations':
                            return <IntegrationsStrip key={`${id}-${i}`} mod={mod} />;
                        case 'workflow':
                            return <WorkflowShowcase key={`${id}-${i}`} mod={mod} />;
                        case 'comparison':
                            return <ComparisonSection key={`${id}-${i}`} mod={mod} />;
                        case 'security':
                            return <SecurityBar key={`${id}-${i}`} mod={mod} />;
                        case 'pricing':
                            return <PricingHint key={`${id}-${i}`} mod={mod} session={session} />;
                        case 'testimonial':
                            return <Testimonial key={`${id}-${i}`} mod={mod} />;
                        case 'faq':
                            return <FaqSection key={`${id}-${i}`} mod={mod} />;
                        case 'related':
                            return <RelatedModules key={`${id}-${i}`} others={others} />;
                        case 'bespoke':
                            return <div key={`${id}-${i}`}>{bespokeNode}</div>;
                        default:
                            return null;
                    }
                })}
                <FinalCta mod={mod} session={session} />
            </main>

            <LandingFooter />
        </div>
    );
}

function renderBespoke(id: BespokeId, mod: (typeof MODULES)[number]) {
    switch (id) {
        case 'conversation':      return <ConversationBespoke mod={mod} />;
        case 'marketing':         return <MarketingBespoke mod={mod} />;
        case 'commerce':          return <CommerceBespoke mod={mod} />;
        case 'success':           return <SuccessBespoke mod={mod} />;
        case 'people':            return <PeopleBespoke mod={mod} />;
        case 'productivity':      return <ProductivityBespoke mod={mod} />;
        case 'engineering':       return <EngineeringBespoke mod={mod} />;
        case 'analytics':         return <AnalyticsBespoke mod={mod} />;
        case 'files':             return <FilesBespoke mod={mod} />;
        case 'acquisition':       return <AcquisitionBespoke mod={mod} />;
        case 'broadcast':         return <BroadcastComposer mod={mod} />;
        case 'bot-builder':       return <BotBuilder mod={mod} />;
        case 'call-queue':        return <CallQueue mod={mod} />;
        case 'storefront':        return <StorefrontPreview mod={mod} />;
        case 'api-playground':    return <ApiPlayground mod={mod} />;
        case 'knowledge-base':    return <KnowledgeBase mod={mod} />;
        case 'qr-studio':         return <QrStudio mod={mod} />;
        case 'recording-library': return <RecordingLibrary mod={mod} />;
        case 'funnel-chart':      return <FunnelChart mod={mod} />;
        case 'vault':             return <VaultEntries mod={mod} />;
        case 'esign':             return <ESignFlow mod={mod} />;
        case 'roadmap':           return <RoadmapKanban mod={mod} />;
        case 'slide-editor':      return <SlideEditor mod={mod} />;
        case 'sheet':             return <SheetPreview mod={mod} />;
        case 'tables':            return <TablesPreview mod={mod} />;
        case 'loyalty':           return <LoyaltyRings mod={mod} />;
        case 'community':         return <CommunityFeed mod={mod} />;
        case 'booking':           return <BookingCalendar mod={mod} />;
        case 'affiliate':         return <AffiliateBoard mod={mod} />;
        case 'ab-test':           return <AbTestRunner mod={mod} />;
        case 'field-jobs':        return <FieldJobsMap mod={mod} />;
        case 'client-portal':     return <ClientPortal mod={mod} />;
        case 'ops-command':       return <OpsCommand mod={mod} />;
        default:                  return null;
    }
}

// ───────── HERO ─────────
function Hero({
    mod,
    Icon,
    session,
    heroVisual,
}: {
    mod: (typeof MODULES)[number];
    Icon: LucideIcon;
    session?: { user?: unknown } | null;
    heroVisual: ReactNode;
}) {
    return (
        <section className="relative px-6 pt-32 pb-20 md:pt-40 md:pb-28">
            <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
                <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <div
                        className="inline-flex items-center gap-2 rounded-full border border-zoru-line bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-zoru-ink backdrop-blur"
                    >
                        <span
                            className={`grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}
                        >
                            <Icon className="h-3 w-3 text-white" />
                        </span>
                        {mod.tag}
                    </div>
                    <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight text-zoru-ink md:text-6xl lg:text-7xl">
                        {mod.name}.
                    </h1>
                    <h2
                        className="mt-3 max-w-xl text-balance text-3xl font-semibold leading-tight md:text-4xl"
                        style={{ color: mod.accentDeep }}
                    >
                        {mod.short}
                    </h2>
                    <div className={`mt-5 h-1 w-16 rounded-full bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo}`} />
                    <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-zoru-ink">
                        {mod.desc}
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Link
                            href={session?.user ? mod.productHref : '/login?signup=1'}
                            className={`group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo} px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.03]`}
                            style={{ boxShadow: `0 14px 36px -10px ${mod.glow}` }}
                        >
                            {session?.user ? `Open ${mod.name}` : 'Start free'}
                            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                            href="#how-flow"
                            className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-white px-5 py-2.5 text-sm font-semibold text-zoru-ink transition hover:border-zoru-line"
                        >
                            <PlayCircle className="h-4 w-4" /> See how it works
                        </Link>
                    </div>
                    <div className="mt-10 grid max-w-md grid-cols-2 gap-4 sm:grid-cols-4">
                        {mod.stats.map((s, i) => (
                            <m.div
                                key={s.label}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 + i * 0.06 }}
                            >
                                <div className="text-2xl font-semibold text-zoru-ink">{s.value}</div>
                                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-zoru-ink">
                                    {s.label}
                                </div>
                            </m.div>
                        ))}
                    </div>
                </m.div>
                <m.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="relative aspect-square w-full"
                >
                    {heroVisual}
                </m.div>
            </div>
        </section>
    );
}

// ───────── TRUST BAR ─────────
function TrustBar({ mod }: { mod: (typeof MODULES)[number] }) {
    const logos = ['Sole Co.', 'Acme', 'Globex', 'Initech', 'Soylent', 'Wayne Co.', 'Daily Planet', 'Stark'];
    return (
        <section className="relative border-y border-zoru-line bg-white/60 py-8 backdrop-blur">
            <div className="mx-auto max-w-7xl px-6">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Teams use <span className="text-zoru-ink">{mod.name}</span> across India + 14 countries
                </p>
                <div className="mt-5 grid grid-cols-4 gap-6 opacity-70 md:grid-cols-8">
                    {logos.map((l, i) => (
                        <m.span
                            key={l}
                            initial={{ opacity: 0, y: 4 }}
                            whileInView={{ opacity: 0.85, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="text-center text-sm font-semibold tracking-tight text-zoru-ink"
                        >
                            {l}
                        </m.span>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ───────── PROBLEM SECTION ─────────
function ProblemSection({ mod }: { mod: (typeof MODULES)[number] }) {
    const pains = [
        `Stitching together 6 tools that don't share data`,
        `Paying per-seat for software your team barely opens`,
        `Reports that disagree because every tool counts differently`,
        `Context lost the moment a customer switches channels`,
    ];
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-6xl">
                <m.p
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink"
                >
                    The status quo
                </m.p>
                <m.h2
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 }}
                    className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl"
                >
                    The old way of doing {mod.tag.toLowerCase()} is full of duct tape.
                </m.h2>
                <p className="mt-5 max-w-2xl text-lg text-zoru-ink">
                    Most teams cobble together a Frankenstein stack — and pay for it twice. Once in seat
                    licences, and again in the hours nobody talks about.
                </p>
                <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {pains.map((p, i) => (
                        <m.div
                            key={p}
                            initial={{ opacity: 0, x: -6 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-start gap-3 rounded-xl border border-zoru-line bg-white p-4"
                        >
                            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-zoru-ink" />
                            <p className="text-[15px] text-zoru-ink">{p}</p>
                        </m.div>
                    ))}
                </div>
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className={`mt-10 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold`}
                    style={{ borderColor: `${mod.muted}80`, color: '#18181b' }}
                >
                    <Sparkles className="h-4 w-4" style={{ color: mod.accentDeep }} />
                    {mod.name} replaces the duct tape with one shared spine.
                </m.div>
            </div>
        </section>
    );
}

// ───────── FLOW ─────────
function FlowSection({ mod }: { mod: (typeof MODULES)[number] }) {
    return (
        <section id="how-flow" className="relative px-6 py-20">
            <div className="mx-auto max-w-6xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    How {mod.name} flows
                </p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Five steps. Nothing you have to learn.
                </h2>
                <div className="relative mt-10 grid grid-cols-1 gap-4 md:grid-cols-5">
                    {mod.flow.map((step, i) => (
                        <m.div
                            key={step}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="relative rounded-2xl border border-zoru-line bg-white p-5"
                        >
                            <span
                                className="text-[11px] font-semibold uppercase tracking-wider"
                                style={{ color: mod.accentDeep }}
                            >
                                Step 0{i + 1}
                            </span>
                            <p className="mt-2 text-lg font-semibold text-zoru-ink">{step}</p>
                            <p className="mt-1 text-[13px] text-zoru-ink">
                                {flowBlurb(i)}
                            </p>
                            {i < mod.flow.length - 1 && (
                                <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-zoru-surface-2 p-1 text-zoru-ink-muted md:block" />
                            )}
                        </m.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function flowBlurb(i: number) {
    return [
        'Get up and running in minutes. Auto-imports your existing data.',
        'Tune the rules once. They follow your business, not the other way around.',
        'Built-in observability — every change is logged and reversible.',
        'Real-time results pipe to the same dashboards your team already opens.',
        'Iterate. Roll back. Ship the next variant.',
    ][i] ?? '';
}

// ───────── STATS BANNER ─────────
function StatsBanner({ mod }: { mod: (typeof MODULES)[number] }) {
    return (
        <section className="relative px-6 py-20">
            <div className="mx-auto max-w-6xl">
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative overflow-hidden rounded-3xl border border-zoru-line bg-white p-10"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full blur-3xl"
                        style={{ background: mod.glow, opacity: 0.6 }}
                    />
                    <p
                        className="relative text-[11px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: mod.accentDeep }}
                    >
                        By the numbers
                    </p>
                    <h2 className="relative mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-zoru-ink md:text-4xl">
                        {mod.name} doesn&apos;t do demos — it does math.
                    </h2>
                    <div className="relative mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
                        {[
                            ...mod.stats,
                            { value: '14d', label: 'Free trial' },
                            { value: '<24h', label: 'Migration help' },
                            { value: '0', label: 'Setup fees' },
                            { value: '99.99%', label: 'Uptime SLO' },
                        ]
                            .slice(0, 8)
                            .map((s, i) => (
                                <m.div
                                    key={`${s.label}-${i}`}
                                    initial={{ opacity: 0, y: 8 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.04 }}
                                >
                                    <div className="text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                                        {s.value}
                                    </div>
                                    <div className="mt-2 text-[12px] font-semibold uppercase tracking-wider text-zoru-ink">
                                        {s.label}
                                    </div>
                                </m.div>
                            ))}
                    </div>
                </m.div>
            </div>
        </section>
    );
}

// ───────── FEATURES GRID ─────────
function FeaturesGrid({ mod }: { mod: (typeof MODULES)[number] }) {
    return (
        <section id="features" className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-3xl"
                >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                        Features
                    </p>
                    <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                        Everything {mod.name} ships with — out of the box.
                    </h2>
                    <p className="mt-4 text-lg text-zoru-ink">
                        Not a slide deck of promises. These are the surfaces your team will touch on day one.
                    </p>
                </m.div>
                <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {mod.features.map((f, i) => {
                        const FIcon = f.icon;
                        return (
                            <m.div
                                key={f.title}
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-10%' }}
                                transition={{ delay: i * 0.04 }}
                                whileHover={{ y: -4 }}
                                className="group relative overflow-hidden rounded-2xl border border-zoru-line bg-white p-6 transition hover:border-zoru-line"
                            >
                                <div
                                    aria-hidden
                                    className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition duration-500 group-hover:opacity-70"
                                    style={{ background: mod.glow }}
                                />
                                <div
                                    className={`relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-md`}
                                >
                                    <FIcon className="h-5 w-5 text-white" />
                                </div>
                                <h3 className="relative mt-5 text-xl font-semibold tracking-tight text-zoru-ink">
                                    {f.title}
                                </h3>
                                <p className="relative mt-2 text-[15px] leading-relaxed text-zoru-ink">
                                    {f.desc}
                                </p>
                                <div className="relative mt-4 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: mod.accentDeep }}>
                                    Learn more <ArrowUpRight className="h-3 w-3" />
                                </div>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── FEATURE SPOTLIGHTS (3 alternating with unique mockups) ─────────
function FeatureSpotlights({ mod }: { mod: (typeof MODULES)[number] }) {
    const spotlights = mod.features.slice(0, 3);
    const mockups = [
        <CategoryMockup key="cat" mod={mod} />,
        <AutomationMockup key="auto" mod={mod} />,
        <AuditMockup key="audit" mod={mod} />,
    ];
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl space-y-32">
                {spotlights.map((f, i) => {
                    const reversed = i % 2 === 1;
                    return (
                        <m.div
                            key={f.title}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-10%' }}
                            className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${reversed ? 'lg:[&>*:first-child]:order-2' : ''}`}
                        >
                            <div>
                                <span
                                    className="inline-flex items-center gap-2 rounded-full border border-zoru-line bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]"
                                    style={{ color: mod.accentDeep }}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo}`} />
                                    Spotlight 0{i + 1}
                                </span>
                                <h3 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-zoru-ink md:text-4xl">
                                    {f.title}
                                </h3>
                                <p className="mt-4 text-lg leading-relaxed text-zoru-ink">{f.desc}</p>
                                <ul className="mt-6 space-y-2">
                                    {spotlightBullets(i).map((b) => (
                                        <li key={b} className="flex items-start gap-2 text-[15px] text-zoru-ink">
                                            <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: mod.accentDeep }} />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href="#features"
                                    className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold"
                                    style={{ color: mod.accentDeep }}
                                >
                                    Jump to all features <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                            <div className="relative">{mockups[i]}</div>
                        </m.div>
                    );
                })}
            </div>
        </section>
    );
}

function spotlightBullets(i: number) {
    return [
        ['Configurable per workspace and per project', 'Lives next to your other modules — no double entry', 'Audit log on every change with one-click revert'],
        ['Built-in retries, idempotency, and graceful fallback', 'Designed for India + 12 regions, time-zone aware', 'Webhook + SDK for whatever you build next'],
        ['Multi-role permissions, SSO ready, SCIM friendly', 'Reports export to CSV, Sheets, and any BI tool', 'Plays nicely with your existing data warehouse'],
    ][i] ?? [];
}

// ───────── USE CASES ─────────
function UseCases({ mod }: { mod: (typeof MODULES)[number] }) {
    const personas = [
        { icon: Store, label: 'D2C brands', desc: `Use ${mod.name} to scale ${mod.tag.toLowerCase()} without hiring an extra ops team.` },
        { icon: Building2, label: 'Agencies', desc: `Run ${mod.name} across 30+ client accounts from one console with project-level isolation.` },
        { icon: GraduationCap, label: 'Edtech + creators', desc: `Personalised flows that turn one-time learners into long-term subscribers.` },
        { icon: Briefcase, label: 'Enterprises', desc: `Plug ${mod.name} into your existing SSO, vault, and BI stack — no rip-and-replace.` },
    ];
    return (
        <section className="relative bg-white px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Who it&apos;s for
                </p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Built for teams that ship every day.
                </h2>
                <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {personas.map((p, i) => {
                        const PIcon = p.icon;
                        return (
                            <m.div
                                key={p.label}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="group rounded-2xl border border-zoru-line bg-zoru-surface p-6 transition hover:-translate-y-1 hover:border-zoru-line"
                            >
                                <div
                                    className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-md`}
                                >
                                    <PIcon className="h-5 w-5 text-white" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold text-zoru-ink">{p.label}</h3>
                                <p className="mt-2 text-[14px] leading-relaxed text-zoru-ink">{p.desc}</p>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── AI CAPABILITIES ─────────
function AiCapabilities({ mod }: { mod: (typeof MODULES)[number] }) {
    const helpers = [
        { icon: Sparkles, title: 'AI suggestions', desc: 'Recommends the next-best-action inside the workflow — accept or ignore in one click.' },
        { icon: Cpu, title: 'AI summaries', desc: 'Long threads, lengthy reports, multi-day logs — summarised in two lines, in your tone.' },
        { icon: Activity, title: 'AI anomaly watch', desc: 'Spots dips, drifts, regressions and pages the right person — before customers tweet.' },
        { icon: Headphones, title: 'AI assistant', desc: 'Press / inside any field — talk to your data, build a segment, draft a reply, plan a sprint.' },
    ];
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <div className="grid items-start gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
                    <div>
                        <span
                            className="inline-flex items-center gap-2 rounded-full border border-zoru-line bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]"
                            style={{ color: mod.accentDeep }}
                        >
                            <Sparkles className="h-3 w-3" /> AI inside
                        </span>
                        <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                            AI that earns its keep — not just a sparkle button.
                        </h2>
                        <p className="mt-4 text-lg text-zoru-ink">
                            Every feature in {mod.name} ships with a real-job AI helper. Bring your own key
                            (OpenAI, Anthropic, Gemini, local Ollama) or use ours.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {helpers.map((h, i) => {
                            const HIcon = h.icon;
                            return (
                                <m.div
                                    key={h.title}
                                    initial={{ opacity: 0, y: 8 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.05 }}
                                    className="rounded-2xl border border-zoru-line bg-white p-5"
                                >
                                    <HIcon className="h-5 w-5" style={{ color: mod.accentDeep }} />
                                    <h4 className="mt-3 text-base font-semibold text-zoru-ink">{h.title}</h4>
                                    <p className="mt-1.5 text-[14px] leading-relaxed text-zoru-ink">{h.desc}</p>
                                </m.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ───────── INTEGRATIONS STRIP ─────────
function IntegrationsStrip({ mod }: { mod: (typeof MODULES)[number] }) {
    const integrations = [
        'Google', 'Meta', 'Shopify', 'Razorpay', 'Stripe', 'Slack', 'Notion', 'Zapier',
        'HubSpot', 'Salesforce', 'Linear', 'GitHub', 'Postgres', 'MongoDB', 'Redis', 'AWS S3',
    ];
    return (
        <section className="relative bg-white px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                            Integrations
                        </p>
                        <h2 className="mt-3 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                            Talks to everything your stack already runs on.
                        </h2>
                    </div>
                    <Link href="/#integrations" className="text-sm font-semibold text-zoru-ink underline-offset-4 hover:underline">
                        See all 900+ →
                    </Link>
                </div>
                <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                    {integrations.map((name, i) => (
                        <m.div
                            key={name}
                            initial={{ opacity: 0, y: 6 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.03 }}
                            className="flex aspect-square items-center justify-center rounded-2xl border border-zoru-line bg-zoru-surface text-center text-[13px] font-semibold text-zoru-ink transition hover:-translate-y-0.5 hover:border-zoru-line hover:text-zoru-ink"
                        >
                            {name}
                        </m.div>
                    ))}
                </div>
                <p className="mt-6 text-sm text-zoru-ink">
                    Plus a clean REST + Webhook API, signed events, and SDKs for Node, Python, Go.
                </p>
            </div>
        </section>
    );
}

// ───────── WORKFLOW SHOWCASE ─────────
function WorkflowShowcase({ mod }: { mod: (typeof MODULES)[number] }) {
    const nodes = mod.flow;
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Inside the workflow
                </p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Visual logic. No black boxes.
                </h2>
                <div
                    className="relative mt-12 overflow-hidden rounded-3xl border bg-white p-8 md:p-12"
                    style={{ borderColor: `${mod.muted}33` }}
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{
                            backgroundImage: `radial-gradient(${mod.muted}55 1px, transparent 1px)`,
                            backgroundSize: '22px 22px',
                        }}
                    />
                    <div className="relative grid grid-cols-1 gap-4 md:grid-cols-5">
                        {nodes.map((n, i) => (
                            <m.div
                                key={n}
                                initial={{ opacity: 0, scale: 0.94 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.06 }}
                                className="relative rounded-2xl border border-zoru-line bg-white p-5 shadow-sm"
                            >
                                <div
                                    className={`grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}
                                >
                                    <span className="text-[12px] font-bold text-white">{i + 1}</span>
                                </div>
                                <p className="mt-3 text-base font-semibold text-zoru-ink">{n}</p>
                                <p className="mt-1.5 text-[12px] text-zoru-ink">Runs in &lt;200ms · Idempotent · Logged</p>
                            </m.div>
                        ))}
                    </div>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[
                        { icon: GitBranch, title: 'Versioned', desc: 'Every change is a commit you can diff and roll back.' },
                        { icon: Zap, title: 'Replayable', desc: 'Pin a run, replay it on new data, debug like a time-traveller.' },
                        { icon: Layers, title: 'Composable', desc: 'Sub-workflows, shared steps, and team-wide templates.' },
                    ].map((c, i) => {
                        const CIcon = c.icon;
                        return (
                            <m.div
                                key={c.title}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-2xl border border-zoru-line bg-white p-5"
                            >
                                <CIcon className="h-5 w-5" style={{ color: mod.accentDeep }} />
                                <h4 className="mt-3 text-base font-semibold text-zoru-ink">{c.title}</h4>
                                <p className="mt-1.5 text-[13px] text-zoru-ink">{c.desc}</p>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── COMPARISON ─────────
function ComparisonSection({ mod }: { mod: (typeof MODULES)[number] }) {
    const rows = [
        { label: 'Setup time', us: 'Under 1 day', them: '2–6 weeks' },
        { label: 'Per-seat pricing', us: 'No — flat by usage', them: 'Yes, painful' },
        { label: 'Cross-module data', us: 'One shared customer', them: 'Manual sync' },
        { label: 'API + Webhooks', us: 'First-class, signed', them: 'Add-on or limited' },
        { label: 'AI helpers', us: 'Built-in everywhere', them: 'Sparkle buttons' },
        { label: 'India compliance', us: 'GST + DLT + DPDP', them: 'Partial' },
        { label: 'Migration help', us: 'Free, white-glove', them: 'Pay separately' },
    ];
    return (
        <section className="relative bg-white px-6 py-24">
            <div className="mx-auto max-w-6xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Honest comparison
                </p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    {mod.name} vs the tool you&apos;re paying for right now.
                </h2>
                <div className="mt-10 overflow-hidden rounded-3xl border border-zoru-line">
                    <div className="grid grid-cols-3 border-b border-zoru-line bg-zoru-surface-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-zoru-ink">
                        <div></div>
                        <div className="text-zoru-ink">SabNode · {mod.name}</div>
                        <div>The legacy tool</div>
                    </div>
                    {rows.map((r, i) => (
                        <m.div
                            key={r.label}
                            initial={{ opacity: 0, x: -4 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.03 }}
                            className="grid grid-cols-3 items-center border-b border-zoru-line px-5 py-4 text-[14px] last:border-0"
                        >
                            <div className="font-semibold text-zoru-ink">{r.label}</div>
                            <div className="flex items-center gap-2 text-zoru-ink">
                                <Check className="h-4 w-4" style={{ color: mod.accentDeep }} />
                                {r.us}
                            </div>
                            <div className="text-zoru-ink">{r.them}</div>
                        </m.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ───────── SECURITY BAR ─────────
function SecurityBar({ mod }: { mod: (typeof MODULES)[number] }) {
    const items = [
        { icon: Shield, title: 'SOC 2 + ISO 27001', desc: 'Annual audits, full report available under NDA.' },
        { icon: Lock, title: 'Encryption everywhere', desc: 'AES-256 at rest, TLS 1.3 in transit, BYO-KMS available.' },
        { icon: Globe2, title: 'Region pinning', desc: 'Choose IN / EU / US — data never leaves the region.' },
        { icon: Database, title: 'Backups + retention', desc: 'Daily snapshots, configurable retention, point-in-time restore.' },
        { icon: Webhook, title: 'Signed webhooks', desc: 'HMAC + timestamp, replay protection, audit log per event.' },
        { icon: BarChart3, title: 'Audit log', desc: 'Every important action is signed, searchable and exportable.' },
    ];
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Security &amp; trust
                </p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Enterprise-ready from day one.
                </h2>
                <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((s, i) => {
                        const SIcon = s.icon;
                        return (
                            <m.div
                                key={s.title}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-start gap-3 rounded-2xl border border-zoru-line bg-white p-5"
                            >
                                <div
                                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}
                                >
                                    <SIcon className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-base font-semibold text-zoru-ink">{s.title}</h4>
                                    <p className="mt-1 text-[13px] leading-relaxed text-zoru-ink">{s.desc}</p>
                                </div>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── PRICING HINT ─────────
function PricingHint({ mod, session }: { mod: (typeof MODULES)[number]; session?: { user?: unknown } | null }) {
    const tiers = [
        { name: 'Starter', price: 'Free', features: ['Up to 2 users', 'Core features', 'Community support'], cta: 'Start free' },
        { name: 'Growth', price: '₹2,499/mo', features: ['Up to 10 users', 'All features', 'Priority support', 'Audit log'], cta: 'Start trial', popular: true },
        { name: 'Scale', price: 'Talk to us', features: ['Unlimited users', 'Region pinning', 'SSO + SCIM', 'Dedicated support'], cta: 'Book a call' },
    ];
    return (
        <section id="pricing" className="relative bg-white px-6 py-24">
            <div className="mx-auto max-w-6xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Plans
                </p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Honest pricing. No surprises.
                </h2>
                <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
                    {tiers.map((t, i) => (
                        <m.div
                            key={t.name}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className={`relative flex flex-col rounded-3xl border bg-white p-6 ${
                                t.popular ? 'border-zoru-line shadow-[0_24px_60px_-30px_rgba(0,0,0,0.3)]' : 'border-zoru-line'
                            }`}
                        >
                            {t.popular && (
                                <span
                                    className={`absolute -top-3 left-6 rounded-full bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo} px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-md`}
                                >
                                    Most popular
                                </span>
                            )}
                            <h3 className="text-lg font-semibold text-zoru-ink">{t.name}</h3>
                            <p className="mt-2 text-3xl font-semibold tracking-tight text-zoru-ink">{t.price}</p>
                            <ul className="mt-6 space-y-2">
                                {t.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-[14px] text-zoru-ink">
                                        <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: mod.accentDeep }} />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href={session?.user ? mod.productHref : '/login?signup=1'}
                                className={`mt-8 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                                    t.popular
                                        ? 'bg-zoru-ink text-white hover:bg-zoru-ink'
                                        : 'border border-zoru-line text-zoru-ink hover:border-zoru-line'
                                }`}
                            >
                                {t.cta} <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </m.div>
                    ))}
                </div>
                <p className="mt-6 text-center text-sm text-zoru-ink">
                    All plans include the full {mod.name} feature set. You only pay for scale, not features.
                </p>
            </div>
        </section>
    );
}

// ───────── TESTIMONIAL ─────────
function Testimonial({ mod }: { mod: (typeof MODULES)[number] }) {
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-5xl">
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative overflow-hidden rounded-3xl border border-zoru-line bg-white p-10 md:p-14"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full blur-3xl"
                        style={{ background: mod.glow, opacity: 0.6 }}
                    />
                    <Quote className="relative h-8 w-8" style={{ color: mod.accentDeep }} />
                    <p className="relative mt-5 text-balance text-2xl font-medium leading-relaxed text-zoru-ink md:text-3xl">
                        “We swapped out three vendors for {mod.name}. The first week we shipped two campaigns
                        without writing a JIRA. By month two our team stopped asking for new tools.”
                    </p>
                    <div className="relative mt-7 flex items-center gap-4">
                        <div className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-base font-semibold text-white`}>
                            A
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-zoru-ink">Aanya Mehra</p>
                            <p className="text-[13px] text-zoru-ink">Head of Growth · D2C unicorn</p>
                        </div>
                    </div>
                </m.div>
            </div>
        </section>
    );
}

// ───────── FAQ ─────────
function FaqSection({ mod }: { mod: (typeof MODULES)[number] }) {
    const items = [
        { q: `How long does it take to set up ${mod.name}?`, a: `Most teams are live the same day. The flagship modules ship with a guided 5-step setup and we offer free migration help to import data from your old tool.` },
        { q: `Does ${mod.name} work alone or do I need the rest of SabNode?`, a: `It works completely on its own. But the moment you flip another module on, the data starts sharing — same customer, same inbox, same reports.` },
        { q: `Can I bring my own data warehouse?`, a: `Yes. Every event ${mod.name} produces can be streamed to BigQuery, Snowflake, Postgres, or any S3-compatible store via signed webhooks.` },
        { q: `What about pricing as we scale?`, a: `Usage-based, not per-seat. Add as many users as you like — you only pay when the work actually grows. Talk to us for volume.` },
        { q: `Do you handle India-specific compliance?`, a: `GST, DLT (for SMS), DPDP, and signed e-invoices are all native. Region pinning is available on the Scale plan.` },
        { q: `What if I outgrow ${mod.name}?`, a: `Every record is exportable to CSV / Parquet / signed Postgres dump, with no lock-in. You came with your data, you leave with your data.` },
    ];
    const [open, setOpen] = useState<number | null>(0);
    return (
        <section className="relative bg-white px-6 py-24">
            <div className="mx-auto max-w-4xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Frequently asked
                </p>
                <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Questions you&apos;d want answered.
                </h2>
                <div className="mt-10 divide-y divide-zoru-line border-y border-zoru-line">
                    {items.map((it, i) => {
                        const isOpen = open === i;
                        return (
                            <div key={it.q}>
                                <button
                                    onClick={() => setOpen(isOpen ? null : i)}
                                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                                >
                                    <span className="text-lg font-semibold text-zoru-ink">{it.q}</span>
                                    <ChevronDown
                                        className={`h-5 w-5 shrink-0 text-zoru-ink-muted transition ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                <m.div
                                    initial={false}
                                    animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <p className="pb-5 text-[15px] leading-relaxed text-zoru-ink">{it.a}</p>
                                </m.div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── RELATED MODULES ─────────
function RelatedModules({ others }: { others: (typeof MODULES)[number][] }) {
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Better together
                </p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Pair with the rest of SabNode.
                </h2>
                <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {others.map((o, i) => {
                        const OIcon = o.icon;
                        return (
                            <m.div
                                key={o.slug}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                            >
                                <Link
                                    href={o.href}
                                    className="group block rounded-2xl border border-zoru-line bg-white p-5 transition hover:-translate-y-1 hover:border-zoru-line"
                                >
                                    <div
                                        className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${o.accentFrom} ${o.accentTo} shadow-md`}
                                    >
                                        <OIcon className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="mt-4 flex items-center gap-1.5">
                                        <h4 className="text-base font-semibold text-zoru-ink">{o.name}</h4>
                                        <ArrowUpRight className="h-3.5 w-3.5 text-zoru-ink-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                                    </div>
                                    <p className="mt-1 text-[12px] text-zoru-ink">{o.tag}</p>
                                </Link>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── FINAL CTA ─────────
function FinalCta({ mod, session }: { mod: (typeof MODULES)[number]; session?: { user?: unknown } | null }) {
    return (
        <section className="relative px-6 py-32">
            <div className="mx-auto max-w-4xl text-center">
                <m.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-lg`}
                    style={{ boxShadow: `0 18px 50px -12px ${mod.glow}` }}
                >
                    <mod.icon className="h-8 w-8 text-white" />
                </m.div>
                <m.h2
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-7 text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-6xl"
                >
                    Ready to flip {mod.name} on?
                </m.h2>
                <p className="mt-5 text-lg text-zoru-ink">
                    14 days free. No card. Migration help included.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        href={session?.user ? mod.productHref : '/login?signup=1'}
                        className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo} px-6 py-3 text-base font-semibold text-white shadow-lg`}
                        style={{ boxShadow: `0 16px 38px -10px ${mod.glow}` }}
                    >
                        {session?.user ? `Open ${mod.name}` : 'Start free'}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                        href="/contact"
                        className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-white px-6 py-3 text-base font-semibold text-zoru-ink hover:border-zoru-line"
                    >
                        Talk to sales
                    </Link>
                </div>
                <p className="mt-6 text-sm text-zoru-ink">
                    Or join 12,000+ teams already shipping faster with SabNode.
                </p>
            </div>
        </section>
    );
}
