'use client';

import * as React from 'react';
import { LuPackage, LuPlus, LuCircleAlert, LuRefreshCw, LuExternalLink } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { getAdCatalogs, createAdCatalog } from '@/app/actions/ad-manager-features.actions';

export default function CatalogsPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [catalogs, setCatalogs] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [name, setName] = React.useState('');

    const fetchCatalogs = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const res = await getAdCatalogs(activeAccount.account_id);
        setCatalogs(res.catalogs || []);
        setLoading(false);
    }, [activeAccount]);

    React.useEffect(() => { fetchCatalogs(); }, [fetchCatalogs]);

    const handleCreate = async () => {
        if (!activeAccount || !name.trim()) {
            toast({ title: 'Validation', description: 'Catalog name is required.', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        const res = await createAdCatalog(activeAccount.account_id, name.trim());
        setSubmitting(false);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Created', description: res.message });
            setDialogOpen(false);
            setName('');
            fetchCatalogs();
        }
    };

    if (!activeAccount) {
        return (
            <div className="p-8">
                <Alert>
                    <LuCircleAlert className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to manage catalogs.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LuPackage className="h-6 w-6" /> Product catalogs
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage catalogs for Dynamic Product Ads, Advantage+ catalog ads, and Shops.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchCatalogs} disabled={loading}>
                        <LuRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setDialogOpen(true)}>
                        <LuPlus className="h-4 w-4 mr-1" /> New catalog
                    </Button>
                </div>
            </div>

            <Alert>
                <LuPackage className="h-4 w-4" />
                <AlertTitle>Tip</AlertTitle>
                <AlertDescription>
                    Catalogs live at the business level. Connect a Meta Business account from Settings
                    to manage product feeds, product sets, and DPA creative here.
                </AlertDescription>
            </Alert>

            {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
                </div>
            ) : catalogs.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                        <LuPackage className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="mt-3 font-semibold">No catalogs yet</p>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                            Create a catalog from your Shopify/WooCommerce store or upload a CSV feed.
                        </p>
                        <Button variant="outline" className="mt-4" asChild>
                            <a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer">
                                Open Commerce Manager <LuExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {catalogs.map((c) => (
                            <Card key={c.id}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">{c.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Products</span>
                                        <span className="font-medium tabular-nums">{c.product_count ?? 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Vertical</span>
                                        <Badge variant="outline">{c.vertical || 'COMMERCE'}</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground">ID: {c.id}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="flex justify-center">
                        <Button variant="outline" asChild>
                            <a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer">
                                Open Commerce Manager <LuExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    </div>
                </>
            )}

            {/* Create dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setName(''); } else setDialogOpen(true); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>New catalog</DialogTitle>
                        <DialogDescription>Create a product catalog for your ad account.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Catalog name *</Label>
                            <Input placeholder="e.g. Spring Collection 2026" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogOpen(false); setName(''); }}>Cancel</Button>
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleCreate} disabled={submitting || !name.trim()}>
                            {submitting ? 'Creating\u2026' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
