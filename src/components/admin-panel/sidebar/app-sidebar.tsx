'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import {
    wachatMenuItems,
    crmMenuItems,
    adManagerMenuItems,
    sabChatMenuItems,
    sabflowMenuItems,
    facebookMenuGroups,
    instagramMenuGroups,
    emailMenuItems,
    smsMenuItems,
    apiMenuItems,
    urlShortenerMenuItems,
    qrCodeMakerMenuItems,
    portfolioMenuItems,
    seoMenuItems,
    userSettingsItems,
    teamMenuItems,
    MenuItem,
    MenuGroup
} from '@/config/dashboard-config';
import { useAdManager } from '@/context/ad-manager-context';

/* -------------------------------------------------------------------------------------------------
 * Helper Components
 * ------------------------------------------------------------------------------------------------- */

const SidebarItem = ({ item, isSubItem = false }: { item: MenuItem; isSubItem?: boolean }) => {
    const pathname = usePathname();
    const { isOpen } = useSidebar();
    const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const LinkIcon = item.icon;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className={cn(isSubItem && "pl-10")}>
                <Link href={item.href}>
                    {LinkIcon && <LinkIcon className="h-5 w-5 shrink-0" />}
                    <span className={cn("ml-2 whitespace-nowrap transition-all duration-300", !isOpen && "w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:opacity-100")}>
                        {item.label}
                    </span>
                    {item.new && <Badge className="ml-auto text-[10px] h-5 px-1.5">New</Badge>}
                    {item.beta && <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">Beta</Badge>}
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
};

const CollapsibleSidebarItem = ({ item }: { item: MenuItem }) => {
    const pathname = usePathname();
    const { isOpen } = useSidebar();
    const isOpenPath = pathname.startsWith(item.href || item.label);
    const Icon = item.icon;

    return (
        <Collapsible defaultOpen={isOpenPath} className="group/collapsible">
            <CollapsibleTrigger asChild>
                <SidebarMenuButton isActive={isOpenPath} tooltip={item.label} className="w-full">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-5 w-5 shrink-0" />}
                        <span className={cn("whitespace-nowrap transition-all duration-300", !pathname.startsWith(item.href) && !isOpen && "w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:opacity-100")}>
                            {item.label}
                        </span>
                    </div>
                    <ChevronRight className={cn("ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90", !isOpen && "hidden group-hover:block")} />
                </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent asChild>
                <SidebarMenu className="pl-4 border-l ml-3.5 my-1 border-border/40">
                    {(item.subItems || item.subSubItems || []).map((subItem: any, index: number) =>
                        subItem.subSubItems ? (
                            <CollapsibleSidebarItem key={subItem.label || index} item={subItem} />
                        ) : (
                            <SidebarItem key={subItem.href || index} item={subItem} isSubItem={true} />
                        )
                    )}
                </SidebarMenu>
            </CollapsibleContent>
        </Collapsible>
    );
};

/* -------------------------------------------------------------------------------------------------
 * Main Component
 * ------------------------------------------------------------------------------------------------- */

interface AppSidebarProps {
    activeApp: string;
    currentUserRole: string;
}

export function AppSidebar({ activeApp, currentUserRole }: AppSidebarProps) {
    const { isOpen } = useSidebar();
    const { activeAccount } = useAdManager();

    // -- Render Logic based on active app --

    const renderContent = () => {
        switch (activeApp) {
            case 'whatsapp':
                return wachatMenuItems
                    .filter(item => item.roles?.includes(currentUserRole))
                    .map(item => <SidebarItem key={item.href} item={item} />);

            case 'ad-manager':
                if (!activeAccount) {
                    const accountsItem = adManagerMenuItems.find(item => item.href.includes('ad-accounts'));
                    return accountsItem ? <SidebarItem item={accountsItem} /> : null;
                }
                return adManagerMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'sabchat':
                return sabChatMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'sabflow':
                return sabflowMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'facebook':
                return facebookMenuGroups.map((group) => (
                    <React.Fragment key={group.title}>
                        <div className={cn("px-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mt-6 mb-2 transition-all duration-300 whitespace-nowrap", !isOpen && "hidden group-hover:block")}>
                            {group.title}
                        </div>
                        {group.items.map(item => <SidebarItem key={item.href} item={item} />)}
                    </React.Fragment>
                ));

            case 'instagram':
                return instagramMenuGroups.flatMap(g => g.items).map(item => <SidebarItem key={item.href} item={item} />);

            case 'crm':
                return crmMenuItems.map(item => item.subItems ? <CollapsibleSidebarItem key={item.href} item={item} /> : <SidebarItem key={item.href} item={item} />);

            case 'team':
                return teamMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'email':
                return emailMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'sms':
                return smsMenuItems.map(item => item.subItems ? <CollapsibleSidebarItem key={item.href} item={item} /> : <SidebarItem key={item.href} item={item} />);

            case 'api':
                return apiMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'website-builder':
                return portfolioMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'url-shortener':
                return urlShortenerMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'qr-code-maker':
                return qrCodeMakerMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'seo-suite':
                return seoMenuItems.map(item => <SidebarItem key={item.href} item={item} />);

            case 'user-settings':
                return userSettingsItems.map(item => <SidebarItem key={item.href} item={item} />);

            default:
                return null;
        }
    };

    // If no active project or special conditions could be checked here to hide sidebar
    // But mostly controlled by parent layout.

    return (
        <Sidebar
            collapsible="icon"
            className="border-none bg-transparent shadow-none"
        >
            <SidebarHeader className="h-16 flex items-center justify-center p-0">
                {/* Header content if needed, e.g. project switcher could go here if not in main header */}
            </SidebarHeader>
            <SidebarContent className="px-2">
                <SidebarMenu>
                    {renderContent()}
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
    );
}
