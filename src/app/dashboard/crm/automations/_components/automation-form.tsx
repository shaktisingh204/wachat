'use client';

import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useMemo,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';
import { AutomationFlowEditor } from './automation-flow-editor';
import { getAutomationRuns } from '@/app/actions/crm-automations.actions';

/**
 * <AutomationForm /> — create + edit form for CRM Automations.
 *
 * Binds to the `saveAutomation` server action via `useActionState`. The
 * "nodes" table is a simple linear sequence: trigger node is implicit
 * (set via `trigger` + `conditions`), and each row is one action that
 * runs in order. This is intentionally a slimmer surface than the old
 * block-graph editor — for branching flows the `/docs` page links to the
 * advanced editor.
 */

import { saveAutomation } from '@/app/actions/crm-automations.actions';
import type {
    CrmAutomationDoc,
    CrmAutomationStatus,
} from '@/lib/rust-client/crm-automations';

const BASE = '/dashboard/crm/automations';

const TRIGGER_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'manual', label: 'Manual' },
    { value: 'tag_added', label: 'Tag added to contact' },
    { value: 'lead_created', label: 'Lead created' },
    { value: 'deal_stage_changed', label: 'Deal stage changed' },
    { value: 'form_submitted', label: 'Form submitted' },
    { value: 'webhook', label: 'Webhook' },
];

const NODE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'action_send_email', label: 'Send email' },
    { value: 'action_add_tag', label: 'Add tag' },
    { value: 'action_remove_tag', label: 'Remove tag' },
    { value: 'action_create_task', label: 'Create task' },
    { value: 'action_assign_user', label: 'Assign to user' },
    { value: 'action_webhook', label: 'Call webhook' },
    { value: 'delay', label: 'Wait / delay' },
    { value: 'condition', label: 'Condition (if/else)' },
];

const STATUS_OPTIONS: Array<{ value: CrmAutomationStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'archived', label: 'Archived' },
];

interface NodeRow {
    id: string;
    type: string;
    label: string;
    config: string; // free-text config (JSON or comma-separated)
}

interface AutomationFormProps {
    initialData?: CrmAutomationDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create automation'}
        </Button>
    );
}

function deriveInitialNodes(doc?: CrmAutomationDoc | null): NodeRow[] {
    if (!doc?.nodes?.length) return [];
    return doc.nodes
        .filter((n) => !n.type?.startsWith('trigger'))
        .map((n) => {
            const data = (n.data ?? {}) as Record<string, unknown>;
            const label =
                typeof data.label === 'string' ? (data.label as string) : n.type;
            // Strip label from config for display
            const { label: _omit, ...rest } = data;
            void _omit;
            return {
                id: n.id,
                type: n.type,
                label,
                config: Object.keys(rest).length ? JSON.stringify(rest) : '',
            };
        });
}

function deriveInitialTrigger(doc?: CrmAutomationDoc | null): {
    trigger: string;
    conditions: string;
} {
    if (!doc?.nodes?.length) return { trigger: 'manual', conditions: '' };
    const trig = doc.nodes.find((n) => n.type?.startsWith('trigger'));
    if (!trig) return { trigger: 'manual', conditions: '' };
    const data = (trig.data ?? {}) as Record<string, unknown>;
    const trigger = trig.type.replace(/^trigger_/, '') || 'manual';
    const conditions =
        typeof data.conditions === 'string' ? (data.conditions as string) : '';
    return { trigger, conditions };
}

export function AutomationForm({ initialData }: AutomationFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    // We can poll or fetch runs for debugging
    const [runs, setRuns] = useState<any[]>([]);
    const [testingWebhook, setTestingWebhook] = useState(false);

    useEffect(() => {
        if (!isEditing) return;
        const fetchRuns = async () => {
             const result = await getAutomationRuns(initialData._id as string);
             setRuns(result);
        };
        fetchRuns();
        const intval = setInterval(fetchRuns, 5000);
        return () => clearInterval(intval);
    }, [isEditing, initialData?._id]);

    const handleTestWebhook = async () => {
        setTestingWebhook(true);
        try {
            await fetch('/api/crm/automations/test-webhook', { method: 'POST', body: JSON.stringify({ automationId: initialData?._id }) });
            toast({ title: 'Webhook test sent!' });
        } catch (e) {
            toast({ title: 'Webhook test failed', variant: 'destructive' });
        }
        setTestingWebhook(false);
    };

    const [state, formAction] = useActionState(saveAutomation, initialState);

    const initialTrig = deriveInitialTrigger(initialData);
    const [trigger, setTrigger] = useState<string>(initialTrig.trigger);
    const [status, setStatus] = useState<CrmAutomationStatus>(
        initialData?.status ?? 'draft',
    );
    const [nodes, setNodes] = useState<NodeRow[]>(() =>
        deriveInitialNodes(initialData),
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const [rfNodes, setRfNodes] = useState<any[]>(() => {
         if (!initialData?.nodes) return [];
         return initialData.nodes.map((n: any, idx) => ({
              id: n.id || `node-${idx}`,
              type: 'custom',
              position: n.position || { x: 50, y: 50 + idx * 100 },
              data: { ...n.data, typeLabel: n.type, label: n.data?.label || n.type }
         }));
    });
    
    const [rfEdges, setRfEdges] = useState<any[]>(() => {
         if (!initialData?.edges) return [];
         return initialData.edges.map((e: any, idx) => ({
              id: e.id || `edge-${idx}`,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle
         }));
    });

    // Annotate nodes with errors if any run failed on them
    const annotatedNodes = useMemo(() => {
         if (!runs.length) return rfNodes;
         const latestRun = runs[0];
         return rfNodes.map(n => {
             let error = undefined;
             let success = false;
             if (latestRun.actions) {
                 const actionRes = latestRun.actions.find((a: any) => a.nodeId === n.id);
                 if (actionRes?.error) error = actionRes.error;
                 else if (actionRes) success = true;
             }
             if (latestRun.status === 'failed' && n.id === latestRun.failedNodeId) {
                 error = latestRun.error;
             }
             return { ...n, data: { ...n.data, error, success } };
         });
    }, [rfNodes, runs]);

    const nodesJson = JSON.stringify(rfNodes.map(n => ({
        id: n.id,
        type: n.data.typeLabel || n.type,
        data: n.data,
        position: n.position
    })));
    const edgesJson = JSON.stringify(rfEdges);

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="automationId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="trigger" value={trigger} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="nodes" value={nodesJson} />
                <input type="hidden" name="edges" value={edgesJson} />
                <input type="hidden" name="isAdvancedGraph" value="true" />

                {/* Name + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Automation name *</Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Welcome new leads"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <Select
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmAutomationStatus)}
                        >
                            <SelectTrigger id="status-trigger">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={2}
                        placeholder="What does this automation do?"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Trigger + Conditions */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="trigger-trigger">Trigger</Label>
                        <Select value={trigger} onValueChange={setTrigger}>
                            <SelectTrigger id="trigger-trigger">
                                <SelectValue placeholder="Trigger" />
                            </SelectTrigger>
                            <SelectContent>
                                {TRIGGER_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="conditions">Conditions</Label>
                        <Input
                            id="conditions"
                            name="conditions"
                            placeholder="e.g. tag=hot lead"
                            defaultValue={initialTrig.conditions}
                        />
                    </div>
                </div>

                {/* Actions (free-form notes for the engine) */}
                <div className="space-y-1.5">
                    <Label htmlFor="actions">Action notes</Label>
                    <Textarea
                        id="actions"
                        name="actions"
                        rows={2}
                        placeholder="Free-form notes attached to the trigger. Use the node table below for executable steps."
                    />
                </div>

                <div className="space-y-2">
                    <Label>Visual Automation Builder</Label>
                    <p className="text-xs text-[var(--st-text)] mb-2">Drag and drop nodes. If an execution fails, the node will turn red and display the error message.</p>
                    <AutomationFlowEditor
                         nodes={annotatedNodes}
                         edges={rfEdges}
                         setNodes={setRfNodes}
                         setEdges={setRfEdges}
                         testingWebhook={testingWebhook}
                         onTestWebhook={trigger === 'webhook' ? handleTestWebhook : undefined}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to automations
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
