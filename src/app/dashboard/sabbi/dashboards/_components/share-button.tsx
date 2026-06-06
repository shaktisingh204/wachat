'use client';

import * as React from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Input, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { Share2, Copy, Check } from 'lucide-react';
import { setDashboardVisibility } from './share-action';

export function ShareButton({ dashboardId, visibility }: { dashboardId: string; visibility: string }) {
    const [open, setOpen] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [isPublic, setIsPublic] = React.useState(visibility === 'public');
    const [isPending, startTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const publicUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/dashboard/sabbi/dashboards/${dashboardId}/public` 
        : '';

    const handleCopy = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Link copied', description: 'Public link copied to clipboard.' });
    };

    const handleTogglePublic = () => {
        startTransition(async () => {
            const newVisibility = !isPublic;
            const result = await setDashboardVisibility(dashboardId, newVisibility);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                return;
            }
            
            setIsPublic(newVisibility);
            toast({ title: 'Updated', description: `Dashboard is now ${newVisibility ? 'public' : 'private'}.` });
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share Dashboard</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zoru-ink">Public Access</span>
                        <Button 
                            variant={isPublic ? 'default' : 'outline'} 
                            size="sm"
                            onClick={handleTogglePublic}
                            disabled={isPending}
                        >
                            {isPublic ? 'Enabled' : 'Disabled'}
                        </Button>
                    </div>
                    
                    {isPublic && (
                        <div className="flex gap-2">
                            <Input value={publicUrl} readOnly className="text-[13px]" />
                            <Button size="icon" variant="outline" onClick={handleCopy}>
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    )}
                    
                    {!isPublic && (
                        <p className="text-[13px] text-zoru-ink-muted">
                            Enable public access to generate a shareable link that anyone can view.
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
