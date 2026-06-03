"use client";

import React, { useState } from 'react';
import { 
  Bot, Settings, Plus, Search, Filter, MoreVertical, Play, 
  MessageSquare, Edit3, Trash2, Tag, UserPlus, Clock, 
  Zap, Copy, ArrowRight, CornerDownRight, CheckCircle2,
  XCircle, SlidersHorizontal, BookOpen, Hash
} from 'lucide-react';

const mockMacros = Array.from({ length: 45 }).map((_, i) => ({
  id: `mac-${i}`,
  name: i % 3 === 0 ? 'Reset Password Flow' : i % 3 === 1 ? 'Refund Request Standard' : 'Escalate to L2 Tech',
  description: 'Standard procedure for handling incoming requests of this type.',
  category: i % 2 === 0 ? 'Billing' : 'Technical',
  usageCount: Math.floor(Math.random() * 5000),
  lastUpdated: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
  active: i % 5 !== 0,
  actions: Math.floor(Math.random() * 4) + 1
}));

export default function MacrosPage() {
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 p-6 font-sans flex gap-6">
      
      {/* Main List Area */}
      <div className={`flex-1 transition-all duration-300 ${selectedMacro || isCreating ? 'hidden lg:block lg:w-1/2' : 'w-full'}`}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/50 p-6 rounded-2xl border border-gray-800/50 backdrop-blur-xl">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3">
                <Bot className="w-8 h-8 text-purple-400" />
                Macros & Quick Actions
              </h1>
              <p className="text-gray-400 mt-2">Automate repetitive tasks with one-click multi-action macros.</p>
            </div>
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-lg shadow-purple-900/20"
            >
              <Plus className="w-4 h-4" /> Create Macro
            </button>
          </div>

          <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-md overflow-hidden flex flex-col h-[calc(100vh-220px)]">
            <div className="p-4 border-b border-gray-800 flex flex-wrap gap-4 items-center justify-between bg-gray-900/80">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search macros by name or action..." 
                  className="w-full bg-gray-800/50 border border-gray-700 text-gray-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
                />
              </div>
              <div className="flex gap-2">
                <select className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500">
                  <option>All Categories</option>
                  <option>Billing</option>
                  <option>Technical</option>
                  <option>General</option>
                </select>
                <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-gray-700">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-900 z-10">
                  <tr className="bg-gray-800/30 text-gray-400 text-sm border-b border-gray-800">
                    <th className="px-6 py-4 font-semibold">Macro Name</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                    <th className="px-6 py-4 font-semibold">Usage</th>
                    <th className="px-6 py-4 font-semibold">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {mockMacros.map((macro, idx) => (
                    <tr 
                      key={macro.id} 
                      onClick={() => { setSelectedMacro(macro.id); setIsCreating(false); }}
                      className={`hover:bg-gray-800/40 transition-colors cursor-pointer group ${selectedMacro === macro.id ? 'bg-purple-900/10 border-l-2 border-purple-500' : 'border-l-2 border-transparent'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${macro.active ? 'bg-emerald-500' : 'bg-gray-600'}`}></div>
                          <div>
                            <p className="font-medium text-gray-200 group-hover:text-purple-300 transition-colors">{macro.name} {idx}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{macro.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-xs font-medium">
                          {macro.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Zap className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">{macro.actions} steps</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {macro.usageCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {macro.lastUpdated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Detail / Editor Panel */}
      {(selectedMacro || isCreating) && (
        <div className="flex-1 bg-gray-900/50 rounded-2xl border border-gray-800/50 backdrop-blur-md overflow-hidden flex flex-col h-[calc(100vh-48px)] sticky top-6 shadow-2xl animate-in slide-in-from-right-8 duration-300">
          <div className="p-6 border-b border-gray-800 bg-gray-900/80 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isCreating ? 'Create New Macro' : 'Edit Macro: Reset Password Flow'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">Configure actions to run simultaneously.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { setSelectedMacro(null); setIsCreating(false); }
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Save Macro
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Macro Name</label>
                  <input type="text" defaultValue={isCreating ? '' : 'Reset Password Flow'} className="w-full bg-gray-800/80 border border-gray-700 text-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Category</label>
                  <select className="w-full bg-gray-800/80 border border-gray-700 text-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                    <option>Technical</option>
                    <option>Billing</option>
                    <option>General</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-300">Description</label>
                  <textarea rows={2} defaultValue={isCreating ? '' : 'Standard procedure for handling incoming requests of this type.'} className="w-full bg-gray-800/80 border border-gray-700 text-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"></textarea>
                </div>
              </div>
            </div>

            <hr className="border-gray-800" />

            {/* Actions Builder */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Actions to Perform
                </h3>
                <button className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 bg-purple-400/10 px-2 py-1 rounded">
                  <Play className="w-3 h-3" /> Test Run
                </button>
              </div>

              <div className="space-y-3">
                {/* Action 1 */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 flex gap-4 group">
                  <div className="mt-1 cursor-move text-gray-600 group-hover:text-gray-400">
                    <MoreVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center">
                      <select className="bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 w-48">
                        <option>Status</option>
                        <option>Priority</option>
                        <option>Assign to Agent</option>
                        <option>Add Tags</option>
                        <option>Add Public Reply</option>
                      </select>
                      <button className="text-gray-500 hover:text-red-400 transition-colors">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <CornerDownRight className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-400">Set to</span>
                      <select className="bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 flex-1">
                        <option>Resolved</option>
                        <option>Pending</option>
                        <option>Open</option>
                        <option>Closed</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Action 2 */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 flex gap-4 group">
                  <div className="mt-1 cursor-move text-gray-600 group-hover:text-gray-400">
                    <MoreVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center">
                      <select className="bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 w-48" defaultValue="Add Tags">
                        <option>Status</option>
                        <option>Priority</option>
                        <option>Assign to Agent</option>
                        <option>Add Tags</option>
                        <option>Add Public Reply</option>
                      </select>
                      <button className="text-gray-500 hover:text-red-400 transition-colors">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <CornerDownRight className="w-4 h-4 text-gray-600" />
                      <div className="flex flex-wrap gap-2 flex-1">
                        <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-1 rounded text-xs flex items-center gap-1">
                          password-reset <XCircle className="w-3 h-3 cursor-pointer" />
                        </span>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded text-xs flex items-center gap-1">
                          auto-handled <XCircle className="w-3 h-3 cursor-pointer" />
                        </span>
                        <button className="border border-dashed border-gray-600 text-gray-500 hover:text-gray-300 hover:border-gray-500 px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors">
                          <Plus className="w-3 h-3" /> Add Tag
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action 3 - Rich Text Editor Mock */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 flex gap-4 group">
                  <div className="mt-1 cursor-move text-gray-600 group-hover:text-gray-400">
                    <MoreVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center">
                      <select className="bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 w-48" defaultValue="Add Public Reply">
                        <option>Status</option>
                        <option>Priority</option>
                        <option>Assign to Agent</option>
                        <option>Add Tags</option>
                        <option>Add Public Reply</option>
                      </select>
                      <button className="text-gray-500 hover:text-red-400 transition-colors">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-start gap-3">
                      <CornerDownRight className="w-4 h-4 text-gray-600 mt-2" />
                      <div className="flex-1 border border-gray-700 rounded-lg bg-gray-900 overflow-hidden">
                        {/* Editor Toolbar */}
                        <div className="bg-gray-800/50 border-b border-gray-700 p-2 flex gap-2">
                          <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400"><Hash className="w-4 h-4" /></button>
                          <div className="w-px h-6 bg-gray-700 mx-1"></div>
                          <span className="text-gray-400 font-bold px-2 py-1">B</span>
                          <span className="text-gray-400 italic px-2 py-1">I</span>
                          <span className="text-gray-400 underline px-2 py-1">U</span>
                        </div>
                        <textarea 
                          rows={4}
                          className="w-full bg-transparent p-3 text-sm text-gray-300 focus:outline-none resize-y"
                          defaultValue="Hi {requester.first_name},\n\nI have gone ahead and triggered a password reset for your account. You should receive an email shortly with instructions on how to set a new password.\n\nLet me know if you need anything else!"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button className="w-full py-3 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2 font-medium">
                  <Plus className="w-5 h-5" /> Add Action
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
