'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Zap,
  Plus,
  CircleAlert,
  RefreshCw,
  Trash2 } from 'lucide-react';

import * as React from 'react';

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
        return '—';
    };

    const formatAction = (rule: any) => {
        try {
            return rule.execution_spec?.execution_type?.replace(/_/g, ' ') || '—';
        } catch { return '—'; }
    };

    if (!activeAccount) {
        return (
            <div>
                <ZoruAlert>
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to manage automated rules.</ZoruAlertDescription>
                </ZoruAlert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Zap className="h-6 w-6" /> Automated rules
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Automatically pause, scale or notify based on performance thresholds.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" size="icon" onClick={fetchRules} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </ZoruButton>
                    <ZoruButton className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Create rule
                    </ZoruButton>
                </div>
            </div>

            <ZoruCard>
                <ZoruCardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <ZoruSkeleton key={i} className="h-10" />)}
                        </div>
                    ) : rules.length === 0 ? (
                        <div className="py-16 text-center">
                            <Zap className="h-12 w-12 mx-auto text-muted-foreground" />
                            <p className="mt-3 font-semibold">No automated rules yet</p>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                                Examples: pause ads with CTR below 0.5%, increase budget by 20% when ROAS exceeds 4x,
                                or send a notification when daily spend crosses a threshold.
                            </p>
                        </div>
                    ) : (
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Name</ZoruTableHead>
                                    <ZoruTableHead>Condition</ZoruTableHead>
                                    <ZoruTableHead>Action</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead className="w-16" />
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {rules.map((r) => (
                                    <ZoruTableRow key={r.id}>
                                        <ZoruTableCell className="font-medium">{r.name}</ZoruTableCell>
                                        <ZoruTableCell className="text-sm text-muted-foreground">{formatCondition(r)}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant="outline">{formatAction(r)}</ZoruBadge>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant={r.status === 'ENABLED' ? 'default' : 'secondary'}>
                                                {r.status || 'UNKNOWN'}
                                            </ZoruBadge>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruButton
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => setDeleteId(r.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </ZoruButton>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </ZoruTable>
                    )}
                </ZoruCardContent>
            </ZoruCard>

            {/* Create dialog */}
            <ZoruDialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
                <ZoruDialogContent className="max-w-lg">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Create automated rule</ZoruDialogTitle>
                        <ZoruDialogDescription>Set conditions and actions that run automatically.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <ZoruLabel>Rule name *</ZoruLabel>
                            <ZoruInput placeholder="e.g. Pause low CTR campaigns" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Entity type</ZoruLabel>
                                <ZoruSelect value={entityType} onValueChange={setEntityType}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {ENTITY_TYPES.map(t => <ZoruSelectItem key={t} value={t}>{t}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Action</ZoruLabel>
                                <ZoruSelect value={actionType} onValueChange={setActionType}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {ACTION_TYPES.map(t => <ZoruSelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Metric</ZoruLabel>
                                <ZoruSelect value={metricField} onValueChange={setMetricField}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {METRIC_FIELDS.map(m => <ZoruSelectItem key={m} value={m}>{m.toUpperCase()}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Operator</ZoruLabel>
                                <ZoruSelect value={operator} onValueChange={setOperator}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {OPERATORS.map(o => <ZoruSelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Value *</ZoruLabel>
                                <ZoruInput type="number" placeholder="0" value={value} onChange={e => setValue(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</ZoruButton>
                        <ZoruButton className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleCreate} disabled={submitting}>
                            {submitting ? 'Creating…' : 'Create rule'}
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Delete confirmation */}
            <ZoruDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete rule?</ZoruDialogTitle>
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
