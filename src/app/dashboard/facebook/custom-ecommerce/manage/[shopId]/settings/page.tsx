

'use client';

import { getEcommShopById } from '@/app/actions/custom-ecommerce.actions';
import { getCustomDomains } from '@/app/actions/url-shortener.actions';
import { EcommSettingsForm } from '@/components/wabasimplify/ecomm-settings-form';
import { EcommCustomDomainForm } from '@/components/wabasimplify/ecomm-custom-domain-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Settings, Palette, LoaderCircle } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import type { WithId, CustomDomain, EcommShop } from '@/lib/definitions';
import { Separator } from '@/components/ui/separator';
import { PersistentMenuForm } from '@/components/wabasimplify/persistent-menu-form';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { applyEcommShopTheme } from '@/app/actions/custom-ecommerce.actions';

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

function ThemeSelectionForm({ shop }: { shop: WithId<EcommShop> }) {
    const { toast } = useToast();
    const [isApplying, startApplying] = useTransition();

    const handleApplyTheme = async () => {
        startApplying(async () => {
            const result = await applyEcommShopTheme(shop._id.toString());
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Theme Applied!', description: result.message });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5"/>Shop Themes</CardTitle>
                <CardDescription>
                    Apply a pre-designed layout to your shop to get started quickly. Applying a theme will overwrite your current homepage layout.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg p-4 flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold">Default Shopping Theme</h4>
                        <p className="text-sm text-muted-foreground">A classic layout with a hero, featured products, and testimonials.</p>
                    </div>
                    <Button onClick={handleApplyTheme} disabled={isApplying}>
                        {isApplying ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Apply Theme
                    </Button>
                </div>
            </CardContent>
        </Card>
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
            <ThemeSelectionForm shop={shop} />
            <Separator />
            <PersistentMenuForm shop={shop} />
            <Separator />
            <EcommCustomDomainForm />
        </div>
    )
}
