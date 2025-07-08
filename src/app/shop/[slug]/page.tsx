

import { notFound } from 'next/navigation';
import { getEcommShopBySlug, getPublicEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { LayoutGrid } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import type { EcommPage } from '@/lib/definitions';

export default async function ShopPage({ params }: { params: { slug: string } }) {
    if (!params.slug) {
        notFound();
    }

    const shop = await getEcommShopBySlug(params.slug);

    if (!shop) {
        notFound();
    }
    
    const { db } = await connectToDatabase();
    const homepage = await db.collection<EcommPage>('ecomm_pages').findOne({ shopId: shop._id, isHomepage: true });

    const products = await getPublicEcommProducts(shop._id.toString());
    const homepageLayout = homepage?.layout || [];
    
    return (
        <main>
            {homepageLayout.length > 0 ? (
                <Canvas
                    layout={homepageLayout}
                    products={products}
                    shopSlug={shop.slug}
                    isEditable={false}
                />
            ) : (
                <div className="text-center py-24 text-muted-foreground">
                    <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground/50"/>
                    <h1 className="mt-4 text-2xl font-semibold">{shop.name}</h1>
                    <p className="mt-2 text-sm">This shop is under construction. Come back soon!</p>
                </div>
            )}
        </main>
    );
}

```
  </change>
  <change>
    <file>/src/app/dashboard/facebook/custom-ecommerce/page.tsx</file>
    <content><![CDATA[
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getProjectById } from '@/app/actions';
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

function ShopCard({ shop }: { shop: WithId<EcommShop> }) {
    const router = useRouter();
    
    const handleManageShop = () => {
        router.push(`/dashboard/facebook/custom-ecommerce/manage/${shop._id.toString()}`);
    }

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>{shop.name}</CardTitle>
                <CardDescription>Slug: /shop/{shop.slug}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">Created on: {new Date(shop.createdAt).toLocaleDateString()}</p>
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
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [shops, setShops] = useState<WithId<EcommShop>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startLoading(async () => {
            const projectData = await getProjectById(projectId);
            if (projectData) {
                const shopsData = await getEcommShops(projectData._id.toString());
                setProject(projectData);
                setShops(shopsData);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            fetchData();
        }
    }, [projectId, fetchData]);
    
    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!projectId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <ShoppingBag className="h-16 w-16 text-muted-foreground" />
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to manage its shops, or go to the Project Connections page to connect a Facebook Page.
                    </AlertDescription>
                </Alert>
                <Button asChild>
                    <Link href="/dashboard/facebook/all-projects">
                        <Wrench className="mr-2 h-4 w-4" />
                        Go to Project Connections
                    </Link>
                </Button>
            </div>
        );
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
                        Build and manage your Messenger-based e-commerce storefronts for project "{project?.name}".
                    </p>
                </div>
                <CreateEcommShopDialog projectId={projectId} onSuccess={fetchData} />
            </div>

            {shops.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {shops.map(shop => (
                        <ShopCard key={shop._id.toString()} shop={shop} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Store className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Shops Created Yet</h3>
                    <p className="mt-1 text-sm">Click "Create New Shop" to get started.</p>
                </div>
            )}
        </div>
    );
}
