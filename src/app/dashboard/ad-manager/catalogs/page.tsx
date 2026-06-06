'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import { Package, Plus, RefreshCw, ExternalLink } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
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
            toast.error({ title: 'Catalog name is required.', tone: 'danger' });
            return;
        }
        setSubmitting(true);
        const res = await createAdCatalog(activeAccount.account_id, name.trim());
        setSubmitting(false);
        if (res.error) {
            toast.error({ title: 'Error', description: res.error });
        } else {
            toast.success({ title: 'Catalog created', description: res.message });
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
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} height={160} className="w-full" />
                    ))}
                </div>
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Catalogs" />
                <Alert tone="warning" title="No ad account selected">
                    Pick an ad account to manage catalogs.
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
                        <IconButton
                            label="Refresh catalogs"
                            icon={RefreshCw}
                            variant="outline"
                            onClick={fetchCatalogs}
                            disabled={loading}
                            className={loading ? 'is-loading' : undefined}
                        />
                        <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
                            New catalog
                        </Button>
                    </div>
                }
            />

            <Alert tone="info" icon={Package} title="Tip">
                Catalogs live at the business level. Connect a Meta Business account from Settings
                to manage product feeds, product sets, and DPA creative here.
            </Alert>

            {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} height={160} className="w-full" />
                    ))}
                </div>
            ) : catalogs.length === 0 ? (
                <EmptyState
                    icon={Package}
                    title="No catalogs yet"
                    description="Create a catalog from your Shopify or WooCommerce store, or upload a CSV feed."
                    action={
                        <Button
                            variant="outline"
                            iconRight={ExternalLink}
                            onClick={() => window.open('https://business.facebook.com/commerce', '_blank', 'noopener,noreferrer')}
                        >
                            Open Commerce Manager
                        </Button>
                    }
                />
            ) : (
                <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {catalogs.map((c) => (
                            <Card key={c.id}>
                                <CardHeader>
                                    <CardTitle>{c.name}</CardTitle>
                                </CardHeader>
                                <CardBody className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--st-text-secondary)]">Products</span>
                                        <span className="font-medium tabular-nums">{c.product_count ?? 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--st-text-secondary)]">Vertical</span>
                                        <Badge variant="outline">{c.vertical || 'COMMERCE'}</Badge>
                                    </div>
                                    <div className="text-xs text-[var(--st-text-secondary)]">ID: {c.id}</div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            iconRight={ExternalLink}
                            onClick={() => window.open('https://business.facebook.com/commerce', '_blank', 'noopener,noreferrer')}
                        >
                            Open Commerce Manager
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
                        <Field label="Catalog name" required>
                            <Input
                                placeholder="e.g. Spring Collection 2026"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogOpen(false); setName(''); }}>Cancel</Button>
                        <Button variant="primary" loading={submitting} onClick={handleCreate} disabled={submitting || !name.trim()}>
                            {submitting ? 'Creating' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
