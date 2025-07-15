
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getProjectById, getProjects } from '@/app/actions';
import { getEcommShops } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, Project, EcommShop } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ShoppingBag, Store, ArrowRight, Wrench } from 'lucide-react';
import { CreateEcommShopDialog } from '@/components/wabasimplify/create-shop-dialog';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FacebookIcon } from '@/components/wabasimplify/custom-sidebar-components';

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

function ShopCard({ project }: { project: WithId<Project> }) {
    const router = useRouter();
    
    const handleManageShop = () => {
        localStorage.setItem('activeProjectId', project._id.toString());
        router.push(`/dashboard/facebook/custom-ecommerce/manage/${project._id.toString()}`);
    }

    return (
        <Card className="flex flex-col">
            <CardHeader className="flex-row items-center gap-4">
                 <div className="p-3 bg-muted rounded-full">
                    <FacebookIcon className="h-6 w-6 text-primary"/>
                 </div>
                 <div>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>Page ID: {project.facebookPageId}</CardDescription>
                 </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">Manage products, pages, and automation for this Facebook Page.</p>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleManageShop} className="w-full">
                    Manage Shop <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function CustomEcommerceDashboard() {
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
      setIsClient(true);
    }, []);

    const fetchProjects = useCallback(() => {
        startLoading(async () => {
            const facebookProjects = await getProjects(undefined, 'facebook');
            setProjects(facebookProjects);
        });
    }, []);

    useEffect(() => {
        if(isClient) {
            fetchProjects();
        }
    }, [isClient, fetchProjects]);
    
    if (!isClient || isLoading) {
        return <PageSkeleton />;
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <ShoppingBag className="h-8 w-8" />
                        Custom Shops
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Select a Facebook Page to manage its e-commerce storefront and automation.
                    </p>
                </div>
            </div>

            {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <ShopCard key={project._id.toString()} project={project} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Store className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Facebook Pages Connected</h3>
                    <p className="mt-1 text-sm max-w-md mx-auto">
                        Please go to the <Link href="/dashboard/facebook/all-projects" className="text-primary hover:underline">Meta Suite Connections</Link> page to connect your Facebook account and pages first.
                    </p>
                </div>
            )}
        </div>
    );
}

    