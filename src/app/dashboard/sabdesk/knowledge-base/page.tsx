"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  FolderTree,
  FileText,
  Settings,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  BarChart2,
  Filter,
  Download,
  Upload,
  Globe,
  Lock,
  Users,
  Clock,
  ArrowUpRight,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Quote,
  Maximize2,
  Save,
  Tag,
  Folder,
  History,
} from "lucide-react";

// Mock Data
const kbMetrics = [
  { id: 1, title: "Total Articles", value: "1,248", change: "+12%", trend: "up" },
  { id: 2, title: "Total Views", value: "845.2K", change: "+24%", trend: "up" },
  { id: 3, title: "Helpful Rating", value: "94.2%", change: "+1.5%", trend: "up" },
  { id: 4, title: "Needs Update", value: "42", change: "-8%", trend: "down" },
];

const categoryTree = [
  {
    id: "cat-1",
    name: "Getting Started",
    articles: 45,
    expanded: true,
    children: [
      { id: "cat-1-1", name: "Installation", articles: 12 },
      { id: "cat-1-2", name: "Account Setup", articles: 28 },
      { id: "cat-1-3", name: "Quickstart Guide", articles: 5 },
    ],
  },
  {
    id: "cat-2",
    name: "Core Features",
    articles: 156,
    expanded: false,
    children: [
      { id: "cat-2-1", name: "Dashboard Overview", articles: 34 },
      { id: "cat-2-2", name: "User Management", articles: 89 },
      { id: "cat-2-3", name: "Reporting & Analytics", articles: 33 },
    ],
  },
  {
    id: "cat-3",
    name: "Integrations",
    articles: 89,
    expanded: false,
    children: [
      { id: "cat-3-1", name: "API Documentation", articles: 45 },
      { id: "cat-3-2", name: "Webhooks", articles: 22 },
      { id: "cat-3-3", name: "Third-party Apps", articles: 22 },
    ],
  },
  {
    id: "cat-4",
    name: "Troubleshooting",
    articles: 234,
    expanded: false,
    children: [
      { id: "cat-4-1", name: "Common Errors", articles: 150 },
      { id: "cat-4-2", name: "Performance Issues", articles: 45 },
      { id: "cat-4-3", name: "Security FAQs", articles: 39 },
    ],
  },
];

const articles = Array.from({ length: 25 }).map((_, i) => ({
  id: `art-${i}`,
  title: [
    "How to configure SSO with Okta",
    "Understanding Billing Cycles",
    "Advanced Workflow Automation",
    "Setting up Custom Domains",
    "Resolving Sync Conflicts",
  ][i % 5] + ` (Part ${i + 1})`,
  category: ["Security", "Billing", "Features", "Settings", "Troubleshooting"][i % 5],
  author: ["Sarah Chen", "Alex Rivera", "Jamie Smith", "Taylor Wong"][i % 4],
  status: ["Published", "Draft", "Review", "Archived"][i % 4],
  views: Math.floor(Math.random() * 50000),
  helpful: Math.floor(Math.random() * 100) + 1,
  unhelpful: Math.floor(Math.random() * 20),
  lastUpdated: new Date(Date.now() - Math.random() * 10000000000).toISOString().split("T")[0],
}));

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "cat-1": true,
  });
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-400" />
            Knowledge Base
          </h1>
          <p className="text-slate-400 mt-1">Manage articles, categories, and self-service portals.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-2 transition-colors border border-slate-700">
            <Globe className="w-4 h-4" />
            View Portal
          </button>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            New Article
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kbMetrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <BarChart2 className="w-16 h-16 text-indigo-400" />
            </div>
            <p className="text-slate-400 text-sm font-medium">{metric.title}</p>
            <h3 className="text-3xl font-bold text-slate-100 mt-2">{metric.value}</h3>
            <div className="flex items-center gap-2 mt-3">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${
                  metric.trend === "up"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
                }`}
              >
                {metric.trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3 rotate-90" />}
                {metric.change}
              </span>
              <span className="text-xs text-slate-500">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Sidebar */}
        <div className="xl:w-80 flex-shrink-0 space-y-6">
          {/* Navigation */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("articles")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "articles"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
              }`}
            >
              <FileText className="w-4 h-4" /> All Articles
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "categories"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
              }`}
            >
              <FolderTree className="w-4 h-4" /> Categories
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "settings"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Settings className="w-4 h-4" /> KB Settings
            </button>
          </div>

          {/* Category Tree Quick View */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FolderTree className="w-4 h-4" /> Directory
            </h3>
            <div className="space-y-1">
              {categoryTree.map((cat) => (
                <div key={cat.id} className="text-sm">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="flex items-center justify-between w-full p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedCategories[cat.id] ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                      <Folder className="w-4 h-4 text-indigo-400" />
                      {cat.name}
                    </div>
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                      {cat.articles}
                    </span>
                  </button>
                  {expandedCategories[cat.id] && (
                    <div className="ml-6 pl-2 border-l border-slate-800 mt-1 space-y-1">
                      {cat.children.map((child) => (
                        <button
                          key={child.id}
                          className="flex items-center justify-between w-full p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 opacity-70" />
                            {child.name}
                          </div>
                          <span className="text-xs opacity-50">{child.articles}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[800px]">
          {activeTab === "articles" && (
            <>
              {/* Toolbar */}
              <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800">
                    <Filter className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800">
                    <Download className="w-4 h-4" />
                  </button>
                  <select className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
                    <option>All Statuses</option>
                    <option>Published</option>
                    <option>Draft</option>
                    <option>Review</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        Article
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        Category
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        Status
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        Metrics
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {articles.map((article) => (
                      <tr key={article.id} className="hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-200">{article.title}</span>
                            <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Users className="w-3 h-3" /> {article.author} • <Clock className="w-3 h-3 ml-2" /> {article.lastUpdated}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <Folder className="w-3 h-3 text-indigo-400" />
                            {article.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              article.status === "Published"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : article.status === "Draft"
                                ? "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                : article.status === "Review"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}
                          >
                            {article.status === "Published" && <CheckCircle2 className="w-3 h-3" />}
                            {article.status === "Draft" && <Edit className="w-3 h-3" />}
                            {article.status === "Review" && <Eye className="w-3 h-3" />}
                            {article.status === "Archived" && <Trash2 className="w-3 h-3" />}
                            {article.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1" title="Views">
                              <Eye className="w-3.5 h-3.5" /> {(article.views / 1000).toFixed(1)}k
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400/80" title="Helpful">
                              <ThumbsUp className="w-3.5 h-3.5" /> {article.helpful}
                            </span>
                            <span className="flex items-center gap-1 text-rose-400/80" title="Unhelpful">
                              <ThumbsDown className="w-3.5 h-3.5" /> {article.unhelpful}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors">
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
              <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-sm text-slate-400">
                <span>Showing 1 to 10 of 1,248 entries</span>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 border border-slate-800 rounded hover:bg-slate-800 transition-colors">Prev</button>
                  <button className="px-3 py-1 bg-indigo-600 text-white border border-indigo-500 rounded hover:bg-indigo-500 transition-colors">1</button>
                  <button className="px-3 py-1 border border-slate-800 rounded hover:bg-slate-800 transition-colors">2</button>
                  <button className="px-3 py-1 border border-slate-800 rounded hover:bg-slate-800 transition-colors">3</button>
                  <span>...</span>
                  <button className="px-3 py-1 border border-slate-800 rounded hover:bg-slate-800 transition-colors">Next</button>
                </div>
              </div>
            </>
          )}

          {activeTab === "categories" && (
            <div className="p-8 flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20">
                <FolderTree className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-200 mb-2">Category Management</h2>
              <p className="text-slate-400 max-w-md mb-8">Organize your knowledge base content into a hierarchical structure to help users find information easily.</p>
              <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                <Plus className="w-5 h-5" /> Add Root Category
              </button>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="p-8 overflow-auto h-full">
              <h2 className="text-xl font-bold text-slate-200 mb-6 pb-4 border-b border-slate-800">Knowledge Base Settings</h2>
              
              <div className="space-y-8 max-w-3xl">
                {/* General Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">General</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Portal Name</label>
                      <input type="text" defaultValue="SabDesk Help Center" className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Support Email</label>
                      <input type="email" defaultValue="support@sabdesk.com" className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                </div>

                {/* Appearance */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Appearance</h3>
                  <div className="p-5 border border-slate-800 rounded-xl bg-slate-950 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Primary Color</label>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-slate-700 cursor-pointer ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950"></div>
                        <div className="w-8 h-8 rounded-full bg-cyan-500 border-2 border-slate-700 cursor-pointer"></div>
                        <div className="w-8 h-8 rounded-full bg-rose-500 border-2 border-slate-700 cursor-pointer"></div>
                        <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-slate-700 cursor-pointer"></div>
                        <div className="w-8 h-8 rounded-full bg-amber-500 border-2 border-slate-700 cursor-pointer"></div>
                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer hover:border-slate-400">
                          <Plus className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Logo</label>
                      <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-900/50 hover:bg-slate-900 transition-colors cursor-pointer">
                        <Upload className="w-8 h-8 text-slate-500 mb-2" />
                        <span className="text-sm text-slate-400">Click or drag image to upload</span>
                        <span className="text-xs text-slate-500 mt-1">PNG, JPG, SVG up to 2MB</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Access Control */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Access Control</h3>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 border border-slate-800 rounded-xl bg-slate-950 cursor-pointer hover:border-slate-700 transition-colors">
                      <div className="mt-0.5">
                        <input type="radio" name="access" className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 focus:ring-indigo-500 focus:ring-offset-slate-950" defaultChecked />
                      </div>
                      <div>
                        <span className="block font-medium text-slate-200">Public Access</span>
                        <span className="block text-sm text-slate-400 mt-1">Anyone on the internet can view the knowledge base.</span>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-4 border border-slate-800 rounded-xl bg-slate-950 cursor-pointer hover:border-slate-700 transition-colors">
                      <div className="mt-0.5">
                        <input type="radio" name="access" className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 focus:ring-indigo-500 focus:ring-offset-slate-950" />
                      </div>
                      <div>
                        <span className="block font-medium text-slate-200 flex items-center gap-2">Restricted Access <Lock className="w-3.5 h-3.5 text-amber-500" /></span>
                        <span className="block text-sm text-slate-400 mt-1">Only authenticated users can access the knowledge base.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                  <button className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium">Cancel</button>
                  <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium flex items-center gap-2">
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal / Fullscreen Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Editor Header */}
          <div className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsEditorOpen(false)}
                className="p-2 -ml-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="h-6 w-px bg-slate-800"></div>
              <span className="text-sm font-medium text-slate-400">Editing:</span>
              <span className="text-sm font-medium text-slate-200">New Article</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-slate-400">Draft</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Saved just now</span>
              <button className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">
                Preview
              </button>
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                Publish Article
              </button>
            </div>
          </div>

          {/* Editor Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main Editing Area */}
            <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-950 relative">
              {/* Toolbar */}
              <div className="h-12 border-b border-slate-800 bg-slate-900 flex items-center px-4 gap-1 overflow-x-auto">
                <select className="bg-transparent text-slate-300 text-sm focus:outline-none border-none cursor-pointer py-1 px-2 hover:bg-slate-800 rounded mr-2">
                  <option>Paragraph</option>
                  <option>Heading 1</option>
                  <option>Heading 2</option>
                  <option>Heading 3</option>
                </select>
                <div className="w-px h-6 bg-slate-800 mx-1"></div>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><Bold className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><Italic className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><Underline className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-slate-800 mx-1"></div>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><AlignLeft className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><AlignCenter className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><AlignRight className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-slate-800 mx-1"></div>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><List className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><ListOrdered className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-slate-800 mx-1"></div>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><LinkIcon className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><ImageIcon className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><Code className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><Quote className="w-4 h-4" /></button>
                <div className="flex-1"></div>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"><Maximize2 className="w-4 h-4" /></button>
              </div>

              {/* Text Area */}
              <div className="flex-1 overflow-auto p-8 lg:p-12">
                <div className="max-w-4xl mx-auto">
                  <input 
                    type="text" 
                    placeholder="Article Title..." 
                    className="w-full text-4xl font-bold bg-transparent border-none text-slate-100 placeholder:text-slate-700 focus:outline-none mb-8"
                  />
                  <textarea 
                    placeholder="Start writing your article here..."
                    className="w-full h-[600px] bg-transparent border-none text-slate-300 placeholder:text-slate-700 focus:outline-none resize-none text-lg leading-relaxed"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Sidebar Settings */}
            <div className="w-80 bg-slate-900 overflow-auto flex-shrink-0">
              <div className="p-6 space-y-8">
                {/* Taxonomy */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Folder className="w-4 h-4 text-indigo-400" /> Organization
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
                    <select className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
                      <option>Select a category...</option>
                      <option>Getting Started</option>
                      <option>Core Features</option>
                      <option>Integrations</option>
                      <option>Troubleshooting</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Tags</label>
                    <div className="min-h-[42px] bg-slate-950 border border-slate-800 rounded-lg p-1.5 flex flex-wrap gap-1.5 focus-within:border-indigo-500">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-xs text-slate-300">
                        Authentication <button className="hover:text-rose-400"><XCircle className="w-3 h-3" /></button>
                      </span>
                      <input type="text" placeholder="Add tag..." className="bg-transparent border-none focus:outline-none text-sm text-slate-300 w-24 flex-1 min-w-[80px]" />
                    </div>
                  </div>
                </div>

                {/* Visibility */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Eye className="w-4 h-4 text-indigo-400" /> Visibility & SEO
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Access Level</label>
                    <select className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
                      <option>Public</option>
                      <option>Logged-in Users Only</option>
                      <option>Internal Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Meta Description</label>
                    <textarea rows={3} className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 resize-none" placeholder="Brief summary for search results..."></textarea>
                  </div>
                </div>

                {/* History */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <History className="w-4 h-4 text-indigo-400" /> Revision History
                  </h3>
                  <div className="space-y-3">
                    <div className="flex gap-3 relative">
                      <div className="w-px h-full bg-slate-800 absolute left-1 top-2"></div>
                      <div className="w-2 h-2 rounded-full bg-indigo-500 relative z-10 mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-300">Current Draft</p>
                        <p className="text-xs text-slate-500">Saved 2 mins ago by You</p>
                      </div>
                    </div>
                    <div className="flex gap-3 relative">
                      <div className="w-2 h-2 rounded-full bg-slate-700 relative z-10 mt-1.5 border border-slate-900"></div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-400">Initial Creation</p>
                        <p className="text-xs text-slate-500">Oct 12, 10:42 AM</p>
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
  );
}
