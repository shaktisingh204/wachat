'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useProject } from '@/context/project-context';
import { getDiwaliThemeStatus } from '@/app/actions/admin.actions';
import { AppSidebar } from '@/components/admin-panel/sidebar/app-sidebar';
import { AppRail } from '@/components/admin-panel/sidebar/app-rail';
import { AdminHeader } from '@/components/admin-panel/header/admin-header';

interface AdminLayoutProps {
    children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
    const pathname = usePathname();
    const { sessionUser, activeProject } = useProject();

    // State
    const [activeApp, setActiveApp] = React.useState('whatsapp');
    const [isSparklesEnabled, setIsSparklesEnabled] = React.useState(false);

    const appRailPosition = sessionUser?.appRailPosition || 'left';

    // Effects
    React.useEffect(() => {
        getDiwaliThemeStatus().then(status => setIsSparklesEnabled(status.enabled));
    }, []);

    React.useEffect(() => {
        let currentApp = 'whatsapp';
        if (pathname.startsWith('/dashboard/sabflow')) { currentApp = 'sabflow'; }
        else if (pathname.startsWith('/dashboard/ad-manager')) { currentApp = 'ad-manager'; }
        else if (pathname.startsWith('/dashboard/facebook')) { currentApp = 'facebook'; }
        else if (pathname.startsWith('/dashboard/instagram')) { currentApp = 'instagram'; }
        else if (pathname.startsWith('/dashboard/crm')) { currentApp = 'crm'; }
        else if (pathname.startsWith('/dashboard/team')) { currentApp = 'team'; }
        else if (pathname.startsWith('/dashboard/email')) { currentApp = 'email'; }
        else if (pathname.startsWith('/dashboard/sms')) { currentApp = 'sms'; }
        else if (pathname.startsWith('/dashboard/api')) { currentApp = 'api'; }
        else if (pathname.startsWith('/dashboard/seo')) { currentApp = 'seo-suite'; }
        else if (pathname.startsWith('/dashboard/sabchat')) { currentApp = 'sabchat'; }
        else if (pathname.startsWith('/dashboard/website-builder') || pathname.startsWith('/dashboard/portfolio')) { currentApp = 'website-builder'; }
        else if (pathname.startsWith('/dashboard/url-shortener')) { currentApp = 'url-shortener'; }
        else if (pathname.startsWith('/dashboard/qr-code-maker')) { currentApp = 'qr-code-maker'; }
        else if (pathname.startsWith('/dashboard/user')) { currentApp = 'user-settings'; }
        else if (pathname.startsWith('/dashboard/settings')) { currentApp = 'whatsapp'; }
        setActiveApp(currentApp);
    }, [pathname]);

    // Roles and Permissions logic
    const currentUserRole = React.useMemo(() => {
        if (!sessionUser || !activeProject) return 'owner';
        if (sessionUser._id.toString() === activeProject.userId.toString()) return 'owner';
        const agentInfo = activeProject.agents?.find((a: any) => a.userId.toString() === sessionUser._id.toString());
        return agentInfo?.role || 'none';
    }, [sessionUser, activeProject]);

    // Page type detection
    const isChatPage = pathname.startsWith('/dashboard/chat') ||
        pathname.startsWith('/dashboard/facebook/messages') ||
        pathname.startsWith('/dashboard/facebook/kanban') ||
        pathname.startsWith('/dashboard/sabchat/inbox');

    const isBuilderPage = pathname.includes('builder') && !pathname.includes('website-builder'); // Keep sidebar for website builder mainly, but maybe not flow builder

    const showSidebar = !(!activeProject?._id && ['whatsapp', 'facebook', 'instagram', 'ad-manager'].includes(activeApp));

    return (
        <SidebarProvider defaultOpen={false}>
            <div className={cn("admin-dashboard flex h-screen w-full flex-col bg-muted/40", appRailPosition === 'top' ? 'app-rail-top' : 'app-rail-left')}>

                <AdminHeader appRailPosition={appRailPosition} activeApp={activeApp} />

                <div className="flex flex-1 overflow-hidden">
                    {appRailPosition === 'left' && <AppRail activeApp={activeApp} />}

                    {showSidebar && (
                        <div className="hidden md:flex m-2 ml-0 rounded-2xl h-[calc(100%-1rem)] shadow-lg border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
                            <AppSidebar activeApp={activeApp} currentUserRole={currentUserRole} />
                        </div>
                    )}

                    <main className={cn("flex-1 overflow-hidden relative transition-all duration-300",
                        isChatPage || isBuilderPage ? "" : "p-4 md:p-6 lg:p-8 pt-0")}>
                        {isChatPage || isBuilderPage ? (
                            children
                        ) : (
                            <div className="h-full overflow-y-auto rounded-3xl bg-background/50 backdrop-blur-md shadow-sm border border-white/20 p-4 md:p-6">
                                {children}
                            </div>
                        )}
                    </main>
                </div>
            </div>
            {isSparklesEnabled && (
                <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
                    {/* Sparkles effect can be re-added here if needed */}
                </div>
            )}
        </SidebarProvider>
    );
}
