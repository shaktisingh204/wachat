

'use client';

import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getProjectById } from '@/app/actions/index.ts';
import { getPageDetails, getPageInsights, getFacebookPosts, getInstagramAccountForPage } from '@/app/actions/facebook.actions';
import type { FacebookPageDetails, PageInsights, FacebookPost, FacebookComment, Project, WithId } from '@/lib/definitions';
import { AlertCircle, Users, ThumbsUp, Newspaper, Megaphone, Settings, MessageSquare, Wrench, Edit, TrendingUp, Handshake, Star, Calendar, Search, SlidersHorizontal, Plus, MoreHorizontal, Share2 } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { PermissionErrorDialog } from '@/components/wabasimplify/permission-error-dialog';
import { WhatsAppIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <Card className="card-gradient card-gradient-blue">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const RadialChartCard = ({ value, label, description }: { value: number, label: string, description: string }) => {
    const chartData = [{ name: 'engagement', value, fill: 'hsl(var(--primary))' }];
    return (
        <Card className="flex flex-col card-gradient card-gradient-green">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center">
                <ChartContainer config={{}} className="mx-auto aspect-square h-full w-full max-h-[120px]">
                    <RadialBarChart
                        data={chartData}
                        startAngle={-90}
                        endAngle={270}
                        innerRadius="75%"
                        outerRadius="100%"
                        barSize={12}
                    >
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar dataKey="value" background={{ fill: 'hsl(var(--muted))' }} cornerRadius={10} />
                         <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-foreground">
                            {value}%
                        </text>
                    </RadialBarChart>
                </ChartContainer>
                 <p className="text-xs text-muted-foreground mt-2">{description}</p>
            </CardContent>
        </Card>
    );
};

const PostColumn = ({ title, count, children }: { title: string, count: number, children: React.ReactNode }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
            <h3 className="font-semibold">{title} <Badge variant="secondary" className="ml-1">{count}</Badge></h3>
        </div>
        <div className="space-y-4">{children}</div>
    </div>
);

const PostItemCard = ({ post }: { post: FacebookPost }) => {
    return (
        <Card className="hover:shadow-md transition-shadow card-gradient card-gradient-blue">
            <CardHeader className="flex flex-row justify-between items-start p-3">
                <CardTitle className="text-base font-semibold leading-snug">{post.message || "Media Post"}</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"><MoreHorizontal className="h-4 w-4"/></Button>
            </CardHeader>
            {post.full_picture && (
                <CardContent className="p-3 pt-0">
                     <Image src={post.full_picture} alt="Post image" width={400} height={225} className="rounded-md object-cover w-full" data-ai-hint="social media post"/>
                </CardContent>
            )}
            <CardFooter className="p-3 pt-0 flex justify-between items-center text-xs text-muted-foreground">
                 <span className="font-mono">{new Date(post.created_time).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>
                 <div className="flex gap-3">
                     <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3"/>{post.comments?.summary?.total_count || 0}</span>
                     <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3"/>{post.reactions?.summary?.total_count || 0}</span>
                     <span className="flex items-center gap-1"><Share2 className="h-3 w-3"/>{post.shares?.count || 0}</span>
                 </div>
            </CardFooter>
        </Card>
    );
}

const CommentItemCard = ({ comment, postLink }: { comment: FacebookComment, postLink: string }) => (
    <Card className="hover:shadow-md transition-shadow card-gradient card-gradient-purple">
        <CardContent className="p-3">
            <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={`https://graph.facebook.com/${comment.from.id}/picture`} alt={comment.from.name} data-ai-hint="person avatar" />
                    <AvatarFallback>{comment.from.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold text-sm">{comment.from.name}</p>
                         <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.created_time), { addSuffix: true })}</p>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        "{comment.message}"
                    </p>
                </div>
            </div>
        </CardContent>
    </Card>
);


function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" />
            </div>
        </div>
    );
}

export default function FacebookDashboardPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [pageDetails, setPageDetails] = useState<FacebookPageDetails | null>(null);
    const [insights, setInsights] = useState<PageInsights | null>(null);
    const [posts, setPosts] = useState<FacebookPost[]>([]);
    const [instagramId, setInstagramId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchPageData = useCallback((id: string) => {
        startLoading(async () => {
            const projectData = await getProjectById(id);
            setProject(projectData);
            if (!projectData) {
                setError("Project not found or you don't have access.");
                return;
            }
            const [detailsResult, insightsResult, postsResult, igResult] = await Promise.all([
                getPageDetails(id), 
                getPageInsights(id), 
                getFacebookPosts(id),
                getInstagramAccountForPage(id)
            ]);

            const firstError = detailsResult.error || insightsResult.error || postsResult.error || igResult.error;
            if (firstError) {
                if (firstError.includes('permission') || firstError.includes('(#100)') || firstError.includes('(#200)')) {
                    setPermissionError(firstError); setError(null);
                } else { setError(firstError); }
            }

            if (detailsResult.page) setPageDetails(detailsResult.page);
            if (insightsResult.insights) setInsights(insightsResult.insights);
            if (postsResult.posts) setPosts(postsResult.posts);
            if (igResult.instagramId) setInstagramId(igResult.instagramId);
        });
    }, []);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            fetchPageData(projectId);
        }
    }, [projectId, fetchPageData]);
    
    const onSuccessfulReconnect = () => {
        setPermissionError(null);
        if (projectId) {
            fetchPageData(projectId);
        }
    }

    const engagementRate = (insights && insights.pageReach > 0) ? Math.round((insights.postEngagement / insights.pageReach) * 100) : 0;
    const { topPosts, recentComments } = useMemo(() => {
        if (!posts || posts.length === 0) return { topPosts: [], recentComments: [] };
        const calculatedTopPosts = [...posts].map(post => ({ ...post, engagementScore: (post.reactions?.summary?.total_count || 0) + (post.comments?.summary?.total_count || 0) })).sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 3);
        const allComments = posts.flatMap(post => (post.comments?.data || []).map(comment => ({ ...comment, postLink: post.permalink_url }))).sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime()).slice(0, 5);
        return { topPosts: calculatedTopPosts, recentComments: allComments };
    }, [posts]);

    if (isLoading && !pageDetails) {
        return <DashboardSkeleton />;
    }

    if (!projectId) {
         return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" /><AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project from the main dashboard to view its Facebook overview.</AlertDescription>
            </Alert>
         )
    }

    if (!pageDetails) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <PermissionErrorDialog isOpen={!!permissionError} onOpenChange={() => setPermissionError(null)} error={permissionError} project={project} onSuccess={onSuccessfulReconnect} />
                 <p className="text-muted-foreground">No page details available. This may be due to missing permissions.</p>
            </div>
        )
    }
    
    return (
        <>
            <PermissionErrorDialog isOpen={!!permissionError} onOpenChange={() => setPermissionError(null)} error={permissionError} project={project} onSuccess={onSuccessfulReconnect} />
            <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold font-headline flex items-center gap-3">
                        <span>{pageDetails.name} Dashboard</span>
                        {project?.wabaId && <WhatsAppIcon className="h-6 w-6 text-green-500" />}
                        {instagramId && <InstagramIcon className="h-6 w-6 text-instagram" />}
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-8"/></div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4"/>Filters</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Filter Posts</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>Image Posts</DropdownMenuItem>
                                <DropdownMenuItem>Video Posts</DropdownMenuItem>
                                <DropdownMenuItem>Text Posts</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button asChild><Link href="/dashboard/facebook/create-post"><Plus className="mr-2 h-4 w-4"/>Create Post</Link></Button>
                    </div>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Followers" value={pageDetails.followers_count || 0} icon={Users} description="+20.1% from last month"/>
                    <StatCard title="Likes" value={pageDetails.fan_count || 0} icon={ThumbsUp} description="+180.1% from last month"/>
                    <StatCard title="Posts" value={posts.length} icon={Newspaper} description="Total posts on page"/>
                    <RadialChartCard value={engagementRate} label="Engagement Rate" description="Daily engagement / daily reach"/>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <PostColumn title="Latest Posts" count={posts.slice(0, 3).length}>
                        {posts.slice(0, 3).map(post => <PostItemCard key={post.id} post={post} />)}
                    </PostColumn>
                    <PostColumn title="Top Posts" count={topPosts.length}>
                        {topPosts.map(post => <PostItemCard key={post.id} post={post} />)}
                    </PostColumn>
                    <PostColumn title="Recent Comments" count={recentComments.length}>
                        {recentComments.map(comment => <CommentItemCard key={comment.id} comment={comment} postLink={comment.postLink} />)}
                    </PostColumn>
                    <PostColumn title="Quick Links" count={0}>
                        <Card><CardContent className="p-3 space-y-2">
                           {[
                                { href: '/dashboard/facebook/posts', title: 'Manage Posts', icon: Newspaper },
                                { href: '/dashboard/facebook/ads', title: 'Ads Manager', icon: Megaphone },
                                { href: '/dashboard/facebook/messages', title: 'Live Chat', icon: MessageSquare },
                                { href: '/dashboard/facebook/settings', title: 'Settings', icon: Settings }
                           ].map(link => <Button key={link.href} variant="ghost" className="w-full justify-start" asChild><Link href={link.href}><link.icon className="mr-2 h-4 w-4"/>{link.title}</Link></Button>)}
                        </CardContent></Card>
                    </PostColumn>
                </div>
            </div>
        </>
    );
}
