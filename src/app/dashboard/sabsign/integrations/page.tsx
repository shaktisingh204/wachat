"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, Webhook, Key, Link2, Shield, Settings, Plus, Search, 
  MoreVertical, CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  Copy, Eye, EyeOff, Trash2, Edit2, Play, Code2, Database,
  Terminal, Globe, Zap, Lock, Calendar, Filter, Download, ArrowUpRight,
  ChevronDown, ChevronRight, CheckSquare, Square, Box, Layers,
  Cloud, HardDrive, Cpu, Network, Radio, Smartphone, CreditCard,
  Users, FileText, FileSignature, FileKey, Mail, Bell, ShieldAlert,
  Server, Clock, ArrowRight, ToggleLeft, ToggleRight, Loader2,
  Check, X
} from "lucide-react";

// ==========================================
// MOCK DATA GENERATION
// ==========================================

const EVENT_CATEGORIES = [
  {
    name: "Envelope",
    events: ["envelope.created", "envelope.sent", "envelope.delivered", "envelope.completed", "envelope.declined", "envelope.voided", "envelope.deleted", "envelope.expired"]
  },
  {
    name: "Recipient",
    events: ["recipient.delivered", "recipient.completed", "recipient.declined", "recipient.authentication_failed", "recipient.reassigned", "recipient.delegated"]
  },
  {
    name: "Document",
    events: ["document.viewed", "document.modified", "document.deleted", "document.downloaded", "document.watermarked"]
  },
  {
    name: "Template",
    events: ["template.created", "template.modified", "template.deleted", "template.shared", "template.version_created"]
  },
  {
    name: "Account",
    events: ["account.billing_updated", "account.subscription_changed", "account.user_added", "account.user_removed", "account.settings_changed"]
  },
  {
    name: "Security",
    events: ["security.login_failed", "security.mfa_enabled", "security.mfa_disabled", "security.api_key_created", "security.api_key_revoked"]
  }
];

const MOCK_ENDPOINTS = [
  { id: "ep_1", url: "https://api.acmecorp.com/webhooks/sabsign", status: "active", secret: "whsec_8f9a2b4c6d8e0f1a3b5c7d9e1f3a5b7", createdAt: "2025-10-12T10:00:00Z", events: ["envelope.completed", "envelope.declined"], successRate: 99.8, failures: 2, totalDelivered: 14502 },
  { id: "ep_2", url: "https://hooks.slack.com/services/invalid/webhook/placeholder", status: "active", secret: "whsec_2a4b6c8d0e2f4a6b8c0d2e4f6a8b0", createdAt: "2025-11-05T14:30:00Z", events: ["envelope.sent", "recipient.declined"], successRate: 100, failures: 0, totalDelivered: 3201 },
  { id: "ep_3", url: "https://internal.dashboard.app/api/webhooks/signatures", status: "failing", secret: "whsec_1b3c5d7e9f1a3b5c7d9e1f3a5b7c9", createdAt: "2026-01-20T09:15:00Z", events: ["*"], successRate: 85.4, failures: 124, totalDelivered: 850 },
  { id: "ep_4", url: "https://zapier.com/hooks/catch/123456/abcdef/", status: "disabled", secret: "whsec_5a5b5c5d5e5f5g5h5i5j5k5l5m5n5", createdAt: "2026-02-10T11:45:00Z", events: ["document.viewed"], successRate: 0, failures: 0, totalDelivered: 0 },
];

const MOCK_API_KEYS = [
  { id: "key_1", name: "Production Backend Integration", prefix: "sk_live_8f9a...", createdAt: "2025-08-01T00:00:00Z", lastUsed: "2026-06-03T10:45:00Z", expiresAt: null, scopes: ["envelope:write", "envelope:read", "document:read"] },
  { id: "key_2", name: "Staging Environment", prefix: "sk_test_2b4c...", createdAt: "2026-01-15T00:00:00Z", lastUsed: "2026-06-02T18:20:00Z", expiresAt: "2027-01-15T00:00:00Z", scopes: ["*"] },
  { id: "key_3", name: "Zapier Automation", prefix: "sk_live_1d3e...", createdAt: "2026-03-10T00:00:00Z", lastUsed: "2026-06-03T19:00:00Z", expiresAt: null, scopes: ["envelope:read", "template:read", "recipient:read"] },
  { id: "key_4", name: "Developer Laptop (Harsh)", prefix: "sk_test_9f8e...", createdAt: "2026-05-20T00:00:00Z", lastUsed: "2026-06-01T09:10:00Z", expiresAt: "2026-06-20T00:00:00Z", scopes: ["envelope:write", "envelope:read"] },
];

const MOCK_APPS = [
  { id: "app_1", name: "Salesforce", category: "CRM", status: "connected", icon: Cloud, syncStatus: "synced", lastSync: "10 mins ago" },
  { id: "app_2", name: "HubSpot", category: "CRM", status: "disconnected", icon: Globe, syncStatus: "none", lastSync: "Never" },
  { id: "app_3", name: "Google Drive", category: "Storage", status: "connected", icon: HardDrive, syncStatus: "syncing", lastSync: "Just now" },
  { id: "app_4", name: "Dropbox", category: "Storage", status: "error", icon: Box, syncStatus: "failed", lastSync: "2 hours ago" },
  { id: "app_5", name: "Slack", category: "Communication", status: "connected", icon: Webhook, syncStatus: "synced", lastSync: "5 mins ago" },
  { id: "app_6", name: "Microsoft Teams", category: "Communication", status: "disconnected", icon: Users, syncStatus: "none", lastSync: "Never" },
  { id: "app_7", name: "Zapier", category: "Automation", status: "connected", icon: Zap, syncStatus: "synced", lastSync: "1 min ago" },
  { id: "app_8", name: "Stripe", category: "Billing", status: "connected", icon: CreditCard, syncStatus: "synced", lastSync: "1 hour ago" },
];

const generateMockLogs = () => {
  const logs = [];
  const events = ["envelope.completed", "envelope.sent", "document.viewed", "recipient.declined"];
  const statuses = [200, 200, 200, 201, 400, 500, 503, 200, 200];
  
  for (let i = 0; i < 150; i++) {
    const event = events[Math.floor(Math.random() * events.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const date = new Date(Date.now() - Math.floor(Math.random() * 10000000000));
    
    logs.push({
      id: `evt_${Math.random().toString(36).substr(2, 9)}`,
      event: event,
      endpoint: MOCK_ENDPOINTS[Math.floor(Math.random() * MOCK_ENDPOINTS.length)].url,
      status: status,
      timestamp: date.toISOString(),
      duration: Math.floor(Math.random() * 500) + 50,
      payload: {
        id: `env_${Math.random().toString(36).substr(2, 9)}`,
        status: event.split('.')[1],
        created_at: new Date(date.getTime() - 86400000).toISOString(),
        recipients: [
          { name: "John Doe", email: "john@example.com", status: "completed" }
        ]
      },
      response: status === 200 ? { success: true, message: "Processed" } : { error: "Internal Server Error", code: status }
    });
  }
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const MOCK_LOGS = generateMockLogs();


// ==========================================
// UTILITY COMPONENTS
// ==========================================

const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-neutral-900/50 backdrop-blur-md border border-neutral-800/60 rounded-xl overflow-hidden shadow-2xl ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, color = "neutral", className = "" }: { children: React.ReactNode, color?: "success" | "warning" | "danger" | "info" | "neutral", className?: string }) => {
  const colors = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    neutral: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5 w-fit ${colors[color]} ${className}`}>
      {children}
    </span>
  );
};

const Button = ({ children, variant = "primary", size = "md", icon: Icon, className = "", ...props }: any) => {
  const base = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 border border-transparent shadow-[0_0_15px_rgba(79,70,229,0.3)]",
    secondary: "bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 focus:ring-neutral-500",
    outline: "bg-transparent hover:bg-neutral-800/50 text-neutral-300 border border-neutral-700 focus:ring-neutral-600",
    danger: "bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-600/20 focus:ring-rose-500",
    ghost: "bg-transparent hover:bg-neutral-800/50 text-neutral-400 hover:text-neutral-200 border border-transparent"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5"
  };

  return (
    <button className={`${base} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} {...props}>
      {Icon && <Icon className={size === "sm" ? "w-3.5 h-3.5" : size === "md" ? "w-4 h-4" : "w-5 h-5"} />}
      {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, ...props }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-xs font-medium text-neutral-400 ml-1">{label}</label>}
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />}
      <input 
        className={`w-full bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 placeholder-neutral-600`}
        {...props}
      />
    </div>
  </div>
);

const JsonViewer = ({ data }: { data: any }) => (
  <div className="bg-[#0D0D11] border border-neutral-800 rounded-lg p-4 overflow-x-auto">
    <pre className="text-xs font-mono text-neutral-300 leading-relaxed">
      {JSON.stringify(data, null, 2).split('\n').map((line, i) => {
        // Simple syntax highlighting
        let styledLine = line;
        if (line.includes('":')) {
          const parts = line.split('":');
          styledLine = `<span class="text-indigo-400">${parts[0]}</span>":<span class="text-emerald-400">${parts.slice(1).join('":')}</span>`;
        }
        return (
          <div key={i} className="flex hover:bg-white/[0.02]">
            <span className="w-8 select-none text-neutral-600 text-right pr-4 border-r border-neutral-800/50 mr-4 inline-block">{i + 1}</span>
            <span dangerouslySetInnerHTML={{ __html: styledLine.replace(/"/g, '&quot;') }} />
          </div>
        );
      })}
    </pre>
  </div>
);


// ==========================================
// VIEWS
// ==========================================

const WebhooksView = () => {
  const [endpoints, setEndpoints] = useState(MOCK_ENDPOINTS);
  const [isCreating, setIsCreating] = useState(false);
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Active Endpoints", value: endpoints.filter(e => e.status === 'active').length, icon: Webhook, color: "text-indigo-400" },
          { title: "Total Events Delivered", value: "18,553", icon: Activity, color: "text-emerald-400" },
          { title: "Avg Latency", value: "142ms", icon: Zap, color: "text-amber-400" },
          { title: "Failed Deliveries", value: "126", icon: AlertCircle, color: "text-rose-400" }
        ].map((stat, i) => (
          <GlassCard key={i} className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50 ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{stat.title}</div>
              <div className="text-2xl font-bold text-neutral-100 mt-1">{stat.value}</div>
            </div>
          </GlassCard>
        ))}
      </div>

      {isCreating ? (
        <CreateWebhookForm onCancel={() => setIsCreating(false)} />
      ) : (
        <GlassCard>
          <div className="p-6 border-b border-neutral-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-100">Webhook Endpoints</h3>
              <p className="text-sm text-neutral-400 mt-1">Configure endpoints to receive real-time event payloads.</p>
            </div>
            <Button icon={Plus} onClick={() => setIsCreating(true)}>Add Endpoint</Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900/50 text-neutral-400 border-b border-neutral-800/60">
                <tr>
                  <th className="px-6 py-4 font-medium">URL & Secret</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Events Subscribed</th>
                  <th className="px-6 py-4 font-medium">Delivery Rate</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {endpoints.map((ep) => (
                  <tr key={ep.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-neutral-800 border border-neutral-700">
                          <Globe className="w-4 h-4 text-neutral-400" />
                        </div>
                        <div>
                          <div className="font-medium text-neutral-200 truncate max-w-[200px] lg:max-w-[300px]" title={ep.url}>{ep.url}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                              {ep.secret.substring(0, 12)}...
                            </code>
                            <button className="text-neutral-500 hover:text-neutral-300 transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={ep.status === 'active' ? 'success' : ep.status === 'failing' ? 'warning' : 'neutral'}>
                        {ep.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : ep.status === 'failing' ? <AlertCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {ep.status.charAt(0).toUpperCase() + ep.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                        {ep.events[0] === "*" ? (
                          <Badge color="info">All Events</Badge>
                        ) : (
                          <>
                            {ep.events.slice(0, 2).map((evt, i) => (
                              <span key={i} className="text-[11px] px-2 py-1 bg-neutral-800 rounded-md border border-neutral-700 text-neutral-300">
                                {evt}
                              </span>
                            ))}
                            {ep.events.length > 2 && (
                              <span className="text-[11px] px-2 py-1 bg-neutral-800 rounded-md border border-neutral-700 text-neutral-400">
                                +{ep.events.length - 2} more
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex justify-between text-xs">
                          <span className={ep.successRate > 95 ? "text-emerald-400" : ep.successRate > 80 ? "text-amber-400" : "text-rose-400"}>
                            {ep.successRate}%
                          </span>
                          <span className="text-neutral-500">{ep.totalDelivered.toLocaleString()} total</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${ep.successRate > 95 ? "bg-emerald-500" : ep.successRate > 80 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${ep.successRate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" icon={Play} title="Test Endpoint" />
                        <Button variant="ghost" size="sm" icon={Edit2} title="Edit" />
                        <Button variant="ghost" size="sm" icon={Trash2} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" title="Delete" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

const CreateWebhookForm = ({ onCancel }: { onCancel: () => void }) => {
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  
  const toggleEvent = (evt: string) => {
    setSelectedEvents(prev => prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]);
  };

  const toggleCategory = (catEvents: string[]) => {
    const allSelected = catEvents.every(e => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents(prev => prev.filter(e => !catEvents.includes(e)));
    } else {
      setSelectedEvents(prev => [...new Set([...prev, ...catEvents])]);
    }
  };

  return (
    <GlassCard className="animate-in fade-in zoom-in-95 duration-300">
      <div className="p-6 border-b border-neutral-800/60 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">Add Webhook Endpoint</h3>
          <p className="text-sm text-neutral-400 mt-1">Configure a new endpoint to receive HTTP POST requests.</p>
        </div>
        <Button variant="ghost" icon={X} onClick={onCancel} />
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Config */}
        <div className="lg:col-span-1 space-y-6">
          <Input label="Endpoint URL" placeholder="https://api.yourdomain.com/webhooks" icon={Globe} />
          <Input label="Description (Optional)" placeholder="e.g. Production Billing Updates" icon={FileText} />
          
          <div className="bg-neutral-800/30 p-4 rounded-xl border border-neutral-700/50 space-y-4">
            <h4 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" /> Endpoint Security
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              We will sign every webhook request with a unique secret. You can use this secret to verify that the request came from SabSign.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-neutral-500">Signing Secret</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono flex items-center">
                  whsec_******************************
                </code>
                <Button variant="secondary" icon={RefreshCw} title="Rotate Secret" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Events Selection */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-medium text-neutral-200">Events to send</h4>
            <Button variant="ghost" size="sm" onClick={() => setSelectedEvents(EVENT_CATEGORIES.flatMap(c => c.events))}>
              Select All
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {EVENT_CATEGORIES.map((cat, i) => (
              <div key={i} className="bg-neutral-900/40 rounded-xl border border-neutral-800/60 p-4">
                <div 
                  className="flex justify-between items-center mb-3 cursor-pointer group"
                  onClick={() => toggleCategory(cat.events)}
                >
                  <h5 className="text-sm font-medium text-neutral-300 group-hover:text-indigo-400 transition-colors">{cat.name}</h5>
                  {cat.events.every(e => selectedEvents.includes(e)) ? (
                    <CheckSquare className="w-4 h-4 text-indigo-500" />
                  ) : cat.events.some(e => selectedEvents.includes(e)) ? (
                    <div className="w-4 h-4 rounded bg-indigo-500/20 border border-indigo-500 flex items-center justify-center">
                      <div className="w-2 h-0.5 bg-indigo-500 rounded-full" />
                    </div>
                  ) : (
                    <Square className="w-4 h-4 text-neutral-600 group-hover:text-neutral-500" />
                  )}
                </div>
                
                <div className="space-y-2.5">
                  {cat.events.map((evt, j) => (
                    <label key={j} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          className="peer sr-only"
                          checked={selectedEvents.includes(evt)}
                          onChange={() => toggleEvent(evt)}
                        />
                        <div className="w-4 h-4 border border-neutral-600 rounded bg-transparent peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center">
                          <Check className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                        </div>
                      </div>
                      <span className="text-xs text-neutral-400 group-hover:text-neutral-200 transition-colors font-mono">
                        {evt}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="p-6 border-t border-neutral-800/60 flex justify-end gap-3 bg-neutral-900/30">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" icon={CheckCircle2}>Create Endpoint</Button>
      </div>
    </GlassCard>
  );
};


const ApiKeysView = () => {
  const [keys, setKeys] = useState(MOCK_API_KEYS);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <GlassCard>
        <div className="p-6 border-b border-neutral-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-100">API Keys</h3>
            <p className="text-sm text-neutral-400 mt-1">Manage API keys used to authenticate requests to the SabSign API.</p>
          </div>
          <Button icon={Key}>Generate New Key</Button>
        </div>
        
        <div className="p-6">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-4 mb-6">
            <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-300">Keep your keys secure</h4>
              <p className="text-xs text-blue-400/80 mt-1">
                Your API keys carry many privileges. Do not share them in publicly accessible areas such as GitHub, client-side code, and so forth.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900/50 text-neutral-400 border-b border-neutral-800/60">
                <tr>
                  <th className="px-6 py-4 font-medium">Name & Prefix</th>
                  <th className="px-6 py-4 font-medium">Scopes</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                  <th className="px-6 py-4 font-medium">Last Used</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-200">{key.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 font-mono">
                          {key.prefix}****************
                        </code>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                        {key.scopes[0] === "*" ? (
                          <Badge color="danger">Full Access</Badge>
                        ) : (
                          key.scopes.map((scope, i) => (
                            <span key={i} className="text-[11px] px-2 py-1 bg-neutral-800 rounded-md border border-neutral-700 text-neutral-300">
                              {scope}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-400">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-neutral-400">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(key.lastUsed).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm">Roll Key</Button>
                        <Button variant="ghost" size="sm" icon={Trash2} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" title="Revoke" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};


const EventLogsView = () => {
  const [logs] = useState(MOCK_LOGS);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Filters */}
      <GlassCard className="p-4 flex flex-wrap gap-4 items-end">
        <div className="w-full sm:w-auto flex-1 max-w-xs">
          <Input label="Search Events" icon={Search} placeholder="Search by ID or event..." />
        </div>
        <div className="w-full sm:w-auto flex-1 max-w-xs">
          <label className="text-xs font-medium text-neutral-400 ml-1 mb-1.5 block">Endpoint</label>
          <div className="relative">
            <select className="w-full bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 px-3 py-2.5 appearance-none cursor-pointer">
              <option>All Endpoints</option>
              {MOCK_ENDPOINTS.map(ep => <option key={ep.id}>{ep.url}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="w-full sm:w-auto flex-1 max-w-xs">
          <label className="text-xs font-medium text-neutral-400 ml-1 mb-1.5 block">Status</label>
          <div className="relative">
            <select className="w-full bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 px-3 py-2.5 appearance-none cursor-pointer">
              <option>All Statuses</option>
              <option>Success (2xx)</option>
              <option>Error (4xx/5xx)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <Button variant="secondary" icon={Filter}>Filter</Button>
        <Button variant="outline" icon={Download} title="Export CSV" />
      </GlassCard>

      {/* Logs Table */}
      <GlassCard>
        <div className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900/80 text-neutral-400 border-b border-neutral-800/60 sticky top-0 backdrop-blur-xl z-10">
              <tr>
                <th className="px-6 py-4 font-medium w-12"></th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Event</th>
                <th className="px-6 py-4 font-medium">Date & Time</th>
                <th className="px-6 py-4 font-medium">Endpoint</th>
                <th className="px-6 py-4 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {logs.slice(0, 20).map((log) => (
                <React.Fragment key={log.id}>
                  <tr 
                    className={`hover:bg-neutral-800/30 transition-colors cursor-pointer ${expandedLogId === log.id ? 'bg-neutral-800/20' : ''}`}
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  >
                    <td className="px-6 py-4 text-center text-neutral-500">
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expandedLogId === log.id ? 'rotate-90' : ''}`} />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-mono font-medium border ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-neutral-200">{log.event}</span>
                    </td>
                    <td className="px-6 py-4 text-neutral-400 text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="truncate max-w-[200px] text-neutral-400 text-xs" title={log.endpoint}>
                        {log.endpoint}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-neutral-400 text-xs">
                      {log.duration}ms
                    </td>
                  </tr>
                  
                  {/* Expanded Row Details */}
                  {expandedLogId === log.id && (
                    <tr>
                      <td colSpan={6} className="p-0 border-b-0 bg-neutral-900/30">
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
                          
                          {/* Request */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
                                <ArrowUpRight className="w-4 h-4 text-indigo-400" /> Request Payload
                              </h5>
                              <Button variant="ghost" size="sm" icon={Copy} className="text-xs">Copy JSON</Button>
                            </div>
                            <JsonViewer data={log.payload} />
                          </div>

                          {/* Response */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
                                <ArrowRight className="w-4 h-4 text-emerald-400" /> Response Body
                              </h5>
                              <Button variant="ghost" size="sm" icon={Copy} className="text-xs">Copy JSON</Button>
                            </div>
                            <JsonViewer data={log.response} />
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-neutral-800/60 flex items-center justify-between text-sm text-neutral-400">
          <div>Showing 1 to 20 of {logs.length} results</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};


const ConnectedAppsView = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">App Integrations</h2>
          <p className="text-sm text-neutral-400 mt-1">Connect SabSign with your favorite tools to automate your workflows.</p>
        </div>
        <div className="w-full sm:w-64">
          <Input icon={Search} placeholder="Search apps..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {MOCK_APPS.map((app) => (
          <GlassCard key={app.id} className="flex flex-col hover:border-indigo-500/50 transition-colors group cursor-pointer">
            <div className="p-6 flex-1 flex flex-col items-start relative">
              
              {app.status === 'connected' && (
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              )}
              {app.status === 'error' && (
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              )}
              
              <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <app.icon className="w-6 h-6 text-neutral-300" />
              </div>
              
              <h3 className="text-lg font-medium text-neutral-100">{app.name}</h3>
              <p className="text-xs text-neutral-500 mt-1">{app.category}</p>
              
              <div className="mt-6 w-full flex-1">
                {app.status === 'connected' ? (
                  <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-700/50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-400">Sync Status</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-2">
                      <span className="text-neutral-400">Last Sync</span>
                      <span className="text-neutral-300">{app.lastSync}</span>
                    </div>
                  </div>
                ) : app.status === 'error' ? (
                   <div className="bg-rose-500/10 rounded-lg p-3 border border-rose-500/20">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Authentication Failed
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">
                    Connect {app.name} to automatically sync documents and data.
                  </p>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-neutral-800/60 bg-neutral-900/30 flex justify-between items-center">
              {app.status === 'connected' ? (
                <>
                  <Button variant="ghost" size="sm" icon={Settings} className="text-neutral-400">Configure</Button>
                  <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300">Disconnect</Button>
                </>
              ) : app.status === 'error' ? (
                <Button variant="primary" size="sm" className="w-full">Reconnect</Button>
              ) : (
                <Button variant="secondary" size="sm" className="w-full">Connect</Button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

    </div>
  );
};

const SettingsView = () => {
  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <GlassCard className="p-6 md:p-8 space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Advanced API Settings</h2>
          <p className="text-sm text-neutral-400 mt-1">Configure global behavior for API requests and integrations.</p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              <ToggleRight className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h4 className="text-base font-medium text-neutral-200">IP Whitelisting</h4>
              <p className="text-sm text-neutral-400 mt-1 mb-3">Restrict API access to specific IP addresses or CIDR blocks.</p>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 font-mono text-sm text-neutral-300">
                192.168.1.1/24<br/>
                10.0.0.0/8
              </div>
              <Button variant="outline" size="sm" className="mt-3">Edit Allowed IPs</Button>
            </div>
          </div>

          <div className="w-full h-px bg-neutral-800/60" />

          <div className="flex items-start gap-4">
             <div className="mt-1">
              <ToggleLeft className="w-8 h-8 text-neutral-600" />
            </div>
            <div>
              <h4 className="text-base font-medium text-neutral-200">Strict Mode Validation</h4>
              <p className="text-sm text-neutral-400 mt-1">Reject API requests containing unknown JSON properties. By default, extra properties are ignored.</p>
            </div>
          </div>

           <div className="w-full h-px bg-neutral-800/60" />

          <div className="flex items-start gap-4">
             <div className="mt-1">
              <ToggleRight className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h4 className="text-base font-medium text-neutral-200">Rate Limit Headers</h4>
              <p className="text-sm text-neutral-400 mt-1">Include X-RateLimit-* headers in all API responses to track your usage in real-time.</p>
            </div>
          </div>

        </div>

      </GlassCard>

      <GlassCard className="p-6 md:p-8 bg-rose-500/5 border-rose-500/20">
        <div>
          <h2 className="text-xl font-semibold text-rose-500">Danger Zone</h2>
          <p className="text-sm text-neutral-400 mt-1">Irreversible actions for your integrations.</p>
        </div>
        <div className="mt-6 flex items-center justify-between p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
          <div>
            <h4 className="text-sm font-medium text-neutral-200">Revoke All API Keys</h4>
            <p className="text-xs text-neutral-500 mt-1">Immediately invalidates all active API keys. This will break all current integrations.</p>
          </div>
          <Button variant="danger">Revoke All</Button>
        </div>
      </GlassCard>

    </div>
  );
};

// ==========================================
// MAIN PAGE LAYOUT
// ==========================================

export default function SabSignIntegrations() {
  const [activeTab, setActiveTab] = useState("webhooks");

  const TABS = [
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "apikeys", label: "API Keys", icon: Key },
    { id: "logs", label: "Event Logs", icon: Terminal },
    { id: "apps", label: "Connected Apps", icon: Layers },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200 font-sans p-4 md:p-8 pb-24 selection:bg-indigo-500/30">
      
      {/* Background Effects */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-neutral-800/60">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <Network className="w-6 h-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Integrations & API</h1>
            </div>
            <p className="text-neutral-400 text-sm max-w-xl">
              Connect SabSign to your existing tools, manage API authentication, and configure real-time webhooks for seamless data sync.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" icon={Code2}>API Docs</Button>
            <Button variant="primary" icon={Plus}>New Integration</Button>
          </div>
        </header>

        {/* Navigation */}
        <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === tab.id 
                  ? 'bg-neutral-800/80 text-white border border-neutral-700/50 shadow-sm' 
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent'
                }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-400' : ''}`} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <main className="min-h-[600px]">
          {activeTab === "webhooks" && <WebhooksView />}
          {activeTab === "apikeys" && <ApiKeysView />}
          {activeTab === "logs" && <EventLogsView />}
          {activeTab === "apps" && <ConnectedAppsView />}
          {activeTab === "settings" && <SettingsView />}
        </main>

      </div>
    </div>
  );
}
