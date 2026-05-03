'use client';

import * as React from 'react';
import { LuZap, LuPlus, LuCircleAlert, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
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
import { getAutomatedRules, createAutomatedRule, deleteAutomatedRule } from '@/app/actions/ad-manager-features.actions';

const ENTITY_TYPES = ['CAMPAIGN', 'ADSET', 'AD'] as const;
const ACTION_TYPES = ['PAUSE', 'UNPAUSE', 'CHANGE_BUDGET'] as const;
const METRIC_FIELDS = ['spend', 'cpc', 'ctr', 'impressions', 'reach'] as const;
const OPERATORS = ['GREATER_THAN', 'LESS_THAN'] as const;

export default function AutomatedRulesPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [rules, setRules] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    // form
    const [name, setName] = React.useState('');
    const [entityType, setEntityType] = React.useState<string>('CAMPAIGN');
    const [actionType, setActionType] = React.useState<string>('PAUSE');
    const [metricField, setMetricField] = React.useState<string>('spend');
    const [operator, setOperator] = React.useState<string>('GREATER_THAN');
    const [value, setValue] = React.useState('');

    const fetchRules = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const res = await getAutomatedRules(activeAccount.account_id);
        setRules(res.rules || []);
        setLoading(false);
    }, [activeAccount]);

    React.useEffect(() => { fetchRules(); }, [fetchRules]);

    const resetForm = () => {
        setName(''); setEntityType('CAMPAIGN'); setActionType('PAUSE');
        setMetricField('spend'); setOperator('GREATER_THAN'); setValue('');
    };

    const handleCreate = async () => {
        if (!activeAccount || !name || !value) {
            toast({ title: 'Validation', description: 'Name and threshold value are required.', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        const fd = new FormData();
        fd.set('adAccountId', activeAccount.account_id);
        fd.set('name', name);
        fd.set('entityType', entityType);
        fd.set('actionType', actionType);
        fd.set('metricField', metricField);
        fd.set('operator', operator);
        fd.set('value', value);

        const res = await createAutomatedRule(null, fd);
        setSubmitting(false);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Created', description: res.message });
            setDialogOpen(false);
            resetForm();
            fetchRules();
        }
    };

    const handleDelete = async (id: string) => {
        const res = await deleteAutomatedRule(id);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Rule deleted.' });
            setRules(prev => prev.filter(r => r.id !== id));
        } else {
            toast({ title: 'Error', description: res.error || 'Failed to delete.', variant: 'destructive' });
        }
        setDeleteId(null);
    };

    const formatCondition = (rule: any) => {
        try {
            const filters = rule.evaluation_spec?.filters;
            if (filters && filters.length > 0) {
                const f = filters[0];
                return `${f.field} ${(f.operator || '').replace(/_/g, ' ').toLowerCase()} ${f.value}`;
            }
        } catch { /* ignore */ }
        return '\u2014';
    };

    const formatAction = (rule: any) => {
        try {
            return rule.execution_spec?.execution_type?.replace(/_/g, ' ') || '\u2014';
        } catch { return '\u2014'; }
    };

    if (!activeAccount) {
        return (
            <div>
                <Alert>
                    <LuCircleAlert className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to manage automated rules.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LuZap className="h-6 w-6" /> Automated rules
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Automatically pause, scale or notify based on performance thresholds.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchRules} disabled={loading}>
                        <LuRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setDialogOpen(true)}>
                        <LuPlus className="h-4 w-4 mr-1" /> Create rule
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                        </div>
                    ) : rules.length === 0 ? (
                        <div className="py-16 text-center">
                            <LuZap className="h-12 w-12 mx-auto text-muted-foreground" />
                            <p className="mt-3 font-semibold">No automated rules yet</p>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                                Examples: pause ads with CTR below 0.5%, increase budget by 20% when ROAS exceeds 4x,
                                or send a notification when daily spend crosses a threshold.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Condition</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-16" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-medium">{r.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{formatCondition(r)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{formatAction(r)}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={r.status === 'ENABLED' ? 'default' : 'secondary'}>
                                                {r.status || 'UNKNOWN'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => setDeleteId(r.id)}
                                            >
                                                <LuTrash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create automated rule</DialogTitle>
                        <DialogDescription>Set conditions and actions that run automatically.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Rule name *</Label>
                            <Input placeholder="e.g. Pause low CTR campaigns" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Entity type</Label>
                                <Select value={entityType} onValueChange={setEntityType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Action</Label>
                                <Select value={actionType} onValueChange={setActionType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Metric</Label>
                                <Select value={metricField} onValueChange={setMetricField}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {METRIC_FIELDS.map(m => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Operator</Label>
                                <Select value={operator} onValueChange={setOperator}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {OPERATORS.map(o => <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Value *</Label>
                                <Input type="number" placeholder="0" value={value} onChange={e => setValue(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleCreate} disabled={submitting}>
                            {submitting ? 'Creating\u2026' : 'Create rule'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete rule?</DialogTitle>
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
