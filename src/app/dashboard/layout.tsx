
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, LogOut, CreditCard, LoaderCircle, Wrench, Menu } from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { getSession, getProjects } from '@/app/actions';
import { getDiwaliThemeStatus } from '@/app/actions/admin.actions';
import type { WithId, Project, User, Plan } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/wabasimplify/facebook-project-switcher';
import { cn } from '@/lib/utils';

const FullPageSkeleton = () => (
    <div className="flex h-screen w-screen bg-background">
        <div className="flex-1 flex flex-col">
            <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
        </div>
    </div>
);

export default function RootDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [sessionUser, setSessionUser] = React.useState<any>(null);
  const [projects, setProjects] = React.useState<WithId<Project>[]>([]);
  const [activeProject, setActiveProject] = React.useState<WithId<Project> | null>(null);
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [isDiwaliTheme, setIsDiwaliTheme] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  
  const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban');
  const isWebsiteBuilderPage = pathname.includes('/builder');
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if(!isClient) return;

    const fetchAndSetData = async () => {
        try {
            const [session, diwaliStatus] = await Promise.all([getSession(), getDiwaliThemeStatus()]);
            
            if (!session?.user) {
                router.push('/login');
                return;
            }
            setSessionUser(session.user);
            setIsDiwaliTheme(diwaliStatus?.enabled || false);

            const { projects: fetchedProjects } = await getProjects() || { projects: [] };
            if (!fetchedProjects || fetchedProjects.length === 0) {
                setProjects([]);
                setIsVerifying(false);
                if(pathname !== '/dashboard/setup') {
                    router.push('/dashboard/setup');
                }
                return;
            }
            setProjects(fetchedProjects);

            const storedProjectId = localStorage.getItem('activeProjectId');
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
  }, [pathname, router, isClient]);

  if (!isClient || isVerifying) {
    return <FullPageSkeleton />;
  }

  const facebookProjects = projects.filter(p => p.facebookPageId && !p.wabaId);
  const activeApp = pathname.startsWith('/dashboard/facebook') ? 'facebook' : 'whatsapp';
  
  const mainContent = (
    <div className="p-4 md:p-6 lg:p-8">
        {children}
    </div>
  );

  return (
      <div className={cn("flex h-screen bg-background", isDiwaliTheme && 'diwali-theme')}>
        <div className="flex-1 flex flex-col min-w-0">
            <header className="flex h-16 items-center justify-between gap-4 border-b px-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                     <Link href="/dashboard" className="flex items-center gap-2">
                        <SabNodeLogo className="h-8 w-auto" />
                    </Link>
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
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex items-center gap-2">
                                <Avatar className="size-7">
                                    <AvatarImage src="https://placehold.co/100x100.png" alt="User Avatar" data-ai-hint="person avatar"/>
                                    <AvatarFallback>{sessionUser?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                                <span className="hidden md:inline">{sessionUser?.name || 'My Account'}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{sessionUser?.name || 'My Account'}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild><Link href="/dashboard/profile">Profile</Link></DropdownMenuItem>
                            <DropdownMenuItem asChild><Link href="/dashboard/billing">Billing</Link></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild><Link href="/api/auth/logout"><LogOut className="mr-2 h-4 w-4" /><span>Logout</span></Link></DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto">
                {isChatPage || isWebsiteBuilderPage ? children : mainContent}
            </main>
        </div>
      </div>
  );
}
