'use client';

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  cn,
  useZoruToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/zoruui';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { useRouter,
  useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  ChevronLeft,
  Eye,
  GripVertical,
  History,
  Layers,
  LoaderCircle,
  Save,
  Upload,
  } from 'lucide-react';
import type { WithId } from 'mongodb';

import { useProject } from '@/context/project-context';
import { MetaFlowBuilderLayout } from '@/components/zoruui-domain/meta-flow-editor/layout/meta-flow-layout';
import { flowCategories } from '@/components/zoruui-domain/meta-flow-templates';
import { FlowsEncryptionDialog } from '@/components/dashboard/numbers/flows-encryption-dialog';
import { cleanMetaFlowData } from '@/lib/meta-flow-utils';
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
import type { MetaFlowValidationError,
  Project } from '@/lib/definitions';

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

function ValidationBanner({ 
  errors,
  flowData,
  onSelectNode
}: { 
  errors: MetaFlowValidationError[];
  flowData: any;
  onSelectNode: (screenId: string, component: any) => void;
}) {
  if (!errors?.length) return null;

  const handleClick = (e: MetaFlowValidationError) => {
    if (!e.pointers?.length) return;
    const ptr = e.pointers[0]; // e.g., "/screens/0/layout/children/1"
    const parts = ptr.split('/').filter(Boolean);
    if (parts[0] === 'screens' && parts[1]) {
      const screenIndex = parseInt(parts[1], 10);
      const screen = flowData?.screens?.[screenIndex];
      if (screen) {
        let compNode = null;
        let currObj = screen;
        for (let i = 2; i < parts.length; i++) {
            const p = parts[i];
            if (currObj && currObj[p] !== undefined) {
                currObj = currObj[p];
                if (currObj && typeof currObj === 'object' && currObj.type) {
                    compNode = currObj;
                }
            } else {
                break;
            }
        }
        onSelectNode(screen.id, compNode);
      }
    }
  };

  return (
    <div className="border-b border-zoru-danger/30 bg-zoru-danger/5 px-4 py-2 text-[12.5px] text-zoru-danger-ink">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        {errors.length} validation error{errors.length > 1 ? 's' : ''}
      </div>
      <ul className="mt-1 list-disc pl-6 leading-relaxed">
        {errors.slice(0, 5).map((e, i) => (
          <li key={i}>
            <span className="font-mono">{e.error_type ?? e.error ?? 'error'}</span>
            {e.line_start ? ` (line ${e.line_start})` : ''}: {e.message}
            {e.pointers?.length ? (
               <Button variant="link" size="sm" className="ml-2 h-auto p-0 text-zoru-danger-ink underline" onClick={() => handleClick(e)}>
                 Locate
               </Button>
            ) : null}
          </li>
        ))}
        {errors.length > 5 ? <li>…and {errors.length - 5} more</li> : null}
      </ul>
    </div>
  );
}

function ScreenReorderDialog({
  open,
  onOpenChange,
  screens,
  onReorder
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screens: any[];
  onReorder: (screens: any[]) => void;
}) {
  const [localScreens, setLocalScreens] = useState(screens);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) setLocalScreens(screens);
  }, [open, screens]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    
    const newScreens = [...localScreens];
    const [dragged] = newScreens.splice(draggedIdx, 1);
    newScreens.splice(index, 0, dragged);
    
    setDraggedIdx(index);
    setLocalScreens(newScreens);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reorder Screens</DialogTitle>
          <DialogDescription>Drag and drop to reorder the screens in your flow.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
           {localScreens.map((screen, idx) => (
             <div
               key={screen.id}
               draggable
               onDragStart={(e) => handleDragStart(e, idx)}
               onDragOver={(e) => handleDragOver(e, idx)}
               onDragEnd={handleDragEnd}
               className={cn(
                 "cursor-grab active:cursor-grabbing p-3 border rounded-md flex items-center gap-3 transition-colors",
                 draggedIdx === idx ? "bg-zoru-surface-hover opacity-50" : "bg-zoru-surface hover:bg-zoru-surface-hover"
               )}
             >
               <GripVertical className="h-4 w-4 text-zoru-ink-muted" />
               <Layers className="h-4 w-4 text-zoru-brand" />
               <span className="font-medium">{screen.title || screen.id}</span>
             </div>
           ))}
           {localScreens.length === 0 ? (
             <div className="p-4 text-center text-sm text-zoru-ink-muted">No screens to reorder.</div>
           ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onReorder(localScreens); onOpenChange(false); }}>Save Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateMetaFlowPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useZoruToast();
  const { activeProjectId } = useProject();

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

  const [lastSavedData, setLastSavedData] = useState<string>('');
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  
  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedo, setIsUndoRedo] = useState(false);

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
    const pid = activeProjectId || stored || null;
    if (pid) {
      setProjectId(pid);
      getProjectById(pid).then((p) => {
        if (p) setProject(p as WithId<Project>);
      });
    }

    const flowIdParam = searchParams.get('flowId');
    if (flowIdParam) {
      setFlowId(flowIdParam);
      startLoading(async () => {
        const fetched = await getMetaFlowById(flowIdParam);
        if (!fetched) {
          toast({ title: 'Error', description: 'Could not load flow.', variant: 'destructive' });
          router.push('/wachat/flows');
          return;
        }
        setFlowName(fetched.name);
        setCategory(fetched.categories?.[0] ?? '');
        setEndpointUri(fetched.endpoint_uri ?? '');
        setStatus(fetched.status ?? 'DRAFT');
        setMetaId(fetched.metaId);
        setFlowData(fetched.flow_data ?? DEFAULT_FLOW);
        setLastSavedData(JSON.stringify(fetched.flow_data ?? DEFAULT_FLOW));
        setValidation(fetched.validation_errors ?? []);
        if (fetched.flow_data?.screens?.[0]?.id) {
          setSelectedScreenId(fetched.flow_data.screens[0].id);
        }
        const flowProjectId =
          (fetched as any).projectId?.toString?.() ?? (fetched as any).projectId;
        if (flowProjectId) {
          setProjectId((prev) => prev || flowProjectId);
          getProjectById(flowProjectId).then((p) => {
            if (p) setProject((prev) => prev || (p as WithId<Project>));
          });
        }
      });
    }
  }, [searchParams, router, toast, activeProjectId]);

  const handleEncryptionError = useCallback(
    (error: string) => {
      if (
        error.includes('139002') ||
        (error.toLowerCase().includes('flows') && error.toLowerCase().includes('public key'))
      ) {
        const uploaded =
          project?.phoneNumbers?.[0]?.flowsEncryptionConfig?.metaStatus === 'UPLOADED';
        if (uploaded) {
          toast({
            title: 'Encryption key propagating',
            description:
              'Meta accepted the public key but is still rolling it out. Retry in 1–2 minutes.',
          });
        } else {
          setShowEncryptionDialog(true);
        }
        return true;
      }
      return false;
    },
    [project, toast],
  );

  const runSaveDraft = useCallback(
    async (overrideFlowData?: any, showToast = true): Promise<string | null> => {
      if (!projectId) {
        if (showToast) toast({ title: 'No project selected', variant: 'destructive' });
        return null;
      }
      if (!flowName.trim()) {
        if (showToast) toast({ title: 'Flow name is required', variant: 'destructive' });
        return null;
      }
      if (!category) {
        if (showToast) toast({ title: 'Pick a category', variant: 'destructive' });
        return null;
      }

      const cleaned = cleanMetaFlowData(overrideFlowData ?? flowData);

      setSavingDraft(true);
      try {
        if (!flowId) {
          const created = await createMetaFlow({
            projectId,
            name: flowName,
            categories: [category],
            endpoint_uri: endpointUri || undefined,
          });
          if (!created.success || !created.flowId) {
            setValidation(created.validation_errors ?? []);
            if (created.error && !handleEncryptionError(created.error)) {
              if (showToast) toast({ title: 'Create failed', description: created.error, variant: 'destructive' });
            }
            return null;
          }
          setFlowId(created.flowId);
          setMetaId(created.metaId ?? null);
          setStatus('DRAFT');

          const saved = await saveMetaFlowDraft({
            flowId: created.flowId,
            flow_data: cleaned,
          });
          setValidation(saved.validation_errors ?? []);
          if (!saved.success) {
            if (saved.error && !handleEncryptionError(saved.error)) {
              if (showToast) toast({
                title: 'Flow created, but JSON upload failed',
                description: saved.error,
                variant: 'destructive',
              });
            }
            router.replace(`/wachat/flows/create?flowId=${created.flowId}`);
            return created.flowId;
          }

          if (showToast) toast({ title: 'Draft created', description: created.message });
          setLastSavedData(JSON.stringify(overrideFlowData ?? flowData));
          router.replace(`/wachat/flows/create?flowId=${created.flowId}`);
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
            if (showToast) toast({ title: 'Save failed', description: saved.error, variant: 'destructive' });
          }
          return null;
        }
        if (!meta.success && meta.error) {
          if (showToast) toast({
            title: 'Metadata update failed',
            description: meta.error,
            variant: 'destructive',
          });
        }
        if (showToast) toast({ title: 'Draft saved' });
        setLastSavedData(JSON.stringify(overrideFlowData ?? flowData));
        return flowId;
      } finally {
        setSavingDraft(false);
      }
    },
    [projectId, flowName, category, endpointUri, flowData, flowId, router, toast, handleEncryptionError],
  );

  // History tracking
  useEffect(() => {
    if (isUndoRedo) {
       setIsUndoRedo(false);
       return;
    }
    const timer = setTimeout(() => {
       setHistory((prev) => {
         const newHistory = prev.slice(0, historyIndex + 1);
         if (newHistory.length > 0 && JSON.stringify(newHistory[newHistory.length - 1]) === JSON.stringify(flowData)) {
            return prev;
         }
         newHistory.push(JSON.parse(JSON.stringify(flowData)));
         if (newHistory.length > 30) newHistory.shift();
         return newHistory;
       });
       setHistoryIndex((prev) => Math.min(prev + 1, 29));
    }, 500); // debounce history entry
    return () => clearTimeout(timer);
  }, [flowData, historyIndex, isUndoRedo]);

  const undo = () => {
    if (historyIndex > 0) {
      setIsUndoRedo(true);
      setHistoryIndex(historyIndex - 1);
      setFlowData(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setIsUndoRedo(true);
      setHistoryIndex(historyIndex + 1);
      setFlowData(history[historyIndex + 1]);
    }
  };

  // Auto-save logic
  useEffect(() => {
    const isEditingNow = !!flowId;
    const isDraftNow = status === 'DRAFT' || !status;
    const isDeprecatedNow = status === 'DEPRECATED';
    
    if (!isEditingNow || !isDraftNow || isDeprecatedNow || savingDraft || publishing) return;
    
    const currentDataStr = JSON.stringify(flowData);
    if (currentDataStr === lastSavedData) return;

    const timer = setTimeout(() => {
      // Background auto-save, no toast
      runSaveDraft(flowData, false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [flowData, flowId, status, lastSavedData, savingDraft, publishing, runSaveDraft]);

  const runPublish = useCallback(async () => {
    if (!flowData?.screens?.length) {
      toast({
        title: 'Add a screen first',
        description: 'A flow needs at least one screen to publish.',
        variant: 'destructive',
      });
      return;
    }

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
  }, [flowData, runSaveDraft, toast, handleEncryptionError, validation]);

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
    if (
      !confirm(
        'Deprecating a flow stops it from being sent to users. This cannot be undone. Continue?',
      )
    )
      return;
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
    if (isPublished) return <Badge variant="success">PUBLISHED</Badge>;
    if (isDeprecated) return <Badge variant="danger">DEPRECATED</Badge>;
    return <Badge variant="ghost">DRAFT</Badge>;
  }, [isPublished, isDeprecated]);

  if (isLoading) return <PageSkeleton />;

  const disableEdits = isDeprecated;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col">
        <header className="flex flex-shrink-0 flex-col gap-0 border-b border-zoru-line bg-zoru-bg">
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/wachat/flows">
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Link>
              </Button>
              <div className="h-6 w-px bg-zoru-line" />
              <Input
                aria-label="Flow name"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                disabled={disableEdits}
                className="h-8 w-64 border-transparent bg-transparent px-2 text-lg shadow-none hover:border-zoru-line focus:border-zoru-line"
              />
              {statusChip}
              {metaId ? (
                <span className="truncate font-mono text-[11px] text-zoru-ink-muted">
                  ID {metaId}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Select value={category} onValueChange={setCategory} disabled={disableEdits}>
                <ZoruSelectTrigger className="h-8 w-[170px]">
                  <ZoruSelectValue placeholder="Category" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {flowCategories.map((c) => (
                    <ZoruSelectItem key={c.id} value={c.id}>
                      {c.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>

              <div className="flex items-center rounded-md border border-zoru-line">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none rounded-l-md border-r border-zoru-line"
                  disabled={disableEdits || historyIndex <= 0}
                  onClick={undo}
                  title="Undo"
                >
                  <History className="h-3.5 w-3.5 -scale-x-100" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none rounded-r-md"
                  disabled={disableEdits || historyIndex >= history.length - 1}
                  onClick={redo}
                  title="Redo"
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={disableEdits || !isDraft}
                onClick={() => setReorderDialogOpen(true)}
                title="Reorder Screens"
              >
                <GripVertical className="h-4 w-4" />
                Reorder
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={savingDraft || disableEdits || !isDraft}
                onClick={() => runSaveDraft(flowData, true)}
                title={
                  !isDraft
                    ? 'Only DRAFT flows can be edited'
                    : 'Save the current canvas as DRAFT on Meta'
                }
              >
                {savingDraft ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save draft
              </Button>

              <Button
                size="sm"
                disabled={publishing || disableEdits || !isDraft}
                onClick={runPublish}
                title={!isDraft ? 'Already published' : 'Save and publish to Meta'}
              >
                {publishing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Publish
              </Button>

              <Button
                variant="secondary"
                size="sm"
                disabled={previewing || !flowId}
                onClick={runPreview}
              >
                {previewing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Preview
              </Button>

              {isPublished ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deprecating}
                  onClick={runDeprecate}
                >
                  {deprecating ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  Deprecate
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-zoru-line bg-zoru-surface px-3 py-1.5">
            <Label
              htmlFor="endpoint_uri"
              className="text-[11px] uppercase tracking-wide text-zoru-ink-muted"
            >
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
            {project?.phoneNumbers?.[0]?.id ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={disableEdits || !isDraft}
                onClick={() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : '';
                  const phoneId = project.phoneNumbers[0].id;
                  setEndpointUri(`${origin}/api/wachat/flows/endpoint/${phoneId}`);
                }}
                title="Fill with this project's first phone number endpoint"
              >
                Auto-fill
              </Button>
            ) : null}
            <span className="text-[10.5px] text-zoru-ink-muted">For data_exchange screens</span>
          </div>

          <ValidationBanner 
            errors={validation} 
            flowData={flowData} 
            onSelectNode={(screenId, comp) => {
              setSelectedScreenId(screenId);
              if (comp) setSelectedComponent(comp);
            }} 
          />
        </header>

        <ScreenReorderDialog
          open={reorderDialogOpen}
          onOpenChange={setReorderDialogOpen}
          screens={flowData?.screens || []}
          onReorder={(newScreens) => {
             setFlowData({ ...flowData, screens: newScreens });
          }}
        />

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
          onSuccess={() => {
            refreshProject();
            setShowEncryptionDialog(false);
          }}
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
