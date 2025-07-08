
'use client';

import { getEcommShops } from '@/app/actions/custom-ecommerce.actions';
import { getCustomDomains } from '@/app/actions/url-shortener.actions';
import { EcommSettingsForm } from '@/components/wabasimplify/ecomm-settings-form';
import { EcommCustomDomainForm } from '@/components/wabasimplify/ecomm-custom-domain-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Settings } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import type { WithId, EcommShop, CustomDomain } from '@/lib/definitions';
import { Separator } from '@/components/ui/separator';
import { PersistentMenuForm } from '@/components/wabasimplify/persistent-menu-form';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-64"/>
            <Skeleton className="h-4 w-96"/>
            <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-80 w-full" />
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();

    useEffect(() => {
        const fetchSettings = async () => {
            startLoadingTransition(async () => {
                const storedProjectId = localStorage.getItem('activeProjectId');
                if (storedProjectId) {
                    const shops = await getEcommShops(storedProjectId);
                    if (shops && shops.length > 0) {
                        setShop(shops[0]);
                    }
                    const domainData = await getCustomDomains();
                    setDomains(domainData);
                }
            });
        };
        fetchSettings();
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!shop) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Shop Found</AlertTitle>
                <AlertDescription>Please create a shop in the main Custom E-commerce dashboard first.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings /> Shop Settings</h1>
                <p className="text-muted-foreground">Configure your shop name, currency, payment links, and Messenger menu.</p>
            </div>
            <EcommSettingsForm shop={shop} domains={domains} />
            <Separator />
            <PersistentMenuForm shop={shop} />
            <Separator />
            <EcommCustomDomainForm />
        </div>
    )
}
