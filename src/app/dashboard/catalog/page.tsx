
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
import { AlertCircle, PlusCircle, ServerCog, ShoppingBag, Link2, Lock, Repeat, ExternalLink, GitBranch } from 'lucide-react';
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
                 <Button asChild size="sm">
                    <Link href={`/dashboard/catalog/${catalog.metaCatalogId}`}>
                        <ShoppingBag className="mr-2 h-4 w-4"/>
                        View Products
                    </Link>
                </Button>
                <Button size="sm" onClick={handleConnect} disabled={isConnected || isConnecting}>
                    {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin"/> : null}
                    {isConnected ? 'Connected' : 'Connect to WABA'}
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
                    <AlertDescription>This section is for WhatsApp projects. The selected project is not a WhatsApp project.</AlertDescription>
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
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5"/>Get Started with Catalogs</CardTitle>
                        <CardDescription>To begin, create a catalog in Meta Commerce Manager and then sync it here.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <h3 className="font-semibold">Step 1: Create a Catalog in Meta Commerce Manager</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground pl-4">
                            <li>Open the <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Commerce Manager</a>.</li>
                            <li>Make sure you have selected the correct Business Manager account in the top-left dropdown.</li>
                            <li>Click "Add Catalog" or find the "Create a Catalog" option.</li>
                            <li>Select "E-commerce" as the catalog type.</li>
                            <li>Follow the prompts to configure your catalog. For the catalog name, we recommend using your project's name for easy identification.</li>
                            <li>Complete the creation process.</li>
                        </ol>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-4">
                        <div>
                            <h3 className="font-semibold">Step 2: Sync Your Catalogs</h3>
                            <p className="text-sm text-muted-foreground">Once your catalog is created on Meta, return here and click the sync button.</p>
                        </div>
                        <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} />
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
