"use client";

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  Globe,
  MoreVertical,
  Plus,
  Network,
} from "lucide-react";

import {
  Button,
  IconButton,
  Card,
  StatCard,
  Badge,
  Switch,
  Field,
  Input,
  Modal,
  Alert,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from "@/components/sabcrm/20ui";

interface Provider {
  id: string;
  name: string;
  region: string;
  latency: string;
  successRate: string;
  status: "active" | "warning" | "inactive";
  costPerSms: string;
  capacity: string;
}

const initialProviders: Provider[] = [
  { id: "p1", name: "Twilio Global", region: "Worldwide", latency: "110ms", successRate: "99.99%", status: "active", costPerSms: "$0.0075", capacity: "Unlimited" },
  { id: "p2", name: "MessageBird EU", region: "Europe", latency: "145ms", successRate: "99.95%", status: "active", costPerSms: "$0.0065", capacity: "1000/sec" },
  { id: "p3", name: "Vonage API", region: "US East", latency: "180ms", successRate: "98.50%", status: "warning", costPerSms: "$0.0080", capacity: "500/sec" },
  { id: "p4", name: "Sinch Backup", region: "Asia Pacific", latency: "220ms", successRate: "97.20%", status: "inactive", costPerSms: "$0.0090", capacity: "200/sec" },
];

type RuleState = {
  lcr: boolean;
  latency: boolean;
  errorRate: boolean;
  geoRouting: boolean;
};

interface SimResult {
  providerName: string;
  reason: string;
  steps: string[];
}

const STATUS_TONE: Record<Provider["status"], "success" | "warning" | "neutral"> = {
  active: "success",
  warning: "warning",
  inactive: "neutral",
};

const STATUS_LABEL: Record<Provider["status"], string> = {
  active: "Active",
  warning: "Degraded",
  inactive: "Standby",
};

interface RuleCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  thresholdLabel?: string;
  thresholdValue?: string;
}

function RuleCard({ title, description, enabled, onToggle, thresholdLabel, thresholdValue }: RuleCardProps) {
  return (
    <Card variant="outlined" padding="md" className={enabled ? "opacity-100" : "opacity-60"}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <h4 className="font-medium mb-1 text-[var(--st-text)]">{title}</h4>
          <p className="text-sm text-[var(--st-text-secondary)]">{description}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${title}`}
        />
      </div>
      {(thresholdLabel || thresholdValue) && (
        <div className="mt-4">
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 flex items-center justify-between">
            <span className="text-sm text-[var(--st-text-secondary)]">{thresholdLabel}</span>
            <span className="text-sm font-mono text-[var(--st-text)]">{thresholdValue}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function ProviderRowContent({ provider, index, dragHandle }: { provider: Provider; index: number; dragHandle?: React.ReactNode }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
      {/* Priority badge + grip */}
      <div className="flex flex-col items-center justify-center w-12 border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] font-mono text-sm text-[var(--st-text-secondary)]">
        <span className="mb-2">#{index + 1}</span>
        {dragHandle}
      </div>

      {/* Card content */}
      <div className="flex-1 p-5 grid grid-cols-12 gap-6 items-center">
        {/* Provider info */}
        <div className="col-span-12 md:col-span-4 flex items-center gap-4">
          <span className="p-3 rounded-[var(--st-radius)] flex-shrink-0 bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
            <Server className="w-6 h-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[var(--st-text)] tracking-tight truncate">{provider.name}</h3>
              <Badge tone={STATUS_TONE[provider.status]} dot>{STATUS_LABEL[provider.status]}</Badge>
            </div>
            <div className="flex items-center text-sm text-[var(--st-text-secondary)] mt-1 gap-2">
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{provider.region}</span>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="col-span-12 md:col-span-6 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider mb-1">Latency</p>
            <div className="flex items-center gap-1.5 text-[var(--st-text)]">
              <Clock className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              <span className="font-mono">{provider.latency}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider mb-1">Success</p>
            <div className="flex items-center gap-1.5 text-[var(--st-text)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              <span className="font-mono">{provider.successRate}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider mb-1">Cost</p>
            <div className="flex items-center gap-1.5 text-[var(--st-text)]">
              <Zap className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              <span className="font-mono">{provider.costPerSms}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="col-span-12 md:col-span-2 flex justify-end items-center gap-1">
          <IconButton label={`Configure ${provider.name}`} icon={Settings} variant="ghost" />
          <IconButton label={`More options for ${provider.name}`} icon={MoreVertical} variant="ghost" />
        </div>
      </div>
    </div>
  );
}

function SortableItem({ provider, index, disabled }: { provider: Provider; index: number; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: provider.id, disabled });

  // Runtime-computed transform from dnd-kit: must stay inline.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const dragHandle = (
    <span
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      className={`p-2 rounded-[var(--st-radius)] transition-colors ${
        disabled
          ? "opacity-30 cursor-not-allowed"
          : "cursor-grab active:cursor-grabbing hover:bg-[var(--st-bg-secondary)]"
      }`}
      aria-hidden="true"
    >
      <GripVertical className="w-4 h-4 text-[var(--st-text-tertiary)]" />
    </span>
  );

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <ProviderRowContent provider={provider} index={index} dragHandle={dragHandle} />
    </div>
  );
}

export default function RoutingPage() {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [rules, setRules] = useState<RuleState>({
    lcr: false,
    latency: true,
    errorRate: true,
    geoRouting: false,
  });

  const conflicts = React.useMemo(() => {
    const issues: string[] = [];
    if (rules.lcr && rules.geoRouting) {
      issues.push("Conflict detected. Least-Cost Routing and Strict Geo-Routing are both enabled. This may cause routing loops or priority overrides.");
    }
    return issues;
  }, [rules]);

  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [simNumber, setSimNumber] = useState("");
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = () => {
    setIsSimulating(true);
    setSimResult(null);

    setTimeout(() => {
      const steps: string[] = [];
      let selected: Provider | undefined;
      let reason = "";

      steps.push(`Analyzing destination number: ${simNumber}`);

      if (rules.lcr && rules.geoRouting) {
        steps.push("Conflict detected. Applying Strict Geo-Routing over LCR to resolve loop.");
      }

      if (rules.geoRouting) {
        steps.push("Geo-Routing rule enabled.");
        if (simNumber.startsWith("+44") || simNumber.startsWith("+3")) {
          steps.push("Destination mapped to Europe region.");
          selected = providers.find((p) => p.region.includes("Europe"));
          reason = "Strict Geo-Routing (Europe)";
        } else if (simNumber.startsWith("+1")) {
          steps.push("Destination mapped to US region.");
          selected = providers.find((p) => p.region.includes("US"));
          reason = "Strict Geo-Routing (US East)";
        } else {
          steps.push("No specific geo-mapping found, falling back to general rules.");
        }
      }

      if (!selected && rules.lcr) {
        steps.push("Least-Cost Routing (LCR) enabled. Finding cheapest active provider.");
        const activeCheap = [...providers]
          .filter((p) => p.status !== "inactive")
          .sort((a, b) => parseFloat(a.costPerSms.replace("$", "")) - parseFloat(b.costPerSms.replace("$", "")));

        if (activeCheap.length > 0) {
          selected = activeCheap[0];
          reason = "Least-Cost Routing";
        }
      }

      if (!selected) {
        steps.push("Using Priority Waterfall list.");
        selected = providers.find((p) => p.status === "active") || providers[0];
        reason = "Highest Priority Active Provider";
      }

      if (selected) {
        steps.push(`Selected provider: ${selected.name}`);
      }

      setSimResult({
        providerName: selected?.name || "None",
        reason,
        steps,
      });
      setIsSimulating(false);
    }, 800);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setProviders((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  };

  const activeProvider = providers.find((p) => p.id === activeId);
  const activeIndex = providers.findIndex((p) => p.id === activeId);

  return (
    <div className="ui20 min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>
              <span className="inline-flex items-center gap-2">
                <Network className="w-4 h-4" aria-hidden="true" />
                Network Routing
              </span>
            </PageEyebrow>
            <PageTitle>Routing and Fallback</PageTitle>
            <PageDescription>
              Configure provider priorities and set up fallback rules to guarantee delivery of your SMS traffic across the globe.
            </PageDescription>
          </PageHeaderHeading>

          <PageActions>
            <Button variant="secondary" iconLeft={Settings} onClick={() => setIsSimulateOpen(true)}>
              Simulate
            </Button>
            <Button variant="primary" iconLeft={Plus}>
              Add Provider
            </Button>
          </PageActions>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Overall Success Rate" value="99.98%" icon={CheckCircle2} delta={{ value: "+0.02%", tone: "up" }} />
          <StatCard label="Fallback Triggers" value="1,245" icon={ShieldAlert} delta={{ value: "-14.5%", tone: "down" }} />
          <StatCard label="Avg Routing Latency" value="124ms" icon={Zap} delta={{ value: "+12ms", tone: "down" }} />
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Priority list */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--st-border)] pb-4">
              <h2 className="text-xl font-semibold text-[var(--st-text)] flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                Priority Waterfall
              </h2>
              <Badge tone="neutral">Drag to reorder</Badge>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={providers.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {providers.map((provider, index) => (
                    <SortableItem key={provider.id} provider={provider} index={index} disabled={rules.lcr} />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeProvider ? (
                  <div className="opacity-90">
                    <ProviderRowContent
                      provider={activeProvider}
                      index={activeIndex >= 0 ? activeIndex : 0}
                      dragHandle={
                        <span className="p-2 rounded-[var(--st-radius)]" aria-hidden="true">
                          <GripVertical className="w-4 h-4 text-[var(--st-text-tertiary)]" />
                        </span>
                      }
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Rules configuration */}
          <Card variant="elevated" padding="lg" className="lg:col-span-1 h-fit sticky top-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="p-2.5 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </span>
              <h3 className="text-xl font-semibold text-[var(--st-text)]">Rule Evaluation</h3>
            </div>

            {conflicts.length > 0 && (
              <div className="mb-6 space-y-3">
                {conflicts.map((conflict, i) => (
                  <Alert key={i} tone="warning" title="Routing conflict">
                    {conflict}
                  </Alert>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <RuleCard
                title="Least-Cost Routing (LCR)"
                description="Automatically select the cheapest provider."
                enabled={rules.lcr}
                onToggle={() => {
                  const newState = !rules.lcr;
                  setRules((r) => ({ ...r, lcr: newState }));
                  if (newState) {
                    setProviders((prev) => [...prev].sort((a, b) => parseFloat(a.costPerSms.replace("$", "")) - parseFloat(b.costPerSms.replace("$", ""))));
                  }
                }}
              />
              <RuleCard
                title="Latency Timeout"
                description="Switch to next provider if response exceeds threshold."
                enabled={rules.latency}
                onToggle={() => setRules((r) => ({ ...r, latency: !r.latency }))}
                thresholdLabel="Threshold"
                thresholdValue="350ms"
              />
              <RuleCard
                title="Error Rate Tripwire"
                description="Temporarily disable provider on high failure rate."
                enabled={rules.errorRate}
                onToggle={() => setRules((r) => ({ ...r, errorRate: !r.errorRate }))}
                thresholdLabel="Threshold"
                thresholdValue="> 5% / 5m"
              />
              <RuleCard
                title="Strict Geo-Routing"
                description="Force routing through specific regions based on destination."
                enabled={rules.geoRouting}
                onToggle={() => setRules((r) => ({ ...r, geoRouting: !r.geoRouting }))}
              />

              <Button variant="ghost" block iconLeft={Plus}>
                Add Custom Rule
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Simulation modal */}
      <Modal
        open={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        title="Routing Simulation"
        description="Trace which provider a destination number would route to under your current rules."
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsSimulateOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={runSimulation}
              disabled={!simNumber}
              loading={isSimulating}
            >
              {isSimulating ? "Simulating" : "Run Simulation"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <Field label="Destination Phone Number">
            <Input
              type="text"
              value={simNumber}
              onChange={(e) => setSimNumber(e.target.value)}
              placeholder="+1 234 567 8900"
            />
          </Field>

          {simResult && (
            <Card variant="outlined" padding="md" className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--st-text-secondary)]">Simulation Result</h4>
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-status-ok)]">
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[var(--st-text)] font-medium">{simResult.providerName}</p>
                  <p className="text-sm text-[var(--st-text-secondary)]">Reason: {simResult.reason}</p>
                </div>
              </div>
              {simResult.steps.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--st-border)]">
                  <p className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2">Evaluation Steps</p>
                  <ul className="space-y-2 text-sm text-[var(--st-text-secondary)]">
                    {simResult.steps.map((step, i) => (
                      <li key={i} className="flex items-start">
                        <ArrowRight className="w-4 h-4 mr-2 mt-0.5 text-[var(--st-text-secondary)] flex-shrink-0" aria-hidden="true" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>
      </Modal>
    </div>
  );
}
