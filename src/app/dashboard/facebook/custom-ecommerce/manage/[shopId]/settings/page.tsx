
'use client';

import { getEcommShopById } from '@/app/actions/custom-ecommerce.actions';
import { getCustomDomains } from '@/app/actions/url-shortener.actions';
import { EcommSettingsForm } from '@/components/wabasimplify/ecomm-settings-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Settings } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import type { WithId, Project, EcommSettings, CustomDomain, EcommShop } from '@/lib/definitions';
import { Separator } from '@/components/ui/separator';
import { PersistentMenuForm } from '@/components/wabasimplify/persistent-menu-form';
import { useParams } from 'next/navigation';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-80 w-full" />
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const params = useParams();
    const shopId = params.shopId as string;
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient && shopId) {
            startLoadingTransition(async () => {
                const [shopData, domainData] = await Promise.all([
                    getEcommShopById(shopId),
                    getCustomDomains()
                ]);
                setShop(shopData);
                setDomains(domainData);
            });
        }
    }, [isClient, shopId]);

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!shop) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Shop not found</AlertTitle>
                <AlertDescription>The requested shop could not be loaded.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <EcommSettingsForm shop={shop} domains={domains} />
            <Separator />
            <PersistentMenuForm shop={shop} />
        </div>
    )
}
