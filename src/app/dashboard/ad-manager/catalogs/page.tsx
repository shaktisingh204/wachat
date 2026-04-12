'use client';

import * as React from 'react';
import { Package, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CatalogsPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Package className="h-6 w-6" /> Product catalogs
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage catalogs for Dynamic Product Ads, Advantage+ catalog ads, and Shops.
                    </p>
                </div>
                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                    <Plus className="h-4 w-4 mr-1" /> New catalog
                </Button>
            </div>

            <Alert>
                <Package className="h-4 w-4" />
                <AlertTitle>Tip</AlertTitle>
                <AlertDescription>
                    Catalogs live at the business level. Connect a Meta Business account from Settings
                    to manage product feeds, product sets, and DPA creative here.
                </AlertDescription>
            </Alert>

            <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="mt-3 font-semibold">No catalogs yet</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                        Create a catalog from your Shopify/WooCommerce store or upload a CSV feed.
                    </p>
                    <Button variant="outline" className="mt-4" asChild>
                        <a
                            href="https://business.facebook.com/commerce"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open Commerce Manager <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
