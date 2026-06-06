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
} from '@/components/sabcrm/20ui/compat';
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

const RULE_TEMPLATES = [
  {
    name: 'Stop Loss',
    entityType: 'AD',
    actionType: 'PAUSE',
    conditions: [
      { metricField: 'spend', operator: 'GREATER_THAN', value: '50' },
      { metricField: 'ctr', operator: 'LESS_THAN', value: '1' }
    ]
  },
  {
    name: 'Scale Winners',
    entityType: 'CAMPAIGN',
    actionType: 'CHANGE_BUDGET',
    conditions: [
      { metricField: 'cpc', operator: 'LESS_THAN', value: '0.5' },
      { metricField: 'ctr', operator: 'GREATER_THAN', value: '3' }
    ]
  }
];

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
    const [conditions, setConditions] = React.useState<Array<{ metricField: string; operator: string; value: string }>>([
        { metricField: 'spend', operator: 'GREATER_THAN', value: '' }
    ]);
    const [mockData, setMockData] = React.useState<Record<string, string>>({
        spend: '100',
        cpc: '1.5',
        ctr: '2',
        impressions: '1000',
        reach: '800'
    });

    const evaluatePreview = () => {
        if (!conditions || conditions.length === 0) return null;
        let isComplete = true;
        const result = conditions.every(c => {
            if (!c.value) {
                isComplete = false;
                return false;
            }
            const actual = Number(mockData[c.metricField]);
            const target = Number(c.value);
            if (isNaN(actual) || isNaN(target)) return false;
            if (c.operator === 'GREATER_THAN') return actual > target;
            if (c.operator === 'LESS_THAN') return actual < target;
            return false;
        });
        if (!isComplete) return null;
        return result;
    };

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
        setConditions([{ metricField: 'spend', operator: 'GREATER_THAN', value: '' }]);
    };

    const handleCreate = async () => {
        if (!activeAccount || !name || conditions.some(c => !c.value)) {
            toast({ title: 'Validation', description: 'Name and all threshold values are required.', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        const fd = new FormData();
        fd.set('adAccountId', activeAccount.account_id);
        fd.set('name', name);
        fd.set('entityType', entityType);
        fd.set('actionType', actionType);
        fd.set('conditions', JSON.stringify(conditions));
        // Fallback for older rust implementations
        fd.set('metricField', conditions[0].metricField);
        fd.set('operator', conditions[0].operator);
        fd.set('value', conditions[0].value);

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
                return filters
                    .filter((f: any) => f.field !== 'entity_type' && f.field !== 'time_preset')
                    .map((f: any) => `${f.field} ${(f.operator || '').replace(/_/g, ' ').toLowerCase()} ${f.value}`)
                    .join(' AND ');
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
                <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to manage automated rules.</ZoruAlertDescription>
                </Alert>
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
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1">
                        Automatically pause, scale or notify based on performance thresholds.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchRules} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Create rule
                    </Button>
                </div>
            </div>

            <Card>
                <ZoruCardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                        </div>
                    ) : rules.length === 0 ? (
                        <div className="py-16 text-center">
                            <Zap className="h-12 w-12 mx-auto text-[var(--st-text-secondary)]" />
                            <p className="mt-3 font-semibold">No automated rules yet</p>
                            <p className="text-sm text-[var(--st-text-secondary)] max-w-md mx-auto mt-1">
                                Examples: pause ads with CTR below 0.5%, increase budget by 20% when ROAS exceeds 4x,
                                or send a notification when daily spend crosses a threshold.
                            </p>
                        </div>
                    ) : (
                        <Table>
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
                                        <ZoruTableCell className="text-sm text-[var(--st-text-secondary)]">{formatCondition(r)}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant="outline">{formatAction(r)}</Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant={r.status === 'ENABLED' ? 'default' : 'secondary'}>
                                                {r.status || 'UNKNOWN'}
                                            </Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-[var(--st-text)] hover:text-[var(--st-text)]"
                                                onClick={() => setDeleteId(r.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    )}
                </ZoruCardContent>
            </Card>

            {/* Create dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
                <ZoruDialogContent className="max-w-lg">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Create automated rule</ZoruDialogTitle>
                        <ZoruDialogDescription>Set conditions and actions that run automatically.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Templates</Label>
                            <div className="flex flex-wrap gap-2">
                                {RULE_TEMPLATES.map((t) => (
                                    <Button 
                                        key={t.name} 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => {
                                            setName(t.name);
                                            setEntityType(t.entityType);
                                            setActionType(t.actionType);
                                            setConditions([...t.conditions]);
                                        }}
                                    >
                                        {t.name}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Rule name *</Label>
                            <Input placeholder="e.g. Pause low CTR campaigns" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Entity type</Label>
                                <Select value={entityType} onValueChange={setEntityType}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {ENTITY_TYPES.map(t => <ZoruSelectItem key={t} value={t}>{t}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Action</Label>
                                <Select value={actionType} onValueChange={setActionType}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {ACTION_TYPES.map(t => <ZoruSelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-3 border p-4 rounded-lg bg-[var(--st-bg-muted)]/30">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">Conditions (AND logic)</Label>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setConditions([...conditions, { metricField: 'spend', operator: 'GREATER_THAN', value: '' }])}
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Add
                                </Button>
                            </div>
                            
                            {conditions.map((cond, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Metric</Label>
                                        <Select 
                                            value={cond.metricField} 
                                            onValueChange={(v) => {
                                                const newC = [...conditions];
                                                newC[idx].metricField = v;
                                                setConditions(newC);
                                            }}
                                        >
                                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                {METRIC_FIELDS.map(m => <ZoruSelectItem key={m} value={m}>{m.toUpperCase()}</ZoruSelectItem>)}
                                            </ZoruSelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Operator</Label>
                                        <Select 
                                            value={cond.operator} 
                                            onValueChange={(v) => {
                                                const newC = [...conditions];
                                                newC[idx].operator = v;
                                                setConditions(newC);
                                            }}
                                        >
                                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                {OPERATORS.map(o => <ZoruSelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</ZoruSelectItem>)}
                                            </ZoruSelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Value *</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="0" 
                                            value={cond.value} 
                                            onChange={(e) => {
                                                const newC = [...conditions];
                                                newC[idx].value = e.target.value;
                                                setConditions(newC);
                                            }} 
                                        />
                                    </div>
                                    <div className="pb-1">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-9 w-9 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                            onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                                            disabled={conditions.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="space-y-3 border p-4 rounded-lg bg-[var(--st-bg-muted)]/30">
                            <Label className="text-base font-medium">Logic Preview</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {METRIC_FIELDS.map(m => (
                                    <div key={m} className="space-y-1">
                                        <Label className="text-xs uppercase">{m}</Label>
                                        <Input 
                                            className="text-xs h-8"
                                            value={mockData[m] || ''}
                                            onChange={e => setMockData(prev => ({...prev, [m]: e.target.value}))}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm">
                                <span>Preview Result:</span>
                                {evaluatePreview() === true ? (
                                    <Badge className="bg-[var(--st-text)]">Will Trigger</Badge>
                                ) : evaluatePreview() === false ? (
                                    <Badge variant="secondary">Will Not Trigger</Badge>
                                ) : (
                                    <Badge variant="outline">Incomplete Conditions</Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                        <Button className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white" onClick={handleCreate} disabled={submitting}>
                            {submitting ? 'Creating…' : 'Create rule'}
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete rule?</ZoruDialogTitle>
                        <ZoruDialogDescription>This action cannot be undone.</ZoruDialogDescription>
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
