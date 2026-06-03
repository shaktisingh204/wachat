"use client";

import React, { useState } from 'react';
import { 
  Zap, Plus, Search, Filter, Play, CheckCircle, Activity,
  AlertCircle, ArrowRight, Save, Trash2, Edit, MoreHorizontal,
  ChevronDown, Code, GitBranch, Terminal, ShieldAlert, FileJson
} from 'lucide-react';

const mockTriggers = [
  { id: 't1', name: 'Auto-assign VIP Tickets', event: 'Ticket Created', active: true, conditions: 2, actions: 1, lastRun: '2 mins ago' },
  { id: 't2', name: 'SLA Warning Escalation', event: 'Time Based', active: true, conditions: 3, actions: 2, lastRun: '15 mins ago' },
  { id: 't3', name: 'Spam Filter Auto-close', event: 'Ticket Created', active: false, conditions: 5, actions: 3, lastRun: '2 days ago' },
  { id: 't4', name: 'Notify Manager on Negative CSAT', event: 'CSAT Received', active: true, conditions: 1, actions: 2, lastRun: '1 hr ago' },
  { id: 't5', name: 'Auto-reply outside Business Hours', event: 'Ticket Created', active: true, conditions: 2, actions: 1, lastRun: '5 hrs ago' },
];

export default function TriggersPage() {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/50 p-6 rounded-2xl border border-gray-800/50 backdrop-blur-xl">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-3">
              <Zap className="w-8 h-8 text-emerald-400" />
              Event Triggers
            </h1>
            <p className="text-gray-400 mt-2">Set up powerful automations that run when specific events occur in your helpdesk.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('builder')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
            >
              <Plus className="w-4 h-4" /> New Trigger
            </button>
          </div>
        </div>

        {activeTab === 'list' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Active Triggers', value: '42', icon: Activity, color: 'text-emerald-400' },
                { label: 'Executions (24h)', value: '15.4k', icon: Play, color: 'text-blue-400' },
                { label: 'Failed Executions', value: '3', icon: AlertCircle, color: 'text-red-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800/50 backdrop-blur-md flex items-center gap-4">
                  <div className={`p-4 rounded-xl bg-gray-800/50 ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-md overflow-hidden">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
                <div className="relative w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Search triggers..." 
                    className="w-full bg-gray-800/50 border border-gray-700 text-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-gray-700 text-sm">
                  <Filter className="w-4 h-4" /> Filter
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-800/30 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                      <th className="px-6 py-4 font-semibold">Name</th>
                      <th className="px-6 py-4 font-semibold">Trigger Event</th>
                      <th className="px-6 py-4 font-semibold">Complexity</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Last Run</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {mockTriggers.map((trigger) => (
                      <tr key={trigger.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-200">{trigger.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-xs font-medium">
                            <Play className="w-3 h-3 text-emerald-400" />
                            {trigger.event}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 text-xs text-gray-500">
                            <span>{trigger.conditions} Conditions</span>
                            <span>{trigger.actions} Actions</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {trigger.active ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-gray-500 text-sm font-medium">
                              <span className="w-2 h-2 rounded-full bg-gray-500"></span> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {trigger.lastRun}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setActiveTab('builder')} className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors">
                              <MoreHorizontal className="w-4 h-4" />
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

        {activeTab === 'builder' && (
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-gray-900/80 flex justify-between items-center sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveTab('list')} className="text-gray-400 hover:text-white transition-colors">
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-white">Create Automation Trigger</h2>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActiveTab('list')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700 font-medium text-sm">
                  Cancel
                </button>
                <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-lg shadow-emerald-900/20 font-medium text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save & Activate
                </button>
              </div>
            </div>

            <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-12">
              
              {/* Trigger Name */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Trigger Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Escalate VIP tickets created off-hours" 
                  className="w-full bg-gray-900 border border-gray-700 text-xl text-white rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-gray-600"
                />
              </div>

              {/* Event Section */}
              <div className="relative border-l-2 border-emerald-500/30 pl-8 pb-8">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-emerald-900/50 border-2 border-emerald-500 flex items-center justify-center">
                  <Play className="w-4 h-4 text-emerald-400 ml-0.5" />
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">1. When this event occurs</h3>
                    <p className="text-sm text-gray-400">Choose what triggers this automation to run.</p>
                  </div>
                  
                  <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-2 inline-flex">
                    <select className="bg-transparent text-white font-medium px-4 py-2 focus:outline-none appearance-none cursor-pointer pr-10 relative z-10 w-64">
                      <option className="bg-gray-900">Ticket is Created</option>
                      <option className="bg-gray-900">Ticket is Updated</option>
                      <option className="bg-gray-900">New Message Added</option>
                      <option className="bg-gray-900">Time Based (Cron)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Conditions Section */}
              <div className="relative border-l-2 border-amber-500/30 pl-8 pb-8">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-amber-900/50 border-2 border-amber-500 flex items-center justify-center">
                  <GitBranch className="w-4 h-4 text-amber-400" />
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">2. Check these conditions</h3>
                    <p className="text-sm text-gray-400">Only proceed if the ticket matches these criteria.</p>
                  </div>
                  
                  {/* ALL Conditions */}
                  <div className="bg-gray-800/20 border border-gray-700 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs font-bold tracking-wider">MATCH ALL</span>
                      <span className="text-sm text-gray-500">of the following conditions:</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Condition Row 1 */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <select className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-48">
                          <option>Ticket: Priority</option>
                          <option>Ticket: Status</option>
                          <option>Requester: Email</option>
                        </select>
                        <select className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-32">
                          <option>Is</option>
                          <option>Is not</option>
                          <option>Contains</option>
                        </select>
                        <select className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 flex-1 min-w-[150px]">
                          <option>Urgent</option>
                          <option>High</option>
                          <option>Normal</option>
                        </select>
                        <button className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      {/* Condition Row 2 */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <select className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-48">
                          <option>Requester: VIP Status</option>
                          <option>Ticket: Status</option>
                          <option>Requester: Email</option>
                        </select>
                        <select className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-32">
                          <option>Is True</option>
                          <option>Is False</option>
                        </select>
                        <button className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    
                    <button className="text-sm text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors">
                      <Plus className="w-4 h-4" /> Add "ALL" Condition
                    </button>
                  </div>

                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-gray-800"></div>
                    <span className="text-xs font-bold text-gray-500 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">AND</span>
                    <div className="flex-1 h-px bg-gray-800"></div>
                  </div>

                  {/* ANY Conditions */}
                  <div className="bg-gray-800/20 border border-gray-700 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs font-bold tracking-wider">MATCH ANY</span>
                      <span className="text-sm text-gray-500">of the following conditions (optional):</span>
                    </div>

                    <button className="text-sm text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors">
                      <Plus className="w-4 h-4" /> Add "ANY" Condition
                    </button>
                  </div>

                </div>
              </div>

              {/* Actions Section */}
              <div className="relative border-l-2 border-transparent pl-8">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-blue-900/50 border-2 border-blue-500 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">3. Perform these actions</h3>
                    <p className="text-sm text-gray-400">What should happen when the conditions are met?</p>
                  </div>

                  <div className="bg-gray-800/20 border border-gray-700 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col gap-4">
                      
                      {/* Action Row 1 */}
                      <div className="flex gap-4 p-4 bg-gray-900 border border-gray-700 rounded-lg items-start">
                        <div className="mt-1"><Terminal className="w-5 h-5 text-gray-500" /></div>
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-center">
                            <select className="bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 w-48 font-medium">
                              <option>Trigger Webhook</option>
                              <option>Assign to Agent</option>
                              <option>Send Email</option>
                            </select>
                            <button className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          
                          <div className="space-y-3 pt-2">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Endpoint URL</label>
                              <input type="text" defaultValue="https://api.internal.corp/notify-escalation" className="w-full bg-gray-950 border border-gray-800 text-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block flex justify-between">Payload (JSON) <FileJson className="w-3 h-3" /></label>
                              <textarea rows={4} className="w-full bg-gray-950 border border-gray-800 text-blue-300 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-none" defaultValue={`{\n  "ticket_id": "{ticket.id}",\n  "priority": "{ticket.priority}",\n  "alert_channel": "#urgent-support"\n}`}></textarea>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    <button className="w-full py-4 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 font-medium">
                      <Plus className="w-5 h-5" /> Add Action
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
