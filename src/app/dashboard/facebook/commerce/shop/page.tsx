'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { LayoutGrid, ExternalLink, AlertCircle, CheckCircle, Store } from 'lucide-react';
import { getProjectById } from '@/app/actions';
import { getCommerceMerchantSettings } from '@/app/actions/facebook.actions';
import type { WithId, Project, CommerceMerchantSettings } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div className="space-y-2">
                <Skeleton className="h-8 w-1/3"/>
                <Skeleton className="h-4 w-2/3"/>
            </div>
            <div className="mt-4">
                <Skeleton className="h-64 w-full"/>
            </div>
        </div>
    );
}

export default function ShopSetupPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [settings, setSettings] = useState<CommerceMerchantSettings | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoading(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
                if (projectData?.facebookPageId) {
                    const settingsResult = await getCommerceMerchantSettings(storedProjectId);
                    if (settingsResult.error) {
                        setError(settingsResult.error);
                    } else {
                        setSettings(settingsResult.settings || null);
                    }
                }
            });
        }
    }, []);
    
    const commerceManagerUrl = project?.businessId 
        ? `https://business.facebook.com/commerce/${project.businessId}/` 
        : 'https://business.facebook.com/commerce_manager/';

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!project) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project to manage its shop settings.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><LayoutGrid /> Facebook Shop</h1>
                <p className="text-muted-foreground">Manage your Facebook Shop and its connection to SabNode.</p>
            </div>

            {error && !error.includes("No Commerce Merchant Settings found") && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not fetch shop status</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {settings ? (
                <Card className="card-gradient card-gradient-green">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CheckCircle className="text-primary"/>Shop is Connected</CardTitle>
                        <CardDescription>Your Facebook Shop is set up and ready to be used with SabNode features.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p><strong>Shop Name:</strong> {settings.display_name}</p>
                        {settings.shops?.data.map(shop => (
                            <p key={shop.id}><strong>Page Shop:</strong> <a href={shop.shop_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{shop.name}</a></p>
                        ))}
                    </CardContent>
                    <CardFooter>
                         <Button asChild>
                            <a href={settings.commerce_manager_url} target="_blank" rel="noopener noreferrer">
                                Manage in Commerce Manager <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                    </CardFooter>
                </Card>
            ) : (
                <Card className="text-center card-gradient card-gradient-blue">
                    <CardHeader>
                         <div className="mx-auto bg-muted text-muted-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4"><Store className="h-8 w-8" /></div>
                        <CardTitle>Set Up Your Facebook Shop</CardTitle>
                        <CardDescription>To start selling, you need to set up a shop in Meta Commerce Manager.</CardDescription>
                    </CardHeader>
                     <CardContent>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            The Commerce Manager is where you'll create your shop, link your catalog, and manage all your e-commerce settings. Once set up, you can manage products and catalogs from here.
                        </p>
                    </CardContent>
                    <CardFooter className="justify-center">
                         <Button asChild size="lg">
                            <a href={commerceManagerUrl} target="_blank" rel="noopener noreferrer">
                                Go to Commerce Manager <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
