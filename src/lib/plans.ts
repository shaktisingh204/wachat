// TODO(sabwa): SabWa plan caps (sessions / daily send / scheduler / bulk / AI)
// live in `src/lib/sabwa/plan-limits.ts` until the `Plan.appLimits` shape in
// `src/lib/definitions.ts` is extended with a `sabwa?: { … }` discriminator.
// See SABWA_PLAN.md §10 for the source-of-truth table.

import type { PlanFeaturePermissions } from '@/lib/definitions';
import {
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, FileText, Phone, Webhook,
    Briefcase, CreditCard, Megaphone, ServerCog, ShoppingBag, Link as LinkIcon, QrCode, BarChart,
    Newspaper, Clapperboard, Video, Bot, ShieldCheck, Mail, Database, Brush, TrendingUp, Handshake, Building, Zap,
    Mic, PenSquare, PieChart, ClipboardList, Network, KeyRound, Sheet, Presentation, Table2, Kanban,
    Bug, Calculator, FlaskConical, Eye, Wand2, Cloud, Wrench, Activity,
    Camera, MapPin, ShoppingCart, Headphones, Sparkles, Award, Building2
} from 'lucide-react';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, InstagramIcon, SabChatIcon } from '@/components/20ui-domain/custom-sidebar-components';

export const planFeatureMap: { id: keyof PlanFeaturePermissions, name: string, icon: React.ElementType }[] = [
    // Wachat
    { id: 'overview', name: 'Project Overview', icon: LayoutDashboard },
    { id: 'campaigns', name: 'Broadcast Campaigns', icon: Send },
    { id: 'liveChat', name: 'Live Chat', icon: MessageSquare },
    { id: 'contacts', name: 'Wachat Contacts', icon: Users },
    { id: 'templates', name: 'Message Templates', icon: FileText },
    { id: 'catalog', name: 'Wachat Catalog', icon: ShoppingBag },
    { id: 'flowBuilder', name: 'Wachat Flow Builder', icon: GitFork },
    { id: 'metaFlows', name: 'Meta Flows', icon: ServerCog },
    { id: 'whatsappAds', name: 'WhatsApp Ads', icon: Megaphone },
    { id: 'webhooks', name: 'Webhooks Page', icon: Webhook },
    { id: 'numbers', name: 'Phone Numbers', icon: Phone },

    // Meta Suite
    { id: 'instagramFeed', name: 'Instagram Feed', icon: Newspaper },
    { id: 'instagramStories', name: 'Instagram Stories', icon: Clapperboard },
    { id: 'instagramReels', name: 'Instagram Reels', icon: Video },
    { id: 'instagramMessages', name: 'Instagram Messages', icon: MessageSquare },

    // CRM
    { id: 'crmDashboard', name: 'CRM Dashboard', icon: LayoutDashboard },
    { id: 'crmSales', name: 'Sales', icon: Handshake },
    { id: 'crmPurchases', name: 'Purchases', icon: ShoppingBag },
    { id: 'crmInventory', name: 'Inventory', icon: Briefcase },
    { id: 'crmAccounting', name: 'Accounting', icon: Database },
    { id: 'crmSalesCrm', name: 'Sales CRM', icon: BarChart },
    { id: 'crmBanking', name: 'Banking', icon: CreditCard },
    { id: 'crmHrPayroll', name: 'HR & Payroll', icon: Users },
    { id: 'crmGstReports', name: 'GST Reports', icon: FileText },
    { id: 'crmIntegrations', name: 'CRM Integrations', icon: Zap },
    { id: 'crmSettings', name: 'CRM Settings', icon: Settings },

    // Team
    { id: 'teamChat', name: 'Team Chat', icon: MessageSquare },
    { id: 'teamTasks', name: 'Team Tasks', icon: Users },

    // Standalone
    { id: 'chatbot', name: 'AI Chatbot Builder', icon: Bot },
    { id: 'email', name: 'Email Suite', icon: Mail },
    { id: 'sabsms', name: 'SabSMS — SMS / MMS / RCS', icon: MessageSquare },
    { id: 'seo', name: 'SEO Suite', icon: TrendingUp },
    { id: 'websiteBuilder', name: 'Website Builder', icon: Brush },
    { id: 'urlShortener', name: 'URL Shortener', icon: LinkIcon },
    { id: 'qrCodeMaker', name: 'QR Code Maker', icon: QrCode },

    // Settings & Others
    { id: 'billing', name: 'Billing Page', icon: CreditCard },
    { id: 'notifications', name: 'Notifications Page', icon: Send },
    { id: 'apiAccess', name: 'API Access', icon: ServerCog },
    { id: 'settingsBroadcast', name: 'Broadcast Settings', icon: Settings },
    { id: 'settingsAutoReply', name: 'Auto-Reply Settings', icon: Bot },
    { id: 'settingsMarketing', name: 'Marketing Settings', icon: Megaphone },
    { id: 'settingsTemplateLibrary', name: 'Template Library', icon: FileText },
    { id: 'settingsCannedMessages', name: 'Canned Messages', icon: MessageSquare },
    { id: 'settingsAgentsRoles', name: 'Agents & Roles', icon: Users },
    { id: 'settingsCompliance', name: 'Compliance Settings', icon: ShieldCheck },
    { id: 'settingsUserAttributes', name: 'User Attributes', icon: Users },

    // §17 Sab-* applications — one row per app on the dock rail.
    { id: 'sabmail', name: 'SabMail — Hosted Email', icon: Mail },
    { id: 'sabmeet', name: 'SabMeet — Video Rooms', icon: Video },
    { id: 'sabvoice', name: 'SabVoice — Cloud PBX', icon: Mic },
    { id: 'sabsign', name: 'SabSign — E-Signatures', icon: PenSquare },
    { id: 'sabwebinar', name: 'SabWebinar — Live + Registration', icon: Video },
    { id: 'sabconnect', name: 'SabConnect — Intranet', icon: Network },
    { id: 'sabvault', name: 'SabVault — Password Manager', icon: KeyRound },
    { id: 'sabsheet', name: 'SabSheet — Spreadsheets', icon: Sheet },
    { id: 'sabshow', name: 'SabShow — Presentations', icon: Presentation },
    { id: 'sabtables', name: 'SabTables — Airtable-style DB', icon: Table2 },
    { id: 'sabsprints', name: 'SabSprints — Scrum', icon: Kanban },
    { id: 'sabbugs', name: 'SabBugs — Bug Tracker', icon: Bug },
    { id: 'sabrequests', name: 'SabRequests — Approvals', icon: ClipboardList },
    { id: 'sabworkerly', name: 'SabWorkerly — Staffing', icon: Briefcase },
    { id: 'sabpractice', name: 'SabPractice — Accountants', icon: Calculator },
    { id: 'sabbi', name: 'SabBI — Analytics', icon: PieChart },
    { id: 'sabprep', name: 'SabPrep — DataPrep', icon: FlaskConical },
    { id: 'sabsense', name: 'SabSense — CRO + Recordings', icon: Eye },
    { id: 'sabcreator', name: 'SabCreator — Low-Code Builder', icon: Wand2 },
    { id: 'sabcatalyst', name: 'SabCatalyst — Serverless BaaS', icon: Cloud },
    { id: 'sabops', name: 'SabOps — IT Operations', icon: Wrench },
    { id: 'sabmonitor', name: 'SabMonitor — Synthetic + APM', icon: Activity },
    { id: 'sablens', name: 'SabLens — AR Remote Support', icon: Camera },
    { id: 'sabpublish', name: 'SabPublish — Local Listings', icon: MapPin },
    { id: 'sabbigin', name: 'SabBigin — Lite CRM', icon: Building2 },
    { id: 'sabshop', name: 'SabShop — Storefront', icon: ShoppingCart },
    { id: 'sabcheckout', name: 'SabCheckout — Payment Pages', icon: CreditCard },
    { id: 'sabdesk', name: 'SabDesk — Helpdesk', icon: Headphones },
    { id: 'sabcampaigns', name: 'SabCampaigns — Email Mktg', icon: Megaphone },
    { id: 'sabthrive', name: 'SabThrive — Rewards Storefront', icon: Sparkles },
    { id: 'sabrewards', name: 'SabRewards — Loyalty + Coupons', icon: Award },
];

/**
 * SabCRM (embedded Twenty engine) plan feature.
 *
 * Mirrors the way SabWa is gated: SabWa is NOT a typed key on
 * `PlanFeaturePermissions` (its caps live in `src/lib/sabwa/plan-limits.ts`),
 * so SabCRM likewise gets a standalone, additive feature descriptor here
 * instead of being forced into the strictly-typed `planFeatureMap` /
 * `planFeaturesDefaults` collections (which are exactly typed against
 * `PlanFeaturePermissions` in `src/lib/definitions.ts` and would fail a strict
 * typecheck for any non-`keyof` key).
 *
 * `permissionKey` is the RBAC view gate registered for `/sabcrm`
 * (see `src/lib/sabcrm/rbac-keys.ts`). `defaultEnabled` keeps SabCRM ON for
 * every plan by default, matching the §17 Sab-* application gates above.
 */
export const sabcrmPlanFeature = {
    id: 'sabcrm',
    name: 'SabCRM — Embedded Twenty',
    icon: Building,
    permissionKey: 'sabcrm:view',
    defaultEnabled: true,
} as const;

export const planFeaturesDefaults: PlanFeaturePermissions = {
    overview: true,
    campaigns: true,
    liveChat: true,
    contacts: true,
    templates: true,
    catalog: true,
    ecommerce: true,
    flowBuilder: true,
    metaFlows: true,
    whatsappAds: true,
    webhooks: true,
    settingsBroadcast: true,
    settingsAutoReply: true,
    settingsMarketing: true,
    settingsTemplateLibrary: true,
    settingsCannedMessages: true,
    settingsAgentsRoles: true,
    settingsCompliance: true,
    settingsUserAttributes: true,
    apiAccess: true,
    urlShortener: true,
    qrCodeMaker: true,
    numbers: true,
    billing: true,
    notifications: true,
    instagramFeed: true,
    instagramStories: true,
    instagramReels: true,
    instagramMessages: true,
    chatbot: true,
    email: true,
    sabsms: true,
    seo: true,
    websiteBuilder: true,

    // CRM Features
    crmDashboard: true,
    crmSales: true,
    crmPurchases: true,
    crmInventory: true,
    crmAccounting: true,
    crmSalesCrm: true,
    crmBanking: true,
    crmHrPayroll: true,
    crmGstReports: true,
    crmIntegrations: true,
    crmSettings: true,
    teamChat: true,
    teamTasks: true,

    // §17 Sab-* application gates — default ON for all plans.
    sabmail: true,
    sabmeet: true,
    sabvoice: true,
    sabsign: true,
    sabwebinar: true,
    sabconnect: true,
    sabvault: true,
    sabsheet: true,
    sabshow: true,
    sabtables: true,
    sabsprints: true,
    sabbugs: true,
    sabrequests: true,
    sabworkerly: true,
    sabpractice: true,
    sabbi: true,
    sabprep: true,
    sabsense: true,
    sabcreator: true,
    sabcatalyst: true,
    sabops: true,
    sabmonitor: true,
    sablens: true,
    sabpublish: true,
    sabbigin: true,
    sabshop: true,
    sabcheckout: true,
    sabdesk: true,
    sabcampaigns: true,
    sabthrive: true,
    sabrewards: true,
};
