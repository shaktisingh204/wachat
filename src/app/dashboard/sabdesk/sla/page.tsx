"use client";

import React, { useState } from 'react';
import { 
  ShieldAlert, Clock, Calendar, CheckCircle2, AlertTriangle, 
  Settings, ChevronRight, Bell, Mail, MessageSquare, Plus,
  MoreVertical, Edit2, Trash2, StopCircle, PlayCircle
} from 'lucide-react';

const mockSLAs = [
  { id: 'sla-1', name: 'Enterprise Default SLA', desc: 'Standard targets for enterprise-tier customers.', targets: 4, active: true, matching: 1240 },
  { id: 'sla-2', name: 'Global VIP Support', desc: 'Aggressive targets for Top 100 accounts.', targets: 4, active: true, matching: 85 },
  { id: 'sla-3', name: 'Free Tier Basic', desc: 'Best effort responses for free accounts.', targets: 4, active: true, matching: 45200 },
  { id: 'sla-4', name: 'Holiday Special Override', desc: 'Extended targets during holiday season.', targets: 4, active: false, matching: 0 },
];

export default function SLAPage() {
  const [selectedSLA, setSelectedSLA] = useState<string | null>('sla-1');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 p-6 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* Left Sidebar: Policies List */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800/50 backdrop-blur-xl">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-red-400" />
              SLA Policies
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Define response and resolution times to maintain support standards.</p>
            
            <button className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-lg shadow-red-900/20 font-medium">
              <Plus className="w-5 h-5" /> Create Policy
            </button>
          </div>

          <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-xl flex-1 overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-4 border-b border-gray-800 bg-gray-900/80 font-semibold text-gray-300 flex justify-between items-center">
              <span>Active Policies ({mockSLAs.filter(s=>s.active).length})</span>
              <Settings className="w-4 h-4 text-gray-500 cursor-pointer hover:text-gray-300" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {mockSLAs.map(sla => (
                <div 
                  key={sla.id}
                  onClick={() => setSelectedSLA(sla.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                    selectedSLA === sla.id 
                      ? 'bg-red-900/20 border-red-500/50 shadow-md' 
                      : 'bg-gray-800/30 border-gray-800 hover:bg-gray-800/60 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-semibold ${selectedSLA === sla.id ? 'text-red-400' : 'text-gray-200'}`}>
                      {sla.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {sla.active ? (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{sla.desc}</p>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {sla.targets} Targets
                    </span>
                    <span className="bg-gray-950 px-2 py-1 rounded text-gray-400 font-mono">
                      {sla.matching.toLocaleString()} tickets
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content: Policy Editor */}
        <div className="w-full lg:w-2/3">
          {selectedSLA ? (
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-xl h-full flex flex-col">
              
              {/* Editor Header */}
              <div className="p-6 border-b border-gray-800 bg-gray-900/80 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold text-white">Enterprise Default SLA</h2>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-500/20">Active</span>
                  </div>
                  <p className="text-gray-400">Applies to 1,240 currently active tickets.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-gray-700 bg-gray-900">
                    <StopCircle className="w-5 h-5" />
                  </button>
                  <button className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors border border-gray-700 bg-gray-900">
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium ml-2 shadow-lg shadow-red-900/20">
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10">
                
                {/* Apply To */}
                <section>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Filter className="w-4 h-4" /> 1. Apply this SLA when:
                  </h3>
                  <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-gray-300">Ticket</span>
                      <select className="bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option>Organization</option>
                      </select>
                      <span className="text-sm text-gray-300">is</span>
                      <select className="bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option>Enterprise Tier</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* SLA Targets */}
                <section>
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4" /> 2. Set SLA Targets
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Business Hours:</span>
                      <select className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-xs">
                        <option>24/7 Support</option>
                        <option>US East (9-5)</option>
                        <option>EMEA (9-5)</option>
                      </select>
                    </div>
                  </div>

                  <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900/50">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                          <th className="px-6 py-4 font-semibold w-1/4">Priority</th>
                          <th className="px-6 py-4 font-semibold">First Response</th>
                          <th className="px-6 py-4 font-semibold">Next Response</th>
                          <th className="px-6 py-4 font-semibold">Resolution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {[
                          { priority: 'Urgent', color: 'text-red-400', bg: 'bg-red-400/10' },
                          { priority: 'High', color: 'text-orange-400', bg: 'bg-orange-400/10' },
                          { priority: 'Medium', color: 'text-blue-400', bg: 'bg-blue-400/10' },
                          { priority: 'Low', color: 'text-gray-400', bg: 'bg-gray-400/10' },
                        ].map((row, i) => (
                          <tr key={i} className="hover:bg-gray-800/30">
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${row.color} ${row.bg}`}>
                                {row.priority}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <input type="number" defaultValue={i === 0 ? 15 : i === 1 ? 30 : 60} className="w-16 bg-gray-950 border border-gray-700 rounded p-1.5 text-center text-sm focus:border-red-500 outline-none" />
                                <select className="bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-400 outline-none">
                                  <option>mins</option><option>hrs</option><option>days</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <input type="number" defaultValue={i === 0 ? 30 : i === 1 ? 60 : 120} className="w-16 bg-gray-950 border border-gray-700 rounded p-1.5 text-center text-sm focus:border-red-500 outline-none" />
                                <select className="bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-400 outline-none">
                                  <option>mins</option><option>hrs</option><option>days</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <input type="number" defaultValue={i === 0 ? 4 : i === 1 ? 8 : 24} className="w-16 bg-gray-950 border border-gray-700 rounded p-1.5 text-center text-sm focus:border-red-500 outline-none" />
                                <select className="bg-gray-950 border border-gray-700 rounded p-1.5 text-sm text-gray-400 outline-none">
                                  <option defaultValue={i < 2 ? 'hrs' : 'days'}>{i < 2 ? 'hrs' : 'days'}</option>
                                  <option>mins</option><option>hrs</option><option>days</option>
                                </select>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Escalations */}
                <section>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> 3. Escalation Rules (What happens on breach)
                  </h3>

                  <div className="space-y-4">
                    {/* Breach Rule 1 */}
                    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 border-l-4 border-l-orange-500">
                      <div className="flex flex-wrap gap-4 items-center">
                        <span className="text-sm font-medium text-gray-300">When</span>
                        <select className="bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                          <option>First Response time</option>
                          <option>Resolution time</option>
                        </select>
                        <span className="text-sm font-medium text-gray-300">is approaching in</span>
                        <input type="number" defaultValue="15" className="w-16 bg-gray-900 border border-gray-600 rounded p-1.5 text-center text-sm" />
                        <span className="text-sm font-medium text-gray-300">mins, do:</span>
                      </div>
                      
                      <div className="mt-4 pl-4 border-l-2 border-gray-700 space-y-3">
                        <div className="flex items-center gap-3">
                          <Bell className="w-4 h-4 text-orange-400" />
                          <span className="text-sm text-gray-400">Notify assigned agent via internal alert</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-orange-400" />
                          <span className="text-sm text-gray-400">Email supervisor (manager@sabdesk.internal)</span>
                        </div>
                      </div>
                    </div>

                    {/* Breach Rule 2 */}
                    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 border-l-4 border-l-red-500">
                      <div className="flex flex-wrap gap-4 items-center">
                        <span className="text-sm font-medium text-gray-300">When</span>
                        <select className="bg-gray-900 border border-gray-600 text-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                          <option>Resolution time</option>
                          <option>First Response time</option>
                        </select>
                        <span className="text-sm font-medium text-gray-300">is</span>
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded font-bold text-xs uppercase tracking-wider">Breached</span>
                        <span className="text-sm font-medium text-gray-300">, do:</span>
                      </div>
                      
                      <div className="mt-4 pl-4 border-l-2 border-gray-700 space-y-3">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-sm text-gray-400">Escalate ticket priority to <strong className="text-gray-200">Urgent</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-4 h-4 text-red-400" />
                          <span className="text-sm text-gray-400">Add private note warning of breach</span>
                        </div>
                      </div>
                    </div>

                    <button className="w-full py-3 border-2 border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/5 transition-all flex items-center justify-center gap-2 font-medium text-sm">
                      <Plus className="w-4 h-4" /> Add Escalation Rule
                    </button>
                  </div>
                </section>

              </div>
            </div>
          ) : (
            <div className="h-full bg-gray-900/30 rounded-2xl border border-gray-800/50 flex flex-col items-center justify-center text-gray-500">
              <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a policy to view or edit details.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Added a dummy component to ensure import Filter is used
const Filter = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
);
