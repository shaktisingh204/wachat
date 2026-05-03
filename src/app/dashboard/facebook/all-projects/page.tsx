'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects } from "@/app/actions";
import type { WithId, Project } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ManualFacebookSetupDialog } from '@/components/wabasimplify/manual-facebook-setup-dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FacebookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import {
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    CheckCircle2,
    ExternalLink,
    Image,
    MessageSquare,
    Megaphone,
    RefreshCw,
    Settings,
    ShoppingBag,
    Sparkles,
    Users,
    Zap,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Features unlocked by connecting a Facebook Page                     */
/* ------------------------------------------------------------------ */

const FEATURES = [
    { icon: MessageSquare, label: 'Messenger Inbox',  description: 'Manage all customer messages in one place',  color: 'from-blue-500/15 to-blue-500/0 text-blue-700 border-blue-200/60' },
    { icon: Megaphone,     label: 'Broadcasts',       description: 'Send campaigns to your page followers',       color: 'from-violet-500/15 to-violet-500/0 text-violet-700 border-violet-200/60' },
    { icon: Zap,           label: 'Auto Replies',     description: 'Respond instantly with flow automation',      color: 'from-emerald-500/15 to-emerald-500/0 text-emerald-700 border-emerald-200/60' },
    { icon: Image,         label: 'Post Scheduler',   description: 'Plan and publish posts on a schedule',        color: 'from-amber-500/15 to-amber-500/0 text-amber-700 border-amber-200/60' },
    { icon: ShoppingBag,   label: 'Commerce',         description: 'Sync your catalog and manage orders',         color: 'from-orange-500/15 to-orange-500/0 text-orange-700 border-orange-200/60' },
    { icon: BarChart3,     label: 'Analytics',        description: 'Track reach, engagement and conversions',     color: 'from-teal-500/15 to-teal-500/0 text-teal-700 border-teal-200/60' },
];

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-44 w-full rounded-3xl" />
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Connected page card                                                  */
/* ------------------------------------------------------------------ */

function ConnectedPageCard({ project }: { project: WithId<Project> }) {
    const router = useRouter();

    const handleManage = () => {
        localStorage.setItem('activeProjectId', project._id.toString());
        localStorage.setItem('activeProjectName', project.name);
        router.push('/dashboard/facebook');
    };

    return (
        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-blue-200/50 bg-white/70 backdrop-blur-xl shadow-sm transition hover:shadow-lg hover:border-blue-300/60 hover:-translate-y-0.5">
            {/* Top accent line */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400" />

            <div className="flex flex-1 flex-col p-5 gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-12 w-12 rounded-xl border-2 border-blue-100 shadow-sm">
                            <AvatarImage src={`https://graph.facebook.com/${project.facebookPageId}/picture?type=large`} />
                            <AvatarFallback className="rounded-xl bg-blue-100 text-blue-700">
                                <FacebookIcon className="h-6 w-6" />
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 border-2 border-white shadow">
                            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                        </div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground truncate">ID: {project.facebookPageId}</p>
                    </div>
                    <Badge className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 hover:bg-emerald-100">
                        Live
                    </Badge>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: 'Messages', href: '/dashboard/facebook/messages' },
                        { label: 'Posts',    href: '/dashboard/facebook/posts' },
                        { label: 'Commerce', href: '/dashboard/facebook/commerce/products' },
                    ].map((link) => (
                        <button
                            key={link.label}
                            onClick={() => {
                                localStorage.setItem('activeProjectId', project._id.toString());
                                localStorage.setItem('activeProjectName', project.name);
                                router.push(link.href);
                            }}
                            className="rounded-xl bg-blue-50/80 border border-blue-100/60 px-2 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition text-center"
                        >
                            {link.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 border-t border-blue-100/50 bg-blue-50/30 px-5 py-3">
                <a
                    href={`https://facebook.com/${project.facebookPageId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-600 transition"
                >
                    <ExternalLink className="h-3 w-3" /> Facebook
                </a>
                <div className="flex-1" />
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg border-blue-200/60 text-xs hover:bg-blue-50"
                    onClick={handleManage}
                >
                    <Settings className="mr-1.5 h-3 w-3" /> Manage
                </Button>
                <Button
                    size="sm"
                    className="h-7 rounded-lg text-xs"
                    onClick={handleManage}
                >
                    Open <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

function EmptyState({ appId, onSuccess }: { appId: string | undefined; onSuccess: () => void }) {
    return (
        <div className="relative overflow-hidden rounded-3xl border border-blue-200/40 bg-gradient-to-br from-blue-50 via-white to-indigo-50/60">
            {/* Blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl" />
                <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-indigo-200/20 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/30 blur-2xl" />
            </div>

            <div className="relative px-6 py-14 md:px-12 md:py-16">
                {/* Hero */}
                <div className="mx-auto max-w-2xl text-center space-y-4">
                    {/* Icon */}
                    <div className="relative mx-auto w-fit mb-6">
                        <div className="absolute inset-0 rounded-3xl bg-[#1877F2]/20 blur-xl scale-110" />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl shadow-[0_8px_32px_rgba(24,119,242,0.4)]" style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5bbd 100%)' }}>
                            <FacebookIcon className="h-10 w-10 text-white" />
                        </div>
                        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                        <div className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-indigo-400 shadow-lg" />
                    </div>

                    <Badge className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-4 py-1 text-xs font-semibold hover:bg-blue-100">
                        <Sparkles className="mr-1.5 h-3 w-3" /> Meta Business Suite Integration
                    </Badge>

                    <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                        No Pages Connected{' '}
                        <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                            Yet
                        </span>
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Connect your Facebook Page to manage Messenger conversations, schedule posts, run broadcasts, sync your catalog and track analytics — all in one place.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        {appId ? (
                            <Link href="/api/auth/meta-suite/login">
                                <Button size="lg" className="rounded-full px-8 shadow-lg hover:scale-[1.03] transition-all" style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5bbd 100%)', boxShadow: '0 8px 24px rgba(24,119,242,0.35)' }}>
                                    <FacebookIcon className="mr-2 h-5 w-5 text-white" />
                                    Connect Facebook Page
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        ) : (
                            <p className="text-sm text-destructive">Facebook App ID not configured.</p>
                        )}
                        <ManualFacebookSetupDialog onSuccess={onSuccess} />
                    </div>
                </div>

                {/* Features grid */}
                <div className="mx-auto mt-12 max-w-4xl">
                    <p className="mb-5 text-center text-xs font-bold uppercase tracking-widest text-blue-700">
                        Everything you unlock
                    </p>
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                        {FEATURES.map((f) => (
                            <div key={f.label} className={cn(
                                'flex flex-col gap-2.5 rounded-2xl border bg-gradient-to-br p-4 transition hover:shadow-md hover:scale-[1.02]',
                                f.color,
                            )}>
                                <f.icon className="h-5 w-5" />
                                <div>
                                    <p className="font-semibold text-sm">{f.label}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{f.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function AllFacebookPagesPage() {
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            try {
                const result = await getProjects(undefined, 'facebook');
                const projectsData = Array.isArray(result) ? result : (result && Array.isArray((result as any).projects)) ? (result as any).projects : [];
                setProjects(projectsData);
            } catch (error) {
                console.error('[AllFacebookPagesPage] Failed to fetch projects:', error);
                setProjects([]);
            }
        });
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

    if (isLoading) return <PageSkeleton />;

    return (
        <div className="flex flex-col gap-8">

            {/* ── Hero header ── */}
            <div className="relative overflow-hidden rounded-3xl border border-blue-200/40 bg-gradient-to-br from-blue-50 via-white to-indigo-50/40 px-6 py-8 md:px-10 shadow-sm">
                <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-blue-300/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-indigo-200/15 blur-2xl" />

                <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5bbd 100%)', boxShadow: '0 6px 20px rgba(24,119,242,0.35)' }}>
                            <FacebookIcon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <h1 className="text-2xl font-bold tracking-tight">Meta Suite</h1>
                                <Badge className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-[10px] px-2 py-0.5 hover:bg-blue-100">
                                    Connections
                                </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                Connect and manage your Facebook Pages, Messenger, posts and commerce.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="rounded-xl border-blue-200/60 hover:bg-blue-50" onClick={fetchData}>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
                        </Button>
                        <ManualFacebookSetupDialog onSuccess={fetchData} />
                        {appId && (
                            <Link href="/api/auth/meta-suite/login">
                                <Button size="sm" className="rounded-xl shadow-md hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5bbd 100%)' }}>
                                    <FacebookIcon className="mr-1.5 h-4 w-4 text-white" />
                                    Connect Page
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Stats row */}
                {projects.length > 0 && (
                    <div className="relative mt-6 flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 rounded-xl bg-white/70 border border-blue-100/60 px-4 py-2.5 backdrop-blur-sm">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-sm font-semibold">{projects.length}</span>
                            <span className="text-xs text-muted-foreground">page{projects.length !== 1 ? 's' : ''} connected</span>
                        </div>
                        {FEATURES.slice(0, 3).map((f) => (
                            <div key={f.label} className="flex items-center gap-2 rounded-xl bg-white/70 border border-blue-100/60 px-3 py-2.5 backdrop-blur-sm">
                                <f.icon className="h-3.5 w-3.5 text-blue-600" />
                                <span className="text-xs text-muted-foreground">{f.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Pages grid or empty state ── */}
            {projects.length > 0 ? (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-700 flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" /> Connected Pages
                        </p>
                        <span className="text-xs text-muted-foreground">{projects.length} page{projects.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {projects.map(project => (
                            <ConnectedPageCard key={project._id.toString()} project={project} />
                        ))}

                        {/* Add more card */}
                        {appId && (
                            <Link href="/api/auth/meta-suite/login" className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-200/60 bg-blue-50/40 p-8 text-center transition hover:border-blue-400/60 hover:bg-blue-50 hover:shadow-sm">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition">
                                    <FacebookIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm text-blue-700">Connect Another Page</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Add more Facebook Pages to your account</p>
                                </div>
                                <ArrowUpRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 transition" />
                            </Link>
                        )}
                    </div>

                    {/* Features reminder */}
                    <div className="mt-8 rounded-2xl border border-blue-100/60 bg-white/60 backdrop-blur-sm p-5">
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-4">Available features</p>
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                            {FEATURES.map((f) => (
                                <div key={f.label} className={cn(
                                    'flex flex-col gap-2 rounded-xl border bg-gradient-to-br p-3 transition hover:shadow-sm',
                                    f.color,
                                )}>
                                    <f.icon className="h-4 w-4" />
                                    <p className="text-xs font-semibold">{f.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <EmptyState appId={appId} onSuccess={fetchData} />
            )}
        </div>
    );
}
