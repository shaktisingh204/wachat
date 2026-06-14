import {
    Activity,
    BarChart3,
    Bot,
    Briefcase,
    BriefcaseBusiness,
    Bug,
    Building2,
    Calendar,
    ClipboardList,
    CreditCard,
    DollarSign,
    Eye,
    FileSignature,
    FileSpreadsheet,
    FileText,
    Files,
    Filter,
    Gauge,
    GitBranch,
    Globe2,
    GraduationCap,
    Inbox,
    Instagram,
    Key,
    Layers,
    LayoutTemplate,
    Link as LinkIcon,
    Mail,
    Megaphone,
    MessageCircle,
    MessageSquare,
    Network,
    Phone,
    PieChart,
    Presentation,
    QrCode,
    Receipt,
    Send,
    Share2,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    Sparkles,
    Star,
    Table2,
    Target,
    Ticket,
    TrendingUp,
    UserCheck,
    Users,
    Video,
    Wallet,
    Webhook,
    Workflow,
    Wrench,
    Zap,
    type LucideIcon,
} from 'lucide-react';

const ShieldlessLock = ShieldCheck;

export type ModuleSlug =
    | 'wachat'
    | 'sabflow'
    | 'sabchat'
    | 'crm'
    | 'seo'
    | 'hrm'
    | 'sabmail'
    | 'telegram'
    | 'instagram'
    | 'meta-suite'
    | 'ad-manager'
    | 'sabsms'
    | 'sabcall'
    | 'sabmeet'
    | 'sabwebinar'
    | 'sabshow'
    | 'sabdesk'
    | 'sabrequests'
    | 'sabpublish'
    | 'sabcreator'
    | 'sabcatalyst'
    | 'sabshop'
    | 'sabcheckout'
    | 'sabworkerly'
    | 'sabpractice'
    | 'sablens'
    | 'sabsense'
    | 'sabbi'
    | 'sabbigin'
    | 'sabmonitor'
    | 'sabops'
    | 'sabbugs'
    | 'sabsprints'
    | 'sabfiles'
    | 'sabsign'
    | 'sabsheet'
    | 'sabtables'
    | 'sabprep'
    | 'website-builder'
    | 'url-shortener'
    | 'qr-code-maker';

export type ModuleCategory =
    | 'Conversation'
    | 'Marketing'
    | 'Sales & Commerce'
    | 'Customer Success'
    | 'People & Operations'
    | 'Productivity'
    | 'Engineering'
    | 'Analytics & AI'
    | 'Files & Documents'
    | 'Acquisition';

export interface ModuleFeature {
    title: string;
    desc: string;
    icon: LucideIcon;
}

export interface ModuleDef {
    slug: ModuleSlug;
    name: string;
    tag: string;
    short: string;
    desc: string;
    href: string;
    productHref: string;
    icon: LucideIcon;
    category: ModuleCategory;
    accent: string;
    accentFrom: string;
    accentTo: string;
    accentDeep: string; // readable solid color for accent text on white
    bg: string;
    glow: string;
    surface: string;
    text: string;
    muted: string;
    grid: string;
    flagship?: boolean;
    stats: { value: string; label: string }[];
    features: ModuleFeature[];
    flow: string[];
}

type Theme = Pick<ModuleDef, 'bg' | 'glow' | 'surface' | 'text' | 'muted' | 'grid' | 'accentFrom' | 'accentTo' | 'accent' | 'accentDeep'>;

const themes: Record<string, Theme> = {
    emerald: { accent: 'emerald', accentFrom: 'from-emerald-400', accentTo: 'to-teal-500', accentDeep: '#047857', bg: '#02110d', glow: 'rgba(16,185,129,0.35)', surface: 'rgba(16,185,129,0.08)', text: '#ecfdf5', muted: '#6ee7b7', grid: 'rgba(16,185,129,0.10)' },
    violet: { accent: 'violet', accentFrom: 'from-violet-400', accentTo: 'to-fuchsia-500', accentDeep: '#6d28d9', bg: '#0c0617', glow: 'rgba(168,85,247,0.35)', surface: 'rgba(168,85,247,0.08)', text: '#f5f3ff', muted: '#c4b5fd', grid: 'rgba(168,85,247,0.10)' },
    amber: { accent: 'amber', accentFrom: 'from-amber-400', accentTo: 'to-orange-500', accentDeep: '#b45309', bg: '#150a02', glow: 'rgba(251,146,60,0.35)', surface: 'rgba(251,146,60,0.08)', text: '#fff7ed', muted: '#fdba74', grid: 'rgba(251,146,60,0.10)' },
    sky: { accent: 'sky', accentFrom: 'from-sky-400', accentTo: 'to-indigo-500', accentDeep: '#0369a1', bg: '#020817', glow: 'rgba(56,189,248,0.35)', surface: 'rgba(56,189,248,0.08)', text: '#eff6ff', muted: '#7dd3fc', grid: 'rgba(56,189,248,0.10)' },
    rose: { accent: 'rose', accentFrom: 'from-rose-400', accentTo: 'to-pink-500', accentDeep: '#be123c', bg: '#170611', glow: 'rgba(244,63,94,0.35)', surface: 'rgba(244,63,94,0.08)', text: '#fff1f2', muted: '#fda4af', grid: 'rgba(244,63,94,0.10)' },
    cyan: { accent: 'cyan', accentFrom: 'from-cyan-400', accentTo: 'to-blue-500', accentDeep: '#0e7490', bg: '#021019', glow: 'rgba(34,211,238,0.35)', surface: 'rgba(34,211,238,0.08)', text: '#ecfeff', muted: '#67e8f9', grid: 'rgba(34,211,238,0.10)' },
    teal: { accent: 'teal', accentFrom: 'from-teal-400', accentTo: 'to-emerald-500', accentDeep: '#0f766e', bg: '#02161a', glow: 'rgba(20,184,166,0.35)', surface: 'rgba(20,184,166,0.08)', text: '#ecfeff', muted: '#5eead4', grid: 'rgba(20,184,166,0.10)' },
    indigo: { accent: 'indigo', accentFrom: 'from-indigo-400', accentTo: 'to-violet-500', accentDeep: '#4338ca', bg: '#0a081f', glow: 'rgba(99,102,241,0.35)', surface: 'rgba(99,102,241,0.08)', text: '#eef2ff', muted: '#a5b4fc', grid: 'rgba(99,102,241,0.10)' },
    fuchsia: { accent: 'fuchsia', accentFrom: 'from-fuchsia-400', accentTo: 'to-pink-500', accentDeep: '#a21caf', bg: '#160620', glow: 'rgba(217,70,239,0.35)', surface: 'rgba(217,70,239,0.08)', text: '#fdf4ff', muted: '#f0abfc', grid: 'rgba(217,70,239,0.10)' },
    blue: { accent: 'blue', accentFrom: 'from-blue-400', accentTo: 'to-indigo-500', accentDeep: '#1d4ed8', bg: '#020a1c', glow: 'rgba(59,130,246,0.35)', surface: 'rgba(59,130,246,0.08)', text: '#eff6ff', muted: '#93c5fd', grid: 'rgba(59,130,246,0.10)' },
    orange: { accent: 'orange', accentFrom: 'from-orange-400', accentTo: 'to-rose-500', accentDeep: '#c2410c', bg: '#1a0a06', glow: 'rgba(249,115,22,0.35)', surface: 'rgba(249,115,22,0.08)', text: '#fff7ed', muted: '#fdba74', grid: 'rgba(249,115,22,0.10)' },
    lime: { accent: 'lime', accentFrom: 'from-lime-400', accentTo: 'to-emerald-500', accentDeep: '#4d7c0f', bg: '#0a1402', glow: 'rgba(132,204,22,0.35)', surface: 'rgba(132,204,22,0.08)', text: '#f7fee7', muted: '#bef264', grid: 'rgba(132,204,22,0.10)' },
    pink: { accent: 'pink', accentFrom: 'from-pink-400', accentTo: 'to-rose-500', accentDeep: '#be185d', bg: '#170614', glow: 'rgba(236,72,153,0.35)', surface: 'rgba(236,72,153,0.08)', text: '#fdf2f8', muted: '#f9a8d4', grid: 'rgba(236,72,153,0.10)' },
    purple: { accent: 'purple', accentFrom: 'from-purple-400', accentTo: 'to-fuchsia-500', accentDeep: '#7e22ce', bg: '#0d0518', glow: 'rgba(147,51,234,0.35)', surface: 'rgba(147,51,234,0.08)', text: '#faf5ff', muted: '#d8b4fe', grid: 'rgba(147,51,234,0.10)' },
    yellow: { accent: 'yellow', accentFrom: 'from-yellow-400', accentTo: 'to-amber-500', accentDeep: '#a16207', bg: '#161002', glow: 'rgba(234,179,8,0.35)', surface: 'rgba(234,179,8,0.08)', text: '#fefce8', muted: '#fde047', grid: 'rgba(234,179,8,0.10)' },
    slate: { accent: 'slate', accentFrom: 'from-slate-400', accentTo: 'to-zinc-500', accentDeep: '#334155', bg: '#0a0b10', glow: 'rgba(148,163,184,0.35)', surface: 'rgba(148,163,184,0.08)', text: '#f8fafc', muted: '#cbd5e1', grid: 'rgba(148,163,184,0.10)' },
};

function build(
    slug: ModuleSlug,
    name: string,
    tag: string,
    short: string,
    desc: string,
    href: string,
    productHref: string,
    icon: LucideIcon,
    category: ModuleCategory,
    themeKey: keyof typeof themes,
    stats: ModuleDef['stats'],
    features: ModuleFeature[],
    flow: string[],
    flagship?: boolean,
): ModuleDef {
    return { slug, name, tag, short, desc, href: `/products/${slug}`, productHref, icon, category, flagship, stats, features, flow, ...themes[themeKey] };
}

export const MODULES: ModuleDef[] = [
    // ──────── CONVERSATION ────────
    build('wachat', 'Wachat', 'WhatsApp Business at scale', 'Run your entire WhatsApp number on autopilot.',
        'Templates, broadcasts, chatbot, catalog, payments — official WABA without the boring parts.',
        '/products/wachat', '/dashboard/wachat', MessageSquare, 'Conversation', 'emerald',
        [{ value: '99.9%', label: 'WABA delivery' }, { value: '<2s', label: 'Reply latency' }, { value: '40M+', label: 'Msgs / month' }, { value: '12', label: 'Languages' }],
        [
            { title: 'Template studio', desc: 'Submit, version, roll out WABA templates from a real editor — buttons, media, dynamic vars.', icon: FileText },
            { title: 'Broadcast engine', desc: 'Segment audiences, throttle sends, retry failed — keep your quality rating green.', icon: Send },
            { title: 'Visual chatbot', desc: 'Drag-drop flows, conditions, AI fallbacks, human hand-off in one click.', icon: Bot },
            { title: 'Catalog & payments', desc: 'Sell inside chat — Razorpay, Stripe, COD. Orders sync to CRM.', icon: ShoppingCart },
            { title: 'Smart routing', desc: 'Round-robin, skills, language — right agent in <200ms.', icon: GitBranch },
            { title: 'Quality watchdog', desc: 'Auto-pauses risky campaigns when your number drops a tier.', icon: Target },
        ], ['Connect number', 'Pick template', 'Launch campaign', 'Auto-reply', 'Convert + report'], true),

    build('sabchat', 'SabChat', 'Omnichannel inbox', 'Every message your business gets — in one window.',
        'Live chat, email, WhatsApp, Instagram, Telegram, SMS, Messenger. One queue, one routing brain.',
        '/products/sabchat', '/dashboard/sabchat', Inbox, 'Conversation', 'amber',
        [{ value: '8', label: 'Channels' }, { value: '<30s', label: 'First reply' }, { value: '∞', label: 'Agent seats' }, { value: '24/7', label: 'AI cover' }],
        [
            { title: 'Unified queue', desc: 'Email, chat, social, WA — one merged thread per customer.', icon: Inbox },
            { title: 'Smart auto-routing', desc: 'By language, skill, load, history — or let AI decide.', icon: GitBranch },
            { title: 'Macros & canned', desc: 'Personal + team libraries, variables, AI rewrite.', icon: Zap },
            { title: 'SLA + escalations', desc: 'First-reply, resolution, breach alerts on time.', icon: Target },
            { title: 'CSAT + reports', desc: 'Per-agent, per-channel, per-tag dashboards.', icon: BarChart3 },
            { title: 'AI copilot', desc: 'Drafts, summarises, sentiment tags. Agents type half as much.', icon: Sparkles },
        ], ['Capture', 'Route', 'Assist', 'Resolve', 'Measure'], true),

    build('telegram', 'Telegram', 'Telegram bots + groups', 'Run support and broadcasts on Telegram.',
        'Bots, groups, channels, inline keyboards, payments — same dashboard as Wachat.',
        '/products/telegram', '/dashboard/telegram', Send, 'Conversation', 'cyan',
        [{ value: 'Bots', label: 'Native' }, { value: 'Groups', label: 'Mod' }, { value: 'Inline', label: 'Kbd' }, { value: 'Pay', label: 'Stars' }],
        [
            { title: 'Bot orchestrator', desc: 'Connect bots, route to agents, persist user state.', icon: Bot },
            { title: 'Channels + groups', desc: 'Moderate, schedule posts, pin announcements, anti-spam.', icon: Users },
            { title: 'Inline buttons', desc: 'Rich keyboards, callbacks, deep links to your app.', icon: Layers },
            { title: 'Telegram Pay', desc: 'Stars + provider payments inside chat.', icon: CreditCard },
            { title: 'Broadcast', desc: 'Targeted sends with quiet hours and retries.', icon: Send },
            { title: 'Analytics', desc: 'Open rates, conversion, drop-off per flow.', icon: BarChart3 },
        ], ['Add bot', 'Build flow', 'Broadcast', 'Engage', 'Report']),

    build('instagram', 'Instagram', 'DMs, comments, story replies', 'Run Instagram like a real channel.',
        'Connect IG Business, auto-reply DMs, comment automation, story mentions — synced to CRM.',
        '/products/instagram', '/dashboard/instagram', Instagram, 'Conversation', 'pink',
        [{ value: 'DMs', label: '+ comments' }, { value: 'Story', label: 'Reply' }, { value: 'Meta', label: 'Verified' }, { value: 'CRM', label: 'Synced' }],
        [
            { title: 'DM auto-reply', desc: 'Keyword + AI responses, hand-off to agent on intent.', icon: MessageCircle },
            { title: 'Comment workflows', desc: 'Auto-respond, hide, react. Pull leads from the comments.', icon: Webhook },
            { title: 'Story replies', desc: 'Capture mentions and replies into the same inbox.', icon: Sparkles },
            { title: 'Ad lead sync', desc: 'Instant lead form → CRM with attribution.', icon: Target },
            { title: 'Broadcasts', desc: 'Approved-template DM broadcasts to opted-in audiences.', icon: Send },
            { title: 'Insights', desc: 'Reply rate, follower lift, response time.', icon: BarChart3 },
        ], ['Connect IG', 'Set triggers', 'Auto-reply', 'Score lead', 'Convert']),

    build('meta-suite', 'Meta Suite', 'Facebook + Page management', 'Run pages, inbox and posts across Meta.',
        'Multi-page support, scheduled posts, Messenger inbox, audience insights, Meta Business sync.',
        '/products/meta-suite', '/dashboard/facebook', Network, 'Conversation', 'blue',
        [{ value: 'Pages', label: '∞' }, { value: 'Messenger', label: 'Live' }, { value: 'Schedule', label: 'Posts' }, { value: 'BM', label: 'Linked' }],
        [
            { title: 'Messenger inbox', desc: 'All Meta DMs in one stream, assignable + searchable.', icon: Inbox },
            { title: 'Post scheduling', desc: 'Draft, approve, schedule across pages with previews.', icon: Calendar },
            { title: 'Comment moderation', desc: 'Auto-hide spam, reward fans, route to support.', icon: Filter },
            { title: 'Audience insights', desc: 'Demographics, engagement, growth, by page.', icon: PieChart },
            { title: 'Roles + access', desc: 'Map agents to pages without sharing the Meta account.', icon: UserCheck },
            { title: 'Lead ads sync', desc: 'Pull lead-form submissions instantly.', icon: Target },
        ], ['Connect BM', 'Sync pages', 'Publish', 'Reply', 'Measure']),

    build('sabsms', 'SabSMS', 'Transactional + promotional SMS', 'OTPs and campaigns that always land.',
        'DLT, TRAI, sender IDs, fallback routing, delivery receipts — built for India scale.',
        '/products/sabsms', '/sabsms', MessageSquare, 'Conversation', 'orange',
        [{ value: 'DLT', label: 'Ready' }, { value: 'Fallback', label: 'Multi-route' }, { value: 'OTP', label: 'Sub-sec' }, { value: 'DLR', label: 'Real-time' }],
        [
            { title: 'OTP API', desc: 'Sub-second delivery, retry chain, code verification.', icon: Key },
            { title: 'Promo campaigns', desc: 'DLT-compliant templates, header IDs, scheduled blasts.', icon: Send },
            { title: 'Smart fallback', desc: 'Auto-switch routes on failures, never miss a delivery.', icon: GitBranch },
            { title: 'Inbound SMS', desc: 'Keyword + shortcode replies to your webhook.', icon: Inbox },
            { title: 'Cost reports', desc: 'Per route, per campaign, per project P&L.', icon: DollarSign },
            { title: 'Compliance log', desc: 'Audit consent, opt-outs, header approvals.', icon: ClipboardList },
        ], ['Register DLT', 'Pick route', 'Send', 'Track DLR', 'Settle']),

    build('sabcall', 'SabCall', 'Voice + IVR cloud', 'Calls, IVR, agent dashboards and DIDs.',
        'Inbound DIDs, IVR builder, call recording, AI assist, agent supervisor — full contact center.',
        '/products/sabcall', '/sabcall', Phone, 'Conversation', 'indigo',
        [{ value: 'IVR', label: 'Drag-drop' }, { value: 'Rec', label: 'Compliant' }, { value: 'DID', label: 'Global' }, { value: 'AI', label: 'Assist' }],
        [
            { title: 'Visual IVR', desc: 'Build menus, route by time/skill, conditional branching.', icon: Workflow },
            { title: 'Agent dashboard', desc: 'Hold/transfer/conference, screen pops, dispositions.', icon: Users },
            { title: 'Call recording', desc: 'Encrypted, redacted, retention policies built in.', icon: ShieldlessLock },
            { title: 'AI assist', desc: 'Live transcription, sentiment, next-best-action.', icon: Sparkles },
            { title: 'Supervisor mode', desc: 'Whisper, barge, listen — coach in real time.', icon: UserCheck },
            { title: 'Outbound dialer', desc: 'Preview / progressive / predictive with DNC scrub.', icon: Send },
        ], ['Buy DID', 'Build IVR', 'Route', 'Talk', 'Review']),

    // ──────── MARKETING ────────
    build('sabmail', 'SabMail', 'Transactional + lifecycle email', 'Deliver mail like a sender that actually lands.',
        'SMTP, templates, lifecycle journeys, suppression lists, deliverability tools, sub-account billing.',
        '/products/sabmail', '/dashboard/sabmail', Mail, 'Marketing', 'blue',
        [{ value: '99%', label: 'Inbox rate' }, { value: 'DKIM', label: 'Auto' }, { value: 'Lifecycle', label: 'Built-in' }, { value: 'API', label: 'First class' }],
        [
            { title: 'SMTP + API', desc: 'Drop-in replacement for SendGrid + Mailgun, signed and warmed.', icon: Send },
            { title: 'Template studio', desc: 'MJML, blocks, branding, dynamic vars, A/B subject lines.', icon: FileText },
            { title: 'Lifecycle journeys', desc: 'Multi-step drips, branching, gates, exit conditions.', icon: Workflow },
            { title: 'Deliverability', desc: 'Bounce / spam / unsubscribe handling, IP reputation.', icon: Activity },
            { title: 'Suppression lists', desc: 'Auto-clean, global + project-level, regex match.', icon: Filter },
            { title: 'Inbox preview', desc: 'Render across Gmail, Outlook, Apple Mail before send.', icon: Layers },
        ], ['Verify domain', 'Build template', 'Send', 'Measure', 'Iterate']),

    build('sabpublish', 'SabPublish', 'Social publishing + scheduling', 'Schedule everywhere from one calendar.',
        'Cross-post to WA Status, IG, FB, LinkedIn, X, YT Shorts. Approvals, asset library, time-zone smart.',
        '/products/sabpublish', '/dashboard/sabpublish', Calendar, 'Marketing', 'fuchsia',
        [{ value: '8', label: 'Networks' }, { value: 'Drafts', label: 'Approval' }, { value: 'Bulk', label: 'Upload' }, { value: 'Geo', label: 'Schedule' }],
        [
            { title: 'Calendar view', desc: 'Drag-drop posts across networks, see clashes instantly.', icon: Calendar },
            { title: 'Asset library', desc: 'Brand kit, variants, alt text, auto-resize.', icon: Files },
            { title: 'AI captions', desc: 'Voice-matched captions, hashtag suggestions, translations.', icon: Sparkles },
            { title: 'Approval workflow', desc: 'Roles, comments, version diff before publish.', icon: ClipboardList },
            { title: 'Best-time slots', desc: 'Engagement-aware suggestions per network + audience.', icon: Activity },
            { title: 'Repost queue', desc: 'Evergreen content, randomized cadence, kill switch.', icon: Workflow },
        ], ['Draft', 'Approve', 'Schedule', 'Publish', 'Repurpose']),

    build('sabcreator', 'SabCreator', 'Creator + UGC apps', 'Brand-safe storefront for creators and affiliates.',
        'Mini-apps, affiliate links, payout rails, audience tools — built for the creator economy.',
        '/products/sabcreator', '/dashboard/sabcreator', Sparkles, 'Marketing', 'purple',
        [{ value: 'Mini-apps', label: 'Hosted' }, { value: 'Affiliate', label: 'Native' }, { value: 'Payouts', label: 'Auto' }, { value: 'Audience', label: 'Owned' }],
        [
            { title: 'Mini-apps', desc: 'Publish landing + commerce in a creator-friendly editor.', icon: LayoutTemplate },
            { title: 'Affiliate links', desc: 'Trackable, dedupe-safe, real-time leaderboards.', icon: LinkIcon },
            { title: 'Payouts', desc: 'UPI + bank + wallet, automated weekly disbursal.', icon: Wallet },
            { title: 'Audience opt-in', desc: 'Capture phone + email, broadcast across SabNode.', icon: Users },
            { title: 'Drop campaigns', desc: 'Pre-orders, countdowns, scarcity logic — converts.', icon: Megaphone },
            { title: 'Analytics', desc: 'Per-creator, per-drop, per-channel reporting.', icon: BarChart3 },
        ], ['Onboard creator', 'Build app', 'Drop', 'Sell', 'Payout']),

    build('sabcatalyst', 'SabCatalyst', 'Conversion + growth experiments', 'Run experiments without an engineer.',
        'Feature flags, A/B + multivariate, server-side experimentation, audience targeting, instant rollback.',
        '/products/sabcatalyst', '/dashboard/sabcatalyst', Zap, 'Marketing', 'yellow',
        [{ value: 'Flags', label: 'Realtime' }, { value: 'A/B', label: 'Stat-sig' }, { value: 'MVT', label: 'Native' }, { value: 'Rollback', label: '1-click' }],
        [
            { title: 'Feature flags', desc: 'Boolean, multivariant, gradual rollout, killswitch.', icon: Filter },
            { title: 'A/B + MVT', desc: 'Designed for product + growth, stat-sig built in.', icon: TrendingUp },
            { title: 'Targeting', desc: 'Rules by user, geo, plan, custom traits.', icon: Target },
            { title: 'Server-side', desc: 'SDKs for Node, Go, Python, edge functions.', icon: Webhook },
            { title: 'Audit + diff', desc: 'Every flag change is versioned, diffed, reversible.', icon: ClipboardList },
            { title: 'Result reporting', desc: 'Lift, p-value, segment cuts, exportable.', icon: BarChart3 },
        ], ['Define flag', 'Target audience', 'Roll out', 'Read lift', 'Iterate']),

    build('ad-manager', 'Ad Manager', 'Meta + Google ads, one dashboard', 'Spend, creatives, audiences — one console.',
        'Multi-account bidding, creative library, audiences sync from CRM, conversion API, rule-based pausing.',
        '/products/ad-manager', '/dashboard/ad-manager', Target, 'Marketing', 'orange',
        [{ value: 'Meta', label: 'Native' }, { value: 'Google', label: 'Linked' }, { value: 'Rules', label: 'Auto' }, { value: 'CAPI', label: 'Built-in' }],
        [
            { title: 'Multi-account', desc: 'Manage Meta + Google ad accounts from one switcher.', icon: Layers },
            { title: 'Creative library', desc: 'Versioned creatives, naming rules, performance trace.', icon: Files },
            { title: 'Audience sync', desc: 'CRM segments → Custom Audiences in real time.', icon: Users },
            { title: 'Conversion API', desc: 'Server-side events with deduplication.', icon: Webhook },
            { title: 'Rule engine', desc: 'Pause on ROAS dip, scale on CTR lift, dayparting.', icon: Workflow },
            { title: 'P&L reports', desc: 'Spend, CAC, ROAS by campaign, channel, geo.', icon: BarChart3 },
        ], ['Connect ads', 'Sync audiences', 'Launch', 'Optimise', 'Report']),

    // ──────── SALES & COMMERCE ────────
    build('crm', 'CRM', 'Sales + ops in one stack', 'Pipelines. Invoices. Inventory. Bookings. Loyalty.',
        'Replaces HubSpot + Zoho + QuickBooks + Calendly + Loyalzoo, with one shared customer.',
        '/products/crm', '/sabcrm', Users, 'Sales & Commerce', 'sky',
        [{ value: '6', label: 'Tools replaced' }, { value: '∞', label: 'Custom fields' }, { value: 'GST', label: 'Compliant' }, { value: 'API', label: 'First class' }],
        [
            { title: 'Pipelines + deals', desc: 'Drag stages, weighted forecasts, win/loss reasons.', icon: TrendingUp },
            { title: 'Quotes → invoices', desc: 'PDFs, GST, tax slabs, payment links, dunning.', icon: FileText },
            { title: 'Inventory + POs', desc: 'Stock per warehouse, low-stock alerts, batch tracking.', icon: ShoppingCart },
            { title: 'Bookings + calendars', desc: 'Reservable resources, deposits, WA + email reminders.', icon: Calendar },
            { title: 'Loyalty + wallets', desc: 'Points, tiers, referrals, store credit.', icon: Wallet },
            { title: 'Accounting', desc: 'Ledgers, journals, P&L, balance sheet, tax filings.', icon: CreditCard },
        ], ['Lead', 'Deal', 'Quote', 'Invoice', 'Loyal customer'], true),

    build('sabshop', 'SabShop', 'Storefronts that ship in minutes', 'No-code D2C storefront with inventory + payments.',
        'Brandable storefronts, product catalog, checkout, COD, RTO logic, courier rates — all included.',
        '/products/sabshop', '/dashboard/sabshop', ShoppingBag, 'Sales & Commerce', 'rose',
        [{ value: 'Themes', label: 'Brand-ready' }, { value: 'COD', label: 'Smart' }, { value: 'Couriers', label: 'Live rates' }, { value: 'RTO', label: 'Auto risk' }],
        [
            { title: 'Storefront themes', desc: 'Mobile-first, conversion-tested, brand-tweakable.', icon: LayoutTemplate },
            { title: 'Catalog + variants', desc: 'Bulk import, options, bundles, multi-warehouse stock.', icon: ShoppingCart },
            { title: 'Checkout', desc: 'UPI, cards, COD, EMI, partial paid, abandoned recovery.', icon: CreditCard },
            { title: 'Shipping', desc: 'Live courier rates, label print, NDR follow-up flows.', icon: Send },
            { title: 'RTO shield', desc: 'AI risk score on COD, automatic verification calls.', icon: Activity },
            { title: 'Storewide upsell', desc: 'Cart + thank-you offers, post-purchase flows.', icon: TrendingUp },
        ], ['Set up store', 'Add catalog', 'Launch', 'Sell', 'Fulfil']),

    build('sabcheckout', 'SabCheckout', 'Hosted checkout + subscriptions', 'A checkout that just works — anywhere.',
        'Hosted pages, subscriptions, billing portal, dunning, tax + GST — drop on any landing page.',
        '/products/sabcheckout', '/dashboard/sabcheckout', CreditCard, 'Sales & Commerce', 'indigo',
        [{ value: 'Hosted', label: 'Pages' }, { value: 'Subs', label: 'Native' }, { value: 'Dunning', label: 'Smart' }, { value: 'Tax', label: 'Auto' }],
        [
            { title: 'Checkout pages', desc: 'Brandable, optimised, prefill from CRM, tested at scale.', icon: LayoutTemplate },
            { title: 'Subscriptions', desc: 'Trials, proration, pauses, dunning emails, retries.', icon: Calendar },
            { title: 'Customer portal', desc: 'Self-serve invoices, swap card, cancel reasons.', icon: Users },
            { title: 'Coupons', desc: 'Codes, fixed/percent, stackable, geo limits, audit log.', icon: Ticket },
            { title: 'Tax + GST', desc: 'GSTIN capture, jurisdiction logic, signed invoices.', icon: Receipt },
            { title: 'Webhooks', desc: 'Every event to your stack — idempotent, signed.', icon: Webhook },
        ], ['Build page', 'Capture lead', 'Charge', 'Renew', 'Recover']),

    // ──────── CUSTOMER SUCCESS ────────
    build('sabdesk', 'SabDesk', 'Helpdesk + knowledge base', 'Tickets, SLAs, agent groups, help portal.',
        'Multi-channel tickets, SLA timers, public help portal, agent collision, AI deflection.',
        '/products/sabdesk', '/dashboard/sabdesk', Ticket, 'Customer Success', 'sky',
        [{ value: 'SLA', label: 'Live timer' }, { value: 'KB', label: 'Hosted' }, { value: 'AI', label: 'Deflection' }, { value: 'Forms', label: 'Custom' }],
        [
            { title: 'Multi-channel tickets', desc: 'Email, WA, chat, IG, FB — unified ticket per customer.', icon: Inbox },
            { title: 'SLA + escalations', desc: 'First-response, resolution, holiday calendars, alerts.', icon: Target },
            { title: 'Knowledge base', desc: 'Public portal, draft + publish, AI-suggested articles.', icon: FileText },
            { title: 'Agent collision', desc: 'See typing, lock tickets, conflict-free assignment.', icon: UserCheck },
            { title: 'Custom forms', desc: 'Capture exactly what you need at ticket creation.', icon: ClipboardList },
            { title: 'CSAT + reports', desc: 'Per-agent, per-channel, per-tag dashboards.', icon: BarChart3 },
        ], ['Capture', 'Triage', 'Resolve', 'Deflect with KB', 'Survey']),

    build('sabrequests', 'SabRequests', 'Internal request portal', 'IT, HR, finance — one ask, one queue.',
        'Self-service catalog, blueprints, approval chains, SLA, integrations with other modules.',
        '/products/sabrequests', '/dashboard/sabrequests', ClipboardList, 'Customer Success', 'cyan',
        [{ value: 'Blueprints', label: 'Reusable' }, { value: 'Approvals', label: 'Multi-step' }, { value: 'SLA', label: 'Per dept' }, { value: 'API', label: 'Open' }],
        [
            { title: 'Request catalog', desc: 'Pre-built forms for IT, HR, ops — clone and tweak.', icon: Layers },
            { title: 'Blueprints', desc: 'Visual workflow builder, branching, parallel paths.', icon: Workflow },
            { title: 'Approval chains', desc: 'Role / manager / value-based, with mobile approvals.', icon: UserCheck },
            { title: 'SLA timers', desc: 'Per-department, with reassign + escalate triggers.', icon: Activity },
            { title: 'Integrations', desc: 'Trigger HRM payroll, vault provision, finance posting.', icon: Webhook },
            { title: 'Analytics', desc: 'Backlog, throughput, SLA breach, by team.', icon: BarChart3 },
        ], ['Submit', 'Approve', 'Execute', 'SLA', 'Audit']),

    // ──────── PEOPLE & OPERATIONS ────────
    build('hrm', 'HRM', 'People + payroll', 'Run your team like a product — with metrics and motion.',
        'Roster, shifts, attendance, leaves, payroll, performance, roadmaps. Self-service portal included.',
        '/products/hrm', '/dashboard/hrm', Briefcase, 'People & Operations', 'cyan',
        [{ value: '1-click', label: 'Payroll' }, { value: 'Geo', label: 'Attendance' }, { value: '360°', label: 'Reviews' }, { value: 'Self-svc', label: 'Portal' }],
        [
            { title: 'Shift roster', desc: 'Drag-drop weekly grid, swap requests, multi-location.', icon: Calendar },
            { title: 'Geo attendance', desc: 'Face + GPS punch, IP-fence, manual reconcile.', icon: UserCheck },
            { title: 'Leaves + holidays', desc: 'Per-policy accrual, balance projection, approvals.', icon: Ticket },
            { title: 'Payroll engine', desc: 'CTC → in-hand, PT, PF, ESI, TDS — payslips signed.', icon: Wallet },
            { title: 'Roadmaps + reviews', desc: 'Quarterly roadmaps, OKRs, 360° reviews, calibration.', icon: TrendingUp },
            { title: 'Employee portal', desc: 'Tasks, payslips, leaves, docs, support.', icon: Users },
        ], ['Onboard', 'Roster', 'Punch', 'Review', 'Pay'], true),

    build('sabops', 'SabOps', 'Operations control tower', 'See the org run, in real time.',
        'Live ops dashboard, on-call rotations, runbooks, incident drills — the operations layer.',
        '/products/sabops', '/dashboard/sabops', Building2, 'People & Operations', 'slate',
        [{ value: 'Live', label: 'Ops feed' }, { value: 'On-call', label: 'Rotations' }, { value: 'Runbooks', label: 'Versioned' }, { value: 'Drills', label: 'Game-day' }],
        [
            { title: 'Live feed', desc: 'Every important event — sales, ops, support — streamed.', icon: Activity },
            { title: 'On-call rotations', desc: 'Schedules, overrides, escalation, smart hand-off.', icon: Users },
            { title: 'Runbooks', desc: 'Versioned, role-gated, with one-click action buttons.', icon: FileText },
            { title: 'Incident drills', desc: 'Game-day scheduling with after-action reports.', icon: Wrench },
            { title: 'Dashboards', desc: 'Composable tiles from any module — wall-display ready.', icon: BarChart3 },
            { title: 'Alerts', desc: 'Multi-channel paging with mute windows and rules.', icon: Megaphone },
        ], ['Detect', 'Alert', 'Page', 'Resolve', 'Review']),

    build('sabworkerly', 'SabWorkerly', 'Field + freelancer ops', 'Jobs, freelancers, invoices — all tracked.',
        'Job dispatch, freelancer roster, milestone payments, e-signed agreements, time logs.',
        '/products/sabworkerly', '/dashboard/sabworkerly', Wrench, 'People & Operations', 'orange',
        [{ value: 'Jobs', label: 'Dispatch' }, { value: 'Milestones', label: 'Payouts' }, { value: 'Time', label: 'Logged' }, { value: 'e-Sign', label: 'Native' }],
        [
            { title: 'Job dispatch', desc: 'Auto-route by skill, distance, rating; mobile claim.', icon: Send },
            { title: 'Freelancer roster', desc: 'Verified profiles, ratings, KYC, tax docs on file.', icon: Users },
            { title: 'Milestone payouts', desc: 'Lock funds, release on approval, dispute escrow.', icon: Wallet },
            { title: 'Time logs', desc: 'Auto + manual, geofence verify, billable rules.', icon: Activity },
            { title: 'Agreements', desc: 'e-Signed, audit-trail, country-specific tax handling.', icon: FileSignature },
            { title: 'Client portal', desc: 'Approve, comment, pay — without learning a new tool.', icon: LayoutTemplate },
        ], ['Hire', 'Dispatch', 'Track', 'Pay', 'Rate']),

    build('sabpractice', 'SabPractice', 'Pro-services PSA', 'For agencies, firms, consultancies.',
        'Clients, engagements, deadlines, document requests, time + billing — the practice OS.',
        '/products/sabpractice', '/dashboard/sabpractice', BriefcaseBusiness, 'People & Operations', 'teal',
        [{ value: 'Clients', label: 'Portal' }, { value: 'Engage', label: 'Tracked' }, { value: 'Docs', label: 'Requested' }, { value: 'Bill', label: 'Auto' }],
        [
            { title: 'Engagements', desc: 'Scope, milestones, recurring retainers, status board.', icon: ClipboardList },
            { title: 'Document requests', desc: 'Send checklist, upload portal, reminders, audit log.', icon: Files },
            { title: 'Deadlines', desc: 'Government / compliance deadlines, escalation alerts.', icon: Calendar },
            { title: 'Time + bill', desc: 'Stopwatch, manual entries, retainer burn-down, auto-invoice.', icon: DollarSign },
            { title: 'Client portal', desc: 'Status, docs, invoices, messages, audit-friendly.', icon: LayoutTemplate },
            { title: 'Reports', desc: 'Utilisation, WIP, realisation, gross margin.', icon: BarChart3 },
        ], ['Engage', 'Request docs', 'Deliver', 'Bill', 'Report']),

    // ──────── PRODUCTIVITY ────────
    build('sabmeet', 'SabMeet', 'Video meetings + rooms', 'Branded video meetings with recording + transcripts.',
        'Persistent rooms, recordings, AI transcripts + summaries, breakout, embed in your app.',
        '/products/sabmeet', '/dashboard/sabmeet', Video, 'Productivity', 'blue',
        [{ value: 'Rooms', label: 'Persistent' }, { value: 'Rec', label: 'HD' }, { value: 'Transcript', label: 'AI' }, { value: 'Embed', label: 'SDK' }],
        [
            { title: 'Persistent rooms', desc: 'Branded URLs, shared whiteboard, pinned notes.', icon: LayoutTemplate },
            { title: 'Recording', desc: 'HD video, cloud storage, retention policy, sharing.', icon: Video },
            { title: 'AI transcripts', desc: 'Speaker-tagged, searchable, with action-item extraction.', icon: Sparkles },
            { title: 'Breakouts', desc: 'Pre-assign or random, with mass-recall and timer.', icon: Users },
            { title: 'Webhooks', desc: 'Join / leave / recording events to your stack.', icon: Webhook },
            { title: 'Embed', desc: 'Drop into your SaaS via SDK with theme tokens.', icon: Layers },
        ], ['Schedule', 'Meet', 'Record', 'Summarise', 'Share']),

    build('sabwebinar', 'SabWebinar', 'Webinars + livestream', 'Studio-grade webinars + automated funnels.',
        'Live + simulive, custom landing, registration flows, post-event drips, replay gating.',
        '/products/sabwebinar', '/dashboard/sabwebinar', Presentation, 'Productivity', 'fuchsia',
        [{ value: 'Live', label: '+ simulive' }, { value: 'Reg', label: 'Pages' }, { value: 'Replay', label: 'Gated' }, { value: 'CRM', label: 'Sync' }],
        [
            { title: 'Studio mode', desc: 'Multi-camera, lower-thirds, polls, Q&A, chat.', icon: Video },
            { title: 'Registration', desc: 'Branded pages, calendar holds, reminders by WA + email.', icon: Calendar },
            { title: 'Simulive', desc: 'Pre-recorded with live chat presence + faux scarcity.', icon: Activity },
            { title: 'Replay gating', desc: 'Send recording with offer windows + tracking.', icon: ShoppingCart },
            { title: 'CRM sync', desc: 'Attendees + segments synced for follow-ups.', icon: Users },
            { title: 'Analytics', desc: 'Attendance, drop-off, engagement, revenue attributed.', icon: BarChart3 },
        ], ['Plan', 'Promote', 'Host', 'Replay', 'Convert']),

    build('sabshow', 'SabShow', 'Decks + interactive presentations', 'Pitch like a product team — versioned.',
        'Slide editor with components, audience polls, shared notes, real-time present mode, export.',
        '/products/sabshow', '/dashboard/sabshow', Presentation, 'Productivity', 'purple',
        [{ value: 'Decks', label: 'Versioned' }, { value: 'Polls', label: 'Live' }, { value: 'Export', label: 'PDF + PPT' }, { value: 'Embed', label: 'iframe' }],
        [
            { title: 'Component slides', desc: 'Reusable blocks, design system, brand-tokens.', icon: LayoutTemplate },
            { title: 'Audience polls', desc: 'Live polling, quizzes, Q&A queue with upvote.', icon: Activity },
            { title: 'Versioning', desc: 'Branch decks, compare diffs, revert in a click.', icon: GitBranch },
            { title: 'Co-edit', desc: 'Real-time editing with cursors, comments, suggestions.', icon: Users },
            { title: 'Export', desc: 'PDF, PPTX, MP4 walkthroughs, share links.', icon: FileText },
            { title: 'Embed', desc: 'Embed live decks on your site with passcodes.', icon: Layers },
        ], ['Draft', 'Co-edit', 'Present', 'Engage', 'Export']),

    // ──────── ENGINEERING ────────
    build('sabflow', 'SabFlow', 'Visual automation', '900+ apps. Drag-drop logic. No engineers required.',
        'Zapier energy, n8n flexibility — branching, schedules, AI nodes, paired item tracking, sub-flows.',
        '/products/sabflow', '/dashboard/sabflow', Workflow, 'Engineering', 'violet',
        [{ value: '900+', label: 'Integrations' }, { value: '50k', label: 'Runs / sec' }, { value: '0ms', label: 'Cold start' }, { value: '120+', label: 'Built-in nodes' }],
        [
            { title: 'Expression engine', desc: 'JS-like expressions with `$json`, `$node`, `$now`.', icon: Sparkles },
            { title: 'Branching IF + Switch', desc: 'Multi-output paths, regex, type guards. Real logic.', icon: GitBranch },
            { title: 'Per-item iteration', desc: 'Loop arrays with paired-item lineage intact.', icon: Layers },
            { title: 'Schedules + webhooks', desc: 'Cron, intervals, instant webhooks, polling.', icon: Calendar },
            { title: 'Pin + replay', desc: 'Pin data, replay execution, time-travel debug.', icon: Zap },
            { title: 'AI agent nodes', desc: 'GPT, Claude, Gemini, local Ollama — tool-use + memory.', icon: Bot },
        ], ['Trigger', 'Transform', 'Branch', 'AI step', 'Deliver'], true),

    build('sabmonitor', 'SabMonitor', 'Uptime + APM + synthetics', 'See what users see, before they tweet.',
        'Uptime checks, APM tracing, synthetic browsers, error grouping, alerts to chat + WhatsApp.',
        '/products/sabmonitor', '/dashboard/sabmonitor', Gauge, 'Engineering', 'lime',
        [{ value: 'APM', label: 'Tracing' }, { value: 'Synthetic', label: 'Browsers' }, { value: 'Alerts', label: 'Chat + WA' }, { value: 'Logs', label: 'Searchable' }],
        [
            { title: 'Uptime checks', desc: 'HTTP / TCP / DNS / SSL, multi-region, status pages.', icon: Activity },
            { title: 'APM tracing', desc: 'Spans across services, p95 latencies, slow query log.', icon: TrendingUp },
            { title: 'Synthetic flows', desc: 'Headless browsers script real user journeys.', icon: Bot },
            { title: 'Error grouping', desc: 'Stack-trace fingerprinting, regression detection.', icon: Filter },
            { title: 'Alert policies', desc: 'Multi-channel, on-call aware, mute windows.', icon: Megaphone },
            { title: 'Logs', desc: 'Live tail, search, retain, alert on patterns.', icon: ClipboardList },
        ], ['Probe', 'Trace', 'Detect', 'Alert', 'Resolve']),

    build('sabbugs', 'SabBugs', 'Bug tracker built for product teams', 'Lightweight bugs without Jira pain.',
        'Boards, swimlanes, sprints, watchers, linked PRs, AI triage, customer-reported sync.',
        '/products/sabbugs', '/dashboard/sabbugs', Bug, 'Engineering', 'rose',
        [{ value: 'Boards', label: 'WIP-aware' }, { value: 'Sprints', label: 'Native' }, { value: 'PR', label: 'Linked' }, { value: 'AI', label: 'Triage' }],
        [
            { title: 'Boards', desc: 'Customisable swimlanes, WIP limits, drag-drop priority.', icon: LayoutTemplate },
            { title: 'AI triage', desc: 'Auto-tag severity, dedupe, assign by code-owner.', icon: Sparkles },
            { title: 'PR links', desc: 'GitHub / GitLab references with status pills.', icon: GitBranch },
            { title: 'Watchers', desc: 'Anyone can watch, mention, expect updates.', icon: Users },
            { title: 'Customer sync', desc: 'Pull from SabDesk + Sabchat with full context.', icon: Inbox },
            { title: 'Burndown', desc: 'Per sprint + per team, with carry-over math.', icon: BarChart3 },
        ], ['Report', 'Triage', 'Fix', 'Verify', 'Release']),

    build('sabsprints', 'SabSprints', 'Agile sprints + roadmap', 'For shippers who hate ceremony.',
        'Roadmap, sprints, story points, retros, velocity — without the meeting overhead.',
        '/products/sabsprints', '/dashboard/sabsprints', Target, 'Engineering', 'fuchsia',
        [{ value: 'Roadmap', label: 'Visual' }, { value: 'Velocity', label: 'Smart' }, { value: 'Retros', label: 'Inline' }, { value: 'Burndown', label: 'Auto' }],
        [
            { title: 'Roadmap', desc: 'Drag-drop themes, quarters, swimlanes per team.', icon: LayoutTemplate },
            { title: 'Sprints', desc: 'Plan from a backlog, story points, carry-over math.', icon: Calendar },
            { title: 'Velocity', desc: 'Rolling, by team, drives realistic commitments.', icon: TrendingUp },
            { title: 'Retros', desc: 'Built-in templates, votes, action-items tracked.', icon: ClipboardList },
            { title: 'Goals', desc: 'OKRs tied to sprints, with progress + confidence.', icon: Target },
            { title: 'Integrations', desc: 'Bug-tracker, Git, CI — all on a shared timeline.', icon: Webhook },
        ], ['Plan', 'Commit', 'Ship', 'Retro', 'Repeat']),

    // ──────── ANALYTICS & AI ────────
    build('sablens', 'SabLens', 'Session replay + heatmaps', 'See exactly what users do.',
        'Session replay, heatmaps, funnels, dead clicks, rage clicks — all opt-in + privacy-first.',
        '/products/sablens', '/dashboard/sablens', Eye, 'Analytics & AI', 'pink',
        [{ value: 'Replay', label: 'HD' }, { value: 'Heatmaps', label: 'Per page' }, { value: 'Funnels', label: 'Native' }, { value: 'Privacy', label: 'Masked' }],
        [
            { title: 'Session replay', desc: 'Pixel-perfect replays with masking for sensitive fields.', icon: Video },
            { title: 'Heatmaps', desc: 'Click, move, scroll heat — per device + per audience.', icon: PieChart },
            { title: 'Funnels', desc: 'Define steps, see drop-off, slice by traits.', icon: Filter },
            { title: 'Rage + dead clicks', desc: 'Surface frustration instantly with replays.', icon: Activity },
            { title: 'Privacy mode', desc: 'GDPR-friendly, mask by selector, region routing.', icon: ShieldlessLock },
            { title: 'Insights AI', desc: 'Auto-cluster issues, suggest experiments.', icon: Sparkles },
        ], ['Capture', 'Cluster', 'Replay', 'Fix', 'Validate']),

    build('sabsense', 'SabSense', 'A/B + UTM + funnel analytics', 'Measure what actually drove the sale.',
        'A/B tests, UTM tracking, attribution models, revenue funnels — all in one tag.',
        '/products/sabsense', '/dashboard/sabsense', Activity, 'Analytics & AI', 'orange',
        [{ value: '1', label: 'Tag fits all' }, { value: 'Attrib', label: 'Multi-touch' }, { value: 'A/B', label: 'Stat-sig' }, { value: 'Cohorts', label: 'Drag' }],
        [
            { title: 'One tag', desc: 'Captures pageviews, events, sessions, revenue.', icon: Webhook },
            { title: 'Attribution models', desc: 'First / last / linear / decay, with custom windows.', icon: Filter },
            { title: 'Funnels', desc: 'Drag-drop steps, exit reasons, cohort cuts.', icon: TrendingUp },
            { title: 'A/B', desc: 'Server + client experiments, stat-sig math.', icon: Zap },
            { title: 'Cohorts', desc: 'Save segments, retention grids, lifecycle stages.', icon: Layers },
            { title: 'Insights', desc: 'AI surfaces deltas: what slipped, what spiked.', icon: Sparkles },
        ], ['Tag', 'Track', 'Funnel', 'Attribute', 'Decide']),

    build('sabbi', 'SabBI', 'BI dashboards + SQL', 'Drag charts + write SQL when needed.',
        'Connectors to Postgres / Mongo / sheet, dashboards, drill-downs, scheduled exports.',
        '/products/sabbi', '/dashboard/sabbi', BarChart3, 'Analytics & AI', 'indigo',
        [{ value: 'Connectors', label: '20+' }, { value: 'SQL', label: 'Optional' }, { value: 'Schedules', label: 'Native' }, { value: 'Embed', label: 'Yes' }],
        [
            { title: 'Connectors', desc: 'Postgres, Mongo, MySQL, BigQuery, sheets, REST.', icon: Network },
            { title: 'Dashboards', desc: 'Drag tiles, themes, filters, mobile-ready.', icon: LayoutTemplate },
            { title: 'SQL editor', desc: 'Versioned, with formatter, autocomplete, lineage.', icon: FileText },
            { title: 'Drill-down', desc: 'Click a tile → see rows; row-level security supported.', icon: Filter },
            { title: 'Schedules', desc: 'Push dashboards to email, WA, Slack on cron.', icon: Calendar },
            { title: 'Embed', desc: 'Embed dashboards into your app with signed JWTs.', icon: Layers },
        ], ['Connect', 'Model', 'Visualise', 'Share', 'Decide']),

    build('sabbigin', 'SabBigin', 'AI BDR + sales engagement', 'Calls, emails, follow-ups — driven by AI.',
        'Sequencer, AI auto-research, dialer, transcription, call scoring, dialler campaigns.',
        '/products/sabbigin', '/dashboard/sabbigin', Bot, 'Analytics & AI', 'teal',
        [{ value: 'AI', label: 'BDR' }, { value: 'Dialer', label: 'Predictive' }, { value: 'Score', label: 'Live' }, { value: 'Seq', label: 'Multi-step' }],
        [
            { title: 'AI research', desc: 'Pull firmographic + intent signals per lead.', icon: Sparkles },
            { title: 'Sequencer', desc: 'Multi-step emails + WA + calls, with branches.', icon: Workflow },
            { title: 'Predictive dialer', desc: 'Power dialer with answering-machine detect.', icon: Phone },
            { title: 'Live score', desc: 'AI scores calls in real time; coach in the moment.', icon: TrendingUp },
            { title: 'Transcription', desc: 'Speaker-tagged, searchable, with summaries.', icon: FileText },
            { title: 'CRM-native', desc: 'Every action lands on the deal with full context.', icon: Users },
        ], ['Discover', 'Engage', 'Call', 'Score', 'Close']),

    // ──────── FILES & DOCUMENTS ────────
    build('sabfiles', 'SabFiles', 'File manager + shared library', 'One file home for all of SabNode.',
        'R2-backed file store, signed share links, folder roles, versioning, recyclable bin.',
        '/products/sabfiles', '/dashboard/sabfiles', Files, 'Files & Documents', 'sky',
        [{ value: 'R2', label: 'Backed' }, { value: 'Shared', label: 'Links' }, { value: 'Roles', label: 'Per folder' }, { value: 'Versions', label: 'Auto' }],
        [
            { title: 'Library', desc: 'Drop, organise, tag — every module reads from here.', icon: Files },
            { title: 'Share links', desc: 'Signed, passcoded, with expiry + download stats.', icon: Share2 },
            { title: 'Folder roles', desc: 'Per-folder ACL — viewer, editor, owner, no leaks.', icon: UserCheck },
            { title: 'Versions', desc: 'Every overwrite is preserved + restorable.', icon: GitBranch },
            { title: 'Bin', desc: 'Soft-delete with 30-day recovery + audit log.', icon: ClipboardList },
            { title: 'Embeddable picker', desc: 'Drop the SabFilePicker anywhere in your app.', icon: LayoutTemplate },
        ], ['Upload', 'Tag', 'Share', 'Versioned', 'Audit']),

    build('sabsign', 'SabSign', 'E-signatures + agreements', 'Send, sign, e-stamp — all native.',
        'Tabbed signing, sequential signers, custom fields, audit trail, e-stamping, bulk send.',
        '/products/sabsign', '/sabsign', FileSignature, 'Files & Documents', 'violet',
        [{ value: 'Bulk', label: 'Send' }, { value: 'Stamp', label: 'e-Stamp' }, { value: 'Audit', label: 'Signed' }, { value: 'OTP', label: 'KYC' }],
        [
            { title: 'Sequential signers', desc: 'Drag-order, parallel groups, role-based fields.', icon: Users },
            { title: 'Custom fields', desc: 'Signature, initial, date, dropdown, conditional.', icon: ClipboardList },
            { title: 'Bulk send', desc: 'Upload a CSV, send identical agreements to many.', icon: Send },
            { title: 'e-Stamping', desc: 'Stamp papers issued, paid + attached automatically.', icon: FileText },
            { title: 'Audit trail', desc: 'IP, timestamps, OTP-verified ID, signed hash.', icon: ShieldlessLock },
            { title: 'Templates', desc: 'Reusable agreements with pre-mapped fields.', icon: Layers },
        ], ['Upload', 'Map fields', 'Send', 'Sign', 'Archive']),

    build('sabsheet', 'SabSheet', 'Spreadsheets with data ops', 'Sheets that talk to your data.',
        'Real-time multi-user sheets, formulas, scripting, scheduled pulls from DB / APIs.',
        '/products/sabsheet', '/dashboard/sabsheet', FileSpreadsheet, 'Files & Documents', 'lime',
        [{ value: 'Co-edit', label: 'Realtime' }, { value: 'Scripts', label: 'JS' }, { value: 'Connectors', label: 'DB + API' }, { value: 'Charts', label: 'Built-in' }],
        [
            { title: 'Real-time', desc: 'Cursors, presence, comments — Google-style speed.', icon: Users },
            { title: 'Formulas + scripts', desc: 'Full formula library + JS custom functions.', icon: Sparkles },
            { title: 'Connectors', desc: 'Pull live data from Postgres, REST, Sab modules.', icon: Network },
            { title: 'Schedules', desc: 'Refresh on cron, post snapshots to chat.', icon: Calendar },
            { title: 'Charts', desc: 'Line / bar / pie / table; export to dashboard.', icon: BarChart3 },
            { title: 'Permissions', desc: 'Per-tab, per-range, per-role; safe to share.', icon: UserCheck },
        ], ['Open', 'Compute', 'Connect', 'Visualise', 'Share']),

    build('sabtables', 'SabTables', 'Airtable-like databases', 'Spin up real data apps without code.',
        'Typed columns, relations, views, forms, automations, API instantly — your team\'s mini-DB.',
        '/products/sabtables', '/dashboard/sabtables', Table2, 'Files & Documents', 'cyan',
        [{ value: 'Typed', label: 'Columns' }, { value: 'Relations', label: 'Native' }, { value: 'Views', label: '∞' }, { value: 'API', label: 'Auto' }],
        [
            { title: 'Typed columns', desc: 'Text, number, currency, formula, relation, attachment.', icon: Layers },
            { title: 'Relations', desc: 'One-to-many, many-to-many; rollups + lookups.', icon: Network },
            { title: 'Views', desc: 'Grid, kanban, calendar, gallery — saved per user.', icon: LayoutTemplate },
            { title: 'Forms', desc: 'Branded forms that populate tables, with validation.', icon: ClipboardList },
            { title: 'Automations', desc: 'Trigger SabFlow on any record change, with diffs.', icon: Workflow },
            { title: 'API', desc: 'Auto-generated REST + GraphQL with role-aware tokens.', icon: Webhook },
        ], ['Define schema', 'Enter data', 'Relate', 'Automate', 'Embed']),

    build('sabprep', 'SabPrep', 'Recipes + standard operating procs', 'Codify your operations.',
        'Reusable recipes and SOPs, version + role, embed in modules. The handbook your team actually opens.',
        '/products/sabprep', '/dashboard/sabprep', GraduationCap, 'Files & Documents', 'yellow',
        [{ value: 'Recipes', label: 'Versioned' }, { value: 'Roles', label: 'Per step' }, { value: 'Embed', label: 'Any module' }, { value: 'Quizzes', label: 'Built-in' }],
        [
            { title: 'Recipes', desc: 'Step-by-step playbooks with role-by-role checklists.', icon: ClipboardList },
            { title: 'Versioning', desc: 'Track changes, see who edited what, restore in a click.', icon: GitBranch },
            { title: 'Quizzes', desc: 'Confirm understanding, gate access on score.', icon: FileText },
            { title: 'Embedding', desc: 'Drop a recipe panel into any other Sab module.', icon: Layers },
            { title: 'Comments', desc: 'Threaded feedback on individual steps.', icon: MessageSquare },
            { title: 'Audit', desc: 'See who read, who certified, on which version.', icon: Activity },
        ], ['Draft', 'Certify', 'Train', 'Audit', 'Improve']),

    // ──────── ACQUISITION ────────
    build('seo', 'SEO', 'Growth surface', 'Landing pages, schema, and link tracking that actually rank.',
        'No-code page builder, sitemap autogen, schema injection, UTM lab, A/B tests, real Core Web Vitals.',
        '/products/seo', '/dashboard/seo', Globe2, 'Acquisition', 'rose',
        [{ value: '95+', label: 'Lighthouse' }, { value: '<1s', label: 'LCP target' }, { value: 'A/B', label: 'Built-in' }, { value: 'Edge', label: 'Cached' }],
        [
            { title: 'Visual page builder', desc: 'Brand-safe blocks, responsive presets, on-brand fonts.', icon: Layers },
            { title: 'Schema engine', desc: 'Article, Product, FAQ, LocalBusiness — auto-injected.', icon: Target },
            { title: 'Link tracking + UTM lab', desc: 'Branded short links, click maps, attribution.', icon: TrendingUp },
            { title: 'A/B + multivariate', desc: 'Headline, hero, CTA — stat-sig calls baked in.', icon: Sparkles },
            { title: 'Sitemap + robots', desc: 'Auto-generated, priority-aware, GSC verified.', icon: FileText },
            { title: 'Core Web Vitals', desc: 'Real-user data, p75 alerts, regression diffs.', icon: BarChart3 },
        ], ['Plan keyword', 'Build page', 'Inject schema', 'Track clicks', 'Ship variant'], true),

    build('website-builder', 'Website', 'No-code marketing sites', 'Spin a real website in an afternoon.',
        'Blocks, themes, custom domains, CMS-style content, edge-rendered, lightning fast.',
        '/products/website-builder', '/dashboard/website-builder', LayoutTemplate, 'Acquisition', 'pink',
        [{ value: 'Blocks', label: 'Brand-ready' }, { value: 'Domain', label: 'Custom' }, { value: 'CMS', label: 'Built-in' }, { value: 'Edge', label: 'Rendered' }],
        [
            { title: 'Block builder', desc: 'Hero, features, pricing, FAQ blocks; brand-safe.', icon: Layers },
            { title: 'Themes', desc: 'Multiple themes, brand tokens, dark mode toggle.', icon: LayoutTemplate },
            { title: 'CMS-style', desc: 'Reusable content models, drafts, scheduled publish.', icon: FileText },
            { title: 'Forms', desc: 'Branded forms post to CRM with attribution.', icon: ClipboardList },
            { title: 'Custom domain', desc: 'One-click DNS, SSL, redirects, vanity URLs.', icon: Globe2 },
            { title: 'Performance', desc: 'Edge-cached, sub-1s LCP, perfect mobile scores.', icon: Activity },
        ], ['Pick theme', 'Drop blocks', 'Connect domain', 'Publish', 'Measure']),

    build('url-shortener', 'Short Links', 'Branded short links + QR', 'Every link, tracked + branded.',
        'Custom domains, click analytics, UTM presets, expiring + passworded links, QR generation.',
        '/products/url-shortener', '/dashboard/url-shortener', LinkIcon, 'Acquisition', 'amber',
        [{ value: 'Brand', label: 'Domains' }, { value: 'Click', label: 'Maps' }, { value: 'QR', label: 'Bundled' }, { value: 'Bots', label: 'Filtered' }],
        [
            { title: 'Branded domains', desc: 'sab.link/whatever — custom domains, signed SSL.', icon: Globe2 },
            { title: 'Click analytics', desc: 'Geo + device + referrer, bot scrub, real-time.', icon: BarChart3 },
            { title: 'UTM lab', desc: 'Save presets, enforce consistency, audit-safe.', icon: Target },
            { title: 'Expiry + passwords', desc: 'Time-bound, code-protected, single-use options.', icon: Key },
            { title: 'QR codes', desc: 'Dynamic QR pointing at any link, scan analytics.', icon: QrCode },
            { title: 'API', desc: 'Mint links programmatically from any module.', icon: Webhook },
        ], ['Mint', 'Brand', 'Share', 'Track', 'Iterate']),

    build('qr-code-maker', 'QR Studio', 'Dynamic QR codes', 'Scan-friendly QR with branding + analytics.',
        'Dynamic QR for menus, profiles, payments, links — repointable, branded, traceable.',
        '/products/qr-code-maker', '/dashboard/qr-code-maker', QrCode, 'Acquisition', 'fuchsia',
        [{ value: 'Dynamic', label: 'Repoint' }, { value: 'Logo', label: 'Center' }, { value: 'Scans', label: 'Tracked' }, { value: 'A/B', label: 'On QR' }],
        [
            { title: 'Dynamic QR', desc: 'Change destination without reprinting.', icon: QrCode },
            { title: 'Branded design', desc: 'Logo, colors, frames — keep brand on a square.', icon: Sparkles },
            { title: 'Analytics', desc: 'Scans by time, device, geo; cohorts per QR.', icon: BarChart3 },
            { title: 'A/B on QR', desc: 'Rotate destinations, measure best-performing.', icon: GitBranch },
            { title: 'Bulk', desc: 'Generate thousands; CSV import, ZIP export.', icon: Files },
            { title: 'Payments', desc: 'UPI QR with reconciliation built in.', icon: CreditCard },
        ], ['Design', 'Print', 'Scan', 'Track', 'Optimise']),
];

export const MODULES_BY_SLUG: Record<ModuleSlug, ModuleDef> = MODULES.reduce(
    (acc, m) => {
        acc[m.slug] = m;
        return acc;
    },
    {} as Record<ModuleSlug, ModuleDef>,
);

export const MODULE_CATEGORIES: ModuleCategory[] = [
    'Conversation',
    'Marketing',
    'Sales & Commerce',
    'Customer Success',
    'People & Operations',
    'Productivity',
    'Engineering',
    'Analytics & AI',
    'Files & Documents',
    'Acquisition',
];

export function modulesByCategory(): Record<ModuleCategory, ModuleDef[]> {
    const out = {} as Record<ModuleCategory, ModuleDef[]>;
    for (const c of MODULE_CATEGORIES) out[c] = [];
    for (const m of MODULES) out[m.category].push(m);
    return out;
}

export const FLAGSHIP_MODULES = MODULES.filter((m) => m.flagship);

export const PLATFORM_LINKS = [
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'Security', href: '/security' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Customers', href: '/customers' },
    { label: 'Changelog', href: '/changelog' },
];

export const RESOURCES_LINKS = [
    { label: 'Blog', href: '/blog' },
    { label: 'Docs', href: '/docs' },
    { label: 'Templates', href: '/templates' },
    { label: 'Compare tools', href: '/compare' },
    { label: 'API reference', href: '/api-docs' },
    { label: 'Status', href: '/status' },
];
