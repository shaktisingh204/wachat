"use client";

import React, { useState } from "react";
import {
  Megaphone,
  Calendar,
  BarChart,
  Bell,
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Play,
  Pause,
  Eye,
  Trash2,
  Edit2,
  Layout,
  Type,
  Image as ImageIcon,
  Link as LinkIcon,
  MousePointerClick,
  XCircle,
  Clock,
  Target,
  Smartphone,
  Globe,
  Settings,
  ArrowRight,
  Maximize2,
  Monitor,
  LayoutTemplate,
  ChevronDown
} from "lucide-react";

// Mock Data
const announcements = [
  { id: 1, title: "SabDesk v2.0 Launch", type: "Banner", status: "Active", audience: "All Users", views: "45.2k", clicks: "12.4k", ctr: "27.4%" },
  { id: 2, title: "Scheduled Maintenance", type: "Modal", status: "Scheduled", audience: "Enterprise", views: "0", clicks: "0", ctr: "0%" },
  { id: 3, title: "New Feature: AI Summaries", type: "Push", status: "Draft", audience: "Beta Testers", views: "-", clicks: "-", ctr: "-" },
  { id: 4, title: "Holiday Support Hours", type: "Banner", status: "Ended", audience: "All Users", views: "120.5k", clicks: "5.2k", ctr: "4.3%" },
  { id: 5, title: "Webinar: Best Practices", type: "Email + Push", status: "Ended", audience: "Admins", views: "15k", clicks: "3.1k", ctr: "20.6%" },
];

export default function AnnouncementsPage() {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [bannerConfig, setBannerConfig] = useState({
    text: "We just launched SabDesk v2.0! Check out what's new.",
    ctaText: "Read Announcement",
    bgColor: "bg-indigo-600",
    textColor: "text-white",
    position: "top",
    hasCloseBtn: true,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-amber-400" />
            Announcements & Campaigns
          </h1>
          <p className="text-slate-400 mt-1">Design, target, and measure announcements across your product.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setActiveTab("composer"); setIsComposerOpen(true); }
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/20 font-medium"
          >
            <Plus className="w-5 h-5" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-800 mb-6 pb-2 gap-6 scrollbar-hide">
        <button
          onClick={() => { setActiveTab("campaigns"); setIsComposerOpen(false); }
          className={`pb-2 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "campaigns" ? "border-amber-500 text-amber-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Megaphone className="w-4 h-4" /> All Campaigns
        </button>
        <button
          onClick={() => { setActiveTab("analytics"); setIsComposerOpen(false); }
          className={`pb-2 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "analytics" ? "border-amber-500 text-amber-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart className="w-4 h-4" /> Performance Analytics
        </button>
        <button
          onClick={() => { setActiveTab("audience"); setIsComposerOpen(false); }
          className={`pb-2 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "audience" ? "border-amber-500 text-amber-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Target className="w-4 h-4" /> Audience Segments
        </button>
        {isComposerOpen && (
          <button
            className="pb-2 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 border-amber-500 text-amber-400 ml-auto"
          >
            <LayoutTemplate className="w-4 h-4" /> Campaign Builder
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[700px]">
        
        {/* Campaigns List */}
        {activeTab === "campaigns" && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between gap-4 bg-slate-900/50">
              <div className="flex gap-2">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search campaigns..."
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button className="px-4 py-2 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filters
                </button>
              </div>
              <div className="flex gap-2">
                <select className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500">
                  <option>All Types</option>
                  <option>Banner</option>
                  <option>Modal</option>
                  <option>Push Notification</option>
                </select>
                <select className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500">
                  <option>All Statuses</option>
                  <option>Active</option>
                  <option>Scheduled</option>
                  <option>Draft</option>
                  <option>Ended</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Campaign Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Target Audience</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Performance</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {announcements.map((ann) => (
                    <tr key={ann.id} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                            ann.type === 'Banner' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                            ann.type === 'Modal' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          }`}>
                            {ann.type === 'Banner' ? <Layout className="w-5 h-5" /> : 
                             ann.type === 'Modal' ? <Maximize2 className="w-5 h-5" /> : 
                             <Bell className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-medium text-slate-200">{ann.title}</div>
                            <div className="text-xs text-slate-500">{ann.type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          ann.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          ann.status === 'Scheduled' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          ann.status === 'Draft' ? 'bg-slate-700/30 text-slate-400 border-slate-700' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {ann.status === 'Active' && <Play className="w-3 h-3 mr-1" />}
                          {ann.status === 'Scheduled' && <Clock className="w-3 h-3 mr-1" />}
                          {ann.status === 'Draft' && <Edit2 className="w-3 h-3 mr-1" />}
                          {ann.status === 'Ended' && <Pause className="w-3 h-3 mr-1" />}
                          {ann.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Users className="w-4 h-4 text-slate-500" /> {ann.audience}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-4">
                          <div>
                            <div className="text-xs text-slate-500">Views</div>
                            <div className="text-sm font-medium text-slate-200">{ann.views}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Clicks</div>
                            <div className="text-sm font-medium text-slate-200">{ann.clicks}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">CTR</div>
                            <div className="text-sm font-medium text-amber-400">{ann.ctr}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-md transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-200 mb-6">Global Engagement Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[
                { label: "Total Impressions", value: "2.4M", change: "+15.2%", trend: "up" },
                { label: "Average CTR", value: "8.4%", change: "+2.1%", trend: "up" },
                { label: "Dismissal Rate", value: "42.1%", change: "-5.4%", trend: "down" },
                { label: "Conversion Rate", value: "3.2%", change: "+0.8%", trend: "up" },
              ].map((stat, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="text-sm text-slate-400 mb-1">{stat.label}</div>
                  <div className="text-3xl font-bold text-slate-100">{stat.value}</div>
                  <div className={`text-xs mt-2 font-medium ${stat.trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stat.change} vs last month
                  </div>
                </div>
              ))}
            </div>

            <div className="h-64 border border-dashed border-slate-700 rounded-xl flex items-center justify-center flex-col text-slate-500 bg-slate-950/50">
              <BarChart className="w-12 h-12 mb-4 opacity-50" />
              <p>Chart Component Placeholder (Impressions vs Clicks over time)</p>
            </div>
          </div>
        )}

        {/* Campaign Builder (Composer Tab) */}
        {activeTab === "composer" && (
          <div className="flex h-full flex-col xl:flex-row">
            {/* Editor Sidebar */}
            <div className="w-full xl:w-[400px] border-r border-slate-800 bg-slate-900 overflow-auto flex-shrink-0 flex flex-col">
              <div className="p-4 border-b border-slate-800">
                <input 
                  type="text" 
                  defaultValue="New Campaign" 
                  className="w-full bg-transparent text-xl font-bold text-slate-200 border-none focus:outline-none focus:ring-0 placeholder:text-slate-600"
                />
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-6">
                
                {/* Type Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-amber-500 bg-amber-500/10 text-amber-400">
                      <Layout className="w-6 h-6" />
                      <span className="text-sm font-medium">Top Banner</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200 transition-colors">
                      <Maximize2 className="w-6 h-6" />
                      <span className="text-sm font-medium">Modal Popup</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200 transition-colors">
                      <Bell className="w-6 h-6" />
                      <span className="text-sm font-medium">Push Notif</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200 transition-colors">
                      <Smartphone className="w-6 h-6" />
                      <span className="text-sm font-medium">In-App Msg</span>
                    </button>
                  </div>
                </div>

                {/* Content Configuration */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Type className="w-4 h-4" /> Content
                  </label>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Announcement Message</label>
                    <textarea 
                      rows={3} 
                      value={bannerConfig.text}
                      onChange={(e) => setBannerConfig({...bannerConfig, text: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 resize-none"
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Call to Action (CTA)</label>
                      <input 
                        type="text" 
                        value={bannerConfig.ctaText}
                        onChange={(e) => setBannerConfig({...bannerConfig, ctaText: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">CTA Link URL</label>
                      <input 
                        type="text" 
                        placeholder="https://"
                        className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500" 
                      />
                    </div>
                  </div>
                </div>

                {/* Appearance */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Appearance
                  </label>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Background Color</label>
                    <div className="flex gap-2">
                      {['bg-indigo-600', 'bg-slate-900', 'bg-rose-600', 'bg-emerald-600', 'bg-amber-600', 'bg-blue-600', 'bg-purple-600'].map((color) => (
                        <button 
                          key={color}
                          onClick={() => setBannerConfig({...bannerConfig, bgColor: color})}
                          className={`w-8 h-8 rounded-full border-2 ${color} ${bannerConfig.bgColor === color ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900 border-white/20' : 'border-transparent'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-slate-800 rounded-lg bg-slate-950">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Allow Dismissal</div>
                      <div className="text-xs text-slate-500">Show a close button</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={bannerConfig.hasCloseBtn} onChange={(e) => setBannerConfig({...bannerConfig, hasCloseBtn: e.target.checked})} />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>

                {/* Targeting */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Target className="w-4 h-4" /> Targeting & Schedule
                  </label>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Audience Segment</label>
                    <select className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500">
                      <option>All Users</option>
                      <option>Premium Subscribers</option>
                      <option>New Users (Last 30 Days)</option>
                      <option>Custom Segment...</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Date</label>
                      <input type="datetime-local" className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">End Date</label>
                      <input type="datetime-local" className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Actions */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 mt-auto">
                <button className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">Save Draft</button>
                <button className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <Play className="w-4 h-4" /> Launch Campaign
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-slate-950 p-8 flex flex-col relative">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Monitor className="w-4 h-4" /> Live Preview
                </h2>
                <div className="flex gap-2">
                  <button className="p-2 bg-slate-800 text-slate-200 rounded border border-slate-700"><Monitor className="w-4 h-4" /></button>
                  <button className="p-2 bg-slate-900 text-slate-400 rounded border border-slate-800 hover:bg-slate-800"><Smartphone className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Fake Browser Window */}
              <div className="flex-1 border border-slate-800 rounded-xl overflow-hidden bg-white shadow-2xl flex flex-col relative max-w-5xl mx-auto w-full">
                {/* Browser Chrome */}
                <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white border border-slate-200 h-6 rounded text-[10px] text-slate-400 flex items-center px-3 justify-center">
                      <Lock className="w-3 h-3 mr-1" /> your-app.sabdesk.com
                    </div>
                  </div>
                </div>

                {/* Simulated App Area */}
                <div className="flex-1 bg-slate-50 relative flex flex-col">
                  
                  {/* LIVE BANNER PREVIEW */}
                  {bannerConfig.position === 'top' && (
                    <div className={`${bannerConfig.bgColor} ${bannerConfig.textColor} px-4 py-3 flex items-center justify-between text-sm font-medium shadow-md relative z-50`}>
                      <div className="flex-1 text-center flex justify-center items-center gap-4">
                        <span>{bannerConfig.text || "Your announcement text goes here"}</span>
                        {bannerConfig.ctaText && (
                          <button className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-bold transition-colors">
                            {bannerConfig.ctaText}
                          </button>
                        )}
                      </div>
                      {bannerConfig.hasCloseBtn && (
                        <button className="text-white/70 hover:text-white p-1">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* App Mock Content */}
                  <div className="flex-1 p-8 flex gap-8 opacity-40 grayscale pointer-events-none">
                    <div className="w-64 bg-white border border-slate-200 rounded-xl h-full p-4 space-y-4">
                      <div className="h-8 bg-slate-200 rounded w-3/4 mb-8"></div>
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                      <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                      <div className="h-4 bg-slate-200 rounded w-4/6"></div>
                    </div>
                    <div className="flex-1 space-y-6">
                      <div className="h-12 bg-white border border-slate-200 rounded-xl w-full"></div>
                      <div className="h-64 bg-white border border-slate-200 rounded-xl w-full p-6">
                        <div className="h-6 bg-slate-200 rounded w-1/4 mb-6"></div>
                        <div className="space-y-3">
                          <div className="h-4 bg-slate-200 rounded w-full"></div>
                          <div className="h-4 bg-slate-200 rounded w-full"></div>
                          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        </div>
                      </div>
                    </div>
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

// Ensure Lock is imported for the browser mock
const Lock = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
