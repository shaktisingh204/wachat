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
import { RouteTransition } from '@/components/motion';

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
        if (pathname === '/home') { currentApp = 'home'; }
        else if (pathname.startsWith('/dashboard/sabflow')) { currentApp = 'sabflow'; }
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

    const isHomePage = pathname === '/home';
    // Note: 'ad-manager' is intentionally excluded from the "needs project" gate.
    // Its project switcher lives inside the sidebar, so gating the sidebar on a
    // selected project creates a catch-22 where the user can never reach the
    // switcher. Ad Manager is scoped by ad account anyway, not project.
    const showSidebar = !isHomePage && !(!activeProject?._id && ['whatsapp', 'facebook', 'instagram'].includes(activeApp));

    return (
        <SidebarProvider defaultOpen={false}>
            <div data-app={activeApp} style={{ backgroundColor: 'var(--app-bg)' }} className={cn("admin-dashboard flex h-screen w-full flex-col relative overflow-hidden", appRailPosition === 'top' ? 'app-rail-top' : 'app-rail-left')}>
                {/* Ambient theme blobs — color derived from per-app CSS vars */}
                <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
                    <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full blur-[90px] transition-colors duration-700" style={{ background: 'var(--app-blob1)' }} />
                    <div className="absolute top-1/2 -right-24 h-80 w-80 rounded-full blur-[100px] transition-colors duration-700" style={{ background: 'var(--app-blob2)' }} />
                    <div className="absolute bottom-0 left-1/3 h-60 w-60 rounded-full blur-[70px] transition-colors duration-700" style={{ background: 'var(--app-blob3)' }} />
                    <div className="absolute top-1/4 left-1/2 h-48 w-48 rounded-full blur-[80px] transition-colors duration-700" style={{ background: 'var(--app-blob4)' }} />
                </div>

                <div className="relative z-10">
                    <AdminHeader appRailPosition={appRailPosition} activeApp={activeApp} />
                </div>

                <div className="relative z-10 flex flex-1 overflow-hidden">
                    {appRailPosition === 'left' && <AppRail activeApp={activeApp} />}

                    {showSidebar && (
                        <div
                            className="hidden md:flex my-2 mr-0 ml-1 rounded-2xl h-[calc(100%-1rem)] shadow-xl overflow-hidden transition-all duration-500 animate-fade-in shrink-0"
                            style={{
                                background: 'hsl(var(--card) / 0.85)',
                                backdropFilter: 'blur(24px)',
                                WebkitBackdropFilter: 'blur(24px)',
                                border: '1px solid var(--app-border)',
                            }}
                        >
                            <AppSidebar activeApp={activeApp} currentUserRole={currentUserRole} />
                        </div>
                    )}

                    <main className="flex-1 overflow-hidden relative transition-all duration-300 p-2 pl-1">
                        {isChatPage || isBuilderPage ? (
                            <div
                                className="h-full overflow-hidden rounded-2xl shadow-xl"
                                style={{
                                    background: 'hsl(var(--card) / 0.85)',
                                    backdropFilter: 'blur(24px)',
                                    WebkitBackdropFilter: 'blur(24px)',
                                    border: '1px solid var(--app-border)',
                                }}
                            >
                                <RouteTransition>{children}</RouteTransition>
                            </div>
                        ) : (
                            <div
                                className="h-full overflow-y-auto rounded-2xl shadow-xl px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
                                style={{
                                    background: 'hsl(var(--card) / 0.85)',
                                    backdropFilter: 'blur(24px)',
                                    WebkitBackdropFilter: 'blur(24px)',
                                    border: '1px solid var(--app-border)',
                                }}
                            >
                                <div className="mx-auto w-full max-w-[1600px]">
                                    <RouteTransition>{children}</RouteTransition>
                                </div>
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
