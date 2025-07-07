

'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, ShoppingBag } from 'lucide-react';
import { getProjectById } from '@/app/actions';
import { getEcommShops } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, Project, EcommShop } from '@/lib/definitions';
import { CreateEcommShopDialog } from '@/components/wabasimplify/create-shop-dialog';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><Skeleton className="h-10 w-64" /><Skeleton className="h-10 w-32" /></div>
            <Skeleton className="h-4 w-96"/>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

function ShopCard({ shop }: { shop: WithId<EcommShop> }) {
    return (
        <Card className="hover:shadow-lg transition-transform hover:-translate-y-1 card-gradient card-gradient-blue">
            <CardHeader>
                <CardTitle>{shop.name}</CardTitle>
                <CardDescription>Created: {new Date(shop.createdAt).toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">Currency: {shop.currency}</p>
                {shop.slug && (
                    <div className="mt-2">
                        <p className="text-xs font-medium text-foreground">Shop URL:</p>
                        <p className="text-xs font-mono text-muted-foreground break-all">/shop/{shop.slug}</p>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button asChild className="w-full">
                    <Link href={`/dashboard/facebook/custom-ecommerce/manage/${shop._id.toString()}`}>
                        Manage Shop
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function CustomEcommerceDashboard() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [shops, setShops] = useState<WithId<EcommShop>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoading(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
                if (projectData) {
                    const shopsData = await getEcommShops(projectData._id.toString());
                    setShops(shopsData);
                }
            });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its custom e-commerce shops.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <ShoppingBag className="h-8 w-8" />
                        Custom E-commerce Shops
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your Messenger-based e-commerce storefronts for this project.
                    </p>
                </div>
                <CreateEcommShopDialog projectId={project._id.toString()} onSuccess={fetchData} />
            </div>

            {shops.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {shops.map(shop => (
                        <ShopCard key={shop._id.toString()} shop={shop} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <ShoppingBag className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Shops Yet</h3>
                    <p className="mt-1 text-sm">Click "Create New Shop" to get started.</p>
                </div>
            )}
        </div>
    );
}
