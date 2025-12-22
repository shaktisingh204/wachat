
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getCatalogs, connectCatalogToWaba } from '@/app/actions/catalog.actions';
import { getProjectById } from '@/app/actions/index.ts';
import type { Catalog, Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, PlusCircle, ServerCog, ShoppingBag, Link2, Lock, Repeat, LoaderCircle } from 'lucide-react';
import { SyncCatalogsButton } from '@/components/wabasimplify/sync-catalogs-button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/context/project-context';


function WACatalogCard({ catalog, project, onConnect }: { catalog: WithId<Catalog>, project: WithId<Project> | null, onConnect: (catalogId: string) => void }) {
    const isConnected = project?.connectedCatalogId === catalog.metaCatalogId;
    const [isConnecting, startConnecting] = useTransition();

    const handleConnect = () => {
        startConnecting(() => {
            onConnect(catalog.metaCatalogId);
        });
    }

    return (
        <Card className={cn("flex flex-col transition-all", isConnected && "border-2 border-primary")}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{catalog.name}</CardTitle>
                    {isConnected && <Badge>Connected</Badge>}
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
                    <a href={`https://business.facebook.com/commerce/${catalog.metaCatalogId}/items`} target="_blank" rel="noopener noreferrer">
                        <Link2 className="mr-2 h-4 w-4"/>
                        Manage in Meta
                    </a>
                </Button>
                <Button size="sm" onClick={handleConnect} disabled={isConnected || isConnecting}>
                    {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin"/> : null}
                    Connect to WABA
                </Button>
             </CardFooter>
        </Card>
    );
}


export default function CatalogPage() {
    const [catalogs, setCatalogs] = useState<WithId<Catalog>[]>([]);
    const { activeProject, activeProjectId, isLoadingProject } = useProject();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        if (!activeProjectId) return;
        getProjectById(activeProjectId).then(() => {
            getCatalogs(activeProjectId).then(setCatalogs);
        });
    }, [activeProjectId]);

    useEffect(() => {
        if(activeProjectId) {
            fetchData();
        }
    }, [activeProjectId, fetchData]);
    
    const handleConnectCatalog = async (catalogId: string) => {
        if (!activeProjectId) return;
        const result = await connectCatalogToWaba(activeProjectId, catalogId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.message });
            fetchData();
        }
    }
    
    const hasCatalogAccess = activeProject?.hasCatalogManagement === true;
    const isWhatsAppProject = !!activeProject?.wabaId;

    if (isLoadingProject) {
         return <Skeleton className="h-full w-full" />;
    }
    
    if (!activeProjectId) {
         return (
             <div className="flex flex-col gap-8">
                <div><h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag/> Ecomm + Catalog</h1><p className="text-muted-foreground">Manage your product catalogs for WhatsApp interactive messages.</p></div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a WhatsApp project from the main dashboard to manage its catalog.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    if (!isWhatsAppProject) {
         return (
             <div className="flex flex-col gap-8">
                <div><h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag/> Ecomm + Catalog</h1><p className="text-muted-foreground">Manage your product catalogs for WhatsApp interactive messages.</p></div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Invalid Project Type</AlertTitle>
                    <AlertDescription>This section is for WhatsApp projects. The selected project is not configured for WhatsApp.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag/> Ecomm + Catalog</h1>
                    <p className="text-muted-foreground">Manage your product catalogs to use in interactive messages.</p>
                </div>
                 {hasCatalogAccess && (
                    <div className="flex items-center gap-2">
                        <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData}/>
                    </div>
                )}
            </div>
             {!hasCatalogAccess ? (
                <Card className="text-center">
                    <CardHeader><div className="mx-auto bg-destructive text-destructive-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4"><Lock className="h-8 w-8" /></div><CardTitle>Catalog Management Locked</CardTitle><CardDescription>This project was set up without catalog management permissions.</CardDescription></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground max-w-md mx-auto">To use product catalogs, you need to re-authorize the application and grant the 'catalog_management' and 'business_management' permissions.</p></CardContent>
                    <CardFooter className="justify-center"><Button asChild><Link href="/dashboard/setup"><Repeat className="mr-2 h-4 w-4" /> Go to Setup to Re-authorize</Link></Button></CardFooter>
                </Card>
            ) : catalogs.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {catalogs.map(catalog => <WACatalogCard key={catalog._id.toString()} catalog={catalog} project={activeProject} onConnect={handleConnectCatalog} />)}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <ServerCog className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Catalogs Found</h3>
                    <p className="mt-1 text-sm">Create a catalog in Meta Commerce Manager, then click "Sync with Meta".</p>
                </div>
            )}
        </div>
    );
}
