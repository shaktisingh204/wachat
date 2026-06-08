'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Check,
  Zap,
  ZapOff,
  Copy,
} from 'lucide-react';
import { WorkflowProvider, useWorkflow } from './WorkflowContext';
import { WorkflowCanvas } from './canvas/WorkflowCanvas';
import { N8NNodesList } from './nodes/N8NNodesList';
import { N8NNodeRegistry } from './nodes/N8NNodeProperties';
import type { N8NCanvasWorkflow, N8NCanvasNode } from './types';
import { WORKFLOW_TEMPLATES, WorkflowTemplate } from './WorkflowTemplates';
import {
  Button,
  IconButton,
  Input,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/sabcrm/20ui';
import { createId } from '@paralleldrive/cuid2';

type Props = {
  workflow: N8NCanvasWorkflow;
  /** Called on Save. Should persist the workflow via a Server Action. */
  onSave?: (workflow: N8NCanvasWorkflow) => Promise<void>;
  /** Back-link href. Defaults to /dashboard/n8n. */
  backHref?: string;
};

function EditorContent({
  workflow: initialWorkflow,
  onSave,
  backHref = '/dashboard/n8n',
}: Props) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [isSaving, startSaving] = useTransition();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { selectedNodeId } = useWorkflow();

  const handleChange = (
    changes: Partial<Pick<N8NCanvasWorkflow, 'nodes' | 'connections'>>,
  ) => {
    setWorkflow((prev) => ({ ...prev, ...changes }));
  };

  const handleSave = () => {
    startSaving(async () => {
      await onSave?.(workflow);
      setLastSaved(new Date());
    });
  };

  const handleToggleActive = () => {
    const updated = { ...workflow, active: !workflow.active };
    setWorkflow(updated);
    startSaving(async () => {
      await onSave?.(updated);
    });
  };

  const selectedNode = selectedNodeId
    ? workflow.nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  const handleApplyTemplate = (template: WorkflowTemplate) => {
    // Generate new unique names to avoid collisions with existing workflow nodes
    const nameMap = new Map<string, string>();

    const getUniqueName = (baseName: string) => {
      let currentName = baseName;
      let counter = 1;
      const existingNames = new Set(workflow.nodes.map(n => n.name));

      while (existingNames.has(currentName) || Array.from(nameMap.values()).includes(currentName)) {
        currentName = `${baseName} ${counter}`;
        counter++;
      }
      return currentName;
    };

    const newNodes = template.nodes.map((n) => {
      const newName = getUniqueName(n.name);
      nameMap.set(n.name, newName);

      return {
        ...n,
        id: createId(),
        name: newName,
        // Offset position slightly so it doesn't perfectly overlap if dropped multiple times
        position: [n.position[0] + 50, n.position[1] + 50] as [number, number]
      };
    });

    const newConnections = template.connections.map((c) => ({
      ...c,
      id: createId(),
      sourceNodeName: nameMap.get(c.sourceNodeName) || c.sourceNodeName,
      targetNodeName: nameMap.get(c.targetNodeName) || c.targetNodeName,
    }));

    const updated = {
      ...workflow,
      nodes: [...workflow.nodes, ...newNodes],
      connections: [...workflow.connections, ...newConnections],
    };

    setWorkflow(updated);
    startSaving(async () => {
      await onSave?.(updated);
    });
  };

  return (
    <div className="20ui flex flex-col h-screen overflow-clip bg-[var(--st-bg)]">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 z-30">
        <IconButton
          label="Back"
          icon={ArrowLeft}
          variant="ghost"
          size="sm"
          onClick={() => router.push(backHref)}
        />

        <div className="h-5 w-px bg-[var(--st-border)]" />

        {/* Workflow name */}
        <Input
          inputSize="sm"
          aria-label="Workflow name"
          value={workflow.name}
          onChange={(e) =>
            setWorkflow((prev) => ({ ...prev, name: e.target.value }))
          }
          className="w-[240px] font-semibold"
        />

        <div className="flex-1" />

        {/* Templates */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" iconLeft={Copy}>
              Templates
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {WORKFLOW_TEMPLATES.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleApplyTemplate(template)}
                className="flex flex-col items-start gap-1"
              >
                <span className="text-[13px] font-medium text-[var(--st-text)]">
                  {template.name}
                </span>
                <span className="text-[11.5px] text-[var(--st-text-tertiary)] line-clamp-2 leading-snug">
                  {template.description}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Saved indicator */}
        {lastSaved && (
          <Badge tone="success" kind="soft">
            <Check size={13} aria-hidden="true" />
            Saved
          </Badge>
        )}

        {/* Save button */}
        <Button
          variant="primary"
          size="sm"
          iconLeft={Save}
          loading={isSaving}
          onClick={handleSave}
        >
          {isSaving ? 'Saving' : 'Save'}
        </Button>

        {/* Active toggle */}
        <Button
          variant={workflow.active ? 'primary' : 'secondary'}
          size="sm"
          iconLeft={workflow.active ? Zap : ZapOff}
          onClick={handleToggleActive}
        >
          {workflow.active ? 'Active' : 'Inactive'}
        </Button>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 relative overflow-clip">
        {/* Left: node palette */}
        <N8NNodesList />

        {/* Centre: canvas */}
        <WorkflowCanvas workflow={workflow} onChange={handleChange} />

        {/* Right: node properties panel */}
        {selectedNode && (
          <N8NNodeRegistry
            node={selectedNode}
            onUpdate={(changes) =>
              setWorkflow((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) =>
                  n.id === selectedNode.id
                    ? { ...n, ...changes }
                    : n,
                ),
              }))
            }
            onDelete={() => {
              const name = selectedNode.name;
              setWorkflow((prev) => ({
                ...prev,
                nodes: prev.nodes.filter((n) => n.id !== selectedNode.id),
                connections: prev.connections.filter(
                  (c) =>
                    c.sourceNodeName !== name && c.targetNodeName !== name,
                ),
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * WorkflowEditor - the public-facing n8n-style workflow editor.
 *
 * Wraps EditorContent in WorkflowProvider so all children share
 * pan/zoom, draft-connection, and selection state.
 */
export function WorkflowEditor(props: Props) {
  return (
    <WorkflowProvider>
      <EditorContent {...props} />
    </WorkflowProvider>
  );
}
