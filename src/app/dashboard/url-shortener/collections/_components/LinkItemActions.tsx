'use client';

import { useState, useTransition } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Label, useToast, Skeleton, DialogDescription } from '@/components/sabcrm/20ui';
import { MoreVertical, BarChart, Settings, QrCode as QrCodeIcon, Download, Trash, Plus } from 'lucide-react';
import QRCode from 'react-qr-code';
import { updateShortUrl, getShortUrlAnalyticsGeo } from '@/app/actions/url-shortener.actions';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface LinkItemActionsProps {
    url: WithId<ShortUrl>;
    onUpdate: () => void;
}

export function LinkItemActions({ url, onUpdate }: LinkItemActionsProps) {
    const [isGeoOpen, setIsGeoOpen] = useState(false);
    const [isAbOpen, setIsAbOpen] = useState(false);
    const [isQrOpen, setIsQrOpen] = useState(false);

    const [geoData, setGeoData] = useState<{ country: string; count: number }[] | null>(null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    // A/B test state
    const [splitTargets, setSplitTargets] = useState<{ url: string; weight: number }[]>(url.splitTargets || []);

    const handleOpenGeo = () => {
        setIsGeoOpen(true);
        setGeoData(null);
        startTransition(async () => {
            try {
                const data = await getShortUrlAnalyticsGeo(url._id.toString());
                setGeoData(data);
            } catch (e: any) {
                toast({ title: 'Error', description: 'Failed to fetch geo analytics', variant: 'destructive' });
                setGeoData([]);
            }
        });
    };

    const handleSaveAbTest = () => {
        startTransition(async () => {
            try {
                const res = await updateShortUrl(url._id.toString(), { splitTargets });
                if (res.success) {
                    toast({ title: 'Success', description: 'A/B test settings updated.' });
                    setIsAbOpen(false);
                    onUpdate();
                } else {
                    toast({ title: 'Error', description: res.error || 'Failed to update', variant: 'destructive' });
                }
            } catch (e: any) {
                toast({ title: 'Error', description: 'API Error: Failed to save A/B test', variant: 'destructive' });
            }
        });
    };

    const handleAddTarget = () => {
        setSplitTargets([...splitTargets, { url: '', weight: 50 }]);
    };

    const handleUpdateTarget = (index: number, field: 'url' | 'weight', value: string | number) => {
        const newTargets = [...splitTargets];
        newTargets[index] = { ...newTargets[index], [field]: value };
        setSplitTargets(newTargets);
    };

    const handleRemoveTarget = (index: number) => {
        setSplitTargets(splitTargets.filter((_, i) => i !== index));
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={handleOpenGeo}>
                        <BarChart className="mr-2 h-4 w-4" /> Geo Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsAbOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" /> A/B Testing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsQrOpen(true)}>
                        <QrCodeIcon className="mr-2 h-4 w-4" /> Generate QR
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Geo Analytics Modal */}
            <Dialog open={isGeoOpen} onOpenChange={setIsGeoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Geographic Analytics</DialogTitle>
                        <DialogDescription>
                            Clicks by country for /{url.shortCode}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {isPending && !geoData ? (
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : geoData?.length === 0 ? (
                            <p className="text-sm text-[var(--st-text-secondary)] text-center py-4">No geographic data available yet.</p>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {geoData?.map((item) => (
                                    <div key={item.country} className="flex justify-between items-center p-3 rounded-lg border border-[var(--st-border)] bg-[var(--st-text)]/50">
                                        <span className="text-sm font-medium">{item.country || 'Unknown'}</span>
                                        <span className="text-sm text-[var(--st-text-secondary)]">{item.count} clicks</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* A/B Testing Modal */}
            <Dialog open={isAbOpen} onOpenChange={setIsAbOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>A/B Testing (Split Targets)</DialogTitle>
                        <DialogDescription>
                            Distribute traffic among multiple destination URLs.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {splitTargets.map((target, index) => (
                            <div key={index} className="flex gap-2 items-end">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-[var(--st-text-secondary)]">URL</Label>
                                    <Input 
                                        value={target.url} 
                                        onChange={(e) => handleUpdateTarget(index, 'url', e.target.value)} 
                                        placeholder="https://example.com"
                                    />
                                </div>
                                <div className="w-20 space-y-1">
                                    <Label className="text-xs text-[var(--st-text-secondary)]">Weight (%)</Label>
                                    <Input 
                                        type="number"
                                        min={1}
                                        value={target.weight} 
                                        onChange={(e) => handleUpdateTarget(index, 'weight', parseInt(e.target.value) || 0)} 
                                    />
                                </div>
                                <Button variant="ghost" size="icon" className="mb-[2px] text-[var(--st-text-secondary)] hover:text-[var(--st-text-secondary)] hover:bg-[var(--st-text)]" onClick={() => handleRemoveTarget(index)}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleAddTarget}>
                            <Plus className="mr-2 h-4 w-4" /> Add Target
                        </Button>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="ghost" onClick={() => setIsAbOpen(false)}>Cancel</Button>
                            <Button disabled={isPending} onClick={handleSaveAbTest}>
                                {isPending ? 'Saving...' : 'Save A/B Test'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* QR Code Modal */}
            <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
                <DialogContent className="sm:max-w-sm text-center">
                    <DialogHeader>
                        <DialogTitle>QR Code for /{url.shortCode}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center py-6 space-y-6">
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <QRCode 
                                value={`https://${url.domainId || 'sabnode.com'}/${url.shortCode}`} 
                                size={200}
                                level="H"
                            />
                        </div>
                        <Button className="w-full" variant="secondary" onClick={() => {
                            toast({ title: 'Info', description: 'Right-click the QR code to save image.' });
                        }}>
                            <Download className="mr-2 h-4 w-4" /> Download Instructions
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
