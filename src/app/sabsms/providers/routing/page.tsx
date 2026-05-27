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
import { motion } from "framer-motion";
import {
  GripVertical,
  Activity,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  Globe,
  MessageSquare,
  BarChart3,
  MoreVertical,
  Plus,
  Network,
  X
} from "lucide-react";

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

function RuleCard({ title, description, enabled, onToggle, thresholdLabel, thresholdValue }: any) {
  return (
    <div className={`p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors ${enabled ? 'opacity-100' : 'opacity-60'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className={`${enabled ? 'text-white' : 'text-zoru-ink-muted'} font-medium mb-1`}>{title}</h4>
          <p className="text-sm text-zoru-ink">{description}</p>
        </div>
        <div 
          onClick={onToggle}
          className={`w-10 h-5 rounded-full flex items-center p-1 cursor-pointer transition-colors ${enabled ? 'bg-zoru-ink' : 'bg-white/10'}`}
        >
          <div className={`w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-200 ${enabled ? 'bg-white translate-x-4' : 'bg-zoru-surface-2 translate-x-0'}`}></div>
        </div>
      </div>
      {(thresholdLabel || thresholdValue) && (
        <div className="flex items-center space-x-3 mt-4">
          <div className="flex-1 bg-black/40 rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
            <span className="text-sm text-zoru-ink-muted">{thresholdLabel}</span>
            <span className="text-sm font-mono text-white">{thresholdValue}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableItem({ provider, index, disabled }: { provider: Provider; index: number; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: provider.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative mb-4 transition-all ${
        isDragging ? "ring-2 ring-zoru-line shadow-2xl shadow-zoru-line/20 rounded-xl" : ""
      }`}
    >
      <div className="group flex items-stretch rounded-xl border border-white/10 bg-zoru-ink hover:bg-zoru-ink transition-colors overflow-hidden">
        {/* Priority Badge */}
        <div className="flex flex-col items-center justify-center w-12 bg-white/[0.02] border-r border-white/5 font-mono text-sm text-zoru-ink-muted">
          <span className="mb-2">#{index + 1}</span>
          <div
            {...(disabled ? {} : attributes)}
            {...(disabled ? {} : listeners)}
            className={`p-2 rounded-md transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:bg-white/10'}`}
          >
            <GripVertical className="w-4 h-4 text-zoru-ink" />
          </div>
        </div>

        {/* Card Content */}
        <div className="flex-1 p-5 grid grid-cols-12 gap-6 items-center">
          {/* Provider Info */}
          <div className="col-span-12 md:col-span-4 flex items-center space-x-4">
            <div className={`p-3 rounded-lg flex-shrink-0 ${
              provider.status === 'active' ? 'bg-zoru-ink/10 text-zoru-ink-muted' :
              provider.status === 'warning' ? 'bg-zoru-ink/10 text-zoru-ink-muted' :
              'bg-zoru-ink/10 text-zoru-ink-muted'
            }`}>
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight">{provider.name}</h3>
              <div className="flex items-center text-sm text-zoru-ink-muted mt-1 space-x-2">
                <Globe className="w-3.5 h-3.5" />
                <span>{provider.region}</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="col-span-12 md:col-span-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-zoru-ink uppercase tracking-wider mb-1">Latency</p>
              <div className="flex items-center space-x-1.5 text-white">
                <Clock className="w-4 h-4 text-zoru-ink-muted" />
                <span className="font-mono">{provider.latency}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-zoru-ink uppercase tracking-wider mb-1">Success</p>
              <div className="flex items-center space-x-1.5 text-white">
                <CheckCircle2 className="w-4 h-4 text-zoru-ink-muted" />
                <span className="font-mono">{provider.successRate}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-zoru-ink uppercase tracking-wider mb-1">Cost</p>
              <div className="flex items-center space-x-1.5 text-white">
                <Zap className="w-4 h-4 text-zoru-ink-muted" />
                <span className="font-mono">{provider.costPerSms}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="col-span-12 md:col-span-2 flex justify-end items-center">
            <button className="p-2 text-zoru-ink-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 text-zoru-ink-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp }: any) {
  return (
    <div className="bg-zoru-ink border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-zoru-ink/5 to-zoru-ink/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zoru-ink-muted">{title}</p>
          <h4 className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{value}</h4>
          <div className={`flex items-center mt-3 text-sm ${trendUp ? 'text-zoru-ink-muted' : 'text-zoru-ink-muted'}`}>
            <Activity className="w-4 h-4 mr-1.5" />
            <span>{trend} vs last month</span>
          </div>
        </div>
        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10">
          <Icon className="w-6 h-6 text-zoru-ink-muted" />
        </div>
      </div>
    </div>
  );
}

export default function RoutingPage() {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [rules, setRules] = useState({
    lcr: false,
    latency: true,
    errorRate: true,
    geoRouting: false,
  });

  const conflicts = React.useMemo(() => {
    const issues = [];
    if (rules.lcr && rules.geoRouting) {
      issues.push("Conflict Detected: Least-Cost Routing and Strict Geo-Routing are both enabled. This may cause routing loops or priority overrides.");
    }
    return issues;
  }, [rules]);

  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [simNumber, setSimNumber] = useState("");
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = () => {
    setIsSimulating(true);
    setSimResult(null);
    
    setTimeout(() => {
      const steps: string[] = [];
      let selected = null;
      let reason = "";

      steps.push(`Analyzing destination number: ${simNumber}`);

      if (rules.lcr && rules.geoRouting) {
        steps.push(`Conflict Detected: Applying Strict Geo-Routing over LCR to resolve loop.`);
      }

      if (rules.geoRouting) {
        steps.push("Geo-Routing rule enabled.");
        if (simNumber.startsWith("+44") || simNumber.startsWith("+3")) {
          steps.push("Destination mapped to Europe region.");
          selected = providers.find(p => p.region.includes("Europe"));
          reason = "Strict Geo-Routing (Europe)";
        } else if (simNumber.startsWith("+1")) {
          steps.push("Destination mapped to US region.");
          selected = providers.find(p => p.region.includes("US"));
          reason = "Strict Geo-Routing (US East)";
        } else {
          steps.push("No specific geo-mapping found, falling back to general rules.");
        }
      }

      if (!selected && rules.lcr) {
        steps.push("Least-Cost Routing (LCR) enabled. Finding cheapest active provider.");
        const activeCheap = [...providers]
          .filter(p => p.status !== "inactive")
          .sort((a, b) => parseFloat(a.costPerSms.replace('$', '')) - parseFloat(b.costPerSms.replace('$', '')));
        
        if (activeCheap.length > 0) {
          selected = activeCheap[0];
          reason = "Least-Cost Routing";
        }
      }

      if (!selected) {
        steps.push("Using Priority Waterfall list.");
        selected = providers.find(p => p.status === "active") || providers[0];
        reason = "Highest Priority Active Provider";
      }

      if (selected) {
        steps.push(`Selected Provider: ${selected.name}`);
      }

      setSimResult({
        providerName: selected?.name || "None",
        reason: reason,
        steps: steps
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

  return (
    <div className="min-h-screen bg-zoru-ink text-white p-6 lg:p-12 font-sans selection:bg-zoru-ink/30">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-zoru-ink/10 border border-zoru-line/20 rounded-full text-zoru-ink-muted text-sm font-medium mb-4">
              <Network className="w-4 h-4" />
              <span>Network Routing</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-zoru-surface-2 to-zoru-ink tracking-tight">
              Routing & Fallback
            </h1>
            <p className="text-zoru-ink-muted mt-3 text-lg max-w-2xl">
              Configure provider priorities and setup fallback rules to guarantee delivery of your SMS traffic across the globe.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSimulateOpen(true)}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium transition-all text-white flex items-center space-x-2"
            >
              <Settings className="w-4 h-4" />
              <span>Simulate</span>
            </button>
            <button className="px-5 py-2.5 bg-zoru-ink hover:bg-zoru-ink shadow-[0_0_20px_rgba(79,70,229,0.3)] rounded-xl font-medium transition-all text-white flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Add Provider</span>
            </button>
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <StatCard title="Overall Success Rate" value="99.98%" icon={CheckCircle2} trend="+0.02%" trendUp={true} />
          <StatCard title="Fallback Triggers" value="1,245" icon={ShieldAlert} trend="-14.5%" trendUp={true} />
          <StatCard title="Avg Routing Latency" value="124ms" icon={Zap} trend="+12ms" trendUp={false} />
        </motion.div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Priority List */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 space-y-6"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <ArrowRight className="w-5 h-5 mr-2 text-zoru-ink-muted" />
                Priority Waterfall
              </h2>
              <span className="text-sm text-zoru-ink bg-white/5 px-3 py-1 rounded-full border border-white/10">
                Drag to reorder
              </span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={providers.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {providers.map((provider, index) => (
                    <SortableItem key={provider.id} provider={provider} index={index} disabled={rules.lcr} />
                  ))}
                </div>
              </SortableContext>
              
              <DragOverlay>
                {activeProvider ? (
                  <div className="group flex items-stretch rounded-xl border border-zoru-line/50 bg-zoru-ink shadow-2xl shadow-zoru-line/20 overflow-hidden opacity-90 scale-105 transition-transform">
                    <div className="flex flex-col items-center justify-center w-12 bg-white/[0.02] border-r border-white/5 font-mono text-sm text-zoru-ink-muted">
                      <GripVertical className="w-4 h-4 text-zoru-ink" />
                    </div>
                    <div className="flex-1 p-5 grid grid-cols-12 gap-6 items-center">
                      <div className="col-span-12 md:col-span-4 flex items-center space-x-4">
                        <div className={`p-3 rounded-lg flex-shrink-0 ${
                          activeProvider.status === 'active' ? 'bg-zoru-ink/10 text-zoru-ink-muted' :
                          activeProvider.status === 'warning' ? 'bg-zoru-ink/10 text-zoru-ink-muted' :
                          'bg-zoru-ink/10 text-zoru-ink-muted'
                        }`}>
                          <Server className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white tracking-tight">{activeProvider.name}</h3>
                          <div className="flex items-center text-sm text-zoru-ink-muted mt-1 space-x-2">
                            <Globe className="w-3.5 h-3.5" />
                            <span>{activeProvider.region}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </motion.div>

          {/* Rules Configuration Side Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-b from-zoru-ink to-zoru-ink border border-white/10 rounded-2xl p-6 lg:col-span-1 h-fit sticky top-6 shadow-xl"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 bg-zoru-ink/10 text-zoru-ink-muted rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-white">Rule Evaluation</h3>
            </div>

            {conflicts.length > 0 && (
              <div className="mb-6 space-y-3">
                {conflicts.map((conflict, i) => (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    key={i} 
                    className="p-3 bg-zoru-ink/10 border border-zoru-line/20 rounded-xl flex items-start space-x-3 text-zoru-ink-muted"
                  >
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{conflict}</p>
                  </motion.div>
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
                  setRules(r => ({ ...r, lcr: newState }));
                  if (newState) {
                    setProviders(prev => [...prev].sort((a, b) => parseFloat(a.costPerSms.replace('$', '')) - parseFloat(b.costPerSms.replace('$', ''))));
                  }
                }}
              />
              <RuleCard 
                title="Latency Timeout"
                description="Switch to next provider if response exceeds threshold."
                enabled={rules.latency}
                onToggle={() => setRules(r => ({ ...r, latency: !r.latency }))}
                thresholdLabel="Threshold"
                thresholdValue="350ms"
              />
              <RuleCard 
                title="Error Rate Tripwire"
                description="Temporarily disable provider on high failure rate."
                enabled={rules.errorRate}
                onToggle={() => setRules(r => ({ ...r, errorRate: !r.errorRate }))}
                thresholdLabel="Threshold"
                thresholdValue="> 5% / 5m"
              />
              <RuleCard 
                title="Strict Geo-Routing"
                description="Force routing through specific regions based on destination."
                enabled={rules.geoRouting}
                onToggle={() => setRules(r => ({ ...r, geoRouting: !r.geoRouting }))}
              />

              <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-xl text-zoru-ink-muted hover:text-white font-medium transition-all flex items-center justify-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Add Custom Rule</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Simulation Modal */}
      {isSimulateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zoru-ink border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center">
                <Settings className="w-5 h-5 mr-2 text-zoru-ink-muted" />
                Routing Simulation
              </h3>
              <button onClick={() => setIsSimulateOpen(false)} className="text-zoru-ink-muted hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-zoru-ink-muted mb-2">Destination Phone Number</label>
                <input 
                  type="text" 
                  value={simNumber}
                  onChange={(e) => setSimNumber(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zoru-ink focus:outline-none focus:ring-2 focus:ring-zoru-line"
                />
              </div>
              <button 
                onClick={runSimulation}
                disabled={!simNumber || isSimulating}
                className="w-full py-3 bg-zoru-ink hover:bg-zoru-ink disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-colors"
              >
                {isSimulating ? "Simulating..." : "Run Simulation"}
              </button>
              
              {simResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-white/5 border border-white/10 rounded-xl space-y-3"
                >
                  <h4 className="text-sm font-medium text-zoru-ink-muted">Simulation Result</h4>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-zoru-ink/10 text-zoru-ink-muted rounded-lg">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{simResult.providerName}</p>
                      <p className="text-sm text-zoru-ink">Reason: {simResult.reason}</p>
                    </div>
                  </div>
                  {simResult.steps && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-zoru-ink uppercase tracking-wider mb-2">Evaluation Steps</p>
                      <ul className="space-y-2 text-sm text-zoru-ink-muted">
                        {simResult.steps.map((step: string, i: number) => (
                          <li key={i} className="flex items-start">
                            <ArrowRight className="w-4 h-4 mr-2 mt-0.5 text-zoru-ink-muted flex-shrink-0" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
