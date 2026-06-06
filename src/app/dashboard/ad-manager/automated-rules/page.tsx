'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Zap,
  Plus,
  RefreshCw,
  Trash2 } from 'lucide-react';

import * as React from 'react';

import { useAdManager } from '@/context/ad-manager-context';
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
            toast.error({ title: 'Validation', description: 'Name and all threshold values are required.' });
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
            toast.error({ title: 'Error', description: res.error });
        } else {
            toast.success({ title: 'Created', description: res.message });
            setDialogOpen(false);
            resetForm();
            fetchRules();
        }
    };

    const handleDelete = async (id: string) => {
        const res = await deleteAutomatedRule(id);
        if (res.success) {
            toast.success({ title: 'Deleted', description: 'Rule deleted.' });
            setRules(prev => prev.filter(r => r.id !== id));
        } else {
            toast.error({ title: 'Error', description: res.error || 'Failed to delete.' });
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
        return '-';
    };

    const formatAction = (rule: any) => {
        try {
            return rule.execution_spec?.execution_type?.replace(/_/g, ' ') || '-';
        } catch { return '-'; }
    };

    if (!activeAccount) {
        return (
            <div>
                <Alert tone="warning" title="No ad account selected">
                    Pick an ad account to manage automated rules.
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle className="flex items-center gap-2">
                        <Zap className="h-6 w-6" aria-hidden="true" /> Automated rules
                    </PageTitle>
                    <PageDescription>
                        Automatically pause, scale or notify based on performance thresholds.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton
                        label="Refresh rules"
                        icon={RefreshCw}
                        variant="outline"
                        onClick={fetchRules}
                        disabled={loading}
                        className={loading ? 'animate-spin' : undefined}
                    />
                    <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
                        Create rule
                    </Button>
                </PageActions>
            </PageHeader>

            <Card padding="none">
                <CardBody>
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} />)}
                        </div>
                    ) : rules.length === 0 ? (
                        <div className="py-16">
                            <EmptyState
                                icon={Zap}
                                title="No automated rules yet"
                                description="Examples: pause ads with CTR below 0.5%, increase budget by 20% when ROAS exceeds 4x, or send a notification when daily spend crosses a threshold."
                            />
                        </div>
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Condition</Th>
                                    <Th>Action</Th>
                                    <Th>Status</Th>
                                    <Th width={64} />
                                </Tr>
                            </THead>
                            <TBody>
                                {rules.map((r) => (
                                    <Tr key={r.id}>
                                        <Td className="font-medium">{r.name}</Td>
                                        <Td className="text-sm text-[var(--st-text-secondary)]">{formatCondition(r)}</Td>
                                        <Td>
                                            <Badge variant="outline">{formatAction(r)}</Badge>
                                        </Td>
                                        <Td>
                                            <Badge tone={r.status === 'ENABLED' ? 'success' : 'neutral'}>
                                                {r.status || 'UNKNOWN'}
                                            </Badge>
                                        </Td>
                                        <Td>
                                            <IconButton
                                                label="Delete rule"
                                                icon={Trash2}
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleteId(r.id)}
                                            />
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>

            {/* Create dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create automated rule</DialogTitle>
                        <DialogDescription>Set conditions and actions that run automatically.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Field label="Templates">
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
                        </Field>

                        <Field label="Rule name" required>
                            <Input placeholder="e.g. Pause low CTR campaigns" value={name} onChange={e => setName(e.target.value)} />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Entity type">
                                <Select value={entityType} onValueChange={setEntityType}>
                                    <SelectTrigger aria-label="Entity type"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Action">
                                <Select value={actionType} onValueChange={setActionType}>
                                    <SelectTrigger aria-label="Action"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <Card variant="ghost" className="space-y-3 bg-[var(--st-bg-muted)]/30">
                            <div className="flex items-center justify-between">
                                <p className="text-base font-medium text-[var(--st-text)]">Conditions (AND logic)</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    iconLeft={Plus}
                                    onClick={() => setConditions([...conditions, { metricField: 'spend', operator: 'GREATER_THAN', value: '' }])}
                                >
                                    Add
                                </Button>
                            </div>

                            {conditions.map((cond, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                                    <Field label="Metric">
                                        <Select
                                            value={cond.metricField}
                                            onValueChange={(v) => {
                                                const newC = [...conditions];
                                                newC[idx].metricField = v;
                                                setConditions(newC);
                                            }}
                                        >
                                            <SelectTrigger aria-label="Metric"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {METRIC_FIELDS.map(m => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label="Operator">
                                        <Select
                                            value={cond.operator}
                                            onValueChange={(v) => {
                                                const newC = [...conditions];
                                                newC[idx].operator = v;
                                                setConditions(newC);
                                            }}
                                        >
                                            <SelectTrigger aria-label="Operator"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {OPERATORS.map(o => <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label="Value" required>
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
                                    </Field>
                                    <div className="pb-1">
                                        <IconButton
                                            label="Remove condition"
                                            icon={Trash2}
                                            variant="ghost"
                                            onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                                            disabled={conditions.length === 1}
                                        />
                                    </div>
                                </div>
                            ))}
                        </Card>

                        <Card variant="ghost" className="space-y-3 bg-[var(--st-bg-muted)]/30">
                            <p className="text-base font-medium text-[var(--st-text)]">Logic Preview</p>
                            <div className="grid grid-cols-5 gap-2">
                                {METRIC_FIELDS.map(m => (
                                    <Field key={m} label={<span className="uppercase">{m}</span>}>
                                        <Input
                                            inputSize="sm"
                                            value={mockData[m] || ''}
                                            onChange={e => setMockData(prev => ({...prev, [m]: e.target.value}))}
                                        />
                                    </Field>
                                ))}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-[var(--st-text)]">
                                <span>Preview Result:</span>
                                {evaluatePreview() === true ? (
                                    <Badge tone="success">Will Trigger</Badge>
                                ) : evaluatePreview() === false ? (
                                    <Badge tone="neutral">Will Not Trigger</Badge>
                                ) : (
                                    <Badge variant="outline">Incomplete Conditions</Badge>
                                )}
                            </div>
                        </Card>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                        <Button variant="primary" onClick={handleCreate} loading={submitting}>
                            {submitting ? 'Creating...' : 'Create rule'}
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
                        <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
