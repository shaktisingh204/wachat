
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase, ChevronDown, FileText, Phone, Webhook, History, LogOut, CreditCard, LoaderCircle, Megaphone, ServerCog, ShoppingBag, Newspaper, Clapperboard, Wrench, Link as LinkIcon, QrCode, BarChart, Server, Brush, Handshake, Building, Mail, Zap, FolderKanban, Truck, Repeat, Video, Calendar, Package, TrendingUp, Rss, Globe, PhoneCall, Compass, Pencil, BookCopy, Contact, File as FileIcon, Star, BadgeInfo, MoreVertical, Check, ChevronsUpDown, X, Sparkles
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, WaPayIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { getSession, getProjects } from '@/app/actions';
import { getDiwaliThemeStatus } from '@/app/actions/admin.actions';
import type { Plan, WithId, Project, User } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/wabasimplify/facebook-project-switcher';
import { Badge } from '@/components/ui/badge';
import { crmMenuItems } from '@/app/dashboard/crm/layout';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

// --- Lazy-loaded page components ---
const LazyDashboardOverviewPage = React.lazy(() => import('@/app/dashboard/overview/page'));
const LazyChatPage = React.lazy(() => import('@/app/dashboard/chat/page'));
const LazyKanbanPage = React.lazy(() => import('@/app/dashboard/chat/kanban/page'));
const LazyContactsPage = React.lazy(() => import('@/app/dashboard/contacts/page'));
const LazyBroadcastsPage = React.lazy(() => import('@/app/dashboard/broadcasts/page'));
const LazyBroadcastReportPage = React.lazy(() => import('@/app/dashboard/broadcasts/[broadcastId]/page'));
const LazyTemplatesPage = React.lazy(() => import('@/app/dashboard/templates/page'));
const LazyCreateTemplatePage = React.lazy(() => import('@/app/dashboard/templates/create/page'));
const LazyTemplateLibraryPage = React.lazy(() => import('@/app/dashboard/templates/library/page'));
const LazyCatalogPage = React.lazy(() => import('@/app/dashboard/catalog/page'));
const LazyCallsLayout = React.lazy(() => import('@/app/dashboard/calls/layout'));
const LazyFlowBuilderPage = React.lazy(() => import('@/app/dashboard/flow-builder/page'));
const LazyFlowBuilderDocsPage = React.lazy(() => import('@/app/dashboard/flow-builder/docs/page'));
const LazyMetaFlowsPage = React.lazy(() => import('@/app/dashboard/flows/page'));
const LazyCreateMetaFlowPage = React.lazy(() => import('@/app/dashboard/flows/create/page'));
const LazyFlowsUserGuidePage = React.lazy(() => import('@/app/dashboard/flows/docs/page'));
const LazyIntegrationsLayout = React.lazy(() => import('@/app/dashboard/integrations/layout'));
const LazyWhatsAppPayLayout = React.lazy(() => import('@/app/dashboard/whatsapp-pay/layout'));
const LazyNumbersPage = React.lazy(() => import('@/app/dashboard/numbers/page'));
const LazyWebhooksPage = React.lazy(() => import('@/app/dashboard/webhooks/page'));
const LazySettingsPage = React.lazy(() => import('@/app/dashboard/settings/page'));
const LazyBillingPage = React.lazy(() => import('@/app/dashboard/billing/page'));
const LazyBillingHistoryPage = React.lazy(() => import('@/app/dashboard/billing/history/page'));
const LazyNotificationsPage = React.lazy(() => import('@/app/dashboard/notifications/page'));
const LazyProfilePage = React.lazy(() => import('@/app/dashboard/profile/page'));
const LazySetupPage = React.lazy(() => import('@/app/dashboard/setup/page'));
const LazyFacebookDashboardPage = React.lazy(() => import('@/app/dashboard/facebook/page'));
const LazyAllFacebookPagesPage = React.lazy(() => import('@/app/dashboard/facebook/all-projects/page'));
const LazyFacebookPostsPage = React.lazy(() => import('@/app/dashboard/facebook/posts/page'));
const LazyScheduledPostsPage = React.lazy(() => import('@/app/dashboard/facebook/scheduled/page'));
const LazyLiveStudioPage = React.lazy(() => import('@/app/dashboard/facebook/live-studio/page'));
const LazyPostRandomizerPage = React.lazy(() => import('@/app/dashboard/facebook/post-randomizer/page'));
const LazyFacebookMessagesPage = React.lazy(() => import('@/app/dashboard/facebook/messages/page'));
const LazyFacebookKanbanPage = React.lazy(() => import('@/app/dashboard/facebook/kanban/page'));
const LazyFacebookAutomationPage = React.lazy(() => import('@/app/dashboard/facebook/auto-reply/page'));
const LazyFacebookAgentsPage = React.lazy(() => import('@/app/dashboard/facebook/agents/page'));
const LazyFacebookKnowledgePage = React.lazy(() => import('@/app/dashboard/facebook/knowledge/page'));
const LazyCustomEcommerceDashboard = React.lazy(() => import('@/app/dashboard/facebook/custom-ecommerce/page'));
const LazyEcommProductsPage = React.lazy(() => import('@/app/dashboard/facebook/custom-ecommerce/manage/[shopId]/products/page'));
const LazyEcommOrdersPage = React.lazy(() => import('@/app/dashboard/facebook/custom-ecommerce/manage/[shopId]/orders/page'));
const LazyEcommWebsiteBuilderPage = React.lazy(() => import('@/app/dashboard/facebook/custom-ecommerce/manage/[shopId]/website-builder/page'));
const LazyEcommFlowBuilderPage = React.lazy(() => import('@/app/dashboard/facebook/custom-ecommerce/manage/[shopId]/flow-builder/page'));
const LazyEcommSettingsPage = React.lazy(() => import('@/app/dashboard/facebook/custom-ecommerce/manage/[shopId]/settings/page'));
const LazyCommerceProductsPage = React.lazy(() => import('@/app/dashboard/facebook/commerce/products/page'));
const LazyCatalogProductsPage = React.lazy(() => import('@/app/dashboard/facebook/commerce/products/[catalogId]/page'));
const LazyCommerceShopPage = React.lazy(() => import('@/app/dashboard/facebook/commerce/shop/page'));
const LazyCommerceOrdersPage = React.lazy(() => import('@/app/dashboard/facebook/commerce/orders/page'));
const LazyCommerceAnalyticsPage = React.lazy(() => import('@/app/dashboard/facebook/commerce/analytics/page'));
const LazyCommerceApiPage = React.lazy(() => import('@/app/dashboard/facebook/commerce/api/page'));
const LazyFacebookAdsPage = React.lazy(() => import('@/app/dashboard/facebook/ads/page'));
const LazyFacebookBroadcastsPage = React.lazy(() => import('@/app/dashboard/facebook/broadcasts/page'));
const LazyFacebookSubscribersPage = React.lazy(() => import('@/app/dashboard/facebook/subscribers/page'));
const LazyFacebookAudiencesPage = React.lazy(() => import('@/app/dashboard/facebook/audiences/page'));
const LazyFacebookPagesPage = React.lazy(() => import('@/app/dashboard/facebook/pages/page'));
const LazyFacebookWebhooksPage = React.lazy(() => import('@/app/dashboard/facebook/webhooks/page'));
const LazyFacebookSettingsPage = React.lazy(() => import('@/app/dashboard/facebook/settings/page'));
const LazyInstagramConnectionsPage = React.lazy(() => import('@/app/dashboard/instagram/connections/page'));
const LazyInstagramSetupPage = React.lazy(() => import('@/app/dashboard/instagram/setup/page'));
const LazyInstagramDashboardPage = React.lazy(() => import('@/app/dashboard/instagram/page'));
const LazyInstagramCreatePostPage = React.lazy(() => import('@/app/dashboard/instagram/create-post/page'));
const LazyInstagramFeedPage = React.lazy(() => import('@/app/dashboard/instagram/feed/page'));
const LazyInstagramStoriesPage = React.lazy(() => import('@/app/dashboard/instagram/stories/page'));
const LazyInstagramReelsPage = React.lazy(() => import('@/app/dashboard/instagram/reels/page'));
const LazyInstagramMessagesPage = React.lazy(() => import('@/app/dashboard/instagram/messages/page'));
const LazyInstagramDiscoveryPage = React.lazy(() => import('@/app/dashboard/instagram/discovery/page'));
const LazyInstagramHashtagSearchPage = React.lazy(() => import('@/app/dashboard/instagram/hashtag-search/page'));
const LazyInstagramMediaDetailsPage = React.lazy(() => import('@/app/dashboard/instagram/media/[mediaId]/page'));
const LazyEmailDashboardPage = React.lazy(() => import('@/app/dashboard/email/page'));
const LazyEmailInboxPage = React.lazy(() => import('@/app/dashboard/email/inbox/page'));
const LazyEmailCampaignsPage = React.lazy(() => import('@/app/dashboard/email/campaigns/page'));
const LazyEmailContactsPage = React.lazy(() => import('@/app/dashboard/email/contacts/page'));
const LazyEmailTemplatesPage = React.lazy(() => import('@/app/dashboard/email/templates/page'));
const LazyEmailAnalyticsPage = React.lazy(() => import('@/app/dashboard/email/analytics/page'));
const LazyEmailVerificationPage = React.lazy(() => import('@/app/dashboard/email/verification/page'));
const LazyEmailSettingsPage = React.lazy(() => import('@/app/dashboard/email/settings/page'));
const LazySmsDashboardPage = React.lazy(() => import('@/app/dashboard/sms/page'));
const LazySmsCampaignsPage = React.lazy(() => import('@/app/dashboard/sms/campaigns/page'));
const LazySmsContactsPage = React.lazy(() => import('@/app/dashboard/sms/contacts/page'));
const LazySmsAnalyticsPage = React.lazy(() => import('@/app/dashboard/sms/analytics/page'));
const LazySmsSettingsPage = React.lazy(() => import('@/app/dashboard/sms/settings/page'));
const LazyApiKeysPage = React.lazy(() => import('@/app/dashboard/api/page'));
const LazyApiDocsPage = React.lazy(() => import('@/app/dashboard/api/docs/page'));
const LazyUrlShortenerPage = React.lazy(() => import('@/app/dashboard/url-shortener/page'));
const LazyShortUrlAnalyticsPage = React.lazy(() => import('@/app/dashboard/url-shortener/[id]/page'));
const LazyUrlShortenerSettingsPage = React.lazy(() => import('@/app/dashboard/url-shortener/settings/page'));
const LazyQrCodeMakerPage = React.lazy(() => import('@/app/dashboard/qr-code-maker/page'));
const LazyQrCodeSettingsPage = React.lazy(() => import('@/app/dashboard/qr-code-maker/settings/page'));
const LazyWebsiteBuilderDashboard = React.lazy(() => import('@/app/dashboard/website-builder/page'));
const LazyPortfolioBuilderPage = React.lazy(() => import('@/app/dashboard/portfolio/manage/[portfolioId]/builder/page'));
const LazySeoDashboardPage = React.lazy(() => import('@/app/dashboard/seo/page'));
const LazyBrandRadarPage = React.lazy(() => import('@/app/dashboard/seo/brand-radar/page'));
const LazySiteExplorerPage = React.lazy(() => import('@/app/dashboard/seo/site-explorer/page'));
const LazyCrmLayout = React.lazy(() => import('@/app/dashboard/crm/layout'));

const wachatMenuItems = [
  { href: '/dashboard', label: 'All Projects', icon: Briefcase, roles: ['owner', 'admin', 'agent'], component: null },
  { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'admin'], component: LazyDashboardOverviewPage },
  { href: '/dashboard/chat', label: 'Live Chat', icon: MessageSquare, roles: ['owner', 'admin', 'agent'], component: LazyChatPage, subItems: [
    { href: '/dashboard/chat/kanban', label: 'Kanban Board', icon: FolderKanban, component: LazyKanbanPage },
  ]},
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users, roles: ['owner', 'admin', 'agent'], component: LazyContactsPage },
  { href: '/dashboard/broadcasts', label: 'Campaigns', icon: Send, roles: ['owner', 'admin'], component: LazyBroadcastsPage },
  { href: '/dashboard/broadcasts/[broadcastId]', label: 'Broadcast Report', icon: Send, roles: ['owner', 'admin'], component: LazyBroadcastReportPage },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText, roles: ['owner', 'admin'], component: LazyTemplatesPage },
  { href: '/dashboard/templates/create', label: 'Create Template', icon: Plus, roles: ['owner', 'admin'], component: LazyCreateTemplatePage },
  { href: '/dashboard/templates/library', label: 'Template Library', icon: BookCopy, roles: ['owner', 'admin'], component: LazyTemplateLibraryPage },
  { href: '/dashboard/catalog', label: 'Catalog', icon: ShoppingBag, roles: ['owner', 'admin'], component: LazyCatalogPage },
  { href: '/dashboard/calls', label: 'Calls', icon: PhoneCall, roles: ['owner', 'admin'], component: LazyCallsLayout },
  { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitFork, roles: ['owner', 'admin'], component: LazyFlowBuilderPage },
  { href: '/dashboard/flow-builder/docs', label: 'Flow Docs', icon: BookCopy, roles: ['owner', 'admin'], component: LazyFlowBuilderDocsPage },
  { href: '/dashboard/flows', label: 'Meta Flows', beta: true, icon: ServerCog, roles: ['owner', 'admin'], component: LazyMetaFlowsPage },
  { href: '/dashboard/flows/create', label: 'Create Meta Flow', beta: true, icon: Plus, roles: ['owner', 'admin'], component: LazyCreateMetaFlowPage },
  { href: '/dashboard/flows/docs', label: 'Meta Flow Docs', beta: true, icon: BookCopy, roles: ['owner', 'admin'], component: LazyFlowsUserGuidePage },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Zap, roles: ['owner', 'admin'], component: LazyIntegrationsLayout },
  { href: '/dashboard/whatsapp-pay', label: 'WhatsApp Pay', icon: WaPayIcon, roles: ['owner', 'admin'], component: LazyWhatsAppPayLayout },
  { href: '/dashboard/numbers', label: 'Numbers', icon: Phone, roles: ['owner', 'admin'], component: LazyNumbersPage },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook, roles: ['owner', 'admin'], component: LazyWebhooksPage },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: ['owner', 'admin'], component: LazySettingsPage },
];

const facebookMenuGroups = [
  {
    title: 'General',
    items: [
      { href: '/dashboard/facebook/all-projects', label: 'Project Connections', icon: Wrench, component: LazyAllFacebookPagesPage },
      { href: '/dashboard/facebook', label: 'Dashboard', icon: LayoutDashboard, component: LazyFacebookDashboardPage },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/dashboard/facebook/posts', label: 'Posts', icon: Newspaper, component: LazyFacebookPostsPage },
      { href: '/dashboard/facebook/scheduled', label: 'Scheduled', icon: Calendar, component: LazyScheduledPostsPage },
      { href: '/dashboard/facebook/live-studio', label: 'Live Studio', icon: Video, component: LazyLiveStudioPage },
      { href: '/dashboard/facebook/post-randomizer', label: 'Post Randomizer', icon: Repeat, component: LazyPostRandomizerPage },
    ],
  },
  {
    title: 'Engagement',
    items: [
        { href: '/dashboard/facebook/messages', label: 'Messages', icon: MessageSquare, component: LazyFacebookMessagesPage },
        { href: '/dashboard/facebook/kanban', label: 'Kanban Board', icon: FolderKanban, component: LazyFacebookKanbanPage },
        { href: '/dashboard/facebook/auto-reply', label: 'Automation', icon: Sparkles, component: LazyFacebookAutomationPage },
    ]
  },
  {
    title: 'AI & Automation',
    items: [
        { href: '/dashboard/facebook/agents', label: 'AI Agents', icon: Sparkles, component: LazyFacebookAgentsPage },
        { href: '/dashboard/facebook/knowledge', label: 'Knowledge Base', icon: BookCopy, component: LazyFacebookKnowledgePage },
    ]
  },
   {
    title: 'Custom Shops',
    items: [
      { href: '/dashboard/facebook/custom-ecommerce', label: 'Shops Dashboard', icon: LayoutDashboard, component: LazyCustomEcommerceDashboard },
      { href: '/dashboard/facebook/custom-ecommerce/manage/[shopId]/products', label: 'Products', icon: ShoppingBag, component: LazyEcommProductsPage },
      { href: '/dashboard/facebook/custom-ecommerce/manage/[shopId]/orders', label: 'Orders', icon: Package, component: LazyEcommOrdersPage },
      { href: '/dashboard/facebook/custom-ecommerce/manage/[shopId]/website-builder', label: 'Website Builder', icon: Brush, component: LazyEcommWebsiteBuilderPage },
      { href: '/dashboard/facebook/custom-ecommerce/manage/[shopId]/flow-builder', label: 'Chat Bot', icon: Sparkles, component: LazyEcommFlowBuilderPage },
      { href: '/dashboard/facebook/custom-ecommerce/manage/[shopId]/settings', label: 'Settings', icon: Settings, component: LazyEcommSettingsPage },
    ],
  },
  {
    title: 'Meta Commerce',
    items: [
        { href: '/dashboard/facebook/commerce/products', label: 'Products & Collections', icon: ShoppingBag, component: LazyCommerceProductsPage },
        { href: '/dashboard/facebook/commerce/products/[catalogId]', label: 'Catalog Products', icon: ShoppingBag, component: LazyCatalogProductsPage },
        { href: '/dashboard/facebook/commerce/shop', label: 'Shop Setup', icon: LayoutDashboard, component: LazyCommerceShopPage },
        { href: '/dashboard/facebook/commerce/orders', label: 'Orders', icon: Package, component: LazyCommerceOrdersPage },
        { href: '/dashboard/facebook/commerce/analytics', label: 'Analytics', icon: BarChart, component: LazyCommerceAnalyticsPage },
        { href: '/dashboard/facebook/commerce/api', label: 'APIs', icon: Server, component: LazyCommerceApiPage },
    ]
  },
  {
    title: 'Growth Tools',
    items: [
        { href: '/dashboard/facebook/ads', label: 'Ads Manager', icon: Megaphone, component: LazyFacebookAdsPage },
        { href: '/dashboard/facebook/broadcasts', label: 'Broadcasts', icon: Send, component: LazyFacebookBroadcastsPage },
        { href: '/dashboard/facebook/subscribers', label: 'Subscribers', icon: Users, component: LazyFacebookSubscribersPage },
        { href: '/dashboard/facebook/audiences', label: 'Audiences', icon: Users, component: LazyFacebookAudiencesPage },
    ]
  },
  {
      title: 'Configuration',
      items: [
        { href: '/dashboard/facebook/pages', label: 'All Pages', icon: Newspaper, component: LazyFacebookPagesPage },
        { href: '/dashboard/facebook/webhooks', label: 'Webhooks', icon: Webhook, component: LazyFacebookWebhooksPage },
        { href: '/dashboard/facebook/settings', label: 'Settings', icon: Settings, component: LazyFacebookSettingsPage },
      ]
  }
];

const instagramMenuGroups = [
  {
    title: 'General',
    items: [
      { href: '/dashboard/instagram/connections', label: 'Connections', icon: Wrench, component: LazyInstagramConnectionsPage },
      { href: '/dashboard/instagram/setup', label: 'Setup', icon: Plus, component: LazyInstagramSetupPage },
      { href: '/dashboard/instagram', label: 'Dashboard', icon: LayoutDashboard, component: LazyInstagramDashboardPage },
      { href: '/dashboard/instagram/create-post', label: 'Create Post', icon: Pencil, component: LazyInstagramCreatePostPage },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/dashboard/instagram/feed', label: 'Feed', icon: Newspaper, component: LazyInstagramFeedPage },
      { href: '/dashboard/instagram/stories', label: 'Stories', icon: Clapperboard, component: LazyInstagramStoriesPage },
      { href: '/dashboard/instagram/reels', label: 'Reels', icon: Video, component: LazyInstagramReelsPage },
      { href: '/dashboard/instagram/media/[mediaId]', label: 'Media Details', icon: Video, component: LazyInstagramMediaDetailsPage },
    ],
  },
  {
    title: 'Engagement',
    items: [
        { href: '/dashboard/instagram/messages', label: 'Messages', icon: MessageSquare, component: LazyInstagramMessagesPage },
    ]
  },
  {
    title: 'Growth',
    items: [
        { href: '/dashboard/instagram/discovery', label: 'Discovery', icon: Compass, component: LazyInstagramDiscoveryPage },
        { href: '/dashboard/instagram/hashtag-search', label: 'Hashtag Search', icon: Search, component: LazyInstagramHashtagSearchPage },
    ]
  }
];

const emailMenuItems = [
    { href: '/dashboard/email', label: 'Dashboard', icon: LayoutDashboard, component: LazyEmailDashboardPage },
    { href: '/dashboard/email/inbox', label: 'Inbox', icon: Inbox, component: LazyEmailInboxPage },
    { href: '/dashboard/email/campaigns', label: 'Campaigns', icon: Send, component: LazyEmailCampaignsPage },
    { href: '/dashboard/email/contacts', label: 'Contacts', icon: Contact, component: LazyEmailContactsPage },
    { href: '/dashboard/email/templates', label: 'Templates', icon: FileText, component: LazyEmailTemplatesPage },
    { href: '/dashboard/email/analytics', label: 'Analytics', icon: BarChart, component: LazyEmailAnalyticsPage },
    { href: '/dashboard/email/verification', label: 'Verification', icon: ShieldCheck, component: LazyEmailVerificationPage },
    { href: '/dashboard/email/settings', label: 'Settings', icon: Settings, component: LazyEmailSettingsPage },
];

const smsMenuItems = [
    { href: '/dashboard/sms', label: 'Dashboard', icon: LayoutDashboard, component: LazySmsDashboardPage },
    { href: '/dashboard/sms/campaigns', label: 'Campaigns', icon: Send, component: LazySmsCampaignsPage },
    { href: '/dashboard/sms/contacts', label: 'Contacts', icon: Users, component: LazySmsContactsPage },
    { href: '/dashboard/sms/analytics', label: 'Analytics', icon: BarChart, component: LazySmsAnalyticsPage },
    { href: '/dashboard/sms/settings', label: 'Settings', icon: Settings, component: LazySmsSettingsPage },
];

const apiMenuItems = [
    { href: '/dashboard/api', label: 'API Keys', icon: KeyRound, component: LazyApiKeysPage },
    { href: '/dashboard/api/docs', label: 'API Docs', icon: BookCopy, component: LazyApiDocsPage },
];

const urlShortenerMenuItems = [
    { href: '/dashboard/url-shortener', label: 'Shortener', icon: LinkIcon, component: LazyUrlShortenerPage },
    { href: '/dashboard/url-shortener/settings', label: 'Settings', icon: Settings, component: LazyUrlShortenerSettingsPage },
    { href: '/dashboard/url-shortener/[id]', label: 'Analytics', icon: BarChart, component: LazyShortUrlAnalyticsPage },
];

const qrCodeMakerMenuItems = [
    { href: '/dashboard/qr-code-maker', label: 'QR Maker', icon: QrCode, component: LazyQrCodeMakerPage },
    { href: '/dashboard/qr-code-maker/settings', label: 'Settings', icon: Settings, component: LazyQrCodeSettingsPage },
];

const portfolioMenuItems = [
    { href: '/dashboard/website-builder', label: 'Websites', icon: LayoutDashboard, component: LazyWebsiteBuilderDashboard },
    { href: '/dashboard/portfolio/manage/[portfolioId]/builder', label: 'Portfolio Builder', icon: Brush, component: LazyPortfolioBuilderPage },
];

const seoMenuItems = [
    { href: '/dashboard/seo', label: 'Dashboard', icon: TrendingUp, component: LazySeoDashboardPage },
    { href: '/dashboard/seo/brand-radar', label: 'Brand Radar', icon: Rss, component: LazyBrandRadarPage },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe, component: LazySiteExplorerPage },
];

const allCrmMenuItems = crmMenuItems.flatMap((g) => g.subItems || [g]);

const allMenuItems = [
    ...wachatMenuItems, ...emailMenuItems, ...smsMenuItems, ...apiMenuItems, ...urlShortenerMenuItems,
    ...qrCodeMakerMenuItems, ...portfolioMenuItems, ...seoMenuItems,
    ...facebookMenuGroups.flatMap(g => g.items),
    ...instagramMenuGroups.flatMap(g => g.items),
    ...allCrmMenuItems,
];

const pathComponentMap: { [key: string]: React.ComponentType<any> } = allMenuItems.reduce((acc, item) => {
    if (item.component) {
        acc[item.href] = item.component;
    }
    return acc;
}, {} as { [key: string]: React.ComponentType<any> });

type Tab = {
    id: string;
    title: string;
    icon: React.ElementType;
    href: string;
    component: React.ComponentType;
};

const FullPageSkeleton = () => (
    <div className="flex h-screen w-screen bg-background">
        <div className="w-16 border-r bg-sidebar p-2"><Skeleton className="h-full w-full"/></div>
        <div className="w-60 border-r bg-sidebar-secondary p-2"><Skeleton className="h-full w-full"/></div>
        <div className="flex-1 flex flex-col">
            <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
            <div className="h-12 border-b p-2"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
        </div>
    </div>
);


export function DashboardClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [sessionUser, setSessionUser] = React.useState<any>(null);
    const [projects, setProjects] = React.useState<WithId<Project>[]>([]);
    const [activeProject, setActiveProject] = React.useState<WithId<Project> | null>(null);
    const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
    const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
    const [activeApp, setActiveApp] = React.useState('whatsapp');
    const [isVerifying, setIsVerifying] = React.useState(true);
    const [isDiwaliTheme, setIsDiwaliTheme] = React.useState(false);

    const [openTabs, setOpenTabs] = React.useState<Tab[]>([]);
    const [activeTab, setActiveTab] = React.useState<string | null>(null);

    const isWebsiteBuilderPage = pathname.includes('/builder');
    const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban');
    
    React.useEffect(() => {
        const fetchAndSetData = async () => {
            try {
                const [session, { enabled: diwaliEnabled }] = await Promise.all([getSession(), getDiwaliThemeStatus()]);
                
                if (!session?.user) {
                    router.push('/login');
                    return;
                }
                setSessionUser(session.user);
                setIsDiwaliTheme(diwaliEnabled);

                const { projects: fetchedProjects } = await getProjects() || { projects: [] };
                if (!fetchedProjects || fetchedProjects.length === 0) {
                    setProjects([]);
                    setIsVerifying(false);
                    if(pathname !== '/dashboard/setup') {
                        // router.push('/dashboard/setup');
                    }
                    return;
                }
                setProjects(fetchedProjects);

                const storedProjectId = localStorage.getItem('activeProjectId');
                
                let currentApp = 'whatsapp';
                if (pathname.startsWith('/dashboard/facebook')) { currentApp = 'facebook'; }
                else if (pathname.startsWith('/dashboard/instagram')) { currentApp = 'instagram'; }
                else if (pathname.startsWith('/dashboard/crm')) { currentApp = 'crm'; }
                else if (pathname.startsWith('/dashboard/email')) { currentApp = 'email'; }
                else if (pathname.startsWith('/dashboard/sms')) { currentApp = 'sms'; }
                else if (pathname.startsWith('/dashboard/api')) { currentApp = 'api'; }
                else if (pathname.startsWith('/dashboard/seo')) { currentApp = 'seo-suite'; }
                else if (pathname.startsWith('/dashboard/website-builder') || pathname.startsWith('/dashboard/portfolio')) { currentApp = 'website-builder'; }
                else if (pathname.startsWith('/dashboard/url-shortener')) { currentApp = 'url-shortener'; }
                else if (pathname.startsWith('/dashboard/qr-code-maker')) { currentApp = 'qr-code-maker'; }
                setActiveApp(currentApp);

                const projectExists = fetchedProjects.some(p => p._id.toString() === storedProjectId);

                if (pathname === '/dashboard') {
                    localStorage.removeItem('activeProjectId');
                    localStorage.removeItem('activeProjectName');
                    setActiveProjectId(null);
                    setActiveProjectName(null);
                    setActiveProject(null);
                } else if (storedProjectId && projectExists) {
                    setActiveProjectId(storedProjectId);
                    const currentActiveProject = fetchedProjects.find(p => p._id.toString() === storedProjectId);
                    setActiveProject(currentActiveProject || null);
                    setActiveProjectName(currentActiveProject?.name || 'Loading...');
                } else {
                    localStorage.removeItem('activeProjectId');
                    localStorage.removeItem('activeProjectName');
                    setActiveProjectId(null);
                    setActiveProjectName('Select a Project');
                    setActiveProject(null);
                }
            } catch (error) {
                console.error("Failed to initialize dashboard layout:", error);
                router.push('/login');
            } finally {
                setIsVerifying(false);
            }
        };
            
        fetchAndSetData();
    }, [pathname, router]);

    const getUrlParent = (url: string) => url.substring(0, url.lastIndexOf('/'));
        
    const openTab = React.useCallback((item: { href: string; label: string; icon: React.ElementType, component?: React.ComponentType }) => {
        const tabId = item.href;
        const activeTabObject = openTabs.find(tab => tab.id === activeTab);
        const activeTabParent = activeTabObject ? getUrlParent(activeTabObject.href) : null;
        const newTabParent = getUrlParent(item.href);

        if (activeTabParent && newTabParent.startsWith(activeTabParent) && !item.href.includes('[') && !activeTabParent.includes('[')) {
            const updatedTabs = openTabs.map(tab => 
                tab.id === activeTab 
                    ? { ...tab, id: tabId, title: item.label, href: item.href, icon: item.icon, component: item.component! }
                    : tab
            );
            setOpenTabs(updatedTabs);
        } else if (!openTabs.some(tab => tab.id === tabId)) {
            if(item.component){
                setOpenTabs(prev => [...prev, { id: tabId, title: item.label, href: item.href, icon: item.icon, component: item.component! }]);
            }
        }
        setActiveTab(tabId);
        if(pathname !== item.href) {
            router.push(item.href, { scroll: false });
        }
    }, [openTabs, activeTab, router, pathname]);

    const closeTab = (tabId: string) => {
        const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
        setOpenTabs(prev => prev.filter(tab => tab.id !== tabId));

        if (activeTab === tabId) {
            const nextTab = openTabs[tabIndex - 1] || openTabs[tabIndex + 1] || null;
            setActiveTab(nextTab?.id || null);
            if (nextTab) {
                router.push(nextTab.href, { scroll: false });
            } else {
                router.push('/dashboard', { scroll: false });
            }
        }
    };
        
    React.useEffect(() => {
        const matchingItem = allMenuItems.find(item => {
            if(item.href.includes('[')) {
                const regex = new RegExp(`^${item.href.replace(/\[\w+\]/g, '([^/]+)')}$`);
                return regex.test(pathname);
            }
            return item.href === pathname;
        });

        if (matchingItem && matchingItem.component) {
            const activeTabInList = openTabs.find(t => t.id === activeTab);
            const title = activeTabInList ? activeTabInList.title : matchingItem.label;
            openTab({ ...matchingItem, href: pathname, label: title });
        }
        
        if (activeTab !== pathname && openTabs.some(t => t.id === pathname)) {
        setActiveTab(pathname);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const facebookProjects = projects.filter(p => p.facebookPageId && !p.wabaId);

    const currentUserRole = React.useMemo(() => {
        if (!sessionUser || !activeProject) return 'owner'; 
        if (sessionUser._id.toString() === activeProject.userId.toString()) return 'owner';
        const agentInfo = activeProject.agents?.find(a => a.userId.toString() === sessionUser._id);
        return agentInfo?.role || 'none';
    }, [sessionUser, activeProject]);

    const menuGroups = React.useMemo(() => {
        let groups: any[];
        
        switch (activeApp) {
            case 'facebook': groups = facebookMenuGroups; break;
            case 'instagram': groups = instagramMenuGroups; break;
            case 'crm': groups = [{ title: 'CRM Suite', items: crmMenuItems }]; break;
            case 'email': groups = [{ title: null, items: emailMenuItems }]; break;
            case 'sms': groups = [{ title: null, items: smsMenuItems }]; break;
            case 'api': groups = [{ title: null, items: apiMenuItems }]; break;
            case 'seo-suite': groups = [{ title: null, items: seoMenuItems }]; break;
            case 'website-builder': groups = [{ title: null, items: portfolioMenuItems }]; break;
            case 'url-shortener': groups = [{ title: null, items: urlShortenerMenuItems }]; break;
            case 'qr-code-maker': groups = [{ title: null, items: qrCodeMakerMenuItems }]; break;
            default: groups = [{ title: null, items: wachatMenuItems }]; break;
        }
        
        return groups.map((group: any) => ({
            ...group,
            items: (group.items || []).filter((item: any) => item.roles ? item.roles.includes(currentUserRole) : true)
        }));
    }, [activeApp, currentUserRole]);

    const appIcons = [
        { id: 'whatsapp', icon: WhatsAppIcon, label: 'Wachat Suite', href: '/dashboard' },
        { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite' },
        { id: 'instagram', href: '/dashboard/instagram/connections', icon: InstagramIcon, label: 'Instagram Suite' },
        { id: 'crm', href: '/dashboard/crm', icon: Handshake, label: 'CRM Suite' },
        { id: 'email', icon: Mail, label: 'Email Suite', href: '/dashboard/email' },
        { id: 'sms', icon: MessageSquare, label: 'SMS Suite', href: '/dashboard/sms' },
        { id: 'api', icon: Server, label: 'API & Dev', href: '/dashboard/api' },
        { id: 'website-builder', icon: Brush, label: 'Website Builder', href: '/dashboard/website-builder' },
        { id: 'url-shortener', icon: LinkIcon, label: 'URL Shortener', href: '/dashboard/url-shortener' },
        { id: 'qr-code-maker', icon: QrCode, label: 'QR Code Maker', href: '/dashboard/qr-code-maker' },
        { id: 'seo-suite', icon: SeoIcon, label: 'SEO Suite', href: '/dashboard/seo' },
    ];
        
    if (isWebsiteBuilderPage || isChatPage) {
        return <div className={cn(isDiwaliTheme && 'diwali-theme')}>{children}</div>;
    }

    const renderMenuItems = (items: any[], isSubmenu = false) => {
        return items.map((item: any) => {
            if (!item.component && !item.subItems) return null;
            const isActive = activeTab === item.href;
            return (
                <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                        asChild={!item.subItems}
                        isActive={isActive}
                        tooltip={item.label}
                        className={isSubmenu ? 'h-8' : ''}
                        onClick={() => item.component && openTab(item)}
                        subItems={item.subItems}
                    >
                        <button>
                            <item.icon className="h-4 w-4" />
                            <span className="truncate">{item.label}</span>
                            {item.beta && <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">Beta</Badge>}
                        </button>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            );
        });
    };

    const renderGroupedMenuItems = (groups: any[]) => {
        return groups.map((group, groupIndex) => (
            <React.Fragment key={group.title || groupIndex}>
                {group.title && (
                    <SidebarGroupLabel className="group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:pl-2">
                        <span className="group-data-[collapsible=icon]:hidden">{group.title}</span>
                    </SidebarGroupLabel>
                )}
                
                {group.items && renderMenuItems(group.items, false)}

                {groupIndex < groups.length - 1 && <SidebarSeparator />}
            </React.Fragment>
        ));
    };

    const ActiveComponent = openTabs.find(tab => tab.id === activeTab)?.component;
    
    return (
        <SidebarProvider>
            <div className={cn("flex h-screen bg-background", isDiwaliTheme && 'diwali-theme')}>
                 {isVerifying ? (
                    <FullPageSkeleton />
                ) : (
                    <>
                    {/* Primary Sidebar Rail */}
                    <div className="flex-shrink-0 w-16 border-r bg-sidebar flex flex-col items-center py-4 space-y-2">
                        <Link href="/dashboard" className="mb-4">
                        <SabNodeLogo className="h-8 w-auto" />
                        </Link>
                        {appIcons.map(app => (
                            <SidebarMenuButton
                                key={app.id}
                                asChild
                                tooltip={app.label}
                                isActive={activeApp === app.id}
                                className={cn(
                                    'h-10 w-10 rounded-lg transition-colors',
                                    activeApp === app.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'
                                )}
                            >
                                <Link href={app.href} scroll={false}><app.icon className="h-5 w-5"/></Link>
                            </SidebarMenuButton>
                        ))}
                    </div>

                    {/* Secondary Sidebar */}
                    <Sidebar
                        variant="sidebar"
                        collapsible="icon"
                        className="peer group/sidebar w-[240px] border-r bg-sidebar-secondary"
                    >
                    <SidebarHeader className="p-4 flex items-center gap-2">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <SabNodeLogo className="h-8 w-auto" />
                        </Link>
                        <span className="text-lg font-semibold truncate group-data-[collapsible=icon]:hidden">
                            SabNode
                        </span>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarMenu>
                        {renderGroupedMenuItems(menuGroups)}
                        </SidebarMenu>
                    </SidebarContent>
                    <SidebarFooter>
                        <SidebarMenu>
                        <SidebarMenuItem>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton asChild tooltip="My Account">
                                <button>
                                    <Avatar className="size-7">
                                    <AvatarImage src="https://placehold.co/100x100.png" alt="User Avatar" data-ai-hint="person avatar"/>
                                    <AvatarFallback>{sessionUser?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate group-data-[collapsible=icon]:hidden">{sessionUser?.name || 'My Account'}</span>
                                </button>
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start">
                                <DropdownMenuLabel>{sessionUser?.name || 'My Account'}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                <button className="w-full" onClick={() => openTab({ href: '/dashboard/profile', label: 'Profile', icon: Users, component: LazyProfilePage })}>Profile</button>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                <button className="w-full" onClick={() => openTab({ href: '/dashboard/billing', label: 'Billing', icon: CreditCard, component: LazyBillingPage })}>Billing</button>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                <Link href="/api/auth/logout">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Logout</span>
                                </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                    </Sidebar>
                    
                    <div className="flex-1 flex flex-col min-w-0">
                    <header className="flex h-16 items-center justify-between gap-4 border-b px-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger />
                        </div>
                        <div className="flex items-center gap-2">
                            {activeApp === 'facebook' && activeProject ? (
                                <FacebookProjectSwitcher projects={facebookProjects} activeProject={activeProject} />
                            ) : (
                                <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-primary">
                                    <Briefcase className="h-4 w-4" />
                                    <span className="truncate">{activeProjectName || 'No Project Selected'}</span>
                                </div>
                            )}
                            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                                <CreditCard className="h-4 w-4" />
                                <span>Credits: {sessionUser?.credits?.toLocaleString() || 0}</span>
                            </div>
                        </div>
                    </header>
                    <main className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-shrink-0 border-b">
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex w-max">
                                    {openTabs.map(tab => (
                                        <div key={tab.id} className={cn("flex items-center border-r transition-colors", activeTab === tab.id ? 'bg-background' : 'bg-muted hover:bg-background/80')}>
                                            <Button variant="ghost" className="h-10 px-3 rounded-none" onClick={() => openTab(tab)}>
                                                <tab.icon className="mr-2 h-4 w-4"/> {tab.title}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm mr-2" onClick={() => closeTab(tab.id)}>
                                                <X className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {openTabs.map(tab => (
                                <div key={tab.id} className={cn("h-full w-full", activeTab === tab.id ? 'block' : 'hidden')}>
                                    <div className="p-4 md:p-6 lg:p-8">
                                        <React.Suspense fallback={<Skeleton className="h-full w-full" />}>
                                            {React.createElement(tab.component, { children })}
                                        </React.Suspense>
                                    </div>
                                </div>
                            ))}
                            {openTabs.length === 0 && (
                                <div className="h-full w-full p-4 md:p-6 lg:p-8">
                                    {children}
                                </div>
                            )}
                        </div>
                    </main>
                    </div>
                </>
                )}
            </div>
        </SidebarProvider>
    );
}

