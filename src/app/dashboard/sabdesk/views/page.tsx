"use client";

import React, { useState } from "react";
import {
  Layout,
  Plus,
  Save,
  Play,
  Settings,
  Database,
  MoreHorizontal,
  Eye,
  Filter,
  ArrowRight,
  Grid,
  List as ListIcon,
  Share2,
  Lock,
  Unlock,
  Copy,
  Trash2,
  X,
  Check,
  ChevronDown,
  AlignLeft,
} from "lucide-react";

// --- Types ---
interface ViewConfig {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdBy: string;
  count: number;
  conditions: FilterCondition[];
}

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

const FIELDS = [
  "Status",
  "Priority",
  "Assignee",
  "Requester",
  "Tags",
  "Created Date",
  "Organization",
];
const OPERATORS = [
  "is",
  "is not",
  "contains",
  "does not contain",
  "greater than",
  "less than",
  "is empty",
  "is not empty",
];

// --- Mock Data ---
const INITIAL_VIEWS: ViewConfig[] = [
  {
    id: "v1",
    name: "All Open Tickets",
    description: "Everything not resolved",
    isPublic: true,
    createdBy: "System",
    count: 1245,
    conditions: [
      { id: "c1", field: "Status", operator: "is not", value: "Closed" },
    ],
  },
  {
    id: "v2",
    name: "My Urgent Escalations",
    description: "High priority assigned to me",
    isPublic: false,
    createdBy: "Me",
    count: 12,
    conditions: [
      { id: "c1", field: "Priority", operator: "is", value: "Urgent" },
      { id: "c2", field: "Assignee", operator: "is", value: "Me" },
    ],
  },
  {
    id: "v3",
    name: "VIP Customers (SLA Warning)",
    description: "Premium tier customers nearing SLA",
    isPublic: true,
    createdBy: "Sarah K.",
    count: 4,
    conditions: [
      { id: "c1", field: "Tags", operator: "contains", value: "VIP" },
    ],
  },
  {
    id: "v4",
    name: "Unassigned Bugs",
    description: "Bug reports waiting for triage",
    isPublic: true,
    createdBy: "Dev Team",
    count: 89,
    conditions: [
      { id: "c1", field: "Assignee", operator: "is empty", value: "" },
      { id: "c2", field: "Tags", operator: "contains", value: "Bug" },
    ],
  },
];

export default function ViewsBuilderPage() {
  const [savedViews, setSavedViews] = useState<ViewConfig[]>(INITIAL_VIEWS);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Builder State
  const [isBuilding, setIsBuilding] = useState(false);
  const [builderName, setBuilderName] = useState("");
  const [builderDesc, setBuilderDesc] = useState("");
  const [builderPublic, setBuilderPublic] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: "c_init", field: "Status", operator: "is", value: "" },
  ]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: `c_${Date.now()}`, field: "Status", operator: "is", value: "" },
    ]);
  };

  const updateCondition = (
    id: string,
    key: keyof FilterCondition,
    val: string,
  ) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, [key]: val } : c)),
    );
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((c) => c.id !== id));
    }
  };

  const handleSaveView = () => {
    const newView: ViewConfig = {
      id: `v_${Date.now()}`,
      name: builderName || "Untitled View",
      description: builderDesc,
      isPublic: builderPublic,
      createdBy: "Me",
      count: Math.floor(Math.random() * 500), // mocked result count
      conditions: [...conditions],
    };
    setSavedViews([...savedViews, newView]);
    setIsBuilding(false);
    setActiveViewId(newView.id);
  };

  const startNewBuild = () => {
    setBuilderName("");
    setBuilderDesc("");
    setBuilderPublic(false);
    setConditions([
      { id: `c_${Date.now()}`, field: "Status", operator: "is", value: "" },
    ]);
    setIsBuilding(true);
    setActiveViewId(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-zinc-900/80 border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-fuchsia-500/10 text-fuchsia-500 rounded-xl border border-fuchsia-500/20">
            <Layout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Custom Views
            </h1>
            <p className="text-sm text-zinc-400">
              Build, save, and share powerful custom queries
            </p>
          </div>
        </div>

        {!isBuilding && (
          <button
            onClick={startNewBuild}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New View
          </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Saved Views List */}
        <div className="w-64 border-r border-zinc-800 bg-zinc-950/80 flex flex-col shrink-0">
          <div className="p-4 border-b border-zinc-800/60 font-medium text-sm text-zinc-300 flex items-center gap-2">
            <Database className="w-4 h-4 text-zinc-500" />
            Saved Views Library
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-2 px-2">
              Your Views
            </div>
            {savedViews
              .filter((v) => v.createdBy === "Me")
              .map((view) => (
                <button
                  key={view.id}
                  onClick={() => {
                    setActiveViewId(view.id);
                    setIsBuilding(false);
                  }
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between group transition-colors ${activeViewId === view.id && !isBuilding ? "bg-indigo-500/10 text-indigo-300" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <AlignLeft className="w-4 h-4 opacity-50 shrink-0" />
                    <span className="text-sm truncate">{view.name}</span>
                  </div>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${activeViewId === view.id && !isBuilding ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 text-zinc-500"}`}
                  >
                    {view.count}
                  </span>
                </button>
              ))}

            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-6 px-2">
              Shared Views
            </div>
            {savedViews
              .filter((v) => v.createdBy !== "Me")
              .map((view) => (
                <button
                  key={view.id}
                  onClick={() => {
                    setActiveViewId(view.id);
                    setIsBuilding(false);
                  }
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between group transition-colors ${activeViewId === view.id && !isBuilding ? "bg-indigo-500/10 text-indigo-300" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Share2 className="w-4 h-4 opacity-50 shrink-0" />
                    <span className="text-sm truncate">{view.name}</span>
                  </div>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${activeViewId === view.id && !isBuilding ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 text-zinc-500"}`}
                  >
                    {view.count}
                  </span>
                </button>
              ))}
          </div>
        </div>

        {/* Main Area: Builder or Viewer */}
        <div className="flex-1 bg-zinc-950 flex flex-col relative overflow-hidden">
          {isBuilding ? (
            // --- BUILDER MODE ---
            <div className="flex-1 flex flex-col h-full overflow-y-auto">
              <div className="max-w-4xl w-full mx-auto p-8 flex flex-col gap-8">
                {/* Meta details */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-zinc-400" />
                    View Configuration
                  </h2>

                  <div className="space-y-4 max-w-xl">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                        View Name
                      </label>
                      <input
                        type="text"
                        value={builderName}
                        onChange={(e) => setBuilderName(e.target.value)}
                        placeholder="e.g., Unassigned High Priority Bugs"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                        Description (Optional)
                      </label>
                      <input
                        type="text"
                        value={builderDesc}
                        onChange={(e) => setBuilderDesc(e.target.value)}
                        placeholder="What does this view filter?"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => setBuilderPublic(!builderPublic)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors relative ${builderPublic ? "bg-indigo-500" : "bg-zinc-700"}`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${builderPublic ? "translate-x-6" : "translate-x-0"}`}
                        />
                      </button>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-200">
                          Public View
                        </span>
                        <span className="text-xs text-zinc-500">
                          Allow other agents to see and use this view
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Query Builder */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                    <Filter className="w-5 h-5 text-zinc-400" />
                    Query Conditions
                  </h2>
                  <p className="text-sm text-zinc-400 mb-6">
                    Define the rules that tickets must match to appear in this
                    view. Tickets must match ALL conditions.
                  </p>

                  <div className="space-y-3 mb-6 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                    {conditions.map((cond, index) => (
                      <div
                        key={cond.id}
                        className="flex flex-col sm:flex-row gap-3 items-center group relative"
                      >
                        {index > 0 && (
                          <span className="text-xs font-bold text-zinc-600 uppercase absolute -left-10 top-3">
                            AND
                          </span>
                        )}

                        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <select
                            value={cond.field}
                            onChange={(e) =>
                              updateCondition(cond.id, "field", e.target.value)
                            }
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500/50"
                          >
                            {FIELDS.map((f) => (
                              <option key={f}>{f}</option>
                            ))}
                          </select>

                          <select
                            value={cond.operator}
                            onChange={(e) =>
                              updateCondition(
                                cond.id,
                                "operator",
                                e.target.value,
                              )
                            }
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500/50"
                          >
                            {OPERATORS.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={cond.value}
                            onChange={(e) =>
                              updateCondition(cond.id, "value", e.target.value)
                            }
                            placeholder="Value..."
                            disabled={cond.operator.includes("empty")}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                          />
                        </div>

                        <button
                          onClick={() => removeCondition(cond.id)}
                          disabled={conditions.length === 1}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addCondition}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Condition
                  </button>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setIsBuilding(false);
                      if (savedViews.length > 0)
                        setActiveViewId(savedViews[0].id);
                    }
                    className="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700">
                    <Play className="w-4 h-4 text-indigo-400" />
                    Preview Results
                  </button>
                  <button
                    onClick={handleSaveView}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save View
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // --- VIEWER MODE ---
            <div className="flex-1 flex flex-col h-full bg-zinc-900/30">
              {activeViewId && savedViews.find((v) => v.id === activeViewId) ? (
                <>
                  <div className="p-6 border-b border-zinc-800/60 bg-zinc-950/50 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-semibold text-white">
                          {savedViews.find((v) => v.id === activeViewId)?.name}
                        </h2>
                        {savedViews.find((v) => v.id === activeViewId)
                          ?.isPublic ? (
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md border border-zinc-700">
                            <Unlock className="w-3 h-3" /> Public
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/20">
                            <Lock className="w-3 h-3" /> Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mb-4">
                        {
                          savedViews.find((v) => v.id === activeViewId)
                            ?.description
                        }
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {savedViews
                          .find((v) => v.id === activeViewId)
                          ?.conditions.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center text-xs bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden"
                            >
                              <span className="px-2 py-1 text-zinc-400 border-r border-zinc-800">
                                {c.field}
                              </span>
                              <span className="px-2 py-1 text-zinc-500 bg-zinc-950 font-mono">
                                {c.operator}
                              </span>
                              {c.value && (
                                <span className="px-2 py-1 text-indigo-300 font-medium bg-indigo-500/5">
                                  {c.value}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-colors">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-colors">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mock Table Results */}
                  <div className="flex-1 overflow-auto p-6">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                        <span className="text-sm font-medium text-zinc-300">
                          {savedViews.find((v) => v.id === activeViewId)?.count}{" "}
                          matching results
                        </span>
                        <div className="flex gap-2">
                          <button className="p-1.5 text-zinc-400 hover:bg-zinc-800 rounded">
                            <ListIcon className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-zinc-400 hover:bg-zinc-800 rounded">
                            <Grid className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-500 font-semibold border-b border-zinc-800">
                          <tr>
                            <th className="p-4">ID</th>
                            <th className="p-4">Subject</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Priority</th>
                            <th className="p-4">Assignee</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {Array.from({ length: 15 }).map((_, i) => (
                            <tr
                              key={i}
                              className="hover:bg-zinc-800/50 transition-colors"
                            >
                              <td className="p-4 text-sm font-mono text-zinc-500">
                                TIC-{3000 + i}
                              </td>
                              <td className="p-4 text-sm text-zinc-300">
                                Placeholder matched ticket title {i}
                              </td>
                              <td className="p-4">
                                <span className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  Open
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="text-sm text-zinc-400">
                                  Normal
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="text-sm text-zinc-400">
                                  System
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                  <Database className="w-16 h-16 mb-4 opacity-20" />
                  <h3 className="text-xl font-medium text-zinc-300 mb-2">
                    Select a View
                  </h3>
                  <p className="text-sm">
                    Choose a saved view from the sidebar or create a new one.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
