
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getSites } from '@/app/actions/portfolio.actions';
import type { WithId, Website } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Globe } from 'lucide-react';
import { CreatePortfolioDialog } from '@/components/wabasimplify/create-portfolio-dialog';
import { useRouter } from 'next/navigation';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-10 w-40" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

function SiteCard({ site }: { site: WithId<Website> }) {
    const router = useRouter();
    
    const handleManage = () => {
        router.push(`/dashboard/website-builder/manage/${site._id.toString()}/builder`);
    }

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>{site.name}</CardTitle>
                <CardDescription>Slug: {site.slug}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">Created: {new Date(site.createdAt).toLocaleDateString()}</p>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleManage} className="w-full">
                    Manage <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function WebsiteBuilderDashboard() {
    const [sites, setSites] = useState<WithId<Website>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const data = await getSites();
            setSites(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    if (isLoading) {
        return <PageSkeleton />;
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Globe className="h-8 w-8" />
                        Website Builder
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Create and manage your public-facing websites.
                    </p>
                </div>
                <CreatePortfolioDialog onSuccess={fetchData}/>
            </div>

            {sites.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sites.map(p => (
                        <SiteCard key={p._id.toString()} site={p} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Globe className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Websites Created</h3>
                    <p className="mt-1 text-sm">Click "Create New Site" to get started.</p>
                </div>
            )}
        </div>
    );
}
