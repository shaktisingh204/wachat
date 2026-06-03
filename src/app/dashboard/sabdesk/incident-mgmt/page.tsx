'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, Activity, Video, MessageSquare, FileText, CheckCircle, Clock,
  BarChart, Settings, Shield, Users, Layout, Plus, Search, Filter, MoreVertical,
  ChevronRight, ArrowRight, Edit2, Trash2, Eye, Link as LinkIcon, Server, Database,
  Globe, Terminal, Cpu, HardDrive, Cloud, Zap, Play, Pause, RefreshCw, Download,
  Upload, Save, X, Maximize2, Minimize2, Send, Paperclip, Smile, Hash, Phone,
  Mic, MicOff, VideoOff, PhoneOff, Share2, AlertCircle, AlertOctagon, Info,
  ChevronDown, ChevronUp, AlignLeft, Bold, Italic, Underline, List, ListOrdered,
  Link2, Image as ImageIcon, Code, Lock, Unlock, Mail, Bell, Calendar, HelpCircle,
  TrendingUp, TrendingDown, Command, Key, LifeBuoy, CheckSquare, GitPullRequest,
  Github, Slack, Trello, Layers
} from 'lucide-react';

// ============================================================================
// MOCK DATA
// ============================================================================

const SEVERITIES = ['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'];
const STATUSES = ['Investigating', 'Identified', 'Monitoring', 'Resolved', 'Closed'];
const SERVICES = ['API Gateway', 'Authentication', 'User Database', 'Payment Processor', 'Frontend Web', 'Worker Nodes', 'Search Cluster', 'CDN'];
const USERS = [
  { id: 'u1', name: 'Alice Smith', avatar: 'AS', role: 'Incident Commander' },
  { id: 'u2', name: 'Bob Jones', avatar: 'BJ', role: 'Lead Engineer' },
  { id: 'u3', name: 'Charlie Brown', avatar: 'CB', role: 'Communications' },
  { id: 'u4', name: 'Diana Prince', avatar: 'DP', role: 'SME - Database' },
  { id: 'u5', name: 'Evan Wright', avatar: 'EW', role: 'SME - Network' },
];

const generateIncidents = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `INC-${1000 + i}`,
    title: [
      'Database replication lag across US-East regions',
      'Payment gateway timeout for Stripe integration',
      'High latency in API responses > 500ms',
      'Rate Limiting Issues on public endpoints',
      'Frontend rendering error on checkout page',
      'Search cluster desync causing empty results',
      'Auth tokens expiring prematurely',
      'Worker node pool exhaustion',
    ][i % 8],
    severity: SEVERITIES[i % 4],
    status: STATUSES[i % 5],
    impactedServices: SERVICES.slice(0, (i % 4) + 1),
    assignee: USERS[i % USERS.length],
    createdAt: new Date(Date.now() - (i * 3600000 + Math.random() * 1000000)).toISOString(),
    updatedAt: new Date(Date.now() - (i * 1800000)).toISOString(),
    description: 'We are seeing an elevated error rate on the main endpoints. The issue started approximately 15 minutes ago. Initial investigation suggests a possible database connection pool exhaustion or network bottleneck. On-call has been paged.',
    tags: ['database', 'latency', 'customer-impacting'].slice(0, (i % 3) + 1),
  }));
};

const MOCK_INCIDENTS = generateIncidents(25);

const MOCK_MESSAGES = [
  { id: 'm1', user: USERS[0], text: 'I am opening the war room now. Let\'s get everyone in here.', timestamp: '10:00 AM' },
  { id: 'm2', user: USERS[1], text: 'Looking at the Datadog dashboard. DB CPU is at 99%.', timestamp: '10:02 AM' },
  { id: 'm3', user: USERS[2], text: 'Should I update the public status page to "Degraded"?', timestamp: '10:03 AM' },
  { id: 'm4', user: USERS[0], text: 'Yes, go ahead. Mark API and Payments as degraded.', timestamp: '10:04 AM' },
  { id: 'm5', user: USERS[3], text: 'I\'m running a query analyzer. Give me a minute.', timestamp: '10:05 AM' },
  { id: 'm6', user: USERS[1], text: 'It looks like the new index rollout caused a regression on the transactions table.', timestamp: '10:08 AM' },
  { id: 'm7', user: USERS[0], text: 'Can we rollback the migration safely?', timestamp: '10:10 AM' },
];

const MOCK_TIMELINE = [
  { id: 't1', type: 'alert', title: 'High CPU Alert - DB Cluster', time: '09:45 AM', user: 'System' },
  { id: 't2', type: 'incident', title: 'Incident INC-1024 Created', time: '09:50 AM', user: 'PagerDuty' },
  { id: 't3', type: 'status', title: 'Status changed to Investigating', time: '09:55 AM', user: 'Alice Smith' },
  { id: 't4', type: 'chat', title: 'War Room Opened', time: '10:00 AM', user: 'Alice Smith' },
  { id: 't5', type: 'commit', title: 'Revert "Add composite index to tx table"', time: '10:15 AM', user: 'Bob Jones' },
  { id: 't6', type: 'status', title: 'Status changed to Monitoring', time: '10:30 AM', user: 'Alice Smith' },
];

const MOCK_RCAS = [
  { id: 'RCA-001', incidentId: 'INC-1024', title: 'Database Outage - Oct 12', lead: USERS[0].name, status: 'Draft', publishedDate: null },
  { id: 'RCA-002', incidentId: 'INC-0992', title: 'Stripe API Failures', lead: USERS[1].name, status: 'Review', publishedDate: null },
  { id: 'RCA-003', incidentId: 'INC-0950', title: 'Frontend CSS Regression', lead: USERS[2].name, status: 'Published', publishedDate: '2026-05-20' },
];

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

const Badge = ({ children, color = 'blue', className = '' }: any) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    gray: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color]} ${className}`}>
      {children}
    </span>
  );
};

const getSeverityColor = (sev: string) => {
  switch (sev) {
    case 'SEV-1': return 'red';
    case 'SEV-2': return 'orange';
    case 'SEV-3': return 'yellow';
    case 'SEV-4': return 'blue';
    default: return 'gray';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Investigating': return 'red';
    case 'Identified': return 'yellow';
    case 'Monitoring': return 'blue';
    case 'Resolved': return 'green';
    case 'Closed': return 'gray';
    default: return 'gray';
  }
};

const Button = ({ children, variant = 'primary', size = 'md', className = '', icon, ...props }: any) => {
  const base = 'inline-flex items-center justify-center font-medium transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-indigo-500';
  const variants: Record<string, string> = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost: 'hover:bg-slate-800 text-slate-400 hover:text-slate-200',
    outline: 'border border-slate-600 hover:bg-slate-800 text-slate-300',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2',
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {icon && <span className={children ? 'mr-2' : ''}>{icon}</span>}
      {children}
    </button>
  );
};

const Card = ({ children, className = '', noPadding = false }: any) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm ${className}`}>
    {!noPadding ? <div className="p-5">{children}</div> : children}
  </div>
);

const Input = ({ icon, className = '', ...props }: any) => (
  <div className={`relative ${className}`}>
    {icon && (
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
        {icon}
      </div>
    )}
    <input
      className={`block w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2`}
      {...props}
    />
  </div>
);

// ============================================================================
// SUB-VIEWS (TABS)
// ============================================================================

// --- 1. OVERVIEW DASHBOARD ---
const OverviewDashboard = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Incident Overview</h2>
          <p className="text-sm text-slate-400 mt-1">Real-time metrics and active incidents across your infrastructure.</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" icon={<Download size={16} />}>Export Report</Button>
          <Button variant="primary" icon={<Plus size={16} />}>Declare Incident</Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Incidents', value: '3', trend: '+1 from yesterday', color: 'text-red-400', bg: 'bg-red-500/10', icon: <AlertTriangle /> },
          { label: 'MTTA (7d)', value: '4m 12s', trend: '-12% improvement', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <Clock /> },
          { label: 'MTTR (7d)', value: '42m 30s', trend: '+5% regression', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: <Activity /> },
          { label: 'Uptime (30d)', value: '99.98%', trend: 'On track for SLA', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <Shield /> },
        ].map((metric, i) => (
          <Card key={i} className="relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">{metric.label}</p>
                <p className="text-3xl font-bold text-white mt-2 tracking-tight">{metric.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${metric.bg} ${metric.color}`}>
                {metric.icon}
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-500">
              <TrendingDown size={14} className="mr-1" />
              {metric.trend}
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-800">
              <div className={`h-full ${metric.bg.replace('/10', '')} w-2/3 group-hover:w-full transition-all duration-500`} />
            </div>
          </Card>
        ))}
      </div>

      {/* CHARTS AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 lg:col-span-2 min-h-[300px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-white">Incident Volume (30 Days)</h3>
            <select className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-1.5 focus:ring-indigo-500">
              <option>Daily</option>
              <option>Weekly</option>
            </select>
          </div>
          <div className="flex-1 w-full bg-slate-950/50 rounded-lg border border-slate-800/50 flex items-end p-4 space-x-2 relative">
            {/* FAKE BAR CHART */}
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end group">
                <div className="relative w-full">
                  <div
                    className="w-full bg-indigo-500/80 hover:bg-indigo-400 rounded-t-sm transition-all"
                    style={ height: `${Math.max(10, Math.random() * 100)}px` }
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-xs text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    Day {i + 1}: {Math.floor(Math.random() * 5)} incidents
                  </div>
                </div>
              </div>
            ))}
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none border-t border-slate-800 top-[25%]" />
            <div className="absolute inset-0 pointer-events-none border-t border-slate-800 top-[50%]" />
            <div className="absolute inset-0 pointer-events-none border-t border-slate-800 top-[75%]" />
          </div>
        </Card>

        <Card className="col-span-1 min-h-[300px]">
          <h3 className="text-base font-semibold text-white mb-6">Incidents by Service</h3>
          <div className="space-y-4">
            {[
              { name: 'API Gateway', val: 45, color: 'bg-indigo-500' },
              { name: 'Payment Processor', val: 30, color: 'bg-blue-500' },
              { name: 'User Database', val: 15, color: 'bg-emerald-500' },
              { name: 'Worker Nodes', val: 10, color: 'bg-slate-500' },
            ].map((s, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{s.name}</span>
                  <span className="text-slate-400 font-mono">{s.val}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2">
                  <div className={`${s.color} h-2 rounded-full`} style={ w: `${s.val}%`, width: `${s.val}%` }></div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">On-Call Right Now</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                  AS
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Alice Smith</p>
                  <p className="text-xs text-slate-400">Primary • Tier 1</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" icon={<Phone size={16} />} />
            </div>
          </div>
        </Card>
      </div>

      {/* RECENT INCIDENTS TABLE */}
      <Card noPadding className="flex flex-col">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-base font-semibold text-white">Active & Recent Incidents</h3>
          <div className="flex items-center space-x-2">
            <Input icon={<Search size={16} />} placeholder="Search incidents..." className="w-64" />
            <Button variant="outline" icon={<Filter size={16} />}>Filter</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                <th className="p-4 font-medium">Incident ID</th>
                <th className="p-4 font-medium">Title</th>
                <th className="p-4 font-medium">Severity</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Assignee</th>
                <th className="p-4 font-medium">Created</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {MOCK_INCIDENTS.slice(0, 10).map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="p-4 font-mono text-sm text-indigo-400 group-hover:text-indigo-300 cursor-pointer">{inc.id}</td>
                  <td className="p-4">
                    <p className="text-sm font-medium text-white">{inc.title}</p>
                    <div className="flex gap-1 mt-1">
                      {inc.impactedServices.map(s => (
                        <span key={s} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge color={getSeverityColor(inc.severity)}>{inc.severity}</Badge>
                  </td>
                  <td className="p-4">
                    <Badge color={getStatusColor(inc.status)} className="flex w-fit items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full bg-current ${inc.status === 'Investigating' ? 'animate-pulse' : ''}`} />
                      {inc.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-medium">
                        {inc.assignee.avatar}
                      </div>
                      <span className="text-sm text-slate-300">{inc.assignee.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-400 whitespace-nowrap">
                    {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="icon" icon={<ChevronRight size={18} />} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-center">
          <Button variant="ghost" className="text-sm">View All Incidents</Button>
        </div>
      </Card>
    </div>
  );
};

// --- 2. WAR ROOM ---
const WarRoom = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [message, setMessage] = useState('');
  
  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
      
      {/* LEFT PANEL: Channels & Incidents */}
      <div className="w-64 border-r border-slate-800 flex flex-col bg-slate-900/80">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold">
            <RadioWaveIcon /> Active War Rooms
          </div>
          <Button variant="ghost" size="icon" icon={<Plus size={16} />} />
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">SEV-1 & SEV-2</div>
          <div className="space-y-0.5 px-2">
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-500/10 text-indigo-400 rounded-lg group">
              <Hash size={16} className="opacity-70 group-hover:opacity-100" />
              <span className="text-sm font-medium truncate">inc-1024-db-outage</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg group transition-colors">
              <Hash size={16} className="opacity-70 group-hover:opacity-100" />
              <span className="text-sm font-medium truncate">inc-1025-stripe-fail</span>
            </button>
          </div>
          
          <div className="px-3 mt-6 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Investigating</div>
          <div className="space-y-0.5 px-2">
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors">
              <Hash size={16} className="opacity-70" />
              <span className="text-sm font-medium truncate">inc-1027-latency</span>
            </button>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">ME</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">You (Commander)</p>
              <p className="text-xs text-emerald-400">Online</p>
            </div>
            <Button variant="ghost" size="icon" icon={<Settings size={16} />} />
          </div>
        </div>
      </div>

      {/* MIDDLE PANEL: Chat / Timeline */}
      <div className="flex-1 flex flex-col bg-slate-950 relative">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Hash size={20} className="text-indigo-400" />
              inc-1024-db-outage
              <Badge color="red" className="ml-2">SEV-1</Badge>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Database replication lag across US-East regions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<Users size={14} />}>12 Participants</Button>
            <div className="h-6 w-px bg-slate-700 mx-2"></div>
            <Button variant="primary" size="sm" icon={<Phone size={14} />}>Join Bridge</Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="text-center">
            <div className="inline-block bg-slate-800 text-slate-400 text-xs px-3 py-1 rounded-full mb-4">Today</div>
          </div>
          
          {MOCK_MESSAGES.map((msg, idx) => {
            const isMe = msg.user.id === 'u1';
            return (
              <div key={msg.id} className={`flex gap-4 max-w-3xl ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white shadow-sm ${isMe ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                  {msg.user.avatar}
                </div>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-200">{msg.user.name}</span>
                    <span className="text-xs text-slate-500">{msg.timestamp}</span>
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}
          
          <div className="flex items-center gap-4 max-w-3xl mx-auto my-8">
            <div className="flex-1 h-px bg-slate-800"></div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 border border-slate-800 rounded-full px-3 py-1 bg-slate-900">
              <Activity size={12} className="text-yellow-400" /> Status changed to Investigating
            </div>
            <div className="flex-1 h-px bg-slate-800"></div>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="flex items-end gap-2 bg-slate-950 border border-slate-700 rounded-xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            <div className="flex flex-col justify-end gap-1 pb-1 pl-1">
              <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Paperclip size={18} />
              </button>
            </div>
            <textarea
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 resize-none outline-none max-h-32 min-h-[40px] py-2 px-2"
              placeholder="Message #inc-1024-db-outage..."
              rows={1}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex flex-col justify-end gap-1 pb-1 pr-1">
              <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Smile size={18} />
              </button>
            </div>
            <Button variant="primary" size="icon" className="rounded-lg h-10 w-10 flex-shrink-0" icon={<Send size={16} className="ml-1" />} />
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Incident Metadata & Actions */}
      <div className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col hidden lg:flex">
        <div className="flex border-b border-slate-800">
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'actions' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
            onClick={() => setActiveTab('actions')}
          >
            Actions
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'details' ? (
            <>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Impacted Services</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge color="blue" className="px-3 py-1 text-sm bg-slate-800 border-slate-700"><Database size={12} className="inline mr-1" /> Primary DB</Badge>
                  <Badge color="blue" className="px-3 py-1 text-sm bg-slate-800 border-slate-700"><Server size={12} className="inline mr-1" /> API Gateway</Badge>
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Key Roles</h4>
                <div className="space-y-3">
                  {[
                    { role: 'Commander', user: USERS[0] },
                    { role: 'Comms', user: USERS[2] },
                    { role: 'Operations', user: USERS[1] },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white">
                          {r.user.avatar}
                        </div>
                        <span className="text-sm text-slate-300">{r.user.name}</span>
                      </div>
                      <Badge color="gray">{r.role}</Badge>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full mt-2" icon={<Plus size={14} />}>Assign Role</Button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Linked Resources</h4>
                <div className="space-y-2">
                  <a href="#" className="flex items-center justify-between p-2 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <BarChart size={14} className="text-blue-400" />
                      Datadog: DB Metrics
                    </div>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400" />
                  </a>
                  <a href="#" className="flex items-center justify-between p-2 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Terminal size={14} className="text-green-400" />
                      Runbook: DB Failover
                    </div>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Button variant="secondary" className="w-full justify-start" icon={<Activity size={16} className="text-yellow-400" />}>Update Status</Button>
              <Button variant="secondary" className="w-full justify-start" icon={<AlertTriangle size={16} className="text-red-400" />}>Escalate Severity</Button>
              <Button variant="secondary" className="w-full justify-start" icon={<Globe size={16} className="text-blue-400" />}>Update Public Status Page</Button>
              <Button variant="secondary" className="w-full justify-start" icon={<FileText size={16} className="text-emerald-400" />}>Generate Summary Draft</Button>
              
              <div className="pt-6 mt-6 border-t border-slate-800">
                <Button variant="danger" className="w-full" icon={<CheckCircle size={16} />}>Resolve Incident</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 3. STATUS PAGE BUILDER ---
const StatusPageBuilder = () => {
  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Configuration Sidebar */}
      <div className="w-80 flex flex-col gap-4">
        <Card noPadding className="flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <h3 className="font-semibold text-white">Status Page Settings</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Page Title</label>
              <Input defaultValue="SabDesk System Status" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Company Logo URL</label>
              <div className="flex gap-2">
                <Input defaultValue="https://cdn.sabdesk.com/logo.png" className="flex-1" />
                <Button variant="outline" size="icon" icon={<Upload size={16} />} />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-sm font-medium text-white mb-3">Service Components</h4>
              <div className="space-y-2">
                {SERVICES.map(s => (
                  <div key={s} className="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-lg cursor-grab hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-2">
                      <ListOrdered size={14} className="text-slate-600" />
                      <span className="text-sm text-slate-300">{s}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" icon={<Settings size={12} />} />
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed mt-2" icon={<Plus size={14} />}>Add Component</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-slate-800 text-white shadow-sm">Desktop</button>
            <button className="px-3 py-1.5 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200 transition-colors">Mobile</button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" icon={<Eye size={16} />}>Preview</Button>
            <Button variant="primary" icon={<Globe size={16} />}>Publish Changes</Button>
          </div>
        </div>

        <Card noPadding className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden border-4 border-slate-800 rounded-2xl">
          {/* FAKE BROWSER CHROME */}
          <div className="h-10 bg-slate-200 border-b border-slate-300 flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="mx-auto bg-white px-32 py-1 text-xs text-slate-500 rounded-md shadow-sm border border-slate-200 flex items-center gap-2">
              <Lock size={10} /> status.sabdesk.com
            </div>
          </div>
          
          {/* FAKE STATUS PAGE CONTENT */}
          <div className="flex-1 overflow-y-auto bg-white text-slate-900 p-12">
            <div className="max-w-3xl mx-auto space-y-12">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-lg shadow-sm"></div>
                  <h1 className="text-2xl font-bold">SabDesk Status</h1>
                </div>
                <button className="text-sm font-medium text-indigo-600 hover:underline">Subscribe to Updates</button>
              </div>

              {/* Status Banner */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 shadow-sm flex items-start gap-4">
                <AlertTriangle className="text-yellow-600 mt-1" size={24} />
                <div>
                  <h2 className="text-lg font-bold text-yellow-900">Partial System Outage</h2>
                  <p className="text-yellow-800 mt-1">We are currently investigating reports of elevated error rates on our main Database cluster. Some users may experience latency or timeouts.</p>
                  <p className="text-xs text-yellow-600 mt-4 font-medium uppercase tracking-wider">Posted 15 mins ago</p>
                </div>
              </div>

              {/* Metrics (Simulated) */}
              <div>
                <h3 className="text-lg font-bold mb-4">System Metrics</h3>
                <div className="h-48 border border-slate-200 rounded-xl bg-slate-50 p-4 flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-600">API Response Time</span>
                    <span className="text-sm font-bold text-emerald-600">45ms</span>
                  </div>
                  <div className="flex-1 flex items-end gap-1">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div key={i} className="flex-1 bg-indigo-200 hover:bg-indigo-300 rounded-t-sm" style={ height: `${20 + Math.random() * (i > 30 ? 60 : 30)}%` }></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Component Status */}
              <div>
                <h3 className="text-lg font-bold mb-4">Core Services</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                  {SERVICES.slice(0, 5).map((s, i) => {
                    const isDegraded = i === 2;
                    return (
                      <div key={s} className="p-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                        <span className="font-medium text-slate-700">{s}</span>
                        {isDegraded ? (
                          <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full text-sm font-medium border border-yellow-200">
                            <AlertCircle size={16} /> Degraded Performance
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                            <CheckCircle size={16} /> Operational
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
          
          {/* Builder Overlay (Simulates dragging/hovering) */}
          <div className="absolute inset-0 pointer-events-none border-4 border-indigo-500/0 hover:border-indigo-500/20 transition-all z-20"></div>
        </Card>
      </div>
    </div>
  );
};

// --- 4. RCA POST-MORTEM EDITOR ---
const RCAPostMortemEditor = () => {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">RCA: Database Outage - Oct 12</h2>
            <Badge color="yellow">Draft</Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">Incident: <a href="#" className="text-indigo-400 hover:underline">INC-1024</a> • Lead: Alice Smith</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" icon={<Save size={16} />}>Save Draft</Button>
          <Button variant="primary" icon={<Send size={16} />}>Submit for Review</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          
          <Card noPadding className="flex flex-col h-[500px]">
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-wrap gap-1">
              {/* FAKE RICH TEXT TOOLBAR */}
              {[
                <AlignLeft size={16}/>, <Bold size={16}/>, <Italic size={16}/>, <Underline size={16}/>, 
                <span className="w-px h-4 bg-slate-700 mx-1"></span>,
                <List size={16}/>, <ListOrdered size={16}/>,
                <span className="w-px h-4 bg-slate-700 mx-1"></span>,
                <Link2 size={16}/>, <ImageIcon size={16}/>, <Code size={16}/>
              ].map((icon, i) => (
                <button key={i} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors flex items-center justify-center">
                  {icon}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-slate-500">Last saved 2 mins ago</span>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950 prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-white">
              <h3>Executive Summary</h3>
              <p>On October 12, 2026, a configuration change to the primary database cluster in US-East caused severe replication lag across read replicas. This resulted in stale data being served to frontend clients and timeout errors on the Payment Gateway integration.</p>
              
              <h3>Impact</h3>
              <ul>
                <li><strong>Duration:</strong> 42 minutes</li>
                <li><strong>Affected Users:</strong> Approximately 15% of active sessions in US region.</li>
                <li><strong>Revenue Impact:</strong> Estimated $4,500 in dropped transactions.</li>
              </ul>
              
              <h3>Root Cause</h3>
              <p>The root cause was identified as a missing composite index on the <code>transactions</code> table, which was dropped during a routine migration script execution. As a result, subsequent queries performed full table scans, locking rows and halting replication threads.</p>
              
              <div className="p-4 my-4 border border-slate-800 bg-slate-900 rounded-lg font-mono text-sm text-emerald-400">
                // Mitigation applied: <br/>
                CREATE INDEX idx_tx_status_date ON transactions(status, created_at);
              </div>
              
              <p>Following the creation of the index, replication lag recovered at a rate of 100MB/s, fully catching up within 15 minutes.</p>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-white mb-4">The "5 Whys"</h3>
            <div className="space-y-4">
              {[
                "Why did the database replication lag? Because queries on the primary node were extremely slow, causing a backlog in the replication log.",
                "Why were the queries slow? Because a critical composite index was missing on the transactions table, forcing full table scans.",
                "Why was the index missing? Because the database migration script V124_drop_old_tables.sql accidentally included a DROP INDEX command for an active index.",
                "Why was this script approved and merged? Because it bypassed the staging environment tests which normally catch performance regressions.",
                "Why did it bypass staging? Because it was marked as a 'hotfix' by a developer, which currently bypasses the automated staging pipeline."
              ].map((text, i) => (
                <div key={i} className="flex gap-4 items-start group">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <textarea 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      rows={2}
                      defaultValue={text}
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed" icon={<Plus size={16} />}>Add Another Why</Button>
            </div>
          </Card>

        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-bold text-white mb-4">Action Items</h3>
            <div className="space-y-3">
              {[
                { title: 'Update CI/CD pipeline to disallow hotfixes bypassing DB tests', owner: 'DevOps', status: 'In Progress' },
                { title: 'Add Datadog monitor for missing critical indexes', owner: 'DBA Team', status: 'To Do' },
                { title: 'Conduct training on migration best practices', owner: 'Alice S.', status: 'To Do' },
              ].map((item, i) => (
                <div key={i} className="p-3 border border-slate-800 rounded-lg bg-slate-950 hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-slate-200">{item.title}</p>
                    <button className="text-slate-500 hover:text-slate-300"><MoreVertical size={14} /></button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Users size={12} /> {item.owner}
                    </div>
                    <Badge color={item.status === 'In Progress' ? 'blue' : 'gray'}>{item.status}</Badge>
                  </div>
                </div>
              ))}
              <Button variant="secondary" className="w-full" icon={<Plus size={14} />}>Add Action Item</Button>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-white mb-4">Timeline Selection</h3>
            <p className="text-xs text-slate-400 mb-4">Select events from the incident timeline to include in the final RCA report.</p>
            
            <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
              {MOCK_TIMELINE.map((event, i) => (
                <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-2">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-800 bg-slate-900 text-slate-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10">
                    <input type="checkbox" className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950" defaultChecked={i % 2 === 0} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-lg border border-slate-800 bg-slate-900/50 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-bold text-indigo-400">{event.time}</div>
                    </div>
                    <div className="text-sm font-medium text-slate-200">{event.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- 5. DETAILED TIMELINE ---
const IncidentTimeline = () => {
  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-64 flex flex-col gap-4">
        <Card>
          <h3 className="font-semibold text-white mb-4">Filters</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Event Type</label>
              <div className="space-y-2">
                {['Alerts', 'Status Changes', 'Chat Messages', 'Commits/Deployments', 'Manual Entries'].map(f => (
                  <label key={f} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" defaultChecked className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer" />
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{f}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Time Range</label>
              <select className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm p-2 focus:ring-indigo-500">
                <option>All Time</option>
                <option>Last Hour</option>
                <option>Last 24 Hours</option>
                <option>Custom Range...</option>
              </select>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <Button variant="outline" className="w-full" icon={<Search size={14} />}>Search Logs</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex-1 overflow-y-auto relative p-8">
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-20">
          <h2 className="text-xl font-bold text-white">Incident Timeline</h2>
          <Button variant="primary" icon={<Plus size={16} />}>Add Manual Event</Button>
        </div>

        <div className="relative pl-8 sm:pl-32 py-6 group">
          {/* Vertical Line */}
          <div className="absolute top-0 bottom-0 left-8 sm:left-32 w-px bg-slate-800 transform -translate-x-1/2"></div>
          
          <div className="space-y-12">
            {[...MOCK_TIMELINE, ...MOCK_TIMELINE].map((event, i) => {
              
              let Icon = Activity;
              let color = 'bg-blue-500';
              if (event.type === 'alert') { Icon = AlertTriangle; color = 'bg-red-500'; }
              if (event.type === 'chat') { Icon = MessageSquare; color = 'bg-purple-500'; }
              if (event.type === 'commit') { Icon = Code; color = 'bg-emerald-500'; }
              
              return (
                <div key={i} className="relative group/item">
                  {/* Timestamp */}
                  <div className="absolute left-0 sm:-left-24 top-1 text-sm font-mono text-slate-500 sm:text-right w-20 hidden sm:block">
                    {event.time}
                  </div>
                  
                  {/* Node */}
                  <div className={`absolute left-0 sm:left-0 top-1 w-8 h-8 rounded-full border-4 border-slate-900 ${color} flex items-center justify-center transform -translate-x-1/2 shadow-lg z-10 group-hover/item:scale-110 transition-transform`}>
                    <Icon size={12} className="text-white" />
                  </div>
                  
                  {/* Content Card */}
                  <div className="pl-6 sm:pl-10">
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-sm hover:border-slate-700 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-base font-bold text-white">{event.title}</h4>
                        <button className="text-slate-500 hover:text-slate-300 opacity-0 group-hover/item:opacity-100 transition-opacity"><Edit2 size={14} /></button>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5"><Users size={14} /> {event.user}</span>
                        <span>•</span>
                        <span className="capitalize">{event.type} Source</span>
                      </div>
                      
                      {/* Conditional Extra Content based on type */}
                      {event.type === 'commit' && (
                        <div className="mt-3 bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
                          $ git revert HEAD~1 <br/>
                          [main 4f8b9d] Revert "Add composite index to tx table"<br/>
                          1 file changed, 1 insertion(+), 15 deletions(-)
                        </div>
                      )}
                      {event.type === 'alert' && (
                        <div className="mt-3 bg-red-950/30 p-3 rounded-lg border border-red-900/50 text-xs text-red-200">
                          <strong>Trigger:</strong> avg(last_5m):system.cpu.system{'{host:db-primary-east}'} {'>'} 95<br/>
                          <strong>Value:</strong> 99.4%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="absolute bottom-0 left-8 sm:left-32 w-4 h-4 rounded-full border-2 border-slate-800 bg-slate-900 transform -translate-x-1/2 translate-y-1/2"></div>
        </div>
      </Card>
    </div>
  );
};


// ============================================================================
// MAIN PAGE LAYOUT
// ============================================================================

const RadioWaveIcon = () => (
  <div className="relative flex h-3 w-3 mr-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
  </div>
);

export default function IncidentManagementPage() {
  const [activeView, setActiveView] = useState('overview');

  const navItems = [
    { id: 'overview', label: 'Overview Dashboard', icon: <Layout size={18} /> },
    { id: 'warroom', label: 'Active War Rooms', icon: <RadioWaveIcon /> },
    { id: 'statuspage', label: 'Status Pages', icon: <Globe size={18} /> },
    { id: 'rca', label: 'RCA & Post-Mortems', icon: <FileText size={18} /> },
    { id: 'timeline', label: 'Global Timeline', icon: <Clock size={18} /> },
    { id: 'settings', label: 'Settings & Routing', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 flex flex-col font-sans">
      
      {/* TOPBAR */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">SabDesk Incident Mgmt</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search incidents, logs (⌘K)" 
              className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-200 placeholder-slate-500"
            />
          </div>
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-950"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-indigo-400 cursor-pointer overflow-hidden">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-64 border-r border-slate-800 bg-slate-950/50 hidden md:flex flex-col py-6">
          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeView === item.id 
                    ? 'bg-indigo-600/10 text-indigo-400' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className={`${activeView === item.id ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {item.icon}
                </div>
                {item.label}
              </button>
            ))}
          </nav>
          
          <div className="px-6 mt-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-indigo-500/20 to-transparent rounded-bl-full pointer-events-none"></div>
              <h4 className="text-sm font-bold text-white mb-1">On-Call Engineer</h4>
              <p className="text-xs text-slate-400 mb-3">Alice Smith (Tier 1)</p>
              <Button variant="primary" size="sm" className="w-full" icon={<Phone size={14} />}>Page Now</Button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950 to-slate-950">
          <div className="max-w-[1600px] mx-auto">
            {activeView === 'overview' && <OverviewDashboard />}
            {activeView === 'warroom' && <WarRoom />}
            {activeView === 'statuspage' && <StatusPageBuilder />}
            {activeView === 'rca' && <RCAPostMortemEditor />}
            {activeView === 'timeline' && <IncidentTimeline />}
            {activeView === 'settings' && (
              <div className="flex items-center justify-center h-full text-slate-500 flex-col animate-in fade-in">
                <Settings size={48} className="mb-4 opacity-50" />
                <h2 className="text-xl font-semibold text-slate-300">Settings Module</h2>
                <p>Advanced routing and integration configurations loading...</p>
              </div>
            )}
          </div>
        </main>
      </div>

    </div>
  );
}
