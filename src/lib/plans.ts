

import type { PlanFeaturePermissions } from '@/lib/definitions';
import {
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, FileText, Phone, Webhook,
    Briefcase, CreditCard, Megaphone, ServerCog, ShoppingBag, Link as LinkIcon, QrCode, BarChart,
    Newspaper, Clapperboard, Video, Bot, ShieldCheck, Mail, Database, Brush, TrendingUp, Handshake, Building, zap
} from 'lucide-react';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';

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
    
    // Standalone
    { id: 'chatbot', name: 'AI Chatbot Builder', icon: Bot },
    { id: 'email', name: 'Email Suite', icon: Mail },
    { id: 'sms', name: 'SMS Suite', icon: MessageSquare },
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
];

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
    sms: true,
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
};
