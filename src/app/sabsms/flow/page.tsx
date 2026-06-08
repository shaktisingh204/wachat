"use client";

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Zap,
  Clock,
  Globe,
  MessageSquare,
  Mail,
  Smartphone,
  GitBranch,
  SplitSquareHorizontal,
  Play,
  Rocket,
  MoreVertical,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Activity,
  Database,
  Inbox,
  ShieldCheck,
  Brain,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Badge,
  Dot,
  Card,
  Field,
  Input,
  Textarea,
  Spinner,
  EmptyState,
  SegmentedControl,
} from '@/components/sabcrm/20ui';
import type { SabflowBlock } from '@/app/sabsms/sabflow-blocks/mock-data';

const IconMap: Record<string, React.FC<{ className?: string }>> = {
  MessageSquare,
  Inbox,
  ShieldCheck,
  Clock,
  Brain,
  Mail,
  Zap,
  Globe,
  Smartphone,
  Database,
  GitBranch,
  SplitSquareHorizontal,
};

const TABS = [
  { value: 'build', label: 'Build' },
  { value: 'test', label: 'Test' },
  { value: 'analytics', label: 'Analytics' },
];

export default function DripsBuilderShell() {
  const [activeTab, setActiveTab] = useState('build');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('blk_send_sms');
  const [blocks, setBlocks] = useState<SabflowBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sabsms/blocks')
      .then(r => r.json())
      .then(d => {
        setBlocks(d.blocks);
        setIsLoading(false);
      })
      .catch(console.error);
  }, []);

  const activeBlock = blocks.find(b => b.id === selectedNodeId);
  const ActiveIcon = activeBlock?.icon ? IconMap[activeBlock.icon] || MessageSquare : MessageSquare;

  return (
    <div className="20ui flex h-screen w-full flex-col bg-[var(--st-bg)] text-[var(--st-text)] overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg)] px-4 z-20">
        <div className="flex items-center gap-4">
          <IconButton icon={ArrowLeft} label="Back to flows" variant="ghost" size="sm" />
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]" aria-hidden="true">
              <Zap className="h-4 w-4" />
            </span>
            <h1 className="text-sm font-semibold text-[var(--st-text)]">Onboarding Welcome Series</h1>
            <Badge tone="success" kind="soft" dot>Live</Badge>
          </div>
        </div>

        <SegmentedControl
          items={TABS}
          value={activeTab}
          onChange={setActiveTab}
          size="sm"
          aria-label="Builder view"
        />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 border-r border-[var(--st-border)] mr-1">
            <Dot tone="success" pulse aria-label="Saved" />
            <span className="text-xs text-[var(--st-text-secondary)]">Saved just now</span>
          </div>
          <Button variant="secondary" size="sm" iconLeft={Play}>
            Test Flow
          </Button>
          <Button variant="primary" size="sm" iconLeft={Rocket}>
            Deploy
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar - Node Palette */}
        <aside className="w-72 shrink-0 flex flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] z-10">
          <div className="p-4 border-b border-[var(--st-border)]">
            <Input
              iconLeft={Search}
              placeholder="Search nodes..."
              inputSize="sm"
              aria-label="Search nodes"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            {/* Category: Triggers */}
            <NodeCategory title="Triggers" count={3}>
              <DraggableNode icon={<Globe />} title="Webhook Received" desc="Trigger on external event" />
              <DraggableNode icon={<Clock />} title="Scheduled Time" desc="Run at specific intervals" />
              <DraggableNode icon={<Zap />} title="App Event" desc="When a user performs action" />
            </NodeCategory>

            {/* Category: Actions */}
            <NodeCategory title="Actions" count={4}>
              <DraggableNode icon={<MessageSquare />} title="Send SMS" desc="Dispatch text message" />
              <DraggableNode icon={<Mail />} title="Send Email" desc="Send via external provider" />
              <DraggableNode icon={<Smartphone />} title="Push Notification" desc="Send to mobile app" />
              <DraggableNode icon={<Database />} title="Update Record" desc="Modify user attributes" />
            </NodeCategory>

            {/* Category: Logic */}
            <NodeCategory title="Logic" count={3}>
              <DraggableNode icon={<GitBranch />} title="If / Else" desc="Branch based on conditions" />
              <DraggableNode icon={<SplitSquareHorizontal />} title="A/B Split" desc="Test multiple paths" />
              <DraggableNode icon={<Clock />} title="Delay" desc="Wait before next step" />
            </NodeCategory>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 relative bg-[var(--st-bg-muted)] overflow-hidden">
          {/* Grid Background (runtime-painted pattern) */}
          <div
            className="absolute inset-0 z-0 pointer-events-none opacity-60"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--st-border-strong) 1px, transparent 0)', backgroundSize: '24px 24px' }}
          />

          {/* Floating Controls */}
          <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
            <Card variant="elevated" padding="none" className="flex flex-col items-center p-1">
              <IconButton icon={ZoomIn} label="Zoom in" variant="ghost" size="sm" />
              <IconButton icon={ZoomOut} label="Zoom out" variant="ghost" size="sm" />
              <IconButton icon={Maximize} label="Fit to screen" variant="ghost" size="sm" />
            </Card>
          </div>

          {/* Mock Canvas Content */}
          <div className="absolute inset-0 overflow-auto z-0 flex items-center justify-center p-20">
            <div className="relative w-full max-w-2xl h-[600px] flex flex-col items-center">

              {/* Node 1 */}
              <CanvasNode
                icon={<Zap className="h-5 w-5" />}
                title="App Event"
                subtitle="User Signed Up"
                isActive={false}
              />

              {/* SVG Line */}
              <svg className="w-10 h-16 my-2 text-[var(--st-border-strong)]" viewBox="0 0 40 64" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path d="M20 0 L20 64" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="20" cy="32" r="4" fill="var(--st-bg)" stroke="currentColor" strokeWidth="2" />
              </svg>

              {/* Node 2 */}
              <CanvasNode
                icon={<Clock className="h-5 w-5" />}
                title="Delay"
                subtitle="Wait 2 hours"
                isActive={false}
              />

              {/* SVG Path Fork */}
              <svg className="w-[320px] h-20 my-2 text-[var(--st-border-strong)]" viewBox="0 0 320 80" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path d="M160 0 L160 20 C160 30 150 40 140 40 L40 40 C30 40 20 50 20 60 L20 80" stroke="currentColor" strokeWidth="2" />
                <path d="M160 0 L160 20 C160 30 170 40 180 40 L280 40 C290 40 300 50 300 60 L300 80" stroke="currentColor" strokeWidth="2" />
                <rect x="140" y="30" width="40" height="20" rx="10" fill="var(--st-bg)" stroke="currentColor" strokeWidth="2" />
                <text x="160" y="44" fill="var(--st-text-secondary)" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Split</text>
              </svg>

              <div className="flex w-[400px] justify-between">
                {/* Left Fork Node */}
                <div className="flex flex-col items-center">
                  <CanvasNode
                    icon={<MessageSquare className="h-5 w-5" />}
                    title="Send SMS"
                    subtitle="Welcome Offer"
                    isActive
                    selected={selectedNodeId === 'blk_send_sms'}
                    onSelect={() => setSelectedNodeId('blk_send_sms')}
                  />
                  <Badge tone="success" kind="soft" className="mt-4">
                    <Activity className="h-3 w-3" aria-hidden="true" /> 45% conversion
                  </Badge>
                </div>

                {/* Right Fork Node */}
                <div className="flex flex-col items-center">
                  <CanvasNode
                    icon={<Mail className="h-5 w-5" />}
                    title="Send Email"
                    subtitle="Newsletter #1"
                    isActive={false}
                    selected={selectedNodeId === 'blk_inbound_sms'}
                    onSelect={() => setSelectedNodeId('blk_inbound_sms')}
                  />
                </div>
              </div>

            </div>
          </div>
        </main>

        {/* Right Sidebar - Properties Panel */}
        <aside className="w-80 shrink-0 flex flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)] z-10 relative">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="lg" label="Loading node properties" />
            </div>
          ) : activeBlock ? (
            <>
              <div className="flex items-center justify-between p-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]" aria-hidden="true">
                    <ActiveIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--st-text)]">
                      {activeBlock.name}
                    </h2>
                    <p className="text-xs text-[var(--st-text-secondary)] capitalize">{activeBlock.type} Node</p>
                  </div>
                </div>
                <IconButton icon={MoreVertical} label="Node options" variant="ghost" size="sm" />
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Analytics Mini-widget */}
                <div className="p-4 border-b border-[var(--st-border)] grid grid-cols-2 gap-3">
                  <Card variant="outlined" padding="sm">
                    <div className="text-[10px] text-[var(--st-text-tertiary)] uppercase font-medium mb-1">Cost</div>
                    <div className="text-lg font-semibold text-[var(--st-text)]">
                      {activeBlock.creditCost} credits
                    </div>
                  </Card>
                  <Card variant="outlined" padding="sm">
                    <div className="text-[10px] text-[var(--st-text-tertiary)] uppercase font-medium mb-1">Usage</div>
                    <div className="text-lg font-semibold text-[var(--st-text)]">
                      {(activeBlock.usageCount / 1000).toFixed(1)}k
                    </div>
                    <div className="text-xs text-[var(--st-text-secondary)] mt-1 flex items-center gap-1">
                      <Activity className="h-3 w-3" aria-hidden="true" /> Global
                    </div>
                  </Card>
                </div>

                <div className="p-5 space-y-6">
                  {/* General Settings */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">Configuration</h3>

                    <Field label="Node Name">
                      <Input
                        key={activeBlock.id}
                        defaultValue={activeBlock.name}
                        inputSize="sm"
                      />
                    </Field>
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-[var(--st-text-secondary)]">Description</span>
                      <p className="text-[11px] text-[var(--st-text-secondary)] leading-relaxed">
                        {activeBlock.description}
                      </p>
                    </div>
                  </div>

                  <hr className="border-[var(--st-border)]" />

                  {/* Dynamic Schema Fields */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">Properties</h3>
                      <Button variant="ghost" size="sm">Insert Variable</Button>
                    </div>

                    {(() => {
                      let parsedSchema: Record<string, string> = {};
                      try {
                        parsedSchema = JSON.parse(activeBlock.schema);
                      } catch {
                        // ignore malformed schema
                      }

                      return Object.entries(parsedSchema).map(([key, typeStr]) => {
                        const isRequired = !typeStr.endsWith('?');
                        const label = (
                          <span className="capitalize">{key}</span>
                        );
                        return (
                          <Field key={key} label={label} required={isRequired}>
                            {key === 'body' || key === 'text' ? (
                              <Textarea rows={4} placeholder={`Enter ${key}...`} />
                            ) : (
                              <Input inputSize="sm" placeholder={`Enter ${key}...`} />
                            )}
                          </Field>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Footer Save */}
              <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <Button variant="primary" block>
                  Save Changes
                </Button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={MousePointer2}
                title="No node selected"
                description="Select a node on the canvas to view and edit its properties."
              />
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}

// Subcomponents
function NodeCategory({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">{title}</h3>
        <Badge tone="neutral" kind="soft">{count}</Badge>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DraggableNode({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group flex cursor-grab items-start gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 hover:border-[var(--st-accent)] hover:shadow-[var(--st-shadow-sm)] transition-all active:cursor-grabbing">
      <span className="mt-0.5 flex shrink-0 h-8 w-8 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] group-hover:text-[var(--st-accent)] group-hover:border-[var(--st-accent)] transition-colors" aria-hidden="true">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
      </span>
      <div>
        <h4 className="text-sm font-medium text-[var(--st-text)]">{title}</h4>
        <p className="mt-0.5 text-[11px] text-[var(--st-text-tertiary)] line-clamp-1">{desc}</p>
      </div>
    </div>
  );
}

function CanvasNode({
  icon,
  title,
  subtitle,
  isActive,
  selected = false,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  isActive: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const border = selected
    ? 'border-[var(--st-accent)] ring-2 ring-[var(--st-accent-ring)]'
    : isActive
      ? 'border-[var(--st-accent)]'
      : 'border-[var(--st-border)]';
  const interactive = onSelect
    ? 'cursor-pointer hover:border-[var(--st-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent-ring)]'
    : '';
  const baseCls = `w-64 text-left rounded-[var(--st-radius-lg)] border bg-[var(--st-bg)] p-4 shadow-[var(--st-shadow-sm)] transition-all ${border} ${interactive}`;

  const inner = (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] border ${isActive || selected ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]' : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]'}`} aria-hidden="true">
        {icon}
      </span>
      <div className="flex-1 overflow-hidden">
        <h4 className="truncate text-sm font-semibold text-[var(--st-text)]">{title}</h4>
        <p className="truncate text-xs text-[var(--st-text-secondary)]">{subtitle}</p>
      </div>
      <MoreVertical className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
    </div>
  );

  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={baseCls}
      >
        {inner}
      </div>
    );
  }
  return <div className={baseCls}>{inner}</div>;
}
