'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Skeleton,
  Badge,
  Input,
  Label,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  Target,
  Plus,
  CircleAlert,
  RefreshCw,
  Trash2 } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
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
            <div className="space-y-6">
                <AmBreadcrumb page="Custom conversions" />
                <AmHeader
                    title="Custom conversions"
                    description="Define URL-based or rule-based conversion events without code changes."
                />
                <ZoruAlert>
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to view custom conversions.</ZoruAlertDescription>
                </ZoruAlert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Custom conversions" />
            <AmHeader
                title="Custom conversions"
                description="Define URL-based or rule-based conversion events without code changes."
                actions={
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </ZoruButton>
                        <ZoruButton className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-1" /> New custom conversion
                        </ZoruButton>
                    </div>
                }
            />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>Conversions for {activeAccount.name || activeAccount.account_id}</span>
            </div>

            <ZoruCard>
                <ZoruCardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <ZoruSkeleton key={i} className="h-10" />)}
                        </div>
                    ) : (
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Name</ZoruTableHead>
                                    <ZoruTableHead>Event type</ZoruTableHead>
                                    <ZoruTableHead>Last fired</ZoruTableHead>
                                    <ZoruTableHead>Default value</ZoruTableHead>
                                    <ZoruTableHead className="w-16" />
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {conversions.length === 0 ? (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No custom conversions yet.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    conversions.map((c) => (
                                        <ZoruTableRow key={c.id}>
                                            <ZoruTableCell className="font-medium">
                                                {c.name}
                                                {c.description && (
                                                    <div className="text-xs text-muted-foreground">{c.description}</div>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant="outline">{c.custom_event_type || 'OTHER'}</ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-xs text-muted-foreground">
                                                {c.last_fired_time
                                                    ? new Date(c.last_fired_time).toLocaleString()
                                                    : '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="tabular-nums">
                                                {c.default_conversion_value || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => setDeleteId(c.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </ZoruButton>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    )}
                </ZoruCardContent>
            </ZoruCard>

            {/* Create dialog */}
            <ZoruDialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
                <ZoruDialogContent className="max-w-lg">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>New custom conversion</ZoruDialogTitle>
                        <ZoruDialogDescription>Create a URL-based or rule-based conversion event.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <ZoruLabel>Name *</ZoruLabel>
                            <ZoruInput placeholder="e.g. Thank-you page purchase" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Pixel *</ZoruLabel>
                            <ZoruSelect value={pixelId} onValueChange={setPixelId}>
                                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select a pixel" /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {pixels.map(p => (
                                        <ZoruSelectItem key={p.id} value={p.id}>{p.name} ({p.id})</ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Event type</ZoruLabel>
                            <ZoruSelect value={eventName} onValueChange={setEventName}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {EVENT_TYPES.map(e => (
                                        <ZoruSelectItem key={e} value={e}>{e.replace(/_/g, ' ')}</ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>URL rule (contains)</ZoruLabel>
                            <ZoruInput placeholder="e.g. /thank-you" value={urlRule} onChange={e => setUrlRule(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Default conversion value</ZoruLabel>
                            <ZoruInput type="number" placeholder="0" value={defaultValue} onChange={e => setDefaultValue(e.target.value)} />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</ZoruButton>
                        <ZoruButton className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleCreate} disabled={submitting}>
                            {submitting ? 'Creating…' : 'Create'}
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Delete confirmation */}
            <ZoruDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete custom conversion?</ZoruDialogTitle>
                        <ZoruDialogDescription>This action cannot be undone.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" onClick={() => setDeleteId(null)}>Cancel</ZoruButton>
                        <ZoruButton variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
