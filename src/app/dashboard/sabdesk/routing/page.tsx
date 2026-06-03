"use client";

import React, { useState } from "react";
import {
  Settings,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Route,
  Users,
  Zap,
  Shield,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Clock,
  Trash2,
  Edit,
  Save,
  Activity,
  Network,
  ArrowRight,
  Play,
  Server,
  Cpu,
  Sliders,
  GripVertical,
  AlertTriangle,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Info,
  PlusCircle,
  CheckSquare,
  XSquare,
  GitBranch,
  Link,
  Maximize2,
  Share2,
  MousePointer2,
  Move,
  GitCommit,
  GitMerge,
} from "lucide-react";

const mockQueues = [
  {
    id: "q1",
    name: "L1 Support",
    agents: 45,
    active: true,
    strategy: "Round Robin",
    avgWait: "2m 15s",
  },
  {
    id: "q2",
    name: "L2 Technical",
    agents: 12,
    active: true,
    strategy: "Skill Based",
    avgWait: "15m 30s",
  },
  {
    id: "q3",
    name: "Billing Specialists",
    agents: 8,
    active: true,
    strategy: "Least Loaded",
    avgWait: "5m 10s",
  },
  {
    id: "q4",
    name: "Escalation Team",
    agents: 5,
    active: false,
    strategy: "Manual",
    avgWait: "N/A",
  },
  {
    id: "q5",
    name: "VIP Enterprise",
    agents: 15,
    active: true,
    strategy: "Dedicated",
    avgWait: "30s",
  },
];

const mockRules = [
  {
    id: "r1",
    name: "Route High Priority to Escalation",
    condition: "Priority equals Urgent",
    action: "Assign to Escalation Team",
    status: "active",
    matches: 1240,
  },
  {
    id: "r2",
    name: "Billing Inquiries",
    condition: "Category equals Billing",
    action: "Assign to Billing Specialists",
    status: "active",
    matches: 8432,
  },
  {
    id: "r3",
    name: "Spanish Language Support",
    condition: "Language equals Spanish",
    action: "Require Skill: Spanish",
    status: "inactive",
    matches: 0,
  },
  {
    id: "r4",
    name: "VIP Customers",
    condition: "Organization equals Enterprise VIP",
    action: "Assign to VIP Enterprise",
    status: "active",
    matches: 342,
  },
  {
    id: "r5",
    name: "Password Resets",
    condition: "Subject contains Password",
    action: "Auto-reply Macro: Password Reset",
    status: "active",
    matches: 12053,
  },
];

const flowNodes = [
  {
    id: "start",
    type: "trigger",
    title: "Ticket Created",
    icon: Play,
    x: 50,
    y: 150,
  },
  {
    id: "cond1",
    type: "condition",
    title: "Is VIP Customer?",
    icon: GitBranch,
    x: 300,
    y: 150,
  },
  {
    id: "act1",
    type: "action",
    title: "Route to VIP Queue",
    icon: Users,
    x: 600,
    y: 50,
  },
  {
    id: "cond2",
    type: "condition",
    title: "Category = Technical?",
    icon: GitBranch,
    x: 600,
    y: 250,
  },
  {
    id: "act2",
    type: "action",
    title: "Assign to L2 Tech",
    icon: Cpu,
    x: 900,
    y: 150,
  },
  {
    id: "act3",
    type: "action",
    title: "Assign to L1 General",
    icon: Users,
    x: 900,
    y: 350,
  },
];

const flowEdges = [
  { from: "start", to: "cond1", label: "" },
  { from: "cond1", to: "act1", label: "Yes" },
  { from: "cond1", to: "cond2", label: "No" },
  { from: "cond2", to: "act2", label: "Yes" },
  { from: "cond2", to: "act3", label: "No" },
];

export default function RoutingPage() {
  const [activeTab, setActiveTab] = useState("flow");
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/50 p-6 rounded-2xl border border-gray-800/50 backdrop-blur-xl">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
              <Network className="w-8 h-8 text-blue-400" />
              Routing & Assignment
            </h1>
            <p className="text-gray-400 mt-2">
              Manage queues, skill-based routing, and visual workflows.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-gray-700">
              <Activity className="w-4 h-4" /> Routing Logs
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20">
              <Plus className="w-4 h-4" /> Create Route
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-900/40 p-1 rounded-xl border border-gray-800 w-fit">
          {[
            { id: "flow", label: "Flow Builder", icon: GitMerge },
            { id: "queues", label: "Queues & Pools", icon: Users },
            { id: "rules", label: "Routing Rules", icon: Sliders },
            { id: "settings", label: "Global Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-gray-800 text-white shadow-md border border-gray-700/50"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Flow Builder Tab */}
        {activeTab === "flow" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[800px]">
            {/* Sidebar Tools */}
            <div className="col-span-1 bg-gray-900/50 rounded-2xl border border-gray-800/50 flex flex-col backdrop-blur-md overflow-hidden">
              <div className="p-4 border-b border-gray-800 bg-gray-900/80">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-400" />
                  Components
                </h3>
              </div>
              <div className="p-4 space-y-6 overflow-y-auto flex-1">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Triggers
                  </h4>
                  <div className="space-y-2">
                    {[
                      "Ticket Created",
                      "Ticket Updated",
                      "Email Received",
                      "API Event",
                    ].map((t) => (
                      <div
                        key={t}
                        className="p-3 bg-gray-800/40 border border-gray-700/50 rounded-lg flex items-center gap-3 cursor-grab hover:bg-gray-700/50 transition-colors"
                      >
                        <GripVertical className="w-4 h-4 text-gray-500" />
                        <Play className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Conditions
                  </h4>
                  <div className="space-y-2">
                    {[
                      "Property Check",
                      "Time Based",
                      "Agent Online",
                      "Sentiment Score",
                    ].map((t) => (
                      <div
                        key={t}
                        className="p-3 bg-gray-800/40 border border-gray-700/50 rounded-lg flex items-center gap-3 cursor-grab hover:bg-gray-700/50 transition-colors"
                      >
                        <GripVertical className="w-4 h-4 text-gray-500" />
                        <GitBranch className="w-4 h-4 text-amber-400" />
                        <span className="text-sm">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Actions
                  </h4>
                  <div className="space-y-2">
                    {[
                      "Assign to Queue",
                      "Assign to Agent",
                      "Add Tags",
                      "Trigger Webhook",
                      "Send Auto-reply",
                    ].map((t) => (
                      <div
                        key={t}
                        className="p-3 bg-gray-800/40 border border-gray-700/50 rounded-lg flex items-center gap-3 cursor-grab hover:bg-gray-700/50 transition-colors"
                      >
                        <GripVertical className="w-4 h-4 text-gray-500" />
                        <Zap className="w-4 h-4 text-blue-400" />
                        <span className="text-sm">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="col-span-1 lg:col-span-3 bg-[#0f1115] rounded-2xl border border-gray-800/50 relative overflow-hidden flex flex-col">
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
                <div className="bg-gray-900/80 backdrop-blur-md px-4 py-2 rounded-lg border border-gray-700 pointer-events-auto flex items-center gap-3">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  <span className="text-sm font-medium">
                    Main Routing Flow v2.4
                  </span>
                </div>
                <div className="flex gap-2 pointer-events-auto">
                  <button className="p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors text-gray-400 hover:text-white">
                    <MousePointer2 className="w-5 h-5" />
                  </button>
                  <button className="p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors text-gray-400 hover:text-white">
                    <Move className="w-5 h-5" />
                  </button>
                  <button className="p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors text-gray-400 hover:text-white">
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Mock Canvas Area */}
              <div
                className="flex-1 w-full h-full relative"
                style={{
                  backgroundSize: "40px 40px",
                  backgroundImage:
                    "radial-gradient(circle, #1f2937 1px, transparent 1px)",
                }}
              >
                {/* Lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* start to cond1 */}
                  <path
                    d="M 230 180 L 300 180"
                    stroke="#374151"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrow)"
                  />
                  {/* cond1 to act1 */}
                  <path
                    d="M 500 180 C 550 180, 550 80, 600 80"
                    stroke="#10B981"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrow-green)"
                  />
                  <text
                    x="530"
                    y="120"
                    fill="#10B981"
                    fontSize="12"
                    className="font-medium"
                  >
                    Yes
                  </text>
                  {/* cond1 to cond2 */}
                  <path
                    d="M 500 180 C 550 180, 550 280, 600 280"
                    stroke="#EF4444"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrow-red)"
                  />
                  <text
                    x="530"
                    y="240"
                    fill="#EF4444"
                    fontSize="12"
                    className="font-medium"
                  >
                    No
                  </text>
                  {/* cond2 to act2 */}
                  <path
                    d="M 800 280 C 850 280, 850 180, 900 180"
                    stroke="#10B981"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrow-green)"
                  />
                  {/* cond2 to act3 */}
                  <path
                    d="M 800 280 C 850 280, 850 380, 900 380"
                    stroke="#EF4444"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrow-red)"
                  />

                  <defs>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
                    </marker>
                    <marker
                      id="arrow-green"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#10B981" />
                    </marker>
                    <marker
                      id="arrow-red"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
                    </marker>
                  </defs>
                </svg>

                {/* Nodes */}
                {flowNodes.map((node) => (
                  <div
                    key={node.id}
                    className={`absolute p-4 rounded-xl border w-[200px] shadow-xl backdrop-blur-md transition-transform hover:scale-105 cursor-pointer flex flex-col gap-3
                      ${
                        node.type === "trigger"
                          ? "bg-emerald-900/20 border-emerald-500/50"
                          : node.type === "condition"
                            ? "bg-amber-900/20 border-amber-500/50"
                            : "bg-blue-900/20 border-blue-500/50"
                      }`}
                    style={{ left: node.x, top: node.y }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg 
                        ${
                          node.type === "trigger"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : node.type === "condition"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        <node.icon className="w-5 h-5" />
                      </div>
                      <span className="font-semibold text-sm">
                        {node.title}
                      </span>
                    </div>
                    {node.type === "condition" && (
                      <div className="flex justify-between text-xs font-medium px-1">
                        <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                          Yes
                        </span>
                        <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                          No
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Bar */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
                <div className="bg-gray-900/80 backdrop-blur-md px-4 py-2 rounded-lg border border-gray-700 pointer-events-auto text-xs text-gray-400">
                  Auto-saved 2 mins ago
                </div>
                <div className="flex gap-3 pointer-events-auto">
                  <button className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 transition-colors font-medium">
                    Discard Changes
                  </button>
                  <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-900/20 flex items-center gap-2">
                    <Save className="w-4 h-4" /> Publish Flow
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Queues Tab */}
        {activeTab === "queues" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  label: "Total Queues",
                  value: "12",
                  icon: Route,
                  color: "text-blue-400",
                },
                {
                  label: "Active Agents",
                  value: "84",
                  icon: Users,
                  color: "text-emerald-400",
                },
                {
                  label: "Avg Queue Time",
                  value: "4m 20s",
                  icon: Clock,
                  color: "text-amber-400",
                },
                {
                  label: "Routing Errors",
                  value: "0.02%",
                  icon: AlertTriangle,
                  color: "text-red-400",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800/50 backdrop-blur-md flex items-center gap-4"
                >
                  <div
                    className={`p-4 rounded-xl bg-gray-800/50 ${stat.color}`}
                  >
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm font-medium">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-md overflow-hidden">
              <div className="p-6 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-96">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search queues..."
                    className="w-full bg-gray-800/50 border border-gray-700 text-gray-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                  />
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-gray-700">
                    <Filter className="w-4 h-4" /> Filter
                  </button>
                  <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    <Plus className="w-4 h-4" /> New Queue
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-800/30 text-gray-400 text-sm border-b border-gray-800">
                      <th className="px-6 py-4 font-semibold">Queue Name</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">
                        Assigned Agents
                      </th>
                      <th className="px-6 py-4 font-semibold">
                        Routing Strategy
                      </th>
                      <th className="px-6 py-4 font-semibold">Avg Wait Time</th>
                      <th className="px-6 py-4 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {mockQueues.map((queue) => (
                      <tr
                        key={queue.id}
                        className="hover:bg-gray-800/20 transition-colors group cursor-pointer"
                        onClick={() => setSelectedQueue(queue.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-blue-400 font-bold border border-gray-700">
                              {queue.name.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-200">
                              {queue.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              queue.active
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                            }`}
                          >
                            {queue.active ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <XSquare className="w-3 h-3" />
                            )}
                            {queue.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span>{queue.agents} agents</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-gray-800/80 text-gray-300 text-xs font-medium border border-gray-700">
                            {queue.strategy}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 font-medium">
                          {queue.avgWait}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === "rules" && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-md overflow-hidden">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" /> Pre-Routing
                  Rules
                </h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm">
                  <Plus className="w-4 h-4" /> Add Rule
                </button>
              </div>

              <div className="p-0">
                {mockRules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className="p-6 border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center"
                  >
                    <div className="flex items-center gap-4 w-12 justify-center">
                      <GripVertical className="w-5 h-5 text-gray-600 cursor-grab" />
                      <span className="text-gray-500 font-mono text-sm">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg text-gray-200">
                          {rule.name}
                        </h3>
                        {rule.status === "active" ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 text-xs font-medium border border-gray-500/20">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-gray-500">IF</span>
                        <div className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 font-mono">
                          {rule.condition}
                        </div>
                        <span className="text-gray-500">THEN</span>
                        <div className="px-3 py-1.5 rounded-lg bg-indigo-900/30 border border-indigo-700/50 text-indigo-300 font-mono flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5" />
                          {rule.action}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
                      <div className="text-right">
                        <p className="text-2xl font-light text-gray-300">
                          {rule.matches.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                          Executions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {rule.status === "active" ? (
                          <button
                            className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                            title="Deactivate"
                          >
                            <ToggleRight className="w-5 h-5 text-emerald-400" />
                          </button>
                        ) : (
                          <button
                            className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                            title="Activate"
                          >
                            <ToggleLeft className="w-5 h-5 text-gray-600" />
                          </button>
                        )}
                        <button className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
