
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
import { AlertCircle, PlusCircle, ServerCog, ShoppingBag, Link2, Lock, Repeat, ExternalLink, GitBranch, LoaderCircle } from 'lucide-react';
import { SyncCatalogsButton } from '@/components/wabasimplify/sync-catalogs-button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/context/project-context';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Separator } from '@/components/ui/separator';


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

    const catalogStep1Image = PlaceHolderImages.find(img => img.id === 'catalog-step-1');
    const catalogStep2Image = PlaceHolderImages.find(img => img.id === 'catalog-step-2');
    const catalogStep3Image = PlaceHolderImages.find(img => img.id === 'catalog-step-3');
    const catalogStep6Image = PlaceHolderImages.find(img => img.id === 'catalog-step-6');

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
                    <CardContent className="space-y-12">
                        <div className="grid md:grid-cols-2 gap-6 items-center">
                            {catalogStep1Image && (
                                <Image src={catalogStep1Image.imageUrl} alt={catalogStep1Image.description} width={600} height={400} className="rounded-lg shadow-md" data-ai-hint={catalogStep1Image.imageHint} />
                            )}
                            <div>
                                <h3 className="font-semibold text-lg">Step 1: Create a Catalog</h3>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground pl-4 mt-2">
                                    <li>Open the <Button variant="link" asChild className="p-0 h-auto"><a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer">Meta Commerce Manager <ExternalLink className="inline-block ml-1 h-3 w-3"/></a></Button>.</li>
                                    <li>Make sure you have selected the correct Business Manager account.</li>
                                    <li>Click "Add Catalog", choose "E-commerce" as the type, and follow the prompts.</li>
                                </ol>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6 items-center">
                            {catalogStep2Image && (
                                <Image src={catalogStep2Image.imageUrl} alt={catalogStep2Image.description} width={600} height={400} className="rounded-lg shadow-md md:order-last" data-ai-hint={catalogStep2Image.imageHint} />
                            )}
                            <div>
                                <h3 className="font-semibold text-lg">Step 2: Assign Partner</h3>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground pl-4 mt-2">
                                    <li>In Business Settings, go to **Data Sources &rarr; Catalogs**.</li>
                                    <li>Select your newly created catalog.</li>
                                    <li>Click on **Assign Partners**.</li>
                                    <li>Assign "Turo" as a partner with "Full Access" permissions.</li>
                                </ol>
                            </div>
                        </div>
                         <div className="grid md:grid-cols-2 gap-6 items-center">
                              {catalogStep2Image && (
                                <Image src={catalogStep2Image.imageUrl} alt={catalogStep2Image.description} width={600} height={400} className="rounded-lg shadow-md" data-ai-hint={catalogStep2Image.imageHint} />
                            )}
                            <div>
                                <h3 className="font-semibold text-lg">Step 3: Add Your First Product (Mandatory Activation)</h3>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground pl-4 mt-2">
                                    <li>In your new catalog, go to the "Items" tab and click "Add Items".</li>
                                    <li>Choose the "Manual" option.</li>
                                    <li>Fill in all required details for at least one product (image, price, currency, availability, and description).</li>
                                    <li className="font-semibold">This step is mandatory to activate the catalog for WhatsApp.</li>
                                </ol>
                            </div>
                        </div>
                         <div className="grid md:grid-cols-2 gap-6 items-center">
                            {catalogStep3Image && (
                                <Image src={catalogStep3Image.imageUrl} alt={catalogStep3Image.description} width={600} height={400} className="rounded-lg shadow-md" data-ai-hint={catalogStep3Image.imageHint} />
                            )}
                            <div>
                                <h3 className="font-semibold text-lg">Step 4: Assign to WABA</h3>
                                 <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground pl-4 mt-2">
                                    <li>Navigate to <strong>WhatsApp Manager</strong> from your <Button variant="link" asChild className="p-0 h-auto"><a href="https://business.facebook.com/latest/home" target="_blank" rel="noopener noreferrer">Business Suite's "All tools" menu <ExternalLink className="inline-block ml-1 h-3 w-3"/></a></Button>.</li>
                                    <li>Go to <strong>Account tools</strong> &rarr; <strong>Catalog</strong>.</li>
                                    <li>Click <strong>Choose a catalog</strong>.</li>
                                    <li>Select the catalog you just created and click <strong>Connect catalog</strong>.</li>
                                </ol>
                            </div>
                        </div>
                         <div className="text-center space-y-4 pt-8 border-t">
                            <h3 className="font-semibold text-lg">Step 5: Sync Your Catalog</h3>
                            <p className="text-muted-foreground max-w-xl mx-auto">Once your catalog is created, has a product, and is connected to your WABA, return here and click the sync button to see it in your SabNode dashboard.</p>
                            <SyncCatalogsButton projectId={activeProjectId} onSyncComplete={fetchData} />
                        </div>
                         <div className="grid md:grid-cols-2 gap-6 items-center pt-8 border-t">
                             {catalogStep6Image && (
                                <Image src={catalogStep6Image.imageUrl} alt={catalogStep6Image.description} width={600} height={400} className="rounded-lg shadow-md md:order-last" data-ai-hint={catalogStep6Image.imageHint} />
                            )}
                            <div>
                                <h3 className="font-semibold text-lg">Step 6: Send Catalog Messages</h3>
                                 <p className="text-sm text-muted-foreground mt-2">After a successful sync, you can reference your products in interactive messages like Multi-Product and Single Product Messages. Use the "Product Catalog" template type to start.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
