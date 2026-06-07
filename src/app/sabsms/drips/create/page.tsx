"use client";

import React, { useState } from 'react';
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
  AlertCircle,
  Database,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Badge,
  Dot,
  Card,
  StatCard,
  Field,
  Input,
  Textarea,
  EmptyState,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';

type BuilderTab = 'build' | 'test' | 'analytics';

export default function DripsBuilderShell() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<BuilderTab>('build');
  const [selectedNode, setSelectedNode] = useState<string | null>('node-sms');

  return (
    <div className="ui20 flex h-screen w-full flex-col overflow-hidden bg-[var(--st-bg)] text-[var(--st-text)] font-sans">
      {/* Header */}
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg)] px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <IconButton label="Back" icon={ArrowLeft} variant="ghost" size="sm" />
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
              aria-hidden="true"
            >
              <Zap className="h-4 w-4" />
            </span>
            <h1 className="text-sm font-medium text-[var(--st-text)]">Onboarding Welcome Series</h1>
            <Badge tone="success" dot>
              Live
            </Badge>
          </div>
        </div>

        <SegmentedControl<BuilderTab>
          aria-label="Builder view"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { value: 'build', label: 'Build' },
            { value: 'test', label: 'Test' },
            { value: 'analytics', label: 'Analytics' },
          ]}
        />

        <div className="flex items-center gap-3">
          <div className="mr-1 flex items-center gap-1.5 border-r border-[var(--st-border)] px-3">
            <Dot tone="success" pulse aria-label="Saved" />
            <span className="text-xs text-[var(--st-text-secondary)]">Saved just now</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={Play}
            onClick={() => toast.success('Running a test pass through the flow')}
          >
            Test Flow
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Rocket}
            onClick={() => toast.success('Drip campaign deployed')}
          >
            Deploy
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Node Palette */}
        <aside className="z-10 flex w-72 shrink-0 flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
          <div className="border-b border-[var(--st-border)] p-4">
            <Field label="Search nodes" className="!gap-0">
              <Input
                type="search"
                placeholder="Search nodes..."
                iconLeft={Search}
                aria-label="Search nodes"
              />
            </Field>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-3">
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
        <main className="relative flex-1 overflow-hidden bg-[var(--st-bg-secondary)]">
          {/* Grid Background (decorative dot pattern) */}
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,var(--st-border-strong)_1px,transparent_0)] bg-[length:24px_24px]"
            aria-hidden="true"
          />

          {/* Floating Controls */}
          <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
            <Card padding="none" className="flex flex-col items-center p-1">
              <IconButton label="Zoom in" icon={ZoomIn} variant="ghost" size="sm" />
              <IconButton label="Zoom out" icon={ZoomOut} variant="ghost" size="sm" />
              <IconButton label="Fit to screen" icon={Maximize} variant="ghost" size="sm" />
            </Card>
          </div>

          {/* Mock Canvas Content */}
          <div className="absolute inset-0 z-0 flex items-center justify-center overflow-auto p-20">
            <div className="relative flex h-[600px] w-full max-w-2xl flex-col items-center">
              {/* Node 1 */}
              <CanvasNode
                icon={<Zap className="h-5 w-5 text-[var(--st-accent)]" />}
                title="App Event"
                subtitle="User Signed Up"
              />

              {/* SVG Line */}
              <svg
                className="my-2 h-16 w-10 text-[var(--st-border-strong)]"
                viewBox="0 0 40 64"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M20 0 L20 64" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="20" cy="32" r="4" fill="var(--st-bg)" stroke="currentColor" strokeWidth="2" />
              </svg>

              {/* Node 2 */}
              <CanvasNode
                icon={<Clock className="h-5 w-5 text-[var(--st-accent)]" />}
                title="Delay"
                subtitle="Wait 2 hours"
              />

              {/* SVG Path Fork */}
              <svg
                className="my-2 h-20 w-[320px] text-[var(--st-border-strong)]"
                viewBox="0 0 320 80"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M160 0 L160 20 C160 30 150 40 140 40 L40 40 C30 40 20 50 20 60 L20 80"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M160 0 L160 20 C160 30 170 40 180 40 L280 40 C290 40 300 50 300 60 L300 80"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <rect x="140" y="30" width="40" height="20" rx="10" fill="var(--st-bg)" stroke="currentColor" strokeWidth="2" />
                <text x="160" y="44" fill="var(--st-text-secondary)" fontSize="10" textAnchor="middle" fontFamily="sans-serif">
                  Split
                </text>
              </svg>

              <div className="flex w-[400px] justify-between">
                {/* Left Fork Node */}
                <div className="flex flex-col items-center">
                  <CanvasNode
                    icon={<MessageSquare className="h-5 w-5 text-[var(--st-accent)]" />}
                    title="Send SMS"
                    subtitle="Welcome Offer"
                    selected={selectedNode === 'node-sms'}
                    onSelect={() => setSelectedNode('node-sms')}
                  />
                  <div className="mt-4 flex items-center gap-2 rounded-[var(--st-radius-pill)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1 text-xs text-[var(--st-text-secondary)]">
                    <Activity className="h-3 w-3 text-[var(--st-status-ok)]" aria-hidden="true" />
                    45% conversion
                  </div>
                </div>

                {/* Right Fork Node */}
                <div className="flex flex-col items-center">
                  <CanvasNode
                    icon={<Mail className="h-5 w-5 text-[var(--st-accent)]" />}
                    title="Send Email"
                    subtitle="Newsletter #1"
                    selected={selectedNode === 'node-email'}
                    onSelect={() => setSelectedNode('node-email')}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar - Properties Panel */}
        <aside className="relative z-10 flex w-80 shrink-0 flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)] shadow-2xl">
          {selectedNode ? (
            <>
              <div className="flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg)] p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                    aria-hidden="true"
                  >
                    {selectedNode === 'node-sms' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--st-text)]">
                      {selectedNode === 'node-sms' ? 'Send SMS' : 'Send Email'}
                    </h2>
                    <p className="text-xs text-[var(--st-text-secondary)]">Action Node</p>
                  </div>
                </div>
                <IconButton label="Node options" icon={MoreVertical} variant="ghost" size="sm" />
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Analytics Mini-widget */}
                <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      label="Delivered"
                      value={selectedNode === 'node-sms' ? '12,402' : '8,291'}
                      icon={Zap}
                      delta={{ value: '+12%', tone: 'up' }}
                    />
                    <StatCard
                      label={selectedNode === 'node-sms' ? 'Clicked' : 'Opened'}
                      value={selectedNode === 'node-sms' ? '3,891' : '4,102'}
                      icon={MousePointer2}
                      delta={{ value: selectedNode === 'node-sms' ? '31.3%' : '49.4%', tone: 'neutral' }}
                    />
                  </div>
                </div>

                <div className="space-y-6 p-5">
                  {/* General Settings */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                      Configuration
                    </h3>

                    <Field label="Node Name">
                      <Input
                        type="text"
                        key={selectedNode}
                        defaultValue={selectedNode === 'node-sms' ? 'Welcome Offer' : 'Newsletter #1'}
                      />
                    </Field>

                    <Field label="Sender ID">
                      <Select defaultValue="SABNODE_ALERTS">
                        <SelectTrigger aria-label="Sender ID">
                          <SelectValue placeholder="Pick a sender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SABNODE_ALERTS">SABNODE_ALERTS</SelectItem>
                          <SelectItem value="SAB_PROMO">SAB_PROMO</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <hr className="border-[var(--st-border)]" />

                  {/* Message Content */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                        Message Content
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast({ title: 'Pick a variable to insert', tone: 'info' })}
                      >
                        Insert Variable
                      </Button>
                    </div>

                    <Field
                      label="Message body"
                      className="!gap-1"
                      help={<span className="block text-right">89 / 160 chars</span>}
                    >
                      <Textarea
                        rows={5}
                        key={selectedNode + '-text'}
                        defaultValue={
                          selectedNode === 'node-sms'
                            ? 'Hi {{user.firstName}}, welcome to Sabnode! Use code WELCOME20 for 20% off your first month.'
                            : 'Hello {{user.firstName}},\n\nThank you for subscribing to our newsletter! We are thrilled to have you.'
                        }
                      />
                    </Field>

                    {selectedNode === 'node-sms' && (
                      <Card variant="outlined" padding="sm" className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-warn)]" aria-hidden="true" />
                        <p className="text-xs leading-relaxed text-[var(--st-text-secondary)]">
                          Personalized variables may increase SMS length and result in multiple segments being billed.
                        </p>
                      </Card>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Save */}
              <div className="border-t border-[var(--st-border)] bg-[var(--st-bg)] p-4">
                <Button variant="primary" block onClick={() => toast.success('Node changes saved')}>
                  Save Changes
                </Button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={MousePointer2}
                title="No node selected"
                description="Select a node on the canvas to view its properties."
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Subcomponents
function NodeCategory({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
          {title}
        </h3>
        <Badge tone="neutral">{count}</Badge>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DraggableNode({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group flex cursor-grab items-start gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 transition-all hover:border-[var(--st-border-strong)] hover:shadow-lg active:cursor-grabbing">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
        aria-hidden="true"
      >
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
      </span>
      <div>
        <h4 className="text-sm font-medium text-[var(--st-text)]">{title}</h4>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--st-text-secondary)]">{desc}</p>
      </div>
    </div>
  );
}

function CanvasNode({
  icon,
  title,
  subtitle,
  selected = false,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** Highlight + mark the node as the chosen one in the properties panel. */
  selected?: boolean;
  /** When provided, the node becomes a selectable button-like card. */
  onSelect?: () => void;
}) {
  const interactive = Boolean(onSelect);
  const isActive = selected;
  return (
    <Card
      variant={interactive ? 'interactive' : isActive ? 'elevated' : 'outlined'}
      padding="md"
      className={`w-64 transition-all ${isActive ? 'border-[var(--st-accent)] ring-2 ring-[var(--st-accent-ring)]' : ''}`}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? `${title}, ${subtitle}` : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-accent-soft)]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="flex-1 overflow-hidden">
          <h4 className="truncate text-sm font-semibold text-[var(--st-text)]">{title}</h4>
          <p className="truncate text-xs text-[var(--st-text-secondary)]">{subtitle}</p>
        </div>
        <MoreVertical className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
      </div>
    </Card>
  );
}
