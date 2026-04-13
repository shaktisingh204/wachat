'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ChevronLeft,
    LoaderCircle,
    Save,
    Upload,
    Eye,
    Archive,
    AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MetaFlowBuilderLayout } from '@/components/wabasimplify/meta-flow-editor/layout/meta-flow-layout';
import { flowCategories } from '@/components/wabasimplify/meta-flow-templates';
import { FlowsEncryptionDialog } from '@/components/dashboard/numbers/flows-encryption-dialog';
import { cleanMetaFlowData } from '@/lib/meta-flow-utils';
import { cn } from '@/lib/utils';
import { getProjectById } from '@/app/actions/project.actions';
import {
    createMetaFlow,
    deprecateMetaFlow,
    getMetaFlowById,
    getMetaFlowPreview,
    publishMetaFlow,
    saveMetaFlowDraft,
    updateMetaFlowMetadata,
} from '@/app/actions/meta-flow.actions';
import type { MetaFlowValidationError, Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';

const DEFAULT_FLOW = {
    version: '7.3',
    data_api_version: '3.0',
    routing_model: {} as Record<string, string[]>,
    screens: [] as any[],
};

function PageSkeleton() {
    return (
        <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-64" />
            </div>
            <div className="grid flex-1 grid-cols-12 gap-4">
                <Skeleton className="col-span-2 h-full" />
                <Skeleton className="col-span-7 h-full" />
                <Skeleton className="col-span-3 h-full" />
            </div>
        </div>
    );
}

function ValidationBanner({ errors }: { errors: MetaFlowValidationError[] }) {
    if (!errors?.length) return null;
    return (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-[12.5px] text-destructive">
            <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {errors.length} validation error{errors.length > 1 ? 's' : ''}
            </div>
            <ul className="mt-1 list-disc pl-6 leading-relaxed">
                {errors.slice(0, 5).map((e, i) => (
                    <li key={i}>
                        <span className="font-mono">{e.error_type ?? e.error ?? 'error'}</span>
                        {e.line_start ? ` (line ${e.line_start})` : ''}
                        : {e.message}
                    </li>
                ))}
                {errors.length > 5 ? <li>…and {errors.length - 5} more</li> : null}
            </ul>
        </div>
    );
}

function CreateMetaFlowPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [projectId, setProjectId] = useState<string | null>(null);
    const [project, setProject] = useState<WithId<Project> | null>(null);

    const [flowId, setFlowId] = useState<string | null>(null);
    const [metaId, setMetaId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('DRAFT');

    const [flowName, setFlowName] = useState<string>(`flow${Date.now()}`);
    const [category, setCategory] = useState<string>('');
    const [endpointUri, setEndpointUri] = useState<string>('');

    const [flowData, setFlowData] = useState<any>(DEFAULT_FLOW);
    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
    const [selectedComponent, setSelectedComponent] = useState<any | null>(null);

    const [validation, setValidation] = useState<MetaFlowValidationError[]>([]);

    const [isLoading, startLoading] = useTransition();
    const [savingDraft, setSavingDraft] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [deprecating, setDeprecating] = useState(false);

    const [showEncryptionDialog, setShowEncryptionDialog] = useState(false);

    const isEditing = !!flowId;
    const isDraft = status === 'DRAFT' || !status;
    const isPublished = status === 'PUBLISHED';
    const isDeprecated = status === 'DEPRECATED';

    const refreshProject = useCallback(async () => {
        if (!projectId) return;
        const p = await getProjectById(projectId);
        if (p) setProject(p as WithId<Project>);
    }, [projectId]);

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('activeProjectId') : null;
        setProjectId(stored);
        if (stored) {
            getProjectById(stored).then((p) => { if (p) setProject(p as WithId<Project>); });
        }

        const flowIdParam = searchParams.get('flowId');
        if (flowIdParam) {
            setFlowId(flowIdParam);
            startLoading(async () => {
                const fetched = await getMetaFlowById(flowIdParam);
                if (!fetched) {
                    toast({ title: 'Error', description: 'Could not load flow.', variant: 'destructive' });
                    router.push('/dashboard/flows');
                    return;
                }
                setFlowName(fetched.name);
                setCategory(fetched.categories?.[0] ?? '');
                setEndpointUri(fetched.endpoint_uri ?? '');
                setStatus(fetched.status ?? 'DRAFT');
                setMetaId(fetched.metaId);
                setFlowData(fetched.flow_data ?? DEFAULT_FLOW);
                setValidation(fetched.validation_errors ?? []);
                if (fetched.flow_data?.screens?.[0]?.id) {
                    setSelectedScreenId(fetched.flow_data.screens[0].id);
                }
            });
        }
    }, [searchParams, router, toast]);

    const handleEncryptionError = useCallback((error: string) => {
        if (error.includes('139002') || (error.toLowerCase().includes('flows') && error.toLowerCase().includes('public key'))) {
            const uploaded = project?.phoneNumbers?.[0]?.flowsEncryptionConfig?.metaStatus === 'UPLOADED';
            if (uploaded) {
                toast({
                    title: 'Encryption key propagating',
                    description: 'Meta accepted the public key but is still rolling it out. Retry in 1–2 minutes.',
                });
            } else {
                setShowEncryptionDialog(true);
            }
            return true;
        }
        return false;
    }, [project, toast]);

    const runSaveDraft = useCallback(async (overrideFlowData?: any): Promise<string | null> => {
        if (!projectId) { toast({ title: 'No project selected', variant: 'destructive' }); return null; }
        if (!flowName.trim()) { toast({ title: 'Flow name is required', variant: 'destructive' }); return null; }
        if (!category) { toast({ title: 'Pick a category', variant: 'destructive' }); return null; }

        // Drafts are permissive. Meta validates on /assets upload and the
        // banner below surfaces any validation_errors it returns.
        const cleaned = cleanMetaFlowData(overrideFlowData ?? flowData);

        setSavingDraft(true);
        try {
            if (!flowId) {
                const created = await createMetaFlow({
                    projectId,
                    name: flowName,
                    categories: [category],
                    flow_data: cleaned,
                    endpoint_uri: endpointUri || undefined,
                });
                if (!created.success || !created.flowId) {
                    setValidation(created.validation_errors ?? []);
                    if (created.error && !handleEncryptionError(created.error)) {
                        toast({ title: 'Create failed', description: created.error, variant: 'destructive' });
                    }
                    return null;
                }
                setFlowId(created.flowId);
                setMetaId(created.metaId ?? null);
                setStatus('DRAFT');
                setValidation(created.validation_errors ?? []);
                toast({ title: 'Draft created', description: created.message });
                // Reflect the new id in the URL so refresh preserves context.
                router.replace(`/dashboard/flows/create?flowId=${created.flowId}`);
                return created.flowId;
            }

            const [saved, meta] = await Promise.all([
                saveMetaFlowDraft({ flowId, flow_data: cleaned }),
                updateMetaFlowMetadata({
                    flowId,
                    name: flowName,
                    categories: [category],
                    endpoint_uri: endpointUri || null,
                }),
            ]);

            setValidation(saved.validation_errors ?? []);
            if (!saved.success) {
                if (saved.error && !handleEncryptionError(saved.error)) {
                    toast({ title: 'Save failed', description: saved.error, variant: 'destructive' });
                }
                return null;
            }
            if (!meta.success && meta.error) {
                toast({ title: 'Metadata update failed', description: meta.error, variant: 'destructive' });
            }
            toast({ title: 'Draft saved' });
            return flowId;
        } finally {
            setSavingDraft(false);
        }
    }, [projectId, flowName, category, endpointUri, flowData, flowId, router, toast, handleEncryptionError]);

    const runPublish = useCallback(async () => {
        if (!flowData?.screens?.length) {
            toast({ title: 'Add a screen first', description: 'A flow needs at least one screen to publish.', variant: 'destructive' });
            return;
        }

        // Auto-fix: Meta requires exactly one screen to be marked terminal.
        // If the user hasn't marked any, flip the last screen — the common
        // intent when building a linear flow — and keep the canvas in sync.
        let dataToPublish = flowData;
        const anyTerminal = flowData.screens.some((s: any) => s?.terminal === true);
        if (!anyTerminal) {
            const next = JSON.parse(JSON.stringify(flowData));
            const last = next.screens[next.screens.length - 1];
            last.terminal = true;
            if (last.success === undefined) last.success = true;
            dataToPublish = next;
            setFlowData(next);
            toast({
                title: 'Marked last screen as terminal',
                description: `"${last.title || last.id}" is now the final screen. Adjust in the properties panel if that's wrong.`,
            });
        }

        const ensuredId = await runSaveDraft(dataToPublish);
        if (!ensuredId) return;

        setPublishing(true);
        try {
            const res = await publishMetaFlow(ensuredId);
            if (!res.success) {
                setValidation(res.validation_errors ?? validation);
                if (res.error && !handleEncryptionError(res.error)) {
                    toast({ title: 'Publish failed', description: res.error, variant: 'destructive' });
                }
                return;
            }
            setStatus('PUBLISHED');
            toast({ title: 'Published', description: res.message });
        } finally {
            setPublishing(false);
        }
    }, [flowData, setFlowData, runSaveDraft, toast, handleEncryptionError, validation]);

    const runPreview = useCallback(async () => {
        if (!flowId) {
            toast({ title: 'Save the flow first', variant: 'destructive' });
            return;
        }
        setPreviewing(true);
        try {
            const res = await getMetaFlowPreview({ flowId, invalidate: false, interactive: true });
            if (!res.success || !res.preview_url) {
                if (res.error && !handleEncryptionError(res.error)) {
                    toast({ title: 'Preview failed', description: res.error, variant: 'destructive' });
                }
                return;
            }
            window.open(res.preview_url, '_blank', 'noopener');
        } finally {
            setPreviewing(false);
        }
    }, [flowId, toast, handleEncryptionError]);

    const runDeprecate = useCallback(async () => {
        if (!flowId) return;
        if (!confirm('Deprecating a flow stops it from being sent to users. This cannot be undone. Continue?')) return;
        setDeprecating(true);
        try {
            const res = await deprecateMetaFlow(flowId);
            if (!res.success) {
                toast({ title: 'Deprecate failed', description: res.error, variant: 'destructive' });
                return;
            }
            setStatus('DEPRECATED');
            toast({ title: 'Flow deprecated' });
        } finally {
            setDeprecating(false);
        }
    }, [flowId, toast]);

    const statusChip = useMemo(() => {
        const base = 'rounded-full px-2 py-0.5 text-[10.5px] font-semibold border';
        if (isPublished) return <span className={cn(base, 'border-green-300 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 dark:border-green-800')}>PUBLISHED</span>;
        if (isDeprecated) return <span className={cn(base, 'border-red-300 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 dark:border-red-800')}>DEPRECATED</span>;
        return <span className={cn(base, 'border-muted-foreground/30 bg-muted text-muted-foreground')}>DRAFT</span>;
    }, [isPublished, isDeprecated]);

    if (isLoading) return <PageSkeleton />;

    const disableEdits = isDeprecated;

    return (
        <Suspense fallback={<PageSkeleton />}>
            <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col">
                <header className="flex flex-shrink-0 flex-col gap-0 border-b bg-card">
                    <div className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 items-center gap-4">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/dashboard/flows">
                                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                                </Link>
                            </Button>
                            <div className="h-6 w-px bg-border" />
                            <Input
                                aria-label="Flow name"
                                value={flowName}
                                onChange={(e) => setFlowName(e.target.value)}
                                disabled={disableEdits}
                                className="h-8 w-64 border-transparent bg-transparent px-2 text-lg font-semibold shadow-none hover:border-input focus:border-input"
                            />
                            {statusChip}
                            {metaId ? (
                                <span className="truncate font-mono text-[11px] text-muted-foreground">ID {metaId}</span>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-3">
                            <Select value={category} onValueChange={setCategory} disabled={disableEdits}>
                                <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Category" /></SelectTrigger>
                                <SelectContent>
                                    {flowCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={savingDraft || disableEdits || !isDraft}
                                onClick={runSaveDraft}
                                title={!isDraft ? 'Only DRAFT flows can be edited' : 'Save the current canvas as DRAFT on Meta'}
                            >
                                {savingDraft ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save draft
                            </Button>

                            <Button
                                size="sm"
                                disabled={publishing || disableEdits || !isDraft}
                                onClick={runPublish}
                                title={!isDraft ? 'Already published' : 'Save and publish to Meta'}
                            >
                                {publishing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Publish
                            </Button>

                            <Button variant="secondary" size="sm" disabled={previewing || !flowId} onClick={runPreview}>
                                {previewing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                                Preview
                            </Button>

                            {isPublished ? (
                                <Button variant="destructive" size="sm" disabled={deprecating} onClick={runDeprecate}>
                                    {deprecating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                                    Deprecate
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 border-t bg-muted/40 px-3 py-1.5">
                        <Label htmlFor="endpoint_uri" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Endpoint URI
                        </Label>
                        <Input
                            id="endpoint_uri"
                            value={endpointUri}
                            onChange={(e) => setEndpointUri(e.target.value)}
                            disabled={disableEdits || !isDraft}
                            placeholder="https://your.app/api/wachat/flows/endpoint/<PHONE_NUMBER_ID>"
                            className="h-7 flex-1 font-mono text-[11.5px]"
                        />
                        <span className="text-[10.5px] text-muted-foreground">Required for data_exchange screens</span>
                    </div>

                    <ValidationBanner errors={validation} />
                </header>

                <div className="flex-1 overflow-hidden">
                    <MetaFlowBuilderLayout
                        flowData={flowData}
                        setFlowData={setFlowData}
                        selectedScreenId={selectedScreenId}
                        setSelectedScreenId={setSelectedScreenId}
                        selectedComponent={selectedComponent}
                        setSelectedComponent={setSelectedComponent}
                        onPublish={runPublish}
                    />
                </div>
            </div>

            {project && project.phoneNumbers && project.phoneNumbers.length > 0 ? (
                <FlowsEncryptionDialog
                    project={project as Project}
                    phone={project.phoneNumbers[0]}
                    open={showEncryptionDialog}
                    onOpenChange={setShowEncryptionDialog}
                    trigger={<></>}
                    onSuccess={() => { refreshProject(); setShowEncryptionDialog(false); }}
                />
            ) : null}
        </Suspense>
    );
}

export default function CreateMetaFlowPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <CreateMetaFlowPageContent />
        </Suspense>
    );
}
