import {
    Bot,
    Mail,
    Megaphone,
    MessageSquare,
    ShoppingCart,
    Zap,
} from 'lucide-react';
import type { IntegrationStatus } from '@/app/actions/crm-integrations.actions.types';

export type IntegrationStatusKey = keyof IntegrationStatus;

export interface BuiltInIntegration {
    id: IntegrationStatusKey;
    name: string;
    icon: React.ElementType;
    description: string;
    link?: string;
    isAvailable: boolean; // if false, it's "coming_soon"
}

export const BUILT_IN_INTEGRATIONS: BuiltInIntegration[] = [
    {
        id: 'gmail',
        name: 'Gmail',
        icon: Mail,
        description: 'Sync your emails and contacts directly from Gmail.',
        isAvailable: true,
        link: '/dashboard/email/settings',
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp',
        icon: MessageSquare,
        description: 'Connect your WhatsApp Business API for direct messaging.',
        isAvailable: true,
        link: '/dashboard/settings/whatsapp',
    },
    {
        id: 'facebook',
        name: 'Facebook Lead Ads',
        icon: Megaphone,
        description: 'Auto-create CRM leads from Facebook Lead Ad forms in real-time.',
        isAvailable: true,
        link: '/dashboard/crm/settings/integrations/facebook-ads',
    },
    {
        id: 'shopify',
        name: 'Shopify',
        icon: ShoppingCart,
        description: 'Sync customers, products, and orders directly from your Shopify store.',
        isAvailable: false,
    },
    {
        id: 'zapier',
        name: 'Zapier',
        icon: Zap,
        description: 'Connect your CRM to thousands of other apps with Zapier automation.',
        isAvailable: false,
    },
    {
        id: 'slack',
        name: 'Slack',
        icon: Bot,
        description: 'Get real-time notifications for new leads, deals, and tasks in Slack.',
        isAvailable: false,
    },
];
