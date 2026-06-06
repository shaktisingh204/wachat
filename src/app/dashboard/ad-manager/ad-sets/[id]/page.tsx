'use client';

import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Alert,
  Switch,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Textarea,
  Field,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useEffect,
  useTransition,
  use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft,
  Image as ImageIcon,
  RefreshCw,
  EllipsisVertical,
  Pause,
  Play,
  Copy,
  Trash2,
  Plus } from 'lucide-react';
import { getAds,
  updateEntityStatus,
  updateAd,
  duplicateAd,
  deleteAd,
  getAdSet,
  getFacebookPagesForAdCreation,
  createAd } from '@/app/actions/ad-manager.actions';
import { useAdManager } from '@/context/ad-manager-context';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <div className="grid md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
        </div>
    );
}

export default function AdsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: adSetId } = use(params);
    const router = useRouter();
    const [ads, setAds] = useState<any[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const { toast } = useToast();
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const { activeAccount } = useAdManager();
    const [editingAdId, setEditingAdId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createStatus, setCreateStatus] = useState('PAUSED');
    const [createMessage, setCreateMessage] = useState('');
    const [createLink, setCreateLink] = useState('https://');
    const [selectedPageId, setSelectedPageId] = useState('');
    const [pages, setPages] = useState<any[]>([]);
    const [isCreating, startCreatingTransition] = useTransition();

    useEffect(() => {
        if (isCreateOpen && pages.length === 0) {
            getFacebookPagesForAdCreation().then(res => {
                if (res.pages) {
                    setPages(res.pages);
                    if (res.pages.length > 0) setSelectedPageId(res.pages[0].id);
                }
            });
        }
    }, [isCreateOpen]);

    const handleCreateAd = () => {
        if (!createName || !selectedPageId || !createMessage || !createLink) {
            toast({ title: 'Validation Error', description: 'Please fill in all fields.', tone: 'danger' });
            return;
        }
        startCreatingTransition(async () => {
            const payload = {
                name: createName,
                adset_id: adSetId,
                status: createStatus as 'ACTIVE' | 'PAUSED',
                creative: {
                    name: `Creative for ${createName}`,
                    object_story_spec: {
                        page_id: selectedPageId,
                        link_data: {
                            link: createLink,
                            message: createMessage,
                        }
                    }
                }
            };
            const result = await createAd(activeAccount!.account_id, payload);
            if (result.error) {
                toast({ title: 'Create Failed', description: result.error, tone: 'danger' });
            } else {
                toast.success('Ad created successfully');
                setIsCreateOpen(false);
                setCreateName('');
                setCreateMessage('');
                setCreateLink('https://');
                fetchAds();
            }
        });
    };

    const fetchAds = () => {
        if (!activeAccount) {
            router.push('/dashboard/ad-manager/ad-accounts');
            return;
        }
        startLoadingTransition(async () => {
            const adSetRes = await getAdSet(adSetId);
            if (adSetRes.error) {
                setError(adSetRes.error);
                return;
            }
            if (!adSetRes.data) {
                setError('Failed to fetch Ad Set details.');
                return;
            }
            const actualAccountId = String(adSetRes.data.account_id || '').replace(/^act_/, '');
            const expectedAccountId = activeAccount.account_id.replace(/^act_/, '');
            if (actualAccountId !== expectedAccountId) {
                setError(`Ad Set does not belong to the currently active Ad Account. Expected: ${expectedAccountId}, Found: ${actualAccountId}`);
                setAds([]);
                return;
            }
            const result = await getAds(adSetId);
            if (result.error) setError(result.error);
            else setError(null);
            setAds(result.ads || []);
        });
    };

    useEffect(() => { fetchAds(); }, [adSetId, activeAccount, router]);

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        setAds(prev => prev.map(item =>
            item.id === id ? { ...item, status: newStatus } : item
        ));

        const result = await updateEntityStatus(id, 'ad', newStatus);

        if (result.success) {
            toast({ title: 'Status Updated', description: `Ad is now ${newStatus.toLowerCase()}.`, tone: 'success' });
        } else {
            setAds(prev => prev.map(item =>
                item.id === id ? { ...item, status: currentStatus as any } : item
            ));
            toast({ title: 'Update Failed', description: result.error, tone: 'danger' });
        }
    };

    const handleDuplicate = async (id: string) => {
        const result = await duplicateAd(id);
        if (result.error) {
            toast({ title: 'Duplicate Failed', description: result.error, tone: 'danger' });
        } else {
            toast.success('Ad duplicated successfully.');
            fetchAds();
        }
    };

    const handleDelete = async (id: string) => {
        const result = await deleteAd(id);
        if (result.error) {
            toast({ title: 'Delete Failed', description: result.error, tone: 'danger' });
        } else {
            toast.success('Ad deleted.');
            setAds(prev => prev.filter(a => a.id !== id));
        }
        setDeleteId(null);
    };

    const handleSaveName = async (id: string) => {
        if (!editingName.trim()) {
            setEditingAdId(null);
            return;
        }
        const originalAds = [...ads];
        setAds(prev => prev.map(a => a.id === id ? { ...a, name: editingName.trim() } : a));
        const res = await updateAd(id, { name: editingName.trim() });
        if (res.error) {
            toast({ title: 'Failed to update name', description: res.error, tone: 'danger' });
            setAds(originalAds);
        } else {
            toast.success('Name updated successfully');
        }
        setEditingAdId(null);
    };

    if (isLoading) return <PageSkeleton />;

    return (
        <div className="flex flex-col gap-6">
            <AmBreadcrumb page="Ads" parent={{ label: "Ad Sets", href: "/dashboard/ad-manager/ad-sets" }} />

            <AmHeader
                title="Ads"
                description={`Ad Set ID: ${adSetId}`}
                actions={
                    <div className="flex items-center gap-2">
                        <IconButton
                            label="Go back"
                            icon={ArrowLeft}
                            variant="ghost"
                            onClick={() => router.back()}
                        />
                        <IconButton
                            label="Refresh ads"
                            icon={RefreshCw}
                            variant="outline"
                            onClick={fetchAds}
                            disabled={isLoading}
                            className={isLoading ? 'is-loading' : undefined}
                        />
                        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setIsCreateOpen(true)}>
                            Create Ad
                        </Button>
                    </div>
                }
            />

            {error && (
                <Alert tone="danger" title="Error fetching Ads">
                    {error}
                </Alert>
            )}

            {ads.length === 0 ? (
                <EmptyState
                    icon={ImageIcon}
                    title="No Ads Found"
                    description="This ad set currently has no ads."
                    action={
                        <Button variant="primary" iconLeft={Plus} onClick={() => setIsCreateOpen(true)}>
                            Create Ad
                        </Button>
                    }
                />
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {ads.map((ad) => (
                        <Card key={ad.id} padding="none" className="overflow-hidden">
                            <div className="aspect-video relative bg-[var(--st-bg-muted)] flex items-center justify-center overflow-hidden">
                                {ad.imageUrl ? (
                                    <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="h-12 w-12 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                )}
                                <div className="absolute top-2 right-2">
                                    <Badge tone={ad.status === 'ACTIVE' ? 'success' : 'neutral'}>{ad.status}</Badge>
                                </div>
                            </div>
                            <CardHeader className="p-4">
                                <div className="flex justify-between items-start gap-2">
                                    {editingAdId === ad.id ? (
                                        <div className="flex-1 flex items-center gap-2">
                                            <Input
                                                inputSize="sm"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                aria-label="Ad name"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveName(ad.id);
                                                    if (e.key === 'Escape') setEditingAdId(null);
                                                }}
                                            />
                                            <Button variant="primary" size="sm" onClick={() => handleSaveName(ad.id)}>Save</Button>
                                        </div>
                                    ) : (
                                        <CardTitle
                                            className="text-base truncate cursor-pointer hover:underline"
                                            title={ad.name}
                                            onClick={() => {
                                                setEditingName(ad.name);
                                                setEditingAdId(ad.id);
                                            }}
                                        >
                                            {ad.name}
                                        </CardTitle>
                                    )}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Switch
                                            size="sm"
                                            aria-label={`Toggle ${ad.name} status`}
                                            checked={ad.status === 'ACTIVE'}
                                            onCheckedChange={() => handleStatusToggle(ad.id, ad.status)}
                                        />
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <IconButton label="Ad actions" icon={EllipsisVertical} variant="ghost" size="sm" />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    iconLeft={ad.status === 'ACTIVE' ? Pause : Play}
                                                    onSelect={() => handleStatusToggle(ad.id, ad.status)}
                                                >
                                                    {ad.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem iconLeft={Copy} onSelect={() => handleDuplicate(ad.id)}>
                                                    Duplicate
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    variant="danger"
                                                    iconLeft={Trash2}
                                                    onSelect={() => setDeleteId(ad.id)}
                                                >
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <CardDescription className="text-xs">ID: {ad.id}</CardDescription>
                            </CardHeader>
                            <CardBody className="p-4 pt-0 text-sm grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-[var(--st-text-secondary)] block text-xs">Impressions</span>
                                    <span className="font-medium">{ad.insights?.impressions || 0}</span>
                                </div>
                                <div>
                                    <span className="text-[var(--st-text-secondary)] block text-xs">Clicks</span>
                                    <span className="font-medium">{ad.insights?.clicks || 0}</span>
                                </div>
                                <div>
                                    <span className="text-[var(--st-text-secondary)] block text-xs">Spend</span>
                                    <span className="font-medium">${ad.insights?.spend || 0}</span>
                                </div>
                                <div>
                                    <span className="text-[var(--st-text-secondary)] block text-xs">CTR</span>
                                    <span className="font-medium">{ad.insights?.ctr ? Number(ad.insights.ctr).toFixed(2) : 0}%</span>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Ad Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create New Ad</DialogTitle>
                        <DialogDescription>Build a new ad creative directly into this Ad Set.</DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4">
                        <Field label="Ad Name">
                            <Input
                                placeholder="My New Ad"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                            />
                        </Field>

                        <Field label="Facebook Page">
                            <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                                <SelectTrigger aria-label="Facebook Page">
                                    <SelectValue placeholder="Select a page" />
                                </SelectTrigger>
                                <SelectContent>
                                    {pages.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field label="Ad Status">
                            <Select value={createStatus} onValueChange={setCreateStatus}>
                                <SelectTrigger aria-label="Ad Status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PAUSED">Paused</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field label="Link URL">
                            <Input
                                type="url"
                                placeholder="https://example.com"
                                value={createLink}
                                onChange={(e) => setCreateLink(e.target.value)}
                            />
                        </Field>

                        <Field label="Primary Text">
                            <Textarea
                                placeholder="Tell people what your ad is about..."
                                value={createMessage}
                                onChange={(e) => setCreateMessage(e.target.value)}
                                className="resize-none"
                                rows={3}
                            />
                        </Field>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            loading={isCreating}
                            onClick={handleCreateAd}
                            disabled={isCreating || !createName || !selectedPageId || !createMessage || !createLink}
                        >
                            {isCreating ? 'Creating...' : 'Create Ad'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete ad?</DialogTitle>
                        <DialogDescription>This action cannot be undone. The ad will be permanently deleted.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
