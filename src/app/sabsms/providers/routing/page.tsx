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
  Network
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

function SortableItem({ provider, index }: { provider: Provider; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: provider.id });

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
        isDragging ? "ring-2 ring-indigo-500 shadow-2xl shadow-indigo-500/20 rounded-xl" : ""
      }`}
    >
      <div className="group flex items-stretch rounded-xl border border-white/10 bg-[#0f1115] hover:bg-[#161920] transition-colors overflow-hidden">
        {/* Priority Badge */}
        <div className="flex flex-col items-center justify-center w-12 bg-white/[0.02] border-r border-white/5 font-mono text-sm text-gray-400">
          <span className="mb-2">#{index + 1}</span>
          <div
            {...attributes}
            {...listeners}
            className="p-2 cursor-grab active:cursor-grabbing hover:bg-white/10 rounded-md transition-colors"
          >
            <GripVertical className="w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Card Content */}
        <div className="flex-1 p-5 grid grid-cols-12 gap-6 items-center">
          {/* Provider Info */}
          <div className="col-span-12 md:col-span-4 flex items-center space-x-4">
            <div className={`p-3 rounded-lg flex-shrink-0 ${
              provider.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
              provider.status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight">{provider.name}</h3>
              <div className="flex items-center text-sm text-gray-400 mt-1 space-x-2">
                <Globe className="w-3.5 h-3.5" />
                <span>{provider.region}</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="col-span-12 md:col-span-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Latency</p>
              <div className="flex items-center space-x-1.5 text-gray-200">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span className="font-mono">{provider.latency}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Success</p>
              <div className="flex items-center space-x-1.5 text-gray-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-mono">{provider.successRate}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cost</p>
              <div className="flex items-center space-x-1.5 text-gray-200">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="font-mono">{provider.costPerSms}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="col-span-12 md:col-span-2 flex justify-end items-center">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
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
    <div className="bg-[#0f1115] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <h4 className="text-3xl font-bold text-white mt-2 font-mono tracking-tight">{value}</h4>
          <div className={`flex items-center mt-3 text-sm ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
            <Activity className="w-4 h-4 mr-1.5" />
            <span>{trend} vs last month</span>
          </div>
        </div>
        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10">
          <Icon className="w-6 h-6 text-gray-300" />
        </div>
      </div>
    </div>
  );
}

export default function RoutingPage() {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#050505] text-gray-200 p-6 lg:p-12 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-sm font-medium mb-4">
              <Network className="w-4 h-4" />
              <span>Network Routing</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-tight">
              Routing & Fallback
            </h1>
            <p className="text-gray-400 mt-3 text-lg max-w-2xl">
              Configure provider priorities and setup fallback rules to guarantee delivery of your SMS traffic across the globe.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium transition-all text-white flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Simulate</span>
            </button>
            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] rounded-xl font-medium transition-all text-white flex items-center space-x-2">
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
                <ArrowRight className="w-5 h-5 mr-2 text-indigo-400" />
                Priority Waterfall
              </h2>
              <span className="text-sm text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
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
                    <SortableItem key={provider.id} provider={provider} index={index} />
                  ))}
                </div>
              </SortableContext>
              
              <DragOverlay>
                {activeProvider ? (
                  <div className="group flex items-stretch rounded-xl border border-indigo-500/50 bg-[#161920] shadow-2xl shadow-indigo-500/20 overflow-hidden opacity-90 scale-105 transition-transform">
                    <div className="flex flex-col items-center justify-center w-12 bg-white/[0.02] border-r border-white/5 font-mono text-sm text-gray-400">
                      <GripVertical className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 p-5 grid grid-cols-12 gap-6 items-center">
                      <div className="col-span-12 md:col-span-4 flex items-center space-x-4">
                        <div className={`p-3 rounded-lg flex-shrink-0 ${
                          activeProvider.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                          activeProvider.status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          <Server className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white tracking-tight">{activeProvider.name}</h3>
                          <div className="flex items-center text-sm text-gray-400 mt-1 space-x-2">
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
            className="bg-gradient-to-b from-[#0f1115] to-[#0a0b0e] border border-white/10 rounded-2xl p-6 lg:col-span-1 h-fit sticky top-6 shadow-xl"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-white">Rule Evaluation</h3>
            </div>

            <div className="space-y-6">
              {/* Timeout Rule */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-white font-medium mb-1">Latency Timeout</h4>
                    <p className="text-sm text-gray-500">Switch to next provider if response exceeds threshold.</p>
                  </div>
                  <div className="w-10 h-5 bg-indigo-500 rounded-full flex items-center p-1 cursor-pointer">
                    <div className="w-3.5 h-3.5 bg-white rounded-full translate-x-4.5 shadow-sm"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 mt-4">
                  <div className="flex-1 bg-black/40 rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Threshold</span>
                    <span className="text-sm font-mono text-white">350ms</span>
                  </div>
                </div>
              </div>

              {/* Error Rate Rule */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-white font-medium mb-1">Error Rate Tripwire</h4>
                    <p className="text-sm text-gray-500">Temporarily disable provider on high failure rate.</p>
                  </div>
                  <div className="w-10 h-5 bg-indigo-500 rounded-full flex items-center p-1 cursor-pointer">
                    <div className="w-3.5 h-3.5 bg-white rounded-full translate-x-4.5 shadow-sm"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 mt-4">
                  <div className="flex-1 bg-black/40 rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Threshold</span>
                    <span className="text-sm font-mono text-white">&gt; 5% / 5m</span>
                  </div>
                </div>
              </div>

              {/* Geo Routing Rule */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors opacity-60">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-gray-300 font-medium mb-1">Strict Geo-Routing</h4>
                    <p className="text-sm text-gray-500">Force routing through specific regions based on destination.</p>
                  </div>
                  <div className="w-10 h-5 bg-white/10 rounded-full flex items-center p-1 cursor-pointer">
                    <div className="w-3.5 h-3.5 bg-gray-400 rounded-full shadow-sm"></div>
                  </div>
                </div>
              </div>

              <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-xl text-gray-400 hover:text-white font-medium transition-all flex items-center justify-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Add Custom Rule</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
