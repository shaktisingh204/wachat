'use client';

import * as React from 'react';
import { LuTarget, LuPlus, LuCircleAlert, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { listCustomConversions, listPixels } from '@/app/actions/ad-manager.actions';
import { createCustomConversion, deleteCustomConversion } from '@/app/actions/ad-manager-features.actions';

const EVENT_TYPES = [
    'PURCHASE', 'LEAD', 'COMPLETE_REGISTRATION', 'ADD_TO_CART',
    'INITIATE_CHECKOUT', 'SEARCH', 'VIEW_CONTENT',
] as const;

export default function CustomConversionsPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [conversions, setConversions] = React.useState<any[]>([]);
    const [pixels, setPixels] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    // form fields
    const [name, setName] = React.useState('');
    const [pixelId, setPixelId] = React.useState('');
    const [eventName, setEventName] = React.useState<string>('PURCHASE');
    const [urlRule, setUrlRule] = React.useState('');
    const [defaultValue, setDefaultValue] = React.useState('');

    const fetchData = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const [convRes, pixRes] = await Promise.all([
            listCustomConversions(activeAccount.account_id),
            listPixels(activeAccount.account_id),
        ]);
        setConversions(convRes.data || []);
        setPixels(pixRes.data || []);
        setLoading(false);
    }, [activeAccount]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const resetForm = () => {
        setName(''); setPixelId(''); setEventName('PURCHASE');
        setUrlRule(''); setDefaultValue('');
    };

    const handleCreate = async () => {
        if (!activeAccount || !name || !pixelId) {
            toast({ title: 'Validation', description: 'Name and pixel are required.', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        const fd = new FormData();
        fd.set('adAccountId', activeAccount.account_id);
        fd.set('name', name);
        fd.set('pixelId', pixelId);
        fd.set('eventName', eventName);
        fd.set('urlRule', urlRule);
        fd.set('defaultValue', defaultValue);

        const res = await createCustomConversion(null, fd);
        setSubmitting(false);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Created', description: res.message });
            setDialogOpen(false);
            resetForm();
            fetchData();
        }
    };

    const handleDelete = async (id: string) => {
        const res = await deleteCustomConversion(id);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Custom conversion deleted.' });
            setConversions(prev => prev.filter(c => c.id !== id));
        } else {
            toast({ title: 'Error', description: res.error || 'Failed to delete.', variant: 'destructive' });
        }
        setDeleteId(null);
    };

    if (!activeAccount) {
        return (
            <div className="p-8">
                <Alert>
                    <LuCircleAlert className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view custom conversions.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LuTarget className="h-6 w-6" /> Custom conversions
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Define URL-based or rule-based conversion events without code changes.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                        <LuRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setDialogOpen(true)}>
                        <LuPlus className="h-4 w-4 mr-1" /> New custom conversion
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Event type</TableHead>
                                    <TableHead>Last fired</TableHead>
                                    <TableHead>Default value</TableHead>
                                    <TableHead className="w-16" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {conversions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No custom conversions yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    conversions.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">
                                                {c.name}
                                                {c.description && (
                                                    <div className="text-xs text-muted-foreground">{c.description}</div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{c.custom_event_type || 'OTHER'}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {c.last_fired_time
                                                    ? new Date(c.last_fired_time).toLocaleString()
                                                    : '\u2014'}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {c.default_conversion_value || '\u2014'}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => setDeleteId(c.id)}
                                                >
                                                    <LuTrash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New custom conversion</DialogTitle>
                        <DialogDescription>Create a URL-based or rule-based conversion event.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input placeholder="e.g. Thank-you page purchase" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Pixel *</Label>
                            <Select value={pixelId} onValueChange={setPixelId}>
                                <SelectTrigger><SelectValue placeholder="Select a pixel" /></SelectTrigger>
                                <SelectContent>
                                    {pixels.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.id})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Event type</Label>
                            <Select value={eventName} onValueChange={setEventName}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {EVENT_TYPES.map(e => (
                                        <SelectItem key={e} value={e}>{e.replace(/_/g, ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>URL rule (contains)</Label>
                            <Input placeholder="e.g. /thank-you" value={urlRule} onChange={e => setUrlRule(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Default conversion value</Label>
                            <Input type="number" placeholder="0" value={defaultValue} onChange={e => setDefaultValue(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleCreate} disabled={submitting}>
                            {submitting ? 'Creating\u2026' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete custom conversion?</DialogTitle>
                        <DialogDescription>This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
