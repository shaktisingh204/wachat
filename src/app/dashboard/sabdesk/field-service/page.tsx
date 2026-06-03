"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Map, Calendar, Users, Truck, Wrench, Settings, Search, Bell, Menu, Plus, Filter,
  MoreVertical, CheckCircle2, Clock, AlertTriangle, MapPin, Navigation, Phone, MessageSquare,
  ChevronRight, ChevronDown, List, Grid, CalendarDays, BarChart3, PieChart, Activity,
  Briefcase, Hash, Target, Zap, Shield, Battery, Signal, ArrowRight, ArrowUpRight,
  ArrowDownRight, Paperclip, FileText, Image as ImageIcon, Camera, Trash2, Edit2, Check,
  X, Maximize2, Minimize2, Layers, Crosshair, Map as MapIcon, Compass, Thermometer,
  Wind, Droplets, Flame, SearchCode, Download, Upload, Server, Wifi, Smartphone
} from "lucide-react";

// --- MOCK DATA ---

const generateTechnicians = () => Array.from({ length: 45 }, (_, i) => ({
  id: `TECH-${1000 + i}`,
  name: `Technician ${i + 1}`,
  status: ["Active", "On Break", "Off Duty", "In Transit", "Emergency"][Math.floor(Math.random() * 5)],
  battery: Math.floor(Math.random() * 100),
  signal: Math.floor(Math.random() * 4) + 1,
  currentJob: Math.random() > 0.3 ? `JOB-${2000 + i}` : null,
  location: { x: Math.random() * 100, y: Math.random() * 100 },
  avatar: `https://i.pravatar.cc/150?u=tech${i}`,
  skills: ["HVAC", "Plumbing", "Electrical", "Carpentry", "Network", "Security"].sort(() => 0.5 - Math.random()).slice(0, 3),
  rating: (Math.random() * 1 + 4).toFixed(1),
  jobsCompleted: Math.floor(Math.random() * 1500),
  vehicle: `Van ${Math.floor(Math.random() * 50)}`,
  lastSeen: `${Math.floor(Math.random() * 60)} mins ago`,
}));

const generateJobs = () => Array.from({ length: 300 }, (_, i) => {
  const statuses = ["Unassigned", "Dispatched", "In Progress", "Completed", "On Hold", "Cancelled"];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  return {
    id: `JOB-${2000 + i}`,
    title: `Service Request ${i + 1}`,
    customer: `Enterprise Corp ${i + 1}`,
    address: `${Math.floor(Math.random() * 9999)} Commerce Blvd, City`,
    priority: ["Low", "Medium", "High", "Urgent", "Critical"][Math.floor(Math.random() * 5)],
    status: status,
    date: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
    time: `${Math.floor(Math.random() * 12 + 1)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}`,
    type: ["Repair", "Installation", "Maintenance", "Inspection", "Audit", "Emergency Call"][Math.floor(Math.random() * 6)],
    technicianId: status !== "Unassigned" && status !== "Cancelled" ? `TECH-${1000 + Math.floor(Math.random() * 45)}` : null,
    amount: `$${(Math.random() * 5000).toFixed(2)}`,
    progress: status === "In Progress" ? Math.floor(Math.random() * 100) : (status === "Completed" ? 100 : 0),
    location: { x: Math.random() * 100, y: Math.random() * 100 },
  };
});

const STATS = [
  { label: "Total Active Jobs", value: "1,284", change: "+12.5%", trend: "up", icon: Briefcase, color: "text-blue-400" },
  { label: "Technicians Online", value: "32/45", change: "+4.1%", trend: "up", icon: Users, color: "text-emerald-400" },
  { label: "Critical Alerts", value: "12", change: "-2.3%", trend: "down", icon: AlertTriangle, color: "text-rose-400" },
  { label: "Avg Response Time", value: "24m", change: "-1.5m", trend: "down", icon: Clock, color: "text-amber-400" },
  { label: "Revenue (Today)", value: "$45.2k", change: "+18.2%", trend: "up", icon: Activity, color: "text-purple-400" },
  { label: "Completed Jobs", value: "142", change: "+5.4%", trend: "up", icon: CheckCircle2, color: "text-cyan-400" },
];

const ALERTS = Array.from({ length: 15 }, (_, i) => ({
  id: `ALT-${i}`,
  type: ["warning", "error", "info"][Math.floor(Math.random() * 3)],
  message: ["Vehicle needs maintenance", "Technician idle for 30m", "Job SLA approaching breach", "Customer updated request", "Traffic delay reported"][Math.floor(Math.random() * 5)],
  time: `${Math.floor(Math.random() * 60)}m ago`,
  jobId: `JOB-${2000 + Math.floor(Math.random() * 100)}`
}));

// --- UTILS ---

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
    case 'Urgent': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    case 'High': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
    case 'Medium': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    case 'Low': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    case 'In Progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    case 'Dispatched': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
    case 'On Hold': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
    case 'Cancelled': return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
    case 'Unassigned': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  }
};

// --- COMPONENTS ---

const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-sm ${className}`}>
    {children}
  </span>
);

const IconButton = ({ icon: Icon, onClick, className, active }: any) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
        : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
    } ${className}`}
  >
    <Icon className="w-5 h-5" />
  </button>
);

// --- MAIN PAGE COMPONENT ---

export default function FieldServiceDashboard() {
  const [activeTab, setActiveTab] = useState("live-map");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    // Simulate loading data
    setTechnicians(generateTechnicians());
    setJobs(generateJobs());
  }, []);

  const TABS = [
    { id: "live-map", label: "Live Command Center", icon: MapIcon },
    { id: "dispatch", label: "Dispatch Board", icon: Grid },
    { id: "queue", label: "Job Queue", icon: List },
    { id: "technicians", label: "Fleet & Techs", icon: Truck },
    { id: "analytics", label: "Insights", icon: BarChart3 },
    { id: "inventory", label: "Inventory", icon: Layers },
    { id: "settings", label: "Config", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-[#0a0a0f] text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className={`flex flex-col transition-all duration-300 border-r border-slate-800/50 bg-[#0f111a]/80 backdrop-blur-xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              <Zap className="w-5 h-5 text-white" />
            </div>
            {isSidebarOpen && <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 whitespace-nowrap">SabDesk FSM</span>}
          </div>
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-800 rounded-md text-slate-400 shrink-0">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                activeTab === tab.id 
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
              }`}
            >
              <tab.icon className={`w-5 h-5 shrink-0 ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {isSidebarOpen && <span className="font-medium text-sm whitespace-nowrap">{tab.label}</span>}
              {isSidebarOpen && activeTab === tab.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
              )}
            </button>
          ))}
        </div>

        {/* Mini stats in sidebar */}
        {isSidebarOpen && (
          <div className="p-4 border-t border-slate-800/50 bg-slate-900/30">
            <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">System Status</div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">API Health</span>
                  <span className="text-emerald-400">99.9%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[99.9%] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Fleet Active</span>
                  <span className="text-blue-400">71%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[71%] shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-0">
        
        {/* TOP HEADER */}
        <header className="h-16 border-b border-slate-800/50 bg-[#0a0a0f]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative group w-96">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search jobs, technicians, customers, or serial numbers... (Press '/')"
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-400 rounded border border-slate-700">⌘</kbd>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-400 rounded border border-slate-700">K</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 mr-4 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-300">Live Sync Active</span>
            </div>
            
            <IconButton icon={Bell} />
            <IconButton icon={Settings} />
            
            <button 
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] border border-blue-400/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Job</span>
            </button>

            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden cursor-pointer ml-2">
              <img src="https://i.pravatar.cc/150?u=admin" alt="Admin" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* SUBHEADER STATS (Visible on some tabs) */}
        {["live-map", "dispatch", "analytics"].includes(activeTab) && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-b border-slate-800/50 bg-[#0a0a0f]/90 z-10">
            {STATS.map((stat, idx) => (
              <div key={idx} className={`p-4 border-r border-slate-800/50 last:border-0 hover:bg-slate-900/50 transition-colors cursor-pointer group`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 group-hover:text-slate-400 transition-colors">{stat.label}</span>
                  <stat.icon className={`w-4 h-4 ${stat.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                  <span className={`text-xs font-medium mb-1 ${stat.trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DYNAMIC TAB CONTENT */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === "live-map" && <LiveMapTab technicians={technicians} jobs={jobs} />}
          {activeTab === "dispatch" && <DispatchBoardTab jobs={jobs} technicians={technicians} />}
          {activeTab === "queue" && <JobQueueTab jobs={jobs} />}
          {activeTab === "technicians" && <TechniciansTab technicians={technicians} />}
          {/* Add more placeholder tabs if needed */}
          {!["live-map", "dispatch", "queue", "technicians"].includes(activeTab) && (
             <div className="flex-1 h-full flex flex-col items-center justify-center text-slate-500">
               <Layers className="w-16 h-16 mb-4 opacity-20" />
               <h2 className="text-xl font-semibold mb-2">{TABS.find(t => t.id === activeTab)?.label} Module</h2>
               <p className="max-w-md text-center text-sm">This module is part of the extensive SabDesk Field Service Management suite. Features are continuously being rolled out.</p>
             </div>
          )}
        </div>
      </main>

      {/* MASSIVE CREATE JOB MODAL (Slide-over panel) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-4xl bg-[#0f111a] h-full shadow-2xl flex flex-col border-l border-slate-700 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-6 h-6 text-blue-400" />
                  Create Comprehensive Work Order
                </h2>
                <p className="text-sm text-slate-400 mt-1">Fill out the multi-stage form to dispatch a new job.</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                  Save as Draft
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all">
                  Dispatch Job
                </button>
                <button onClick={() => setIsFormOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Form Area */}
                <div className="md:col-span-2 space-y-8">
                  {/* Section 1 */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" /> General Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Job Title</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="e.g. AC Maintenance" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Job Type</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                          <option>Repair</option>
                          <option>Installation</option>
                          <option>Inspection</option>
                        </select>
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Detailed Description</label>
                        <textarea rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Describe the issue..."></textarea>
                      </div>
                    </div>
                  </section>

                  {/* Section 2 */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" /> Customer & Location
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Select Customer</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                          <option>Enterprise Corp</option>
                          <option>Global Industries</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Contact Person</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="John Doe" />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Service Address</label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="123 Commerce Blvd..." />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Section 3 - Massive simulated fields */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-slate-400" /> Equipment & Assets
                    </h3>
                    <div className="p-4 border border-slate-700 border-dashed rounded-xl bg-slate-800/30 flex flex-col items-center justify-center text-center">
                      <ScanLineIcon className="w-8 h-8 text-slate-500 mb-2" />
                      <p className="text-sm font-medium text-slate-300">Scan or select equipment</p>
                      <p className="text-xs text-slate-500 mb-4">Link specific customer assets to this work order</p>
                      <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors">Add Asset</button>
                    </div>
                  </section>
                </div>

                {/* Sidebar Form Area */}
                <div className="space-y-6 border-l border-slate-800 pl-8">
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Scheduling</h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Priority</label>
                        <div className="flex flex-wrap gap-2">
                          {["Low", "Medium", "High", "Critical"].map(p => (
                            <div key={p} className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs cursor-pointer hover:border-blue-500 hover:text-blue-400 transition-colors">{p}</div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Scheduled Date</label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                          <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <div className="space-y-1.5">
                           <label className="text-xs font-medium text-slate-400">Start Time</label>
                           <input type="time" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-xs font-medium text-slate-400">Est. Duration</label>
                           <input type="text" placeholder="2h 30m" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                         </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 pt-4 border-t border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Assignment</h3>
                    <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600 border-dashed">
                          <Users className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Unassigned</p>
                          <p className="text-xs text-slate-500">Auto-assign based on skills?</p>
                        </div>
                      </div>
                      <button className="w-full py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-colors">
                        Find Best Match
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS FOR TABS ---

function LiveMapTab({ technicians, jobs }: { technicians: any[], jobs: any[] }) {
  // Simulate a complex map view using a patterned background and positioned elements
  return (
    <div className="h-full w-full flex relative bg-[#050508]">
      {/* Background Map Grid Simulation */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '100px 100px' }}>
      </div>

      {/* Map Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Render some mock map elements */}
        {technicians.slice(0, 20).map((tech) => (
          <div key={tech.id} 
               className="absolute z-20 group cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
               style={ left: `${tech.location.x}%`, top: `${tech.location.y}%` }>
            <div className="relative">
              <div className={`w-8 h-8 rounded-full border-2 ${tech.status === 'Active' ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-500 bg-slate-500/20'} backdrop-blur-md flex items-center justify-center shadow-lg`}>
                <Truck className={`w-4 h-4 ${tech.status === 'Active' ? 'text-emerald-400' : 'text-slate-400'}`} />
              </div>
              {/* Radar ping effect */}
              {tech.status === 'Active' && (
                <div className="absolute inset-0 rounded-full border border-emerald-500 animate-ping opacity-50" />
              )}
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                <div className="flex items-center gap-2 mb-1">
                  <img src={tech.avatar} alt="" className="w-6 h-6 rounded-full" />
                  <span className="text-sm font-medium text-white truncate">{tech.name}</span>
                </div>
                <div className="text-xs text-slate-400 flex justify-between">
                  <span>{tech.status}</span>
                  <span className="flex items-center"><Battery className="w-3 h-3 mr-1" />{tech.battery}%</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {jobs.filter(j => j.status === 'Unassigned' || j.status === 'In Progress').slice(0, 15).map((job) => (
          <div key={job.id} 
               className="absolute z-10 group cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
               style={ left: `${job.location.x}%`, top: `${job.location.y}%` }>
            <div className={`p-1.5 rounded-lg border ${job.status === 'In Progress' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-amber-500/20 border-amber-500/50 text-amber-400'} backdrop-blur-md`}>
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
        ))}

        {/* Floating Map Controls */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-30">
          <IconButton icon={Plus} className="bg-slate-900/80 backdrop-blur-md shadow-lg" />
          <IconButton icon={MinusIcon} className="bg-slate-900/80 backdrop-blur-md shadow-lg" />
          <IconButton icon={Crosshair} className="bg-slate-900/80 backdrop-blur-md shadow-lg mt-2" />
        </div>
        
        {/* Floating Legend */}
        <div className="absolute bottom-6 left-6 p-4 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-xl z-30 flex gap-6">
          <div className="flex items-center gap-2 text-xs text-slate-300"><div className="w-3 h-3 rounded-full bg-emerald-500/50 border border-emerald-500"></div> Active Tech</div>
          <div className="flex items-center gap-2 text-xs text-slate-300"><div className="w-3 h-3 rounded bg-amber-500/50 border border-amber-500"></div> Pending Job</div>
          <div className="flex items-center gap-2 text-xs text-slate-300"><div className="w-3 h-3 rounded bg-blue-500/50 border border-blue-500"></div> Active Job</div>
        </div>
      </div>

      {/* Right Sidebar: Live Feed & Alerts */}
      <div className="w-80 h-full border-l border-slate-800/50 bg-[#0f111a]/80 backdrop-blur-md flex flex-col z-20">
        <div className="p-4 border-b border-slate-800/50 flex justify-between items-center">
          <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" /> Live Operations</h3>
          <Badge className="bg-red-500/10 text-red-400 border-red-500/20 animate-pulse">Live</Badge>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Critical Alerts</h4>
            <div className="space-y-2">
              {ALERTS.slice(0, 4).map(alert => (
                <div key={alert.id} className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 flex gap-3 group hover:bg-rose-500/10 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-200">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span>{alert.time}</span> • <span>{alert.jobId}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Activity</h4>
            <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-2 before:w-0.5 before:bg-slate-800 ml-2">
              {[1,2,3,4,5].map((_, i) => (
                <div key={i} className="relative pl-6">
                  <div className="absolute left-1 top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-[#0f111a]" />
                  <p className="text-sm text-slate-300">Job <span className="text-blue-400">JOB-{3000+i}</span> assigned to Technician {i+1}</p>
                  <p className="text-xs text-slate-500">{i*12} mins ago</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DispatchBoardTab({ jobs, technicians }: { jobs: any[], technicians: any[] }) {
  const columns = [
    { id: 'Unassigned', title: 'Unassigned Queue', color: 'slate' },
    { id: 'Dispatched', title: 'Dispatched', color: 'purple' },
    { id: 'In Progress', title: 'In Progress', color: 'blue' },
    { id: 'On Hold', title: 'On Hold', color: 'amber' },
    { id: 'Completed', title: 'Completed', color: 'emerald' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#050508]">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0a0a0f]">
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-sm border border-slate-700 flex items-center gap-2"><Filter className="w-4 h-4"/> Filter</button>
          <button className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-sm border border-slate-700 flex items-center gap-2"><CalendarDays className="w-4 h-4"/> Today</button>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>Total Jobs: <strong>{jobs.length}</strong></span>
          <div className="w-px h-4 bg-slate-700"></div>
          <span>Unassigned: <strong>{jobs.filter(j => j.status === 'Unassigned').length}</strong></span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4 flex gap-4 scrollbar-hide items-start">
        {columns.map(col => {
          const colJobs = jobs.filter(j => j.status === col.id).slice(0, 15); // limit for performance in mock
          return (
            <div key={col.id} className="w-80 shrink-0 flex flex-col max-h-full bg-slate-900/50 rounded-xl border border-slate-800/80">
              <div className="p-3 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/80 rounded-t-xl">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-${col.color}-500 shadow-[0_0_8px_currentColor] text-${col.color}-500`} />
                  {col.title}
                </h3>
                <Badge className={`bg-slate-800 text-slate-400 border-slate-700`}>{colJobs.length}</Badge>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {colJobs.map(job => (
                  <div key={job.id} className="p-3 rounded-lg border border-slate-700/50 bg-[#0f111a] hover:border-slate-500 transition-colors cursor-grab active:cursor-grabbing group shadow-sm hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
                      <span className="text-xs text-slate-500 font-mono">{job.id}</span>
                    </div>
                    <h4 className="font-medium text-slate-200 text-sm mb-1">{job.title}</h4>
                    <p className="text-xs text-slate-400 mb-3 truncate">{job.customer}</p>
                    
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800/50">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" /> {job.time}
                      </div>
                      {job.technicianId ? (
                        <div className="flex items-center gap-1.5" title={job.technicianId}>
                           <div className="w-5 h-5 rounded-full bg-slate-800 overflow-hidden border border-slate-600">
                             <img src={`https://i.pravatar.cc/150?u=${job.technicianId}`} alt="" />
                           </div>
                        </div>
                      ) : (
                        <button className="text-xs text-blue-400 hover:text-blue-300 font-medium">Assign</button>
                      )}
                    </div>
                  </div>
                ))}
                {colJobs.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-lg">
                    No jobs in this queue
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

function JobQueueTab({ jobs }: { jobs: any[] }) {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Complex Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap gap-4 justify-between items-center bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input type="text" placeholder="Search in queue..." className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm w-64 focus:border-blue-500 focus:outline-none" />
          </div>
          <button className="p-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-400 hover:text-slate-200"><Filter className="w-4 h-4"/></button>
          <button className="p-2 border border-slate-800 bg-slate-950 rounded-lg text-slate-400 hover:text-slate-200"><Download className="w-4 h-4"/></button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400 mr-2">Selected: 0</span>
          <button className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-sm border border-slate-700 disabled:opacity-50">Bulk Assign</button>
          <button className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-sm border border-slate-700 disabled:opacity-50">Change Status</button>
        </div>
      </div>

      {/* Massive Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 z-10 shadow-sm">
            <tr>
              <th className="p-4 w-12"><input type="checkbox" className="rounded bg-slate-800 border-slate-700" /></th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Job ID</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Details</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer & Location</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Schedule</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Technician</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-slate-800/20 transition-colors group">
                <td className="p-4"><input type="checkbox" className="rounded bg-slate-800 border-slate-700" /></td>
                <td className="p-4">
                  <span className="font-mono text-xs text-blue-400 hover:underline cursor-pointer">{job.id}</span>
                </td>
                <td className="p-4">
                  <div className="font-medium text-slate-200 text-sm">{job.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{job.type}</div>
                </td>
                <td className="p-4">
                  <div className="text-sm text-slate-300">{job.customer}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3"/> {job.address}</div>
                </td>
                <td className="p-4">
                  <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                </td>
                <td className="p-4">
                  <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
                </td>
                <td className="p-4">
                  <div className="text-sm text-slate-300">{job.date}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{job.time}</div>
                </td>
                <td className="p-4">
                  {job.technicianId ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 overflow-hidden border border-slate-600">
                        <img src={`https://i.pravatar.cc/150?u=${job.technicianId}`} alt="" />
                      </div>
                      <span className="text-sm text-slate-300">{job.technicianId}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Unassigned</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded"><Edit2 className="w-4 h-4"/></button>
                    <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"><MoreVertical className="w-4 h-4"/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-sm text-slate-400">
        <div>Showing 1 to 50 of {jobs.length} entries</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-slate-800 rounded border border-slate-700 disabled:opacity-50">Previous</button>
          <button className="px-3 py-1 bg-slate-800 rounded border border-slate-700 text-blue-400 border-blue-500/30 bg-blue-500/10">1</button>
          <button className="px-3 py-1 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700">2</button>
          <button className="px-3 py-1 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700">3</button>
          <span>...</span>
          <button className="px-3 py-1 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700">Next</button>
        </div>
      </div>
    </div>
  );
}

function TechniciansTab({ technicians }: { technicians: any[] }) {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] p-6 overflow-y-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Fleet & Technician Management</h2>
          <p className="text-slate-400 text-sm">Monitor, dispatch, and manage your field workforce.</p>
        </div>
        <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all border border-slate-700">
          <Plus className="w-4 h-4" /> Add Technician
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {technicians.map((tech) => (
          <div key={tech.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-600 transition-colors group relative overflow-hidden">
            {/* Background glowing effect based on status */}
            {tech.status === 'Active' && <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all pointer-events-none"></div>}
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-3">
                <div className="relative">
                  <img src={tech.avatar} alt={tech.name} className="w-12 h-12 rounded-full border-2 border-slate-700 object-cover" />
                  <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                    tech.status === 'Active' ? 'bg-emerald-500' :
                    tech.status === 'On Break' ? 'bg-amber-500' :
                    tech.status === 'Emergency' ? 'bg-rose-500' : 'bg-slate-500'
                  }`}></div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200">{tech.name}</h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{tech.id}</div>
                </div>
              </div>
              <button className="text-slate-500 hover:text-slate-300"><MoreVertical className="w-4 h-4"/></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800/80">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Rating</div>
                <div className="text-sm font-medium text-amber-400 flex items-center gap-1">★ {tech.rating}</div>
              </div>
              <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800/80">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Jobs Done</div>
                <div className="text-sm font-medium text-slate-300">{tech.jobsCompleted}</div>
              </div>
            </div>

            <div className="space-y-2.5 mb-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-2"><Truck className="w-4 h-4"/> Vehicle</span>
                <span className="text-slate-300">{tech.vehicle}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-2"><Smartphone className="w-4 h-4"/> Device</span>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center text-xs ${tech.battery < 20 ? 'text-rose-400' : 'text-slate-400'}`}><Battery className="w-3 h-3 mr-1"/> {tech.battery}%</span>
                  <span className="flex items-center text-xs text-slate-400"><Signal className="w-3 h-3 mr-1"/> {tech.signal}/4</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4"/> Last Seen</span>
                <span className="text-slate-300 text-xs">{tech.lastSeen}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {tech.skills.map((skill: string) => (
                <span key={skill} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  {skill}
                </span>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-800 flex gap-2">
              <button className="flex-1 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs font-medium transition-colors">
                Assign Job
              </button>
              <button className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Utility icons
function MinusIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

function ScanLineIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
      <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
      <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
      <line x1="7" y1="12" x2="17" y2="12"></line>
    </svg>
  );
}
