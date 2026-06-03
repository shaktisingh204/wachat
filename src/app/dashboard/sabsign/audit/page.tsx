'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, FileText, Activity, Clock, MapPin, 
  Search, Filter, Download, AlertTriangle, CheckCircle, 
  Hash, Server, Lock, Fingerprint, Eye, MoreVertical,
  Calendar, Users, ChevronRight, Share2, Printer, 
  Settings, Database, RefreshCw, Smartphone, Key,
  FileSignature, ChevronDown, Plus, Edit2, ShieldAlert,
  Terminal, Monitor, CheckSquare, XCircle, FileBadge,
  Maximize2, ArrowRight, X
} from 'lucide-react';

// --- MOCK DATA ---

const MOCK_EVENTS = Array.from({ length: 150 }).map((_, i) => {
  const date = new Date(Date.now() - Math.random() * 10000000000);
  const actions = ['Document Viewed', 'Signature Added', 'Authentication Failed', 'Document Signed', 'IP Address Changed', 'Certificate Issued', 'Audit Log Exported', 'Settings Changed'];
  const actors = ['Harsh Khandelwal', 'John Doe', 'Jane Smith', 'System', 'Alice Johnson', 'Bob Williams', 'API Service'];
  const locations = ['New York, US', 'London, UK', 'Tokyo, JP', 'Berlin, DE', 'Sydney, AU', 'Mumbai, IN', 'Unknown'];
  const statuses = ['Success', 'Success', 'Success', 'Warning', 'Failed'];
  const devices = ['MacBook Pro 16"', 'iPhone 14 Pro', 'Windows 11 PC', 'iPad Air', 'Android Device', 'Server Node'];
  const browsers = ['Chrome 118', 'Safari 17', 'Firefox 119', 'Edge 118', 'Unknown', 'SabDesk Desktop App'];
  
  return {
    id: `EVT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    timestamp: date.toISOString(),
    formattedDate: date.toLocaleString(),
    action: actions[Math.floor(Math.random() * actions.length)],
    actor: actors[Math.floor(Math.random() * actors.length)],
    ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    location: locations[Math.floor(Math.random() * locations.length)],
    hash: `0x${Array.from({length: 64}).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    device: devices[Math.floor(Math.random() * devices.length)],
    browser: browsers[Math.floor(Math.random() * browsers.length)],
    details: 'Cryptographic verification passed. RSA-2048 key utilized.',
  };
}).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

const MOCK_IPS = Array.from({ length: 45 }).map((_, i) => ({
  id: `IP-${i}`,
  address: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  location: ['San Francisco, CA', 'Austin, TX', 'Toronto, CA', 'Frankfurt, DE', 'Singapore, SG'][Math.floor(Math.random() * 5)],
  isp: ['Comcast', 'AT&T', 'Verizon', 'Vodafone', 'DigitalOcean', 'AWS'][Math.floor(Math.random() * 6)],
  riskScore: Math.floor(Math.random() * 100),
  lastSeen: new Date(Date.now() - Math.random() * 1000000000).toLocaleString(),
  associatedAccounts: Math.floor(Math.random() * 5) + 1,
  status: ['Allowed', 'Allowed', 'Allowed', 'Suspicious', 'Blocked'][Math.floor(Math.random() * 5)],
  sessions: Math.floor(Math.random() * 500) + 10,
}));

const MOCK_CERTIFICATES = Array.from({ length: 25 }).map((_, i) => ({
  id: `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  documentName: ['NDA_Q3_2024.pdf', 'Employment_Contract_Jane.docx', 'Vendor_Agreement_V2.pdf', 'Board_Resolution_Oct.pdf'][Math.floor(Math.random() * 4)],
  signers: Array.from({length: Math.floor(Math.random() * 3) + 1}).map(() => ['Alice M.', 'Bob T.', 'Charlie K.', 'Diana P.'][Math.floor(Math.random() * 4)]),
  completionDate: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
  blockchainTx: `0x${Array.from({length: 40}).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
  status: 'Completed',
  size: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
  encryption: 'AES-256-GCM',
}));

// --- COMPONENTS ---

const MetricCard = ({ title, value, icon: Icon, trend, colorClass }: any) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-all duration-500 ${colorClass}`}></div>
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div>
        <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-white/5 border border-white/10 ${colorClass.replace('bg-', 'text-')}`}>
        <Icon size={24} />
      </div>
    </div>
    <div className="flex items-center text-sm relative z-10">
      <span className={trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
        {trend >= 0 ? '+' : ''}{trend}%
      </span>
      <span className="text-gray-500 ml-2">vs last 30 days</span>
    </div>
  </div>
);

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-5 py-3 rounded-lg font-medium transition-all duration-200 ${
      active 
        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
    }`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

const TimelineTab = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search hash, IP, or event..." 
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
          <button className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button className="flex items-center space-x-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-lg text-sm transition-colors">
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-medium">Event & Hash</th>
                <th className="px-6 py-4 font-medium">Actor & Device</th>
                <th className="px-6 py-4 font-medium">Location & IP</th>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_EVENTS.filter(e => e.hash.includes(searchTerm) || e.action.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 20).map((event) => (
                <tr key={event.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-sm flex items-center gap-2">
                        {event.action}
                        {event.action.includes('Signed') && <FileSignature size={14} className="text-blue-400" />}
                      </span>
                      <span className="text-gray-500 text-xs font-mono mt-1 flex items-center gap-1">
                        <Hash size={12} />
                        {event.hash.substring(0, 16)}...{event.hash.substring(event.hash.length - 8)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-gray-300 text-sm">{event.actor}</span>
                      <span className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                        <Monitor size={12} />
                        {event.device} • {event.browser}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-gray-300 text-sm flex items-center gap-1">
                        <MapPin size={12} className="text-gray-400" />
                        {event.location}
                      </span>
                      <span className="text-gray-500 text-xs mt-1 font-mono">{event.ip}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-gray-300 text-sm">{event.formattedDate.split(',')[0]}</span>
                      <span className="text-gray-500 text-xs mt-1">{event.formattedDate.split(',')[1]}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      event.status === 'Success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      event.status === 'Warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {event.status === 'Success' && <CheckCircle size={12} className="mr-1" />}
                      {event.status === 'Warning' && <AlertTriangle size={12} className="mr-1" />}
                      {event.status === 'Failed' && <XCircle size={12} className="mr-1" />}
                      {event.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-white/10 bg-white/[0.01] flex justify-center">
          <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors flex items-center gap-2">
            Load More Events <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const NetworkTab = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="text-blue-400" size={20} />
              Geographic Traffic Distribution
            </h3>
            <button className="text-gray-400 hover:text-white transition-colors">
              <Maximize2 size={18} />
            </button>
          </div>
          <div className="h-64 w-full bg-black/30 rounded-xl border border-white/5 flex items-center justify-center relative z-10 overflow-hidden">
             {/* Mock Map Visualization */}
             <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'radial-gradient(circle at center, #3b82f6 1px, transparent 1px)',
                backgroundSize: '20px 20px'
             }}></div>
             <div className="relative z-10 text-center">
               <MapPin size={48} className="text-blue-500/50 mx-auto mb-3" />
               <p className="text-gray-400 text-sm">Interactive map visualization would render here.</p>
               <p className="text-gray-500 text-xs mt-1">Showing 45 active nodes across 12 regions</p>
             </div>
             
             {/* Fake map points */}
             {[...Array(8)].map((_, i) => (
                <div key={i} className="absolute w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" style={{
                  top: `${20 + Math.random() * 60}%`,
                  left: `${10 + Math.random() * 80}%`,
                  animationDelay: `${Math.random() * 2}s`
                }}></div>
             ))}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
            <ShieldAlert className="text-rose-400" size={20} />
            High Risk IPs
          </h3>
          <div className="space-y-4">
            {MOCK_IPS.filter(ip => ip.riskScore > 70).slice(0, 4).map(ip => (
              <div key={ip.id} className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col gap-2 hover:border-rose-500/30 transition-colors cursor-pointer">
                <div className="flex justify-between items-center">
                  <span className="text-white font-mono text-sm">{ip.address}</span>
                  <span className="bg-rose-500/20 text-rose-400 text-xs px-2 py-1 rounded font-medium border border-rose-500/20">
                    Risk: {ip.riskScore}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1"><MapPin size={12}/> {ip.location}</span>
                  <span>{ip.sessions} sessions</span>
                </div>
              </div>
            ))}
            <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors mt-2">
              View All Threats
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">IP Access Log</h3>
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
             <input type="text" placeholder="Search IP..." className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-medium">IP Address</th>
                <th className="px-6 py-4 font-medium">Location / ISP</th>
                <th className="px-6 py-4 font-medium">Risk Score</th>
                <th className="px-6 py-4 font-medium">Last Seen</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_IPS.slice(0, 10).map((ip) => (
                <tr key={ip.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-white font-mono text-sm">{ip.address}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-gray-300 text-sm">{ip.location}</span>
                      <span className="text-gray-500 text-xs mt-1">{ip.isp}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            ip.riskScore < 30 ? 'bg-emerald-500' : 
                            ip.riskScore < 70 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${ip.riskScore}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400">{ip.riskScore}/100</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-300 text-sm">{ip.lastSeen}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      ip.status === 'Allowed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      ip.status === 'Suspicious' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {ip.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CertificatesTab = ({ onOpenPreview }: { onOpenPreview: (cert: any) => void }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
        <h3 className="text-lg font-semibold text-white">Certificates of Completion</h3>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20">
          <Plus size={16} />
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {MOCK_CERTIFICATES.map((cert) => (
          <div key={cert.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-blue-500/30 hover:bg-white/10 transition-all duration-300 group cursor-pointer flex flex-col h-full" onClick={() => onOpenPreview(cert)}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform duration-300">
                <FileBadge size={28} />
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-1 rounded-full font-medium">
                {cert.status}
              </span>
            </div>
            
            <h4 className="text-white font-medium mb-1 truncate" title={cert.documentName}>{cert.documentName}</h4>
            <p className="text-gray-400 text-xs mb-4">{cert.size} • {cert.encryption}</p>
            
            <div className="mt-auto space-y-3">
              <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                <p className="text-gray-500 text-xs mb-1">Signers</p>
                <div className="flex flex-wrap gap-1">
                  {cert.signers.map((s, i) => (
                    <span key={i} className="text-gray-300 text-xs bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{s}</span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span className="flex items-center gap-1"><Calendar size={12}/> {cert.completionDate}</span>
                <span className="font-mono text-[10px]" title={cert.blockchainTx}>{cert.blockchainTx.substring(0, 10)}...</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsTab = () => {
  return (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:p-8 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
            <Settings size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Compliance & Audit Settings</h2>
            <p className="text-gray-400 text-sm mt-1">Manage data retention, alerts, and export configurations for compliance audits.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Database size={18} className="text-gray-400"/> Data Retention Policy
              </h3>
              <div className="space-y-4 bg-black/20 p-5 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-300 text-sm">Audit Log Retention</p>
                    <p className="text-gray-500 text-xs mt-1">Duration to keep detailed logs</p>
                  </div>
                  <select className="bg-black/40 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/50">
                    <option>7 Years (Default)</option>
                    <option>10 Years</option>
                    <option>Indefinite</option>
                  </select>
                </div>
                <div className="w-full h-px bg-white/5"></div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-300 text-sm">Automated Archiving</p>
                    <p className="text-gray-500 text-xs mt-1">Move old logs to cold storage</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Lock size={18} className="text-gray-400"/> Cryptographic Anchoring
              </h3>
              <div className="space-y-4 bg-black/20 p-5 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-300 text-sm">Blockchain Timestamping</p>
                    <p className="text-gray-500 text-xs mt-1">Anchor hashes to public chains</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
                <div className="w-full h-px bg-white/5"></div>
                 <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-300 text-sm">Network</p>
                    <p className="text-gray-500 text-xs mt-1">Target anchoring network</p>
                  </div>
                  <select className="bg-black/40 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/50">
                    <option>Ethereum Mainnet</option>
                    <option>Polygon POS</option>
                    <option>Bitcoin</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-gray-400"/> Alert Triggers
              </h3>
              <div className="space-y-4 bg-black/20 p-5 rounded-xl border border-white/5">
                {[
                  { label: 'Multiple Failed Sign-ins', desc: 'Alert after 5 consecutive failures' },
                  { label: 'Unusual Geo-location', desc: 'Login from new country detected' },
                  { label: 'Mass Document Deletion', desc: 'Trigger on >10 deletions in 1hr' }
                ].map((alert, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="text-gray-300 text-sm">{alert.label}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{alert.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked={idx < 2} />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>
                    {idx < 2 && <div className="w-full h-px bg-white/5 mb-3"></div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 flex items-start gap-4">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="text-blue-100 font-medium text-sm mb-1">SOC 2 Compliance Mode Active</h4>
                <p className="text-blue-300/70 text-xs leading-relaxed">
                  Your current settings satisfy standard SOC 2 Type II compliance requirements for audit logging and non-repudiation.
                </p>
                <button className="mt-3 text-blue-400 text-xs font-medium hover:text-blue-300 transition-colors flex items-center gap-1">
                  View Compliance Report <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex justify-end gap-3">
          <button className="px-5 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
            Discard Changes
          </button>
          <button className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg shadow-blue-500/20">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};


const CertificateModal = ({ cert, onClose }: { cert: any, onClose: () => void }) => {
  if (!cert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <FileBadge size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Certificate of Completion</h2>
              <p className="text-xs text-gray-400 font-mono">{cert.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Download PDF">
              <Download size={18} />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Print">
              <Printer size={18} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Content - PDF Preview Style */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-zinc-950">
          <div className="max-w-3xl mx-auto bg-white text-zinc-900 shadow-xl rounded-sm p-10 min-h-[800px] relative">
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] overflow-hidden">
               <ShieldCheck size={400} className="text-black rotate-[-20deg]" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-zinc-200 pb-6 mb-8">
              <div>
                <h1 className="text-3xl font-serif font-bold text-zinc-900">SabSign</h1>
                <p className="text-sm text-zinc-500 mt-1 uppercase tracking-widest font-semibold">Certificate of Completion</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-700">Envelope ID:</p>
                <p className="text-xs font-mono text-zinc-500">{cert.id}</p>
              </div>
            </div>

            {/* Document Info */}
            <div className="mb-10">
              <h3 className="text-lg font-bold text-zinc-800 border-b border-zinc-200 pb-2 mb-4">Document Information</h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div>
                  <p className="text-zinc-500 font-medium">Document Name</p>
                  <p className="font-semibold text-zinc-800">{cert.documentName}</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium">Completed On</p>
                  <p className="font-semibold text-zinc-800">{cert.completionDate}</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium">Document Size</p>
                  <p className="font-semibold text-zinc-800">{cert.size}</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium">Encryption</p>
                  <p className="font-semibold text-zinc-800">{cert.encryption}</p>
                </div>
              </div>
            </div>

            {/* Signatures List */}
            <div className="mb-10">
              <h3 className="text-lg font-bold text-zinc-800 border-b border-zinc-200 pb-2 mb-4">Signatures</h3>
              <div className="space-y-6">
                {cert.signers.map((signer: string, index: number) => (
                  <div key={index} className="bg-zinc-50 p-4 rounded border border-zinc-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-zinc-800 text-lg">{signer}</p>
                        <p className="text-xs text-zinc-500">{signer.toLowerCase().replace(' ', '.')}@example.com</p>
                      </div>
                      <div className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-bold uppercase flex items-center gap-1">
                        <CheckCircle size={12}/> Verified
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-zinc-400 mb-1">Signature Image</p>
                        <div className="h-12 border border-zinc-200 bg-white rounded flex items-center justify-center p-2">
                           <span className="font-serif text-xl italic text-blue-900/80">{signer}</span>
                        </div>
                      </div>
                      <div className="space-y-2 font-mono text-[10px] text-zinc-600">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">IP Address:</span>
                          <span>192.168.1.{Math.floor(Math.random() * 255)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Timestamp:</span>
                          <span>{new Date().toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Authentication:</span>
                          <span>Email + SMS OTP</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Proof */}
            <div>
               <h3 className="text-lg font-bold text-zinc-800 border-b border-zinc-200 pb-2 mb-4">Cryptographic Proof</h3>
               <div className="bg-zinc-900 text-zinc-300 p-4 rounded-lg font-mono text-xs break-all shadow-inner">
                  <p className="text-zinc-500 mb-1">Document Hash (SHA-256)</p>
                  <p className="mb-4 text-green-400">{`0x${Array.from({length: 64}).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`}</p>
                  
                  <p className="text-zinc-500 mb-1">Blockchain Transaction ID</p>
                  <p className="text-blue-400">{cert.blockchainTx}</p>
               </div>
               
               <div className="mt-8 flex justify-center">
                 <div className="text-center">
                    <ShieldCheck size={48} className="mx-auto text-emerald-600 mb-2" />
                    <p className="text-xs text-zinc-500 font-medium">SECURE NON-REPUDIATION GUARANTEED BY SABSIGN</p>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};


export default function AuditTrailPage() {
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedCert, setSelectedCert] = useState<any>(null);

  // Close modal on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCert(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans p-4 md:p-8 selection:bg-blue-500/30">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <ShieldCheck className="text-blue-500" size={32} />
              Audit Trail & Compliance
            </h1>
            <p className="text-gray-400 mt-2 text-sm max-w-2xl">
              Cryptographically secure log of all system activities. Immutable records, network tracking, and verifiable certificates of completion.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              System Normal
            </div>
            <button className="bg-white/5 hover:bg-white/10 border border-white/10 p-2 rounded-lg transition-colors text-gray-400 hover:text-white">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard title="Total Audit Events" value="1.4M" icon={Activity} trend={12} colorClass="bg-blue-500 text-blue-400" />
          <MetricCard title="Active Network IPs" value="842" icon={Server} trend={-3} colorClass="bg-purple-500 text-purple-400" />
          <MetricCard title="Security Alerts" value="14" icon={AlertTriangle} trend={-24} colorClass="bg-rose-500 text-rose-400" />
          <MetricCard title="Issued Certificates" value="12,405" icon={FileBadge} trend={8} colorClass="bg-emerald-500 text-emerald-400" />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-white/10 pb-4">
          <TabButton 
            active={activeTab === 'timeline'} 
            onClick={() => setActiveTab('timeline')} 
            icon={Clock} 
            label="Timeline & Events" 
          />
          <TabButton 
            active={activeTab === 'network'} 
            onClick={() => setActiveTab('network')} 
            icon={MapPin} 
            label="Network & IP Tracking" 
          />
          <TabButton 
            active={activeTab === 'certificates'} 
            onClick={() => setActiveTab('certificates')} 
            icon={FileText} 
            label="Certificates" 
          />
          <div className="flex-1"></div>
          <TabButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={Settings} 
            label="Settings" 
          />
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'timeline' && <TimelineTab />}
          {activeTab === 'network' && <NetworkTab />}
          {activeTab === 'certificates' && <CertificatesTab onOpenPreview={setSelectedCert} />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>

      {/* Modal Portal */}
      {selectedCert && (
        <CertificateModal cert={selectedCert} onClose={() => setSelectedCert(null)} />
      )}
    </div>
  );
}
