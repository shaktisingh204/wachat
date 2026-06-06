'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Skeleton,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Switch,
  Badge,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useEffect,
  useTransition,
  use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft,
  Image as ImageIcon,
  CircleAlert,
  RefreshCw,
  EllipsisVertical,
  Pause,
  Play,
  Copy,
  Trash2 } from 'lucide-react';
import { getAds,
  updateEntityStatus,
  updateAd,
  duplicateAd,
  deleteAd,
  getAdSet,
  getFacebookPagesForAdCreation,
  createAd } from '@/app/actions/ad-manager.actions';
import { useAdManager } from '@/context/ad-manager-context';
import { Plus } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
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
            toast({ title: 'Validation Error', description: 'Please fill in all fields.', variant: 'destructive' });
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
                toast({ title: 'Create Failed', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Ad Created successfully' });
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
            toast({ title: 'Status Updated', description: `Ad is now ${newStatus.toLowerCase()}.` });
        } else {
            setAds(prev => prev.map(item =>
                item.id === id ? { ...item, status: currentStatus as any } : item
            ));
            toast({ title: 'Update Failed', description: result.error, variant: 'destructive' });
        }
    };

    const handleDuplicate = async (id: string) => {
        const result = await duplicateAd(id);
        if (result.error) {
            toast({ title: 'Duplicate Failed', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Duplicated', description: 'Ad duplicated successfully.' });
            fetchAds();
        }
    };

    const handleDelete = async (id: string) => {
        const result = await deleteAd(id);
        if (result.error) {
            toast({ title: 'Delete Failed', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Deleted', description: 'Ad deleted.' });
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
            toast({ title: 'Failed to update name', description: res.error, variant: 'destructive' });
            setAds(originalAds);
        } else {
            toast({ title: 'Name updated successfully' });
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
                        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={fetchAds} disabled={isLoading} aria-label="Refresh">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="default" size="sm" onClick={() => setIsCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Create Ad
                        </Button>
                    </div>
                }
            />

            {error && (
                <Alert variant="destructive">
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>Error fetching Ads</ZoruAlertTitle>
                    <ZoruAlertDescription>{error}</ZoruAlertDescription>
                </Alert>
            )}

            {ads.length === 0 ? (
                <Card className="border-dashed border-2 py-12">
                    <div className="flex flex-col items-center justify-center text-center gap-4">
                        <div className="bg-[var(--st-text)]/10 p-4 rounded-full">
                            <ImageIcon className="h-12 w-12 text-[var(--st-text)]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold">No Ads Found</h3>
                            <p className="text-[var(--st-text-secondary)] mt-1">This ad set currently has no ads.</p>
                        </div>
                    </div>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {ads.map((ad) => (
                        <Card key={ad.id} className="overflow-hidden">
                            <div className="aspect-video relative bg-[var(--st-bg-muted)] flex items-center justify-center overflow-hidden">
                                {ad.imageUrl ? (
                                    <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="h-12 w-12 text-[var(--st-text-secondary)]" />
                                )}
                                <div className="absolute top-2 right-2">
                                    <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'}>{ad.status}</Badge>
                                </div>
                            </div>
                            <ZoruCardHeader className="p-4">
                                <div className="flex justify-between items-start gap-2">
                                    {editingAdId === ad.id ? (
                                        <div className="flex-1 flex items-center gap-2">
                                            <Input
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                className="h-7 text-sm"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveName(ad.id);
                                                    if (e.key === 'Escape') setEditingAdId(null);
                                                }}
                                            />
                                            <Button size="sm" className="h-7" onClick={() => handleSaveName(ad.id)}>Save</Button>
                                        </div>
                                    ) : (
                                        <ZoruCardTitle 
                                            className="text-base truncate cursor-pointer hover:underline" 
                                            title={ad.name}
                                            onClick={() => {
                                                setEditingName(ad.name);
                                                setEditingAdId(ad.id);
                                            }}
                                        >
                                            {ad.name}
                                        </ZoruCardTitle>
                                    )}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Switch
                                            className="scale-75"
                                            checked={ad.status === 'ACTIVE'}
                                            onCheckedChange={() => handleStatusToggle(ad.id, ad.status)}
                                        />
                                        <DropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <EllipsisVertical className="h-4 w-4" />
                                                </Button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem onClick={() => handleStatusToggle(ad.id, ad.status)}>
                                                    {ad.status === 'ACTIVE' ? (
                                                        <><Pause className="h-4 w-4 mr-2" /> Pause</>
                                                    ) : (
                                                        <><Play className="h-4 w-4 mr-2" /> Resume</>
                                                    )}
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem onClick={() => handleDuplicate(ad.id)}>
                                                    <Copy className="h-4 w-4 mr-2" /> Duplicate
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    className="text-[var(--st-text)] focus:text-[var(--st-text)]"
                                                    onClick={() => setDeleteId(ad.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <ZoruCardDescription className="text-xs">ID: {ad.id}</ZoruCardDescription>
                            </ZoruCardHeader>
                            <ZoruCardContent className="p-4 pt-0 text-sm grid grid-cols-2 gap-2">
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
                            </ZoruCardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Ad Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <ZoruDialogContent className="max-w-md">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Create New Ad</ZoruDialogTitle>
                        <ZoruDialogDescription>Build a new ad creative directly into this Ad Set.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    
                    <div className="flex flex-col gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Ad Name</Label>
                            <Input 
                                placeholder="My New Ad" 
                                value={createName} 
                                onChange={(e) => setCreateName(e.target.value)} 
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Facebook Page</Label>
                            <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a page" />
                                </SelectTrigger>
                                <SelectContent>
                                    {pages.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Ad Status</Label>
                            <Select value={createStatus} onValueChange={setCreateStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PAUSED">Paused</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Link URL</Label>
                            <Input 
                                type="url"
                                placeholder="https://example.com" 
                                value={createLink} 
                                onChange={(e) => setCreateLink(e.target.value)} 
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Primary Text</Label>
                            <Textarea 
                                placeholder="Tell people what your ad is about..." 
                                value={createMessage} 
                                onChange={(e) => setCreateMessage(e.target.value)}
                                className="resize-none"
                                rows={3}
                            />
                        </div>
                    </div>

                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={handleCreateAd} 
                            disabled={isCreating || !createName || !selectedPageId || !createMessage || !createLink}
                        >
                            {isCreating ? 'Creating...' : 'Create Ad'}
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete ad?</ZoruDialogTitle>
                        <ZoruDialogDescription>This action cannot be undone. The ad will be permanently deleted.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}
