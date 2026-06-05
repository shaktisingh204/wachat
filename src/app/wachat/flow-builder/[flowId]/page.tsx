'use client';

import {
  Button,
  IconButton,
  EmptyState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Input,
  Field,
  Switch,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Modal,
  Badge,
  Separator,
} from '@/components/sabcrm/20ui';
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
  LuSave,
  LuSettings2,
  LuArrowLeft,
  LuBookOpen,
  LuPlus,
  LuCircleAlert,
  } from 'react-icons/lu';

import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';
import { getFlowById,
  saveFlow } from '@/app/actions/flow.actions';
import { Sidebar } from '@/components/flow-builder/Sidebar';
import CustomNode from '@/components/flow-builder/CustomNode';
import { PropertiesPanel } from '@/components/zoruui-domain/properties-panel';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

/**
 * Flow Builder Canvas — per-flow editor on 20ui.
 *
 * Full-bleed app page (WachatPage variant="app") with:
 *   - 20ui header bar (back link, flow name input, status switch, save CTA)
 *   - React Flow canvas (dotted background, custom nodes, drop-to-add)
 *   - Floating FAB for opening the Add Block palette
 *   - 20ui Drawer on mobile / pinned Properties panel on desktop
 *   - 20ui Modal settings dialog for name + trigger keywords
 */

import * as React from 'react';

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
          router.push('/wachat/flow-builder');
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
            router.replace(`/wachat/flow-builder/${result.flowId}`);
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
      <WachatPage variant="app">
        <div className="flex h-full w-full items-center justify-center p-6">
          <EmptyState
            icon={LuCircleAlert}
            title="No project selected"
            description="Please select a project from the main dashboard to use the flow builder."
            action={<Button variant="primary" onClick={() => router.push('/wachat')}>Choose a project</Button>}
          />
        </div>
      </WachatPage>
    );
  }

  const isPaused = currentFlow?.status === 'PAUSED';

  return (
    <WachatPage variant="app">
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--st-bg)]"
      >
      {/* ─── Header bar ─── */}
      <header
        className="flex h-[64px] shrink-0 items-center justify-between gap-4 px-5 backdrop-blur border-b border-[var(--st-border)] bg-[color-mix(in_srgb,var(--st-bg)_80%,transparent)]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/wachat/flow-builder"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-medium transition-colors rounded-[var(--st-radius-pill)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)]"
          >
            <LuArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Back
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <Input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="w-[260px] font-semibold"
            placeholder="Flow name"
            aria-label="Flow name"
          />
          {currentFlow ? (
            <div className="flex items-center gap-2">
              <Badge
                tone={isPaused ? 'warning' : 'success'}
                kind="soft"
                dot
              >
                {isPaused ? 'Paused' : 'Active'}
              </Badge>
              <Switch
                checked={!isPaused}
                onCheckedChange={(checked) =>
                  setCurrentFlow({
                    ...currentFlow,
                    status: checked ? 'ACTIVE' : 'PAUSED',
                  })
                }
                aria-label={isPaused ? 'Activate flow' : 'Pause flow'}
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={LuBookOpen}
            onClick={() => window.open('/wachat/flow-builder/docs', '_blank')}
          >
            Docs
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={LuSettings2}
            onClick={() => setIsSettingsOpen(true)}
          >
            Settings
          </Button>
          <Button
            variant="primary"
            iconLeft={isSaving ? undefined : LuSave}
            loading={isSaving}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save flow'}
          </Button>
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
          className="relative h-full w-full flex-1 bg-[var(--st-bg)]"
          ref={reactFlowWrapper}
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
              color="var(--st-border)"
            />

            {/* Floating Add-Block FAB (top-left) */}
            <Panel position="top-left" className="m-4">
              <Popover>
                <PopoverTrigger asChild>
                  <IconButton
                    label="Add block"
                    icon={LuPlus}
                    variant="primary"
                    size="lg"
                    className="h-12 w-12 rounded-full shadow-md active:scale-95"
                  />
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  className="ml-4 w-[340px] p-0"
                >
                  <div
                    className="px-4 py-3.5 border-b border-[var(--st-border)]"
                  >
                    <h4 className="text-[14px] font-semibold leading-none text-[var(--st-text)]">
                      Add block
                    </h4>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
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
                <div
                  className="pointer-events-none px-4 py-2 text-[11.5px] font-medium shadow-sm rounded-[var(--st-radius-pill)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)]"
                >
                  Tap the{' '}
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white bg-[var(--st-accent)]"
                  >
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
          <aside
            className="hidden w-[320px] shrink-0 overflow-y-auto md:block border-l border-[var(--st-border)] bg-[var(--st-bg)]"
          >
            <PropertiesPanel
              node={selectedNode}
              onUpdate={onNodeUpdate}
              deleteNode={onDeleteNode}
              availableVariables={[]}
            />
          </aside>
        ) : null}
      </div>

      {/* Properties panel — mobile drawer (only rendered below md breakpoint) */}
      <div className="md:hidden">
        <Drawer
          side="right"
          open={isPropsOpen && !!selectedNode}
          onOpenChange={setIsPropsOpen}
        >
          <DrawerContent side="right" className="w-full p-0 sm:max-w-md">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Properties</DrawerTitle>
            </DrawerHeader>
            {selectedNode ? (
              <PropertiesPanel
                node={selectedNode}
                onUpdate={onNodeUpdate}
                deleteNode={onDeleteNode}
                availableVariables={[]}
              />
            ) : null}
          </DrawerContent>
        </Drawer>
      </div>
      </div>
    </WachatPage>
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
 *  Settings dialog — 20ui Modal
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
  const formId = React.useId();

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
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      size="md"
      title="Flow settings"
      description="Configure the basic settings for this flow."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" form={formId}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          label="Flow name"
          required
          help="A memorable name for this flow."
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Give this flow a memorable name"
          />
        </Field>

        <Field
          label="Trigger keywords"
          help="Comma-separated words that will start this flow when a customer sends them."
        >
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="hello, promo, help"
          />
        </Field>
      </form>
    </Modal>
  );
}
