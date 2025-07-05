
import type { PlanFeaturePermissions } from '@/lib/definitions';

export const planFeatureMap: { id: keyof PlanFeaturePermissions, name: string }[] = [
    { id: 'overview', name: 'Project Overview' },
    { id: 'campaigns', name: 'Broadcast Campaigns' },
    { id: 'liveChat', name: 'Live Chat' },
    { id: 'contacts', name: 'Contact Management' },
    { id: 'templates', name: 'Message Templates' },
    { id: 'catalog', name: 'Product Catalog' },
    { id: 'flowBuilder', name: 'Flow Builder' },
    { id: 'metaFlows', name: 'Meta Flows' },
    { id: 'whatsappAds', name: 'WhatsApp Ads' },
    { id: 'webhooks', name: 'Webhooks Page' },
    { id: 'apiAccess', name: 'API Access' },
    { id: 'urlShortener', name: 'URL Shortener' },
    { id: 'qrCodeMaker', name: 'QR Code Maker' },
    { id: 'numbers', name: 'Phone Numbers Page' },
    { id: 'billing', name: 'Billing Page' },
    { id: 'notifications', name: 'Notifications Page' },
    { id: 'settingsBroadcast', name: 'Broadcast Settings' },
    { id: 'settingsAutoReply', name: 'Auto-Reply Settings' },
    { id: 'settingsMarketing', name: 'Marketing Settings' },
    { id: 'settingsTemplateLibrary', name: 'Template Library' },
    { id: 'settingsCannedMessages', name: 'Canned Messages' },
    { id: 'settingsAgentsRoles', name: 'Agents & Roles' },
    { id: 'settingsCompliance', name: 'Compliance Settings' },
    { id: 'settingsUserAttributes', name: 'User Attributes' },
    { id: 'instagramFeed', name: 'Instagram Feed' },
    { id: 'instagramStories', name: 'Instagram Stories' },
    { id: 'instagramReels', name: 'Instagram Reels' },
    { id: 'instagramMessages', name: 'Instagram Messages' },
];

export const planFeaturesDefaults: PlanFeaturePermissions = {
    overview: true, campaigns: true, liveChat: true, contacts: true, templates: true, catalog: false, flowBuilder: true,
    metaFlows: true, whatsappAds: false, webhooks: true, settingsBroadcast: true, settingsAutoReply: true,
    settingsMarketing: false, settingsTemplateLibrary: true, settingsCannedMessages: true, settingsAgentsRoles: true,
    settingsCompliance: true, settingsUserAttributes: true, apiAccess: false,
    urlShortener: true, qrCodeMaker: true, numbers: true, billing: true, notifications: true,
    instagramFeed: false, instagramStories: false, instagramReels: false, instagramMessages: false
};
