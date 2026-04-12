'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { getProjects } from "@/app/actions/project.actions"
import { getSession } from '@/app/actions/user.actions';
import { ProjectProvider } from '@/context/project-context';
import { AdManagerProvider } from '@/context/ad-manager-context';
import { AdminLayout } from '@/components/admin-panel/layout/admin-layout';

const FullPageSkeleton = () => (
    <div className="flex h-screen w-screen bg-background p-2 gap-2">
        <div className="w-16 rounded-lg bg-card p-2"><Skeleton className="h-full w-full" /></div>
        <div className="w-[70px] rounded-lg bg-card p-2"><Skeleton className="h-full w-full" /></div>
        <div className="flex-1 flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-card p-4"><Skeleton className="h-full w-full" /></div>
            <div className="flex-1 rounded-lg bg-card p-4"><Skeleton className="h-full w-full" /></div>
        </div>
    </div>
);

// This is the main exported component
export function DashboardClientLayout({ children }: { children: React.ReactNode }) {
    const [isClient, setIsClient] = React.useState(false);
    const [initialData, setInitialData] = React.useState<{ user: any, projects: any[] } | null>(null);
    const router = useRouter();

    React.useEffect(() => {
        setIsClient(true);
        const fetchInitial = async () => {
            try {
                const session = await getSession();
                if (!session?.user) {
                    router.push('/login');
                    return;
                }
                // Gate: if the user has an onboarding record that hasn't
                // been completed yet, push them back into the wizard.
                // Users created before the onboarding feature (no
                // `onboarding` field at all) are grandfathered through.
                const onboarding = (session.user as any).onboarding;
                if (onboarding && onboarding.status !== 'complete') {
                    router.push('/onboarding');
                    return;
                }
                const projects = await getProjects() || [];
                setInitialData({ user: session.user, projects });
            } catch (error) {
                console.error("Initialization failed:", error);
                router.push('/login');
            }
        };
        fetchInitial();
    }, [router]);

    if (!isClient || !initialData) {
        return <FullPageSkeleton />;
    }

    return (
        <ProjectProvider initialProjects={initialData.projects} user={initialData.user}>
            <AdManagerProvider>
                <AdminLayout>{children}</AdminLayout>
            </AdManagerProvider>
        </ProjectProvider>
    );
}
