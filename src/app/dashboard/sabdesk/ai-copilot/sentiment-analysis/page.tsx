'use client';
import React, { useState } from 'react';
import { 
    BarChart, Activity, Users, Settings, Filter, Search, Download, 
    Share2, Plus, RefreshCw, ChevronDown, Bell, Zap, ShieldCheck, 
    Clock, Calendar, FileText, Layers, Target
} from 'lucide-react';

export default function AiCopilotSentimentAnalysisPage() {
    const [searchTerm, setSearchTerm] = useState('');
    
    return (
        <div className="flex flex-col w-full h-full min-h-screen bg-neutral-950 text-neutral-200">
            {/* Header */}
            <header className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-neutral-900/50 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Ai Copilot Sentiment Analysis Dashboard</h1>
                    <p className="text-neutral-400 mt-1">Manage and optimize your ai copilot sentiment analysis workflows and metrics.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors border border-white/5">
                        <Search className="w-5 h-5 text-neutral-400" />
                    </button>
                    <button className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors border border-white/5">
                        <Bell className="w-5 h-5 text-neutral-400" />
                    </button>
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all">
                        <Plus className="w-4 h-4" />
                        Create New
                    </button>
                </div>
            </header>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-neutral-900/20">
                <div className="flex gap-2">
                    {['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'].map(t => (
                        <button key={t} className="px-4 py-1.5 text-sm font-medium bg-neutral-800/50 hover:bg-neutral-700 rounded-full border border-white/5 transition-all">
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-md border border-white/5">
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-md border border-white/5">
                        <Download className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
                {/* KPI Cards */}
                <div className="col-span-12 grid grid-cols-4 gap-6">
                    {[
                        { label: 'Total Volume', value: '124,592', change: '+14%', icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { label: 'Active Users', value: '8,432', change: '+5%', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'System Health', value: '99.9%', change: 'Stable', icon: ShieldCheck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        { label: 'Avg Resolution', value: '1.2 hrs', change: '-12%', icon: Clock, color: 'text-rose-400', bg: 'bg-rose-500/10' }
                    ].map((kpi, i) => (
                        <div key={i} className="p-6 bg-neutral-900 border border-white/10 rounded-2xl relative overflow-hidden group hover:border-white/20 transition-all">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <kpi.icon className="w-24 h-24" />
                            </div>
                            <div className={`w-12 h-12 rounded-xl ${kpi.bg} flex items-center justify-center mb-4`}>
                                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                            </div>
                            <h3 className="text-neutral-400 font-medium mb-1">{kpi.label}</h3>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-bold text-white">{kpi.value}</span>
                                <span className="text-sm text-emerald-400 font-medium mb-1">{kpi.change}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Data View */}
                <div className="col-span-8 bg-neutral-900 border border-white/10 rounded-2xl flex flex-col h-[600px]">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Live Data Feed</h2>
                        <button className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"><RefreshCw className="w-5 h-5 text-neutral-400" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">ID</th>
                                    <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Name</th>
                                    <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Status</th>
                                    <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Priority</th>
                                    <th className="p-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 15 }).map((_, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-neutral-800/50 transition-colors cursor-pointer">
                                        <td className="p-4 text-sm text-neutral-300 font-mono">#AI -{1000 + i}</td>
                                        <td className="p-4 text-sm text-white font-medium">Ai Copilot Sentiment Analysis Item {i + 1}</td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">Active</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 text-xs font-medium bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">High</span>
                                        </td>
                                        <td className="p-4">
                                            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">View Details</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Side Panel */}
                <div className="col-span-4 flex flex-col gap-6 h-[600px]">
                    <div className="flex-1 bg-neutral-900 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Zap className="text-amber-400" /> AI Insights</h2>
                        <div className="space-y-4">
                            {[1,2,3,4,5].map(i => (
                                <div key={i} className="p-4 bg-neutral-800/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-neutral-200">Optimization Required</h4>
                                        <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Action</span>
                                    </div>
                                    <p className="text-sm text-neutral-400">The system has detected an anomaly in the standard workflow pattern for {ai copilot sentiment analysis}.</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
