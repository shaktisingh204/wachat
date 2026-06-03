"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle, CheckCircle, Clock, Activity, Database, Server,
  HardDrive, Users, Settings, Search, Filter, MoreVertical, Plus,
  ChevronDown, Calendar, Paperclip, Shield, Zap, TrendingUp, BarChart,
  GitBranch, GitCommit, Network, FileText, Layers, LifeBuoy,
  MessageSquare, Cpu, ArrowRight, X, Play, RefreshCw, Smartphone,
  Monitor, Wifi, Lock, Box, Briefcase, Mail
} from 'lucide-react';

// --- TYPES ---
type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
type Status = 'New' | 'In Progress' | 'Pending CAB' | 'Approved' | 'Resolved' | 'Closed';

interface Incident {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  assignee: string;
  created: string;
  sla: number; // percentage
  category: string;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  status: 'Operational' | 'Degraded' | 'Down' | 'Maintenance';
  ip: string;
  location: string;
  owner: string;
}

interface CabRequest {
  id: string;
  title: string;
  risk: Priority;
  requester: string;
  date: string;
  status: 'Planning' | 'Awaiting Approval' | 'Approved' | 'Implemented';
  impact: string;
}

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  sla: string;
  icon: React.ElementType;
}

// --- MOCK DATA ---
const MOCK_INCIDENTS: Incident[] = Array.from({ length: 45 }).map((_, i) => ({
  id: `INC-${1000 + i}`,
  title: [
    'Database connection timeout in production',
    'Email server rejecting attachments',
    'Cannot access VPN from branch office',
    'Application crashes on startup',
    'UI rendering issue in dashboard',
    'Payment gateway latency spike',
    'User unable to reset password',
    'High CPU usage on Node 4',
  ][i % 8] + ` (Report ${i + 1})`,
  priority: ['Critical', 'High', 'Medium', 'Low'][i % 4] as Priority,
  status: ['New', 'In Progress', 'Resolved', 'Closed'][i % 4] as Status,
  assignee: ['Alex Mercer', 'Sarah Chen', 'John Doe', 'Emma Watson', 'Unassigned'][i % 5],
  created: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
  sla: Math.floor(Math.random() * 100),
  category: ['Network', 'Software', 'Hardware', 'Access'][i % 4],
}));

const MOCK_ASSETS: Asset[] = Array.from({ length: 30 }).map((_, i) => ({
  id: `AST-${5000 + i}`,
  name: `prod-server-0${i + 1}`,
  type: ['Virtual Machine', 'Physical Server', 'Router', 'Switch', 'Database'][i % 5],
  status: ['Operational', 'Operational', 'Operational', 'Degraded', 'Down', 'Maintenance'][i % 6] as any,
  ip: `192.168.1.${10 + i}`,
  location: ['US-East-1', 'EU-West-2', 'AP-South-1'][i % 3],
  owner: ['Infrastructure Team', 'DBA Team', 'Network Team'][i % 3],
}));

const MOCK_CAB: CabRequest[] = [
  { id: 'CHG-901', title: 'Upgrade Core Router Firmware', risk: 'High', requester: 'Network Eng.', date: '2026-06-05', status: 'Awaiting Approval', impact: 'Entire Office Network' },
  { id: 'CHG-902', title: 'Migrate DB to new Cluster', risk: 'Critical', requester: 'DBA Team', date: '2026-06-08', status: 'Planning', impact: 'Production App Downtime' },
  { id: 'CHG-903', title: 'Deploy New HR Portal', risk: 'Medium', requester: 'HR IT', date: '2026-06-10', status: 'Approved', impact: 'Internal HR Systems' },
  { id: 'CHG-904', title: 'Weekly OS Patching', risk: 'Low', requester: 'SecOps', date: '2026-06-04', status: 'Implemented', impact: 'Minimal (Rolling)' },
  { id: 'CHG-905', title: 'Firewall Rule Update', risk: 'High', requester: 'Security', date: '2026-06-06', status: 'Awaiting Approval', impact: 'External Traffic Routing' },
];

const MOCK_SERVICES: ServiceItem[] = [
  { id: 'SRV-1', title: 'New Employee Onboarding', description: 'Provision accounts, hardware, and access for new hires.', category: 'HR / Admin', sla: '2 Days', icon: Users },
  { id: 'SRV-2', title: 'Software License Request', description: 'Request licenses for Adobe, Office365, JetBrains, etc.', category: 'Software', sla: '4 Hours', icon: Box },
  { id: 'SRV-3', title: 'Hardware Request', description: 'Request new laptops, monitors, or peripherals.', category: 'Hardware', sla: '3 Days', icon: Monitor },
  { id: 'SRV-4', title: 'VPN Access', description: 'Request or troubleshoot VPN connectivity.', category: 'Network', sla: '2 Hours', icon: Shield },
  { id: 'SRV-5', title: 'Password Reset', description: 'Emergency password reset for AD or internal systems.', category: 'Access', sla: '15 Mins', icon: Lock },
  { id: 'SRV-6', title: 'Cloud Resource Provisioning', description: 'Request AWS/Azure VMs, Buckets, or DB instances.', category: 'Infrastructure', sla: '1 Day', icon: Server },
  { id: 'SRV-7', title: 'Mobile Device Management', description: 'Enroll a new mobile device to corporate MDM.', category: 'Hardware', sla: '4 Hours', icon: Smartphone },
  { id: 'SRV-8', title: 'Distribution List Update', description: 'Create or modify email distribution lists.', category: 'Software', sla: '1 Hour', icon: Mail },
];

// --- UTILS ---
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
    case 'High': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    case 'Medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 'Low': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'New': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'In Progress': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    case 'Pending CAB': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    case 'Approved': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'Resolved': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'Closed': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    case 'Operational': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'Degraded': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 'Down': return 'text-red-400 bg-red-400/10 border-red-400/20';
    case 'Maintenance': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
};

// --- COMPONENTS ---

// 1. Dashboard Tab
const DashboardOverview = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Incidents', value: '142', trend: '+12%', icon: AlertCircle, color: 'text-rose-400' },
          { label: 'SLA Breach Risk', value: '18', trend: '-5%', icon: Clock, color: 'text-amber-400' },
          { label: 'Pending CAB', value: '7', trend: '+2', icon: Shield, color: 'text-purple-400' },
          { label: 'System Uptime', value: '99.98%', trend: 'Stable', icon: Activity, color: 'text-emerald-400' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl bg-white/[0.03] border border-white/5 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/[0.03] text-slate-400 border border-white/5">
                {stat.trend}
              </span>
            </div>
            <h3 className="text-3xl font-light text-white mb-1">{stat.value}</h3>
            <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Complex Layout Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart Mock */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Incident Volume Trends
            </h3>
            <select className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Quarter</option>
            </select>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {Array.from({ length: 14 }).map((_, i) => {
              const height1 = 20 + Math.random() * 60;
              const height2 = 10 + Math.random() * 40;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end gap-1 group relative">
                  <div 
                    className="w-full bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-t-sm transition-all"
                    style={{ height: `${height1}%` }}
                  />
                  <div 
                    className="w-full bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 rounded-t-sm transition-all"
                    style={{ height: `${height2}%` }}
                  />
                  {/* Tooltip mock */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black border border-white/10 px-3 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-xl">
                    Total: {Math.floor(height1 + height2)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-3 h-3 rounded-full bg-blue-500/50 border border-blue-500" /> Resolved
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-3 h-3 rounded-full bg-rose-500/50 border border-rose-500" /> New
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Critical Alerts
            </h3>
            <span className="bg-rose-500/10 text-rose-400 text-xs px-2 py-1 rounded-full border border-rose-500/20">
              3 Action Required
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors cursor-pointer group">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-mono text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">CRIT-{100+i}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {10 + i * 5}m ago
                  </span>
                </div>
                <p className="text-sm text-slate-200 font-medium group-hover:text-blue-400 transition-colors">
                  {['Core DB Replication Lag', 'Payment API Gateway 502s', 'High memory on k8s-node-03', 'Authentication Service Timeout', 'BGP Route Flap detected'][i]}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border border-black" />
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 border border-black" />
                  </div>
                  <button className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                    Investigate <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. Incident Management Tab
const IncidentManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden flex flex-col h-[calc(100vh-160px)] animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-black/20">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search incidents, CIs, or users..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <button className="p-2 bg-white/[0.03] border border-white/10 rounded-lg hover:bg-white/[0.08] transition-colors text-slate-400 hover:text-white">
            <Filter className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-lg hover:bg-white/[0.08] transition-colors text-sm font-medium text-slate-200">
            Export CSV
          </button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-400/50 rounded-lg transition-colors text-sm font-medium text-white flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
            <Plus className="w-4 h-4" /> New Incident
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-black/40 sticky top-0 z-10 backdrop-blur-md border-b border-white/5">
            <tr>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/3">Title & Category</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Assignee</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">SLA</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {MOCK_INCIDENTS.map((inc) => (
              <tr key={inc.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <td className="p-4 text-sm font-mono text-slate-300">{inc.id}</td>
                <td className="p-4">
                  <p className="text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors line-clamp-1">{inc.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> {inc.category} • {inc.created}
                  </p>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColor(inc.priority)}`}>
                    {inc.priority}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center w-max gap-1.5 ${getStatusColor(inc.status)}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    {inc.status}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-300 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                    {inc.assignee !== 'Unassigned' ? inc.assignee.split(' ').map(n => n[0]).join('') : '?'}
                  </div>
                  {inc.assignee}
                </td>
                <td className="p-4">
                  <div className="w-full max-w-[120px]">
                    <div className="flex justify-between text-xs mb-1">
                      <span className={inc.sla > 90 ? 'text-rose-400' : 'text-slate-400'}>{inc.sla}% consumed</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full rounded-full ${inc.sla > 90 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : inc.sla > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${inc.sla}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors opacity-0 group-hover:opacity-100">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
        <span className="text-sm text-slate-500">Showing 1 to 15 of 45 entries</span>
        <div className="flex items-center gap-1">
          <button className="px-3 py-1 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] text-sm text-slate-400 disabled:opacity-50">Prev</button>
          <button className="px-3 py-1 bg-blue-600 border border-blue-500 rounded-md text-sm text-white">1</button>
          <button className="px-3 py-1 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] text-sm text-slate-400">2</button>
          <button className="px-3 py-1 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] text-sm text-slate-400">3</button>
          <button className="px-3 py-1 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] text-sm text-slate-400">Next</button>
        </div>
      </div>
    </div>
  );
};

// 3. CAB Approval Board (Kanban)
const CABBoard = () => {
  const columns = ['Planning', 'Awaiting Approval', 'Approved', 'Implemented'];
  
  return (
    <div className="h-[calc(100vh-160px)] flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-white mb-1">Change Advisory Board (CAB)</h2>
          <p className="text-sm text-slate-400">Manage, review, and approve infrastructure and software changes.</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-400/50 rounded-lg transition-colors text-sm font-medium text-white flex items-center gap-2">
          <GitCommit className="w-4 h-4" /> Request Change
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
        {columns.map((col) => (
          <div key={col} className="min-w-[320px] w-[320px] flex flex-col bg-white/[0.01] border border-white/5 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="font-medium text-slate-200">{col}</h3>
              <span className="text-xs font-mono bg-white/[0.05] px-2 py-1 rounded-md text-slate-400 border border-white/10">
                {MOCK_CAB.filter(c => c.status === col).length}
              </span>
            </div>
            
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
              {MOCK_CAB.filter(c => c.status === col).map(request => (
                <div key={request.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-blue-500/50 transition-all cursor-grab active:cursor-grabbing hover:shadow-[0_0_15px_rgba(37,99,235,0.1)] group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-blue-400">{request.id}</span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getPriorityColor(request.risk)}`}>
                      {request.risk} RISK
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-200 mb-2 leading-snug group-hover:text-blue-300 transition-colors">{request.title}</h4>
                  
                  <div className="space-y-2 mt-4 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{request.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      <span>{request.requester}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
                      <span className="line-clamp-2">{request.impact}</span>
                    </div>
                  </div>
                  
                  {col === 'Awaiting Approval' && (
                    <div className="mt-4 flex gap-2 pt-4 border-t border-white/5">
                      <button className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded border border-emerald-500/20 transition-colors">Approve</button>
                      <button className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium rounded border border-rose-500/20 transition-colors">Reject</button>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Drop Zone Indicator */}
              <div className="h-24 rounded-xl border-2 border-dashed border-white/5 bg-white/[0.01] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-xs text-slate-500">Drop here</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 4. CMDB / Asset Graph View (Mock)
const CMDBGraph = () => {
  return (
    <div className="h-[calc(100vh-160px)] flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-white mb-1">Configuration Management (CMDB)</h2>
          <p className="text-sm text-slate-400">Visualize relationships between services, servers, and applications.</p>
        </div>
        <div className="flex bg-white/[0.03] p-1 rounded-lg border border-white/10">
          <button className="px-3 py-1.5 bg-white/10 rounded-md text-sm text-white shadow">Graph View</button>
          <button className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors">List View</button>
        </div>
      </div>

      <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl relative overflow-hidden flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:24px_24px]">
        {/* Pseudo Graph UI */}
        
        {/* Core Router */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center relative cursor-pointer hover:border-blue-400 transition-colors group">
            <Network className="w-8 h-8 text-blue-400" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" />
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 w-48 bg-slate-900 border border-white/10 rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-left shadow-xl">
              <h4 className="text-sm font-medium text-white">Core-Router-US1</h4>
              <p className="text-xs text-slate-400 mt-1">Status: Operational<br/>IP: 10.0.0.1</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm border border-white/5">Core Network</span>
        </div>

        {/* Load Balancer */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center relative cursor-pointer hover:border-amber-400 transition-colors group">
            <Layers className="w-7 h-7 text-amber-400" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-900 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
          </div>
          <span className="text-xs font-medium text-slate-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm border border-white/5">Prod-LB-01</span>
        </div>

        {/* App Servers */}
        {[-1, 0, 1].map((offset, idx) => (
          <div key={idx} className="absolute top-[70%] left-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10" style={{ transform: `translate(calc(-50% + ${offset * 150}px), -50%)` }}>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center relative cursor-pointer transition-colors group hover:border-${offset === 0 ? 'rose' : 'blue'}-400`}>
              <Server className={`w-6 h-6 text-${offset === 0 ? 'rose' : 'slate'}-400`} />
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${offset === 0 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'bg-emerald-400'}`} />
            </div>
            <span className="text-xs font-medium text-slate-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm border border-white/5">App-Node-0{idx+1}</span>
            {offset === 0 && (
              <div className="absolute top-full mt-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] px-2 py-1 rounded-md whitespace-nowrap">
                INC-1004 Active
              </div>
            )}
          </div>
        ))}

        {/* SVG Connecting Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
          <path d="M 50% 25% L 50% 50%" stroke="currentColor" className="text-blue-500" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M 50% 50% L 35% 70%" stroke="currentColor" className="text-slate-400" strokeWidth="2" />
          <path d="M 50% 50% L 50% 70%" stroke="currentColor" className="text-rose-500" strokeWidth="2" />
          <path d="M 50% 50% L 65% 70%" stroke="currentColor" className="text-slate-400" strokeWidth="2" />
        </svg>
        
        {/* Floating details panel */}
        <div className="absolute right-6 top-6 w-80 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
          <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" /> View Controls
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Depth Level</label>
              <input type="range" className="w-full accent-blue-500" min="1" max="5" defaultValue="3" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Filter CIs</label>
              <select className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option>All Types</option>
                <option>Hardware</option>
                <option>Software</option>
                <option>Network</option>
              </select>
            </div>
            <div className="pt-4 border-t border-white/5 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" defaultChecked className="rounded border-white/20 bg-black/50 accent-blue-500" /> Show Incidents
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" className="rounded border-white/20 bg-black/50 accent-blue-500" /> Show Changes
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. Service Catalog Tab
const ServiceCatalog = () => {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Header Search */}
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-white/5 rounded-2xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-3xl" />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-light text-white mb-4">How can we help you today?</h2>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search for services, software, or access..." 
              className="w-full bg-black/60 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white text-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xl"
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="text-sm text-slate-400">Popular:</span>
            {['VPN Access', 'New Laptop', 'Adobe CC', 'Password Reset'].map(tag => (
              <button key={tag} className="text-sm text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Catalog Categories */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Categories</h3>
          {['All Services', 'Hardware', 'Software', 'Network & Access', 'HR & Admin', 'Infrastructure'].map((cat, i) => (
            <button key={cat} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${i === 0 ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-white/[0.05]'}`}>
              {cat}
            </button>
          ))}
          
          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4">
              <LifeBuoy className="w-6 h-6 text-indigo-400 mb-2" />
              <h4 className="text-sm font-medium text-white mb-1">Need something else?</h4>
              <p className="text-xs text-slate-400 mb-3">If you can't find what you're looking for, submit a general request.</p>
              <button className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20">
                Submit Generic Ticket
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="md:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MOCK_SERVICES.map((service) => (
            <div key={service.id} className="bg-white/[0.02] border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 transition-all group cursor-pointer hover:bg-white/[0.04]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform shadow-lg">
                  <service.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-medium text-slate-200 group-hover:text-blue-400 transition-colors mb-1">{service.title}</h4>
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5">
                      SLA: {service.sla}
                    </span>
                    <button className="text-sm text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Request <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


// --- MAIN PAGE COMPONENT ---
export default function SabDeskITSM() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'incidents' | 'cab' | 'cmdb' | 'catalog'>('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart },
    { id: 'incidents', label: 'Incidents & Problems', icon: AlertCircle },
    { id: 'cab', label: 'CAB & Changes', icon: GitBranch },
    { id: 'cmdb', label: 'CMDB Assets', icon: Database },
    { id: 'catalog', label: 'Service Catalog', icon: FileText },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Top Navbar / Header area */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-2xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">SabDesk ITSM</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">ENTERPRISE SERVICE MANAGEMENT</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center bg-black/50 border border-white/10 rounded-full px-4 py-1.5 gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-xs font-medium text-slate-300">System Normal</span>
          </div>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative">
            <AlertCircle className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/20 flex items-center justify-center font-bold text-sm text-white cursor-pointer hover:border-blue-500 transition-colors">
            JS
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">
        
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar border-b border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap relative ${
                activeTab === tab.id 
                  ? 'text-blue-400 bg-blue-500/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_-2px_10px_rgba(59,130,246,0.5)]" />
              )}
            </button>
          ))}
        </nav>

        {/* Tab Content Render */}
        <div className="relative">
          {activeTab === 'dashboard' && <DashboardOverview />}
          {activeTab === 'incidents' && <IncidentManagement />}
          {activeTab === 'cab' && <CABBoard />}
          {activeTab === 'cmdb' && <CMDBGraph />}
          {activeTab === 'catalog' && <ServiceCatalog />}
        </div>
      </main>

      {/* Global Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}
