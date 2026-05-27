'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Skeleton,
  EmptyState,
} from '@/components/zoruui';
import {
  Package,
  Plus,
  CircleAlert,
  RefreshCw,
  ExternalLink } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
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
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

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

    if (!isMounted) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Catalogs" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
                </div>
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Catalogs" />
                <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to manage catalogs.</ZoruAlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Catalogs" />
            <AmHeader
                title="Product catalogs"
                description="Manage catalogs for Dynamic Product Ads, Advantage+ catalog ads, and Shops."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={fetchCatalogs} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button className="bg-zoru-ink hover:bg-zoru-ink/90 text-white" onClick={() => setDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-1" /> New catalog
                        </Button>
                    </div>
                }
            />

            <Alert>
                <Package className="h-4 w-4" />
                <ZoruAlertTitle>Tip</ZoruAlertTitle>
                <ZoruAlertDescription>
                    Catalogs live at the business level. Connect a Meta Business account from Settings
                    to manage product feeds, product sets, and DPA creative here.
                </ZoruAlertDescription>
            </Alert>

            {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
                </div>
            ) : catalogs.length === 0 ? (
                <EmptyState
                    icon={<Package />}
                    title="No catalogs yet"
                    description="Create a catalog from your Shopify/WooCommerce store or upload a CSV feed."
                    action={
                        <Button variant="outline" asChild>
                            <a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer">
                                Open Commerce Manager <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    }
                />
            ) : (
                <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {catalogs.map((c) => (
                            <Card key={c.id}>
                                <ZoruCardHeader className="pb-2">
                                    <ZoruCardTitle className="text-base">{c.name}</ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-zoru-ink-muted">Products</span>
                                        <span className="font-medium tabular-nums">{c.product_count ?? 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-zoru-ink-muted">Vertical</span>
                                        <Badge variant="outline">{c.vertical || 'COMMERCE'}</Badge>
                                    </div>
                                    <div className="text-xs text-zoru-ink-muted">ID: {c.id}</div>
                                </ZoruCardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="flex justify-center">
                        <Button variant="outline" asChild>
                            <a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer">
                                Open Commerce Manager <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    </div>
                </>
            )}

            {/* Create dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setName(''); } else setDialogOpen(true); }}>
                <ZoruDialogContent className="max-w-md">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>New catalog</ZoruDialogTitle>
                        <ZoruDialogDescription>Create a product catalog for your ad account.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Catalog name *</Label>
                            <Input placeholder="e.g. Spring Collection 2026" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => { setDialogOpen(false); setName(''); }}>Cancel</Button>
                        <Button className="bg-zoru-ink hover:bg-zoru-ink/90 text-white" onClick={handleCreate} disabled={submitting || !name.trim()}>
                            {submitting ? 'Creating…' : 'Create'}
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}
