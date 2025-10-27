

import type { PlanFeaturePermissions } from '@/lib/definitions';
import {
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, FileText, Phone, Webhook,
    Briefcase, CreditCard, Megaphone, ServerCog, ShoppingBag, Link as LinkIcon, QrCode, BarChart,
    Newspaper, Clapperboard, Video, Bot, ShieldCheck, Mail, Database
} from 'lucide-react';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';

export const planFeatureMap: { id: keyof PlanFeaturePermissions, name: string, icon: React.ElementType }[] = [
    { id: 'overview', name: 'Project Overview', icon: LayoutDashboard },
    { id: 'campaigns', name: 'Broadcast Campaigns', icon: Send },
    { id: 'liveChat', name: 'Live Chat', icon: MessageSquare },
    { id: 'contacts', name: 'Contact Management', icon: Users },
    { id: 'templates', name: 'Message Templates', icon: FileText },
    { id: 'catalog', name: 'Product Catalog', icon: ShoppingBag },
    { id: 'ecommerce', name: 'E-Commerce', icon: CustomEcommerceIcon },
    { id: 'flowBuilder', name: 'Flow Builder', icon: GitFork },
    { id: 'metaFlows', name: 'Meta Flows', icon: ServerCog },
    { id: 'whatsappAds', name: 'WhatsApp Ads', icon: Megaphone },
    { id: 'webhooks', name: 'Webhooks Page', icon: Webhook },
    { id: 'apiAccess', name: 'API Access', icon: ServerCog },
    { id: 'urlShortener', name: 'URL Shortener', icon: LinkIcon },
    { id: 'qrCodeMaker', name: 'QR Code Maker', icon: QrCode },
    { id: 'numbers', name: 'Phone Numbers', icon: Phone },
    { id: 'billing', name: 'Billing Page', icon: CreditCard },
    { id: 'notifications', name: 'Notifications Page', icon: Send },
    { id: 'settingsBroadcast', name: 'Broadcast Settings', icon: Settings },
    { id: 'settingsAutoReply', name: 'Auto-Reply Settings', icon: Bot },
    { id: 'settingsMarketing', name: 'Marketing Settings', icon: Megaphone },
    { id: 'settingsTemplateLibrary', name: 'Template Library', icon: FileText },
    { id: 'settingsCannedMessages', name: 'Canned Messages', icon: MessageSquare },
    { id: 'settingsAgentsRoles', name: 'Agents & Roles', icon: Users },
    { id: 'settingsCompliance', name: 'Compliance Settings', icon: ShieldCheck },
    { id: 'settingsUserAttributes', name: 'User Attributes', icon: Users },
    { id: 'instagramFeed', name: 'Instagram Feed', icon: Newspaper },
    { id: 'instagramStories', name: 'Instagram Stories', icon: Clapperboard },
    { id: 'instagramReels', name: 'Instagram Reels', icon: Video },
    { id: 'instagramMessages', name: 'Instagram Messages', icon: MessageSquare },
    { id: 'chatbot', name: 'AI Chatbot Builder', icon: Bot },
    { id: 'email', name: 'Email Suite', icon: Mail },
];

export const planFeaturesDefaults: PlanFeaturePermissions = {
    overview: true, campaigns: true, liveChat: true, contacts: true, templates: true, catalog: true, ecommerce: false, flowBuilder: true,
    metaFlows: true, whatsappAds: false, webhooks: true, settingsBroadcast: true, settingsAutoReply: true,
    settingsMarketing: false, settingsTemplateLibrary: true, settingsCannedMessages: true, settingsAgentsRoles: true,
    settingsCompliance: true, settingsUserAttributes: true, apiAccess: false,
    urlShortener: true, qrCodeMaker: true, numbers: true, billing: true, notifications: true,
    instagramFeed: false, instagramStories: false, instagramReels: false, instagramMessages: false, chatbot: false,
    email: true,
};
