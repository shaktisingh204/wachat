
'use client';

import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getProjectById } from '@/app/actions';
import { getPageDetails, getPageInsights, getFacebookPosts } from '@/app/actions/facebook.actions';
import type { FacebookPageDetails, PageInsights, FacebookPost, FacebookComment, Project, WithId } from '@/lib/definitions';
import { AlertCircle, Users, ThumbsUp, Newspaper, Megaphone, Settings, MessageSquare, Wrench, Edit, TrendingUp, Handshake, Star, Calendar } from 'lucide-react';
import Image from 'next/image';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { EditPageDetailsDialog } from '@/components/wabasimplify/edit-page-details-dialog';
import { Separator } from '@/components/ui/separator';
import { PermissionErrorDialog } from '@/components/wabasimplify/permission-error-dialog';


const StatCard = ({ title, value, icon: Icon, gradientClass }: { title: string, value: string | number, icon: React.ElementType, gradientClass?: string }) => (
    <Card className={cn("card-gradient", gradientClass)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </CardContent>
    </Card>
);

const features = [
    { href: '/dashboard/facebook/create-post', title: 'Create Post', description: 'Publish content to your page.', icon: Newspaper },
    { href: '/dashboard/facebook/posts', title: 'Manage Posts', description: 'View and manage recent posts.', icon: Newspaper },
    { href: '/dashboard/facebook/scheduled', title: 'Scheduled Posts', description: 'Manage scheduled posts.', icon: Calendar },
    { href: '/dashboard/facebook/ads', title: 'Ads Manager', description: 'Create and monitor campaigns.', icon: Megaphone },
    { href: '/dashboard/facebook/messages', title: 'Live Chat', description: 'Engage with customers on Messenger.', icon: MessageSquare },
    { href: '/dashboard/facebook/pages', title: 'All Pages', description: 'View all connected pages.', icon: Newspaper },
    { href: '/dashboard/facebook/audiences', title: 'Audiences', description: 'Manage custom audiences.', icon: Users },
    { href: '/dashboard/facebook/all/projects', title: 'Project Connections', description: 'Connect your projects to Facebook.', icon: Wrench },
    { href: '/dashboard/facebook/settings', title: 'Settings', description: 'View your connected account IDs.', icon: Settings },
];

const RecentComment = ({ comment, postLink }: { comment: FacebookComment & {postLink: string}; postLink: string }) => (
    <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
            <AvatarImage src={`https://graph.facebook.com/${comment.from.id}/picture`} alt={comment.from.name} data-ai-hint="person avatar" />
            <AvatarFallback>{comment.from.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
            <p className="text-sm">
                <span className="font-semibold">{comment.from.name}</span> commented:
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2">
                "{comment.message}"
            </p>
            <Link href={postLink} target="_blank" className="text-xs text-primary hover:underline">
                View Post
            </Link>
        </div>
    </div>
);

const TopPost = ({ post }: { post: FacebookPost & { engagementScore: number } }) => (
    <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-center w-12">
            <p className="text-lg font-bold">{post.engagementScore}</p>
            <p className="text-xs text-muted-foreground">Engaged</p>
        </div>
        <div className="flex-1">
            <p className="text-sm text-muted-foreground line-clamp-2">
                {post.message || <span className="italic">Media post</span>}
            </p>
            <Link href={post.permalink_url} target="_blank" className="text-xs text-primary hover:underline">
                View Post
            </Link>
        </div>
    </div>
);


function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            <Skeleton className="h-8 w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Skeleton className="h-48" />
                 <Skeleton className="h-48" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2"><Skeleton className="h-48" /></div>
                <div><Skeleton className="h-48" /></div>
            </div>
        </div>
    );
}

export default function FacebookDashboardPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [pageDetails, setPageDetails] = useState<FacebookPageDetails | null>(null);
    const [insights, setInsights] = useState<PageInsights | null>(null);
    const [posts, setPosts] = useState<FacebookPost[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [actionCounter, setActionCounter] = useState(0);

    const fetchPageData = useCallback(() => {
        if (projectId) {
            startLoading(async () => {
                const projectData = await getProjectById(projectId);
                setProject(projectData);
                if (!projectData) {
                    setError("Project not found or you don't have access.");
                    return;
                }
                
                const [detailsResult, insightsResult, postsResult] = await Promise.all([
                    getPageDetails(projectId),
                    getPageInsights(projectId),
                    getFacebookPosts(projectId)
                ]);

                const firstError = detailsResult.error || insightsResult.error || postsResult.error;

                if (firstError) {
                     if (firstError.includes('permission') || firstError.includes('(#100)') || firstError.includes('(#200)')) {
                        setPermissionError(firstError);
                        setError(null);
                    } else {
                        setError(firstError);
                    }
                }

                if (detailsResult.page) setPageDetails(detailsResult.page);
                if (insightsResult.insights) setInsights(insightsResult.insights);
                if (postsResult.posts) setPosts(postsResult.posts);
            });
        }
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchPageData();
    }, [projectId, fetchPageData, actionCounter]);
    
     const { topPosts, recentComments } = useMemo(() => {
        if (!posts || posts.length === 0) {
            return { topPosts: [], recentComments: [] };
        }

        const calculatedTopPosts = posts
            .map(post => {
                const engagementScore = 
                    (post.reactions?.summary.total_count || 0) +
                    (post.comments?.summary.total_count || 0) +
                    (post.shares?.count || 0);
                return { ...post, engagementScore };
            })
            .sort((a, b) => b.engagementScore - a.engagementScore)
            .slice(0, 5);

        const allComments = posts
            .flatMap(post => 
                (post.comments?.data || []).map(comment => ({ ...comment, postLink: post.permalink_url }))
            )
            .sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime())
            .slice(0, 5);
        
        return { topPosts: calculatedTopPosts, recentComments: allComments };
    }, [posts]);
    
    const onSuccessfulReconnect = () => {
        setPermissionError(null);
        setActionCounter(p => p + 1);
    }

    if (isLoading && !pageDetails && !error && !permissionError) return <DashboardSkeleton />;

    if (!projectId) {
         return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to view its Facebook overview.
                </AlertDescription>
            </Alert>
         )
    }

     if (error) {
         return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Could not load Page Details</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
         )
    }

    if (!pageDetails && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <PermissionErrorDialog 
                    isOpen={!!permissionError}
                    onOpenChange={() => setPermissionError(null)}
                    error={permissionError}
                    project={project}
                    onSuccess={onSuccessfulReconnect}
                />
                 <p className="text-muted-foreground">No page details available. This may be due to missing permissions.</p>
            </div>
        )
    }


    return (
        <>
            <PermissionErrorDialog 
                isOpen={!!permissionError}
                onOpenChange={() => setPermissionError(null)}
                error={permissionError}
                project={project}
                onSuccess={onSuccessfulReconnect}
            />
            {pageDetails && projectId && (
                <EditPageDetailsDialog 
                    isOpen={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    pageDetails={pageDetails}
                    projectId={projectId}
                    onSuccess={() => setActionCounter(p => p + 1)}
                />
            )}
            <div className="flex flex-col gap-8">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarFallback>{pageDetails.name.charAt(0)}</AvatarFallback>
                        {pageDetails.picture?.data?.url && <Image src={pageDetails.picture.data.url} alt={pageDetails.name} width={64} height={64} className="rounded-full" data-ai-hint="logo company"/>}
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold font-headline">{pageDetails.name}</h1>
                            <Button variant="outline" size="icon" onClick={() => setIsEditOpen(true)}><Edit className="h-4 w-4"/></Button>
                        </div>
                        <p className="text-muted-foreground">{pageDetails.category}</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Followers" value={pageDetails.followers_count || 0} icon={Users} gradientClass="card-gradient-blue" />
                    <StatCard title="Likes" value={pageDetails.fan_count || 0} icon={ThumbsUp} gradientClass="card-gradient-green" />
                    <StatCard title="Daily Reach" value={insights?.pageReach || 0} icon={TrendingUp} gradientClass="card-gradient-purple" />
                    <StatCard title="Daily Engagement" value={insights?.postEngagement || 0} icon={Handshake} gradientClass="card-gradient-orange" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-400"/>Top Posts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {topPosts.length > 0 ? (
                                topPosts.map(post => <TopPost key={post.id} post={post} />)
                            ) : <p className="text-sm text-muted-foreground text-center py-4">No posts to analyze yet.</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-blue-500"/>Recent Comments</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {recentComments.length > 0 ? (
                                recentComments.map(comment => <RecentComment key={comment.id} comment={comment} postLink={comment.postLink}/>)
                            ) : <p className="text-sm text-muted-foreground text-center py-4">No recent comments.</p>}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader><CardTitle>About</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">{pageDetails.about || 'No description provided.'}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Quick Links</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            {features.map(feature => (
                                <Button key={feature.href} asChild variant="ghost" className="w-full justify-start">
                                    <Link href={feature.href}>
                                        <feature.icon className="mr-2 h-4 w-4" />
                                        {feature.title}
                                    </Link>
                                </Button>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
