
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getCatalogs } from '@/app/actions/catalog.actions';
import { getProjectById } from '@/app/actions';
import type { Catalog, Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, PlusCircle, ServerCog, ShoppingBag, Link2, Lock, Repeat } from 'lucide-react';
import { SyncCatalogsButton } from '@/components/wabasimplify/sync-catalogs-button';
import { CreateCatalogDialog } from '@/components/wabasimplify/create-catalog-dialog';
import { cn } from '@/lib/utils';
import { MessageSquare } from "lucide-react";

function CatalogCard({ catalog }: { catalog: WithId<Catalog> }) {
    return (
        <Card className={cn("flex flex-col transition-all")}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{catalog.name}</CardTitle>
                </div>
                <CardDescription className="font-mono text-xs break-all pt-2">
                    ID: {catalog.metaCatalogId}
                </CardDescription>
            </CardHeader>
             <CardContent className="flex-grow">
                <p className="text-xs text-muted-foreground">Created: {new Date(catalog.createdAt).toLocaleDateString()}</p>
             </CardContent>
             <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/facebook/commerce/products/${catalog.metaCatalogId}`}>
                        <ShoppingBag className="mr-2 h-4 w-4"/>
                        View Products
                    </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                    <a href={`https://business.facebook.com/commerce/${catalog.metaCatalogId}/items`} target="_blank" rel="noopener noreferrer">
                        <Link2 className="mr-2 h-4 w-4"/>
                        Manage in Meta
                    </a>
                </Button>
             </CardFooter>
        </Card>
    );
}


export default function ProductsPage() {
    const [catalogs, setCatalogs] = useState<WithId<Catalog>[]>([]);
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startLoadingTransition(async () => {
            const [catalogsData, projectData] = await Promise.all([
                getCatalogs(projectId),
                getProjectById(projectId),
            ]);
            setCatalogs(catalogsData);
            setProject(projectData);
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
    
    const hasCatalogAccess = project?.hasCatalogManagement === true;
    const isFacebookProject = !!project?.facebookPageId && !project.wabaId;

    if (!projectId) {
         return (
            <div className="flex flex-col gap-8">
                 <div><h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag/> Products & Catalogs</h1><p className="text-muted-foreground">Manage your product catalogs for your Facebook Shop.</p></div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a Facebook Page project from the Connections page to manage catalogs.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    if (isLoading) {
        return <Skeleton className="h-full w-full" />;
    }
    
    if (!isFacebookProject) {
         return (
            <div className="flex flex-col gap-8">
                <div><h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag/> Products & Catalogs</h1><p className="text-muted-foreground">Manage your product catalogs for your Facebook Shop.</p></div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Invalid Project Type</AlertTitle>
                    <AlertDescription>This section is for Facebook Page projects. Please select a Facebook Page project from the Connections page.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag/> Products & Catalogs</h1>
                    <p className="text-muted-foreground">Manage your product catalogs for use in your Facebook Shop.</p>
                </div>
                 {hasCatalogAccess && (
                    <div className="flex items-center gap-2">
                        <SyncCatalogsButton projectId={projectId} onSyncComplete={fetchData}/>
                        <CreateCatalogDialog projectId={projectId} onCatalogCreated={fetchData}/>
                    </div>
                )}
            </div>
             {!hasCatalogAccess ? (
                <Card className="text-center">
                    <CardHeader><div className="mx-auto bg-destructive text-destructive-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4"><Lock className="h-8 w-8" /></div><CardTitle>Catalog Management Locked</CardTitle><CardDescription>This project was set up without catalog management permissions.</CardDescription></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground max-w-md mx-auto">To use product catalogs, you need to re-authorize the application and grant the 'catalog_management' and 'business_management' permissions.</p></CardContent>
                    <CardFooter className="justify-center"><Button asChild><Link href="/dashboard/facebook/all-projects"><Repeat className="mr-2 h-4 w-4" /> Go to Connections to Re-authorize</Link></Button></CardFooter>
                </Card>
            ) : catalogs.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {catalogs.map(catalog => <CatalogCard key={catalog._id.toString()} catalog={catalog} />)}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <ServerCog className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Catalogs Found</h3>
                    <p className="mt-1 text-sm">Click "Sync with Meta" to fetch your existing catalogs, or create a new one.</p>
                </div>
            )}
        </div>
    );
}
