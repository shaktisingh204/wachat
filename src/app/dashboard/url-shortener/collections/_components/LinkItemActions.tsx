'use client';

import { useState, useTransition } from 'react';
import {
    Button,
    IconButton,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Field,
    Input,
    Skeleton,
    Badge,
    EmptyState,
    useToast,
} from '@/components/sabcrm/20ui';
import { MoreVertical, BarChart, Settings, QrCode as QrCodeIcon, Download, Trash, Plus, Globe } from 'lucide-react';
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
            } catch {
                toast({ title: 'Could not load analytics', description: 'Failed to fetch geo analytics. Please try again.', tone: 'danger' });
                setGeoData([]);
            }
        });
    };

    const handleSaveAbTest = () => {
        startTransition(async () => {
            try {
                const res = await updateShortUrl(url._id.toString(), { splitTargets });
                if (res.success) {
                    toast({ title: 'A/B test updated', description: 'Traffic split was saved.', tone: 'success' });
                    setIsAbOpen(false);
                    onUpdate();
                } else {
                    toast({ title: 'Could not save', description: res.error || 'Failed to update', tone: 'danger' });
                }
            } catch {
                toast({ title: 'Could not save', description: 'We could not save the A/B test. Please try again.', tone: 'danger' });
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
                    <IconButton
                        label="Link actions"
                        icon={MoreVertical}
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem iconLeft={BarChart} onClick={handleOpenGeo}>
                        Geo analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem iconLeft={Settings} onClick={() => setIsAbOpen(true)}>
                        A/B testing
                    </DropdownMenuItem>
                    <DropdownMenuItem iconLeft={QrCodeIcon} onClick={() => setIsQrOpen(true)}>
                        Generate QR
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Geo Analytics Modal */}
            <Dialog open={isGeoOpen} onOpenChange={setIsGeoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Clicks by country</DialogTitle>
                        <DialogDescription>
                            Clicks by country for /{url.shortCode}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {isPending && !geoData ? (
                            <div className="space-y-2">
                                <Skeleton height={40} />
                                <Skeleton height={40} />
                                <Skeleton height={40} />
                            </div>
                        ) : geoData?.length === 0 ? (
                            <EmptyState
                                icon={Globe}
                                title="No geographic data yet"
                                description="Clicks by country will appear here once this link starts getting traffic."
                            />
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {geoData?.map((item) => (
                                    <div
                                        key={item.country}
                                        className="flex justify-between items-center p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                                    >
                                        <span className="text-sm font-medium text-[var(--st-text)]">
                                            {item.country || 'Unknown'}
                                        </span>
                                        <Badge tone="info">{item.count} clicks</Badge>
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
                        <DialogTitle>A/B testing (split targets)</DialogTitle>
                        <DialogDescription>
                            Distribute traffic among multiple destination URLs.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {splitTargets.map((target, index) => (
                            <div key={index} className="flex gap-2 items-end">
                                <Field label="URL" className="flex-1">
                                    <Input
                                        value={target.url}
                                        onChange={(e) => handleUpdateTarget(index, 'url', e.target.value)}
                                        placeholder="https://example.com"
                                    />
                                </Field>
                                <Field label="Weight (%)" className="w-24">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={target.weight}
                                        onChange={(e) => handleUpdateTarget(index, 'weight', parseInt(e.target.value) || 0)}
                                    />
                                </Field>
                                <IconButton
                                    label="Remove target"
                                    icon={Trash}
                                    variant="ghost"
                                    onClick={() => handleRemoveTarget(index)}
                                />
                            </div>
                        ))}
                        <Button variant="outline" size="sm" block iconLeft={Plus} onClick={handleAddTarget}>
                            Add target
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAbOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" loading={isPending} onClick={handleSaveAbTest}>
                            {isPending ? 'Saving' : 'Save A/B test'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* QR Code Modal */}
            <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
                <DialogContent className="sm:max-w-sm text-center">
                    <DialogHeader>
                        <DialogTitle>QR code for /{url.shortCode}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center py-6 space-y-6">
                        <div className="bg-white p-4 rounded-[var(--st-radius)] shadow-[var(--st-shadow)]">
                            <QRCode
                                value={`https://${url.domainId || 'sabnode.com'}/${url.shortCode}`}
                                size={200}
                                level="H"
                            />
                        </div>
                        <Button
                            block
                            variant="secondary"
                            iconLeft={Download}
                            onClick={() => {
                                toast({ title: 'Save the QR code', description: 'Right-click the QR code, then choose Save image.', tone: 'info' });
                            }}
                        >
                            How to download
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
