'use client';

/**
 * Flow Builder Canvas — per-flow editor, rebuilt on Clay primitives.
 *
 * Full-bleed layout with:
 *   - Clay header bar (back link, flow name input, status switch, save CTA)
 *   - React Flow canvas (dotted background, custom nodes, drop-to-add)
 *   - Floating Clay FAB for opening the Add Block palette
 *   - Clay Sheet on mobile / pinned Properties panel on desktop
 *   - Clay-styled Settings dialog for name + trigger keywords
 */

import * as React from 'react';
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useTransition,
  use,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  LuLoader,
  LuSave,
  LuSettings2,
  LuArrowLeft,
  LuBookOpen,
  LuPlus,
  LuCircleAlert,
} from 'react-icons/lu';

import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';
import { getFlowById, saveFlow } from '@/app/actions/flow.actions';
import { Sidebar } from '@/components/flow-builder/Sidebar';
import CustomNode from '@/components/flow-builder/CustomNode';
import { PropertiesPanel } from '@/components/wabasimplify/properties-panel';

import { cn } from '@/lib/utils';
import { ClayButton, ClayCard } from '@/components/clay';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/* ── node type registry ─────────────────────────────────────────── */

const nodeTypes: Record<string, typeof CustomNode> = {
  start: CustomNode,
  // Messages
  text: CustomNode,
  image: CustomNode,
  video: CustomNode,
  audio: CustomNode,
  document: CustomNode,
  sticker: CustomNode,
  sendLocation: CustomNode,
  sendContact: CustomNode,
  reaction: CustomNode,
  // Interactive
  buttons: CustomNode,
  listMessage: CustomNode,
  ctaUrl: CustomNode,
  sendTemplate: CustomNode,
  triggerMetaFlow: CustomNode,
  // Logic
  input: CustomNode,
  condition: CustomNode,
  delay: CustomNode,
  setVariable: CustomNode,
  triggerFlow: CustomNode,
  // Integrations
  api: CustomNode,
  webhook: CustomNode,
  sendSms: CustomNode,
  sendEmail: CustomNode,
  // CRM & Commerce
  createCrmLead: CustomNode,
  assignAgent: CustomNode,
  addTag: CustomNode,
  sendOrder: CustomNode,
  generateShortLink: CustomNode,
  generateQrCode: CustomNode,
  notification: CustomNode,
};

let dndId = 0;
const getId = () => `dndnode_${dndId++}`;

/* ══════════════════════════════════════════════════════════════════
 *  FlowBuilder — inner component (needs ReactFlowProvider parent)
 * ══════════════════════════════════════════════════════════════════ */

function FlowBuilder({ flowId }: { flowId: string }) {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  /* React Flow state */
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  /* App state */
  const [currentFlow, setCurrentFlow] = useState<any>(null);
  const [flowName, setFlowName] = useState('New Flow');
  const [isSaving, startSaveTransition] = useTransition();
  const [, startLoadingTransition] = useTransition();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPropsOpen, setIsPropsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  /* Settings dialog save */
  const handleSettingsSave = (name: string, keywords: string) => {
    setFlowName(name);
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'start') {
          return {
            ...node,
            data: {
              ...node.data,
              triggerKeywords: keywords,
            },
          };
        }
        return node;
      }),
    );
    setIsSettingsOpen(false);
  };

  /* Load or bootstrap flow */
  useEffect(() => {
    if (!activeProjectId) return;
    startLoadingTransition(async () => {
      if (flowId === 'new') {
        setNodes([
          {
            id: 'start',
            type: 'start',
            position: { x: 50, y: 50 },
            data: { label: 'Start Flow' },
          },
        ]);
        setCurrentFlow(null);
        setFlowName('New Flow');
      } else {
        const flow = await getFlowById(flowId);
        if (!flow) {
          toast({
            title: 'Error',
            description: 'Flow not found',
            variant: 'destructive',
          });
          router.push('/dashboard/flow-builder');
          return;
        }
        setCurrentFlow(flow);
        setFlowName(flow.name);
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, flowId]);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      setIsPropsOpen(true);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsPropsOpen(false);
  }, []);

  const handleSave = async () => {
    if (!activeProjectId) return;
    if (!flowName) {
      toast({
        title: 'Error',
        description: 'Flow name is required',
        variant: 'destructive',
      });
      return;
    }

    startSaveTransition(async () => {
      const startNode = nodes.find((n) => n.type === 'start');
      let triggerKeywords: string[] = [];

      if (startNode?.data && (startNode.data as any).triggerKeywords) {
        const raw = (startNode.data as any).triggerKeywords;
        if (typeof raw === 'string') {
          triggerKeywords = raw
            .split(',')
            .map((k: string) => k.trim())
            .filter(Boolean);
        } else if (Array.isArray(raw)) {
          triggerKeywords = raw;
        }
      }

      const flowData = {
        flowId: currentFlow?._id.toString(),
        projectId: activeProjectId,
        name: flowName,
        nodes: nodes as any,
        edges: edges as any,
        triggerKeywords,
        status: currentFlow?.status || 'ACTIVE',
      };

      const result = await saveFlow(flowData);
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Saved',
          description: 'Flow saved successfully.',
        });
        if (
          result.flowId &&
          (!currentFlow || currentFlow._id.toString() !== result.flowId)
        ) {
          setCurrentFlow({ _id: result.flowId, name: flowName });
          if (flowId === 'new') {
            router.replace(`/dashboard/flow-builder/${result.flowId}`);
          }
        }
      }
    });
  };

  const onNodeUpdate = (id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      }),
    );
    setSelectedNode((prev) => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, data: { ...prev.data, ...newData } } as Node;
    });
  };

  const onDeleteNode = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== id && e.target !== id),
    );
    setSelectedNode(null);
    setIsPropsOpen(false);
  };

  /* ── No project state ── */
  if (!activeProjectId) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <ClayCard padded={false} className="max-w-md p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-foreground">
            No project selected
          </div>
          <div className="mt-1.5 text-[12.5px] text-muted-foreground">
            Please select a project from the main dashboard to use the
            flow builder.
          </div>
          <ClayButton
            variant="rose"
            size="md"
            onClick={() => router.push('/dashboard')}
            className="mt-5"
          >
            Choose a project
          </ClayButton>
        </ClayCard>
      </div>
    );
  }

  const isPaused = currentFlow?.status === 'PAUSED';

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {/* ─── Clay header bar ─── */}
      <header className="flex h-[64px] shrink-0 items-center justify-between gap-4 border-b border-border bg-card/80 px-5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/flow-builder"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
            Back
          </Link>
          <div className="h-6 w-px bg-border" />
          <Input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="h-9 w-[260px] rounded-[10px] border-border bg-card font-semibold text-foreground"
            placeholder="Flow name"
          />
          {currentFlow ? (
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isPaused ? 'bg-amber-500' : 'bg-emerald-500',
                )}
              />
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isPaused ? 'Paused' : 'Active'}
              </span>
              <Switch
                checked={!isPaused}
                onCheckedChange={(checked) =>
                  setCurrentFlow({
                    ...currentFlow,
                    status: checked ? 'ACTIVE' : 'PAUSED',
                  })
                }
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <ClayButton
            variant="pill"
            size="sm"
            leading={<LuBookOpen className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={() =>
              window.open('/dashboard/flow-builder/docs', '_blank')
            }
          >
            Docs
          </ClayButton>
          <ClayButton
            variant="pill"
            size="sm"
            leading={<LuSettings2 className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={() => setIsSettingsOpen(true)}
          >
            Settings
          </ClayButton>
          <ClayButton
            variant="obsidian"
            size="md"
            className="px-5"
            leading={
              isSaving ? (
                <LuLoader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LuSave className="h-3.5 w-3.5" strokeWidth={2} />
              )
            }
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save flow'}
          </ClayButton>
        </div>
      </header>

      {/* Settings dialog */}
      <FlowSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        initialName={flowName}
        initialKeywords={
          (nodes.find((n) => n.type === 'start')?.data as any)
            ?.triggerKeywords || ''
        }
        onSave={handleSettingsSave}
      />

      {/* ─── Canvas + side panel ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div
          className="relative h-full w-full flex-1"
          ref={reactFlowWrapper}
          style={{ backgroundColor: 'hsl(var(--background))' }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            snapToGrid
          >
            <Controls className="clay-rf-controls" />
            <Background
              variant={BackgroundVariant.Dots}
              gap={14}
              size={1.2}
              color="hsl(30 12% 84%)"
            />

            {/* Floating Add-Block FAB (top-left) */}
            <Panel position="top-left" className="m-4">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add block"
                    className="group flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-white shadow-md transition-[transform,background] hover:bg-foreground/90 active:scale-95"
                  >
                    <LuPlus className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  className="ml-4 w-[340px] rounded-[16px] border border-border bg-card p-0 shadow-lg"
                >
                  <div className="border-b border-border px-4 py-3.5">
                    <h4 className="text-[14px] font-semibold leading-none text-foreground">
                      Add block
                    </h4>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      Drag a block onto the canvas to add it to your flow.
                    </p>
                  </div>
                  <ScrollArea className="h-[460px]">
                    <div className="p-4">
                      <Sidebar className="w-full" />
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </Panel>

            {/* Flow status footer — shown when empty or just start node */}
            {nodes.length <= 1 ? (
              <Panel position="bottom-center" className="mb-6">
                <div className="pointer-events-none rounded-full border border-border bg-card px-4 py-2 text-[11.5px] font-medium text-muted-foreground shadow-sm">
                  Tap the{' '}
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[9px] text-white">
                    +
                  </span>{' '}
                  button to add your first block
                </div>
              </Panel>
            ) : null}
          </ReactFlow>
        </div>

        {/* Right properties panel — desktop pinned */}
        {selectedNode && isPropsOpen ? (
          <aside className="hidden w-[320px] shrink-0 border-l border-border bg-card overflow-y-auto md:block">
            <PropertiesPanel
              node={selectedNode}
              onUpdate={onNodeUpdate}
              deleteNode={onDeleteNode}
              availableVariables={[]}
            />
          </aside>
        ) : null}
      </div>

      {/* Properties panel — mobile sheet (only rendered below md breakpoint) */}
      <div className="md:hidden">
        <Sheet open={isPropsOpen && !!selectedNode} onOpenChange={setIsPropsOpen}>
          <SheetContent
            side="right"
            className="w-full p-0 sm:max-w-md"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Properties</SheetTitle>
            </SheetHeader>
            {selectedNode ? (
              <PropertiesPanel
                node={selectedNode}
                onUpdate={onNodeUpdate}
                deleteNode={onDeleteNode}
                availableVariables={[]}
              />
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 *  Page wrapper — resolves params + provides ReactFlow context
 * ══════════════════════════════════════════════════════════════════ */

export default function FlowBuilderPageWrapper({
  params,
}: {
  params: Promise<{ flowId: string }>;
}) {
  const { flowId } = use(params);
  return (
    <ReactFlowProvider>
      <FlowBuilder flowId={flowId} />
    </ReactFlowProvider>
  );
}

/* ══════════════════════════════════════════════════════════════════
 *  Settings dialog — Clay styled
 * ══════════════════════════════════════════════════════════════════ */

function FlowSettingsDialog({
  open,
  onOpenChange,
  initialName,
  initialKeywords,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  initialKeywords: string;
  onSave: (name: string, keywords: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [keywords, setKeywords] = useState(initialKeywords);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setKeywords(initialKeywords);
    }
  }, [open, initialName, initialKeywords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(name, keywords);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-[18px] border border-border bg-card p-0 shadow-lg">
        <DialogHeader className="flex flex-row items-start gap-3 border-b border-border px-6 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent text-accent-foreground">
            <LuSettings2 className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px] font-semibold text-foreground leading-tight">
              Flow settings
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
              Configure the basic settings for this flow.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="flow-name"
                className="text-[11.5px] font-semibold text-muted-foreground"
              >
                Flow name <span className="ml-1 text-destructive">*</span>
              </Label>
              <Input
                id="flow-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Give this flow a memorable name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="flow-keywords"
                className="text-[11.5px] font-semibold text-muted-foreground"
              >
                Trigger keywords
              </Label>
              <Input
                id="flow-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="hello, promo, help"
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Comma-separated words that will start this flow when a
                customer sends them.
              </p>
            </div>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end gap-2">
            <ClayButton
              type="button"
              variant="pill"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="rose" size="md">
              Save changes
            </ClayButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
