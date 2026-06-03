'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Filter, LayoutGrid, List as ListIcon, 
  MoreVertical, FileSignature, FileText, Users, Clock, 
  Tag, ChevronRight, Settings, Eye, Share2, Trash2, 
  Copy, FolderOpen, CheckCircle, XCircle, AlertCircle, 
  Calendar, Mail, MessageSquare, Shield, ChevronLeft, 
  ChevronDown, Check, X, Star, Link as LinkIcon, FileCheck, 
  History, ArrowRight, UploadCloud, Edit3, Lock, Zap,
  AlertTriangle
} from 'lucide-react';

// --- Types & Interfaces ---
interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  required: boolean;
}

interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  roles: Role[];
  pages: number;
  lastUpdated: string;
  creator: string;
  isFavorite: boolean;
  status: 'active' | 'draft' | 'archived';
  usageCount: number;
  thumbnailUrl: string;
}

// --- Mock Data ---
const CATEGORIES = ['All', 'Human Resources', 'Sales', 'Legal', 'Operations', 'Finance', 'Real Estate', 'IT'];
const TAGS = ['NDA', 'Onboarding', 'Contract', 'Offer Letter', 'Invoice', 'Policy', 'Agreement', 'Lease', 'Compliance'];

const ROLE_COLORS = [
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-rose-500/20 text-rose-400 border-rose-500/30',
];

// --- Removed Mock Data ---

// --- Components ---

// Button Component
const Button = ({ children, variant = 'primary', className = '', ...props }: any) => {
  const baseStyle = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0A0B]";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 shadow-lg shadow-indigo-500/20",
    secondary: "bg-[#27272A] hover:bg-[#3F3F46] text-zinc-100 border border-[#3F3F46] focus:ring-zinc-500",
    ghost: "hover:bg-[#27272A] text-zinc-400 hover:text-zinc-100 focus:ring-zinc-500",
    danger: "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 focus:ring-rose-500"
  };
  
  return (
    <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} px-4 py-2 ${className}`} {...props}>
      {children}
    </button>
  );
};

// Badge Component
const Badge = ({ children, colorClass = "bg-zinc-800 text-zinc-300 border-zinc-700" }: any) => (
  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
    {children}
  </span>
);

// Wizard Modal Component
const UseTemplateWizard = ({ template, onClose }: { template: Template, onClose: () => void }) => {
  const [step, setStep] = useState(1);
  const [recipients, setRecipients] = useState<Record<string, { name: string, email: string }>>({});
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#121214] border border-[#27272A] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#27272A]">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" />
              Use Template: {template.title}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Configure recipients and envelope settings</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-[#27272A] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Steps */}
          <div className="w-64 bg-[#0A0A0B] border-r border-[#27272A] p-6 flex flex-col gap-6">
            {[
              { num: 1, title: 'Assign Roles', icon: Users, desc: 'Map roles to recipients' },
              { num: 2, title: 'Envelope Settings', icon: Settings, desc: 'Subject, expiration' },
              { num: 3, title: 'Review & Send', icon: FileSignature, desc: 'Final checks' }
            ].map((s) => (
              <div key={s.num} className={`flex gap-3 ${step === s.num ? 'opacity-100' : 'opacity-40'} transition-opacity`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                  step === s.num ? 'bg-indigo-600 border-indigo-500 text-white' : 
                  step > s.num ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-[#27272A] border-[#3F3F46] text-zinc-400'
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <div>
                  <div className={`font-medium ${step === s.num ? 'text-zinc-100' : 'text-zinc-400'}`}>{s.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-8 bg-[#121214]">
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-medium text-zinc-100">Assign Recipients to Roles</h3>
                  <Badge colorClass="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">{template.roles.length} Required Roles</Badge>
                </div>
                
                {template.roles.map((role) => (
                  <div key={role.id} className="p-5 rounded-xl border border-[#27272A] bg-[#0A0A0B] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge colorClass={role.color}>{role.name}</Badge>
                        <span className="text-sm text-zinc-400">{role.description}</span>
                      </div>
                      {role.required && <span className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Required</span>}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-400">Full Name</label>
                        <input 
                          type="text" 
                          placeholder="John Doe"
                          className="w-full bg-[#121214] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          value={recipients[role.id]?.name || ''}
                          onChange={(e) => setRecipients({...recipients, [role.id]: { ...recipients[role.id], name: e.target.value }})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-400">Email Address</label>
                        <input 
                          type="email" 
                          placeholder="john@example.com"
                          className="w-full bg-[#121214] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          value={recipients[role.id]?.email || ''}
                          onChange={(e) => setRecipients({...recipients, [role.id]: { ...recipients[role.id], email: e.target.value }})}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-medium text-zinc-100 mb-6">Envelope Settings</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Email Subject</label>
                    <input 
                      type="text" 
                      defaultValue={`Please sign: ${template.title}`}
                      className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Email Message (Optional)</label>
                    <textarea 
                      rows={4}
                      placeholder="Add a personalized message for the recipients..."
                      className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-lg px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div className="p-4 rounded-xl border border-[#27272A] bg-[#0A0A0B] flex items-start gap-3">
                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-zinc-100">Expiration</h4>
                        <p className="text-xs text-zinc-400 mt-1">Envelope expires in</p>
                        <select className="mt-2 w-full bg-[#121214] border border-[#27272A] rounded-md px-2 py-1 text-sm text-zinc-300">
                          <option>7 days</option>
                          <option>14 days</option>
                          <option>30 days</option>
                          <option>90 days</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-xl border border-[#27272A] bg-[#0A0A0B] flex items-start gap-3">
                      <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-zinc-100">Authentication</h4>
                        <p className="text-xs text-zinc-400 mt-1">Require extra verification</p>
                        <select className="mt-2 w-full bg-[#121214] border border-[#27272A] rounded-md px-2 py-1 text-sm text-zinc-300">
                          <option>None (Email link only)</option>
                          <option>Access Code</option>
                          <option>SMS OTP</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center py-6 border-b border-[#27272A] mb-6">
                  <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-100">Ready to Send</h3>
                  <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto">Please review the details below. Once sent, all recipients will be notified in sequence.</p>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#0A0A0B] rounded-xl border border-[#27272A] p-5">
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Recipients Summary</h4>
                    <div className="space-y-3">
                      {template.roles.map((role, idx) => (
                        <div key={role.id} className="flex items-center gap-4">
                          <div className="w-6 h-6 rounded-full bg-[#27272A] text-zinc-400 flex items-center justify-center text-xs font-medium">
                            {idx + 1}
                          </div>
                          <div className="flex-1 flex justify-between items-center bg-[#121214] border border-[#27272A] p-3 rounded-lg">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-zinc-200">{recipients[role.id]?.name || 'Not provided'}</span>
                              <span className="text-xs text-zinc-500">{recipients[role.id]?.email || 'No email'}</span>
                            </div>
                            <Badge colorClass={role.color}>{role.name}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#27272A] bg-[#0A0A0B] flex justify-between items-center">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)}>
                Continue <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                <UploadCloud className="w-4 h-4 mr-2" /> Send Envelope
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Page Component
export default function SabSignTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTemplateModal, setActiveTemplateModal] = useState<Template | null>(null);

  React.useEffect(() => {
    import('@/app/actions/sabsign.actions').then(({ listTemplates }) => {
      listTemplates({ limit: 100 }).then(res => {
        const mapped = res.items.map((doc: any, i: number) => ({
          id: doc._id,
          title: doc.name || 'Untitled Template',
          description: doc.description || 'No description provided.',
          category: 'All', // Since categories aren't strictly stored in doc yet
          tags: [],
          roles: (doc.recipientSlots || []).map((slot: any, idx: number) => ({
            id: `role-${idx}`,
            name: slot.label || slot.role || `Role ${idx + 1}`,
            description: slot.role || '',
            color: ROLE_COLORS[idx % ROLE_COLORS.length],
            required: true,
          })),
          pages: 1,
          lastUpdated: doc.updatedAt || doc.createdAt,
          creator: doc.userId || 'System',
          isFavorite: false,
          status: doc.status || 'active',
          usageCount: 0,
          thumbnailUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${i}&backgroundColor=121214&shape1Color=3f3f46`,
        }));
        setTemplates(mapped);
        setLoading(false);
      }).catch(err => {
        console.error('Failed to list templates', err);
        setLoading(false);
      });
    });
  }, []);

  // Filter Logic
  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl => {
      const matchesSearch = tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            tpl.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = activeCategory === 'All' || tpl.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100">
      
      {/* Top Header Section */}
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-[#27272A] px-8 py-5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400 tracking-tight">
              Templates Catalog
            </h1>
            <p className="text-zinc-400 mt-1.5 text-sm">Manage, share, and launch massive workflows from standardized document templates.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search 1000+ templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 bg-[#121214] border border-[#27272A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
              />
            </div>
            
            <div className="h-8 w-px bg-[#27272A] mx-2"></div>
            
            <Button variant="secondary" className="gap-2">
              <UploadCloud className="w-4 h-4" /> Import
            </Button>
            <Button className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500">
              <Plus className="w-4 h-4" /> Create New Template
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="max-w-[1600px] mx-auto px-8 py-8 flex gap-8">
        
        {/* Left Sidebar Filters (Massive scale illusion) */}
        <aside className="w-64 shrink-0 space-y-8">
          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" /> Categories
            </h3>
            <div className="space-y-1">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeCategory === category 
                      ? 'bg-indigo-500/10 text-indigo-400 font-medium' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#27272A]/50'
                  }`}
                >
                  {category}
                  <span className={`text-xs ${activeCategory === category ? 'text-indigo-400/80' : 'text-zinc-600'}`}>
                    {category === 'All' ? templates.length : templates.filter(t => t.category === category).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4" /> Popular Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {TAGS.slice(0, 15).map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-md bg-[#121214] border border-[#27272A] text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 cursor-pointer transition-colors">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Quick Filters
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-2 hover:bg-[#27272A]/30 rounded-lg cursor-pointer">
                <input type="checkbox" className="rounded border-[#3F3F46] bg-[#121214] text-indigo-500 focus:ring-indigo-500/20" />
                <span className="text-sm text-zinc-300">My Templates</span>
              </label>
              <label className="flex items-center gap-3 p-2 hover:bg-[#27272A]/30 rounded-lg cursor-pointer">
                <input type="checkbox" className="rounded border-[#3F3F46] bg-[#121214] text-indigo-500 focus:ring-indigo-500/20" />
                <span className="text-sm text-zinc-300 flex items-center gap-1"><Star className="w-3 h-3 text-amber-500" /> Favorites</span>
              </label>
              <label className="flex items-center gap-3 p-2 hover:bg-[#27272A]/30 rounded-lg cursor-pointer">
                <input type="checkbox" className="rounded border-[#3F3F46] bg-[#121214] text-indigo-500 focus:ring-indigo-500/20" />
                <span className="text-sm text-zinc-300">Recently Updated</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          
          {/* Controls Bar */}
          <div className="flex items-center justify-between mb-6 bg-[#121214] p-2 rounded-xl border border-[#27272A]">
            <div className="flex items-center gap-4 px-4 text-sm text-zinc-400">
              <span>Showing <strong className="text-zinc-100">{filteredTemplates.length}</strong> templates</span>
              <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
              <span>Sorted by <button className="text-zinc-100 font-medium hover:text-indigo-400 inline-flex items-center gap-1">Most Used <ChevronDown className="w-3 h-3"/></button></span>
            </div>
            
            <div className="flex items-center p-1 bg-[#0A0A0B] rounded-lg border border-[#27272A]">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[#27272A] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#27272A] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Templates Display */}
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 border border-dashed border-[#27272A] rounded-2xl bg-[#121214]/50">
              <div className="w-16 h-16 bg-[#27272A] rounded-2xl flex items-center justify-center mb-4 text-zinc-500">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium text-zinc-200">No templates found</h3>
              <p className="text-zinc-500 mt-2 max-w-md text-center">Try adjusting your search queries, or clear your filters to see the full catalog of templates.</p>
              <Button variant="secondary" className="mt-6" onClick={() => {setSearchQuery(''); setActiveCategory('All');}}>
                Clear Filters
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="group flex flex-col bg-[#121214] border border-[#27272A] rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-indigo-500/5 relative">
                  
                  {/* Thumbnail Area */}
                  <div className="h-40 relative bg-[#1A1A1E] border-b border-[#27272A] overflow-hidden flex items-center justify-center">
                    <img src={template.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover opacity-40 mix-blend-luminosity group-hover:opacity-60 transition-opacity" />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-[#121214] to-transparent"></div>
                    
                    {/* Status Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      {template.status === 'draft' && <Badge colorClass="bg-amber-500/10 text-amber-400 border-amber-500/20">Draft</Badge>}
                      {template.status === 'archived' && <Badge colorClass="bg-rose-500/10 text-rose-400 border-rose-500/20">Archived</Badge>}
                    </div>

                    <div className="absolute top-3 right-3 p-1.5 bg-black/50 backdrop-blur-md rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer border border-white/10">
                      <MoreVertical className="w-4 h-4" />
                    </div>

                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      <div className="bg-[#0A0A0B]/80 backdrop-blur-md px-2 py-1 rounded text-xs text-zinc-300 border border-white/5 flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-indigo-400" /> {template.pages} pages
                      </div>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <h3 className="text-zinc-100 font-medium leading-tight line-clamp-2" title={template.title}>
                        {template.title}
                      </h3>
                    </div>
                    
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-4 flex-1">
                      {template.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {template.roles.slice(0, 3).map((role) => (
                        <span key={role.id} className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${role.color}`}>
                          {role.name}
                        </span>
                      ))}
                      {template.roles.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm border bg-[#27272A] text-zinc-400 border-[#3F3F46]">
                          +{template.roles.length - 3} more
                        </span>
                      )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-[#27272A] flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" />
                        {new Date(template.lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-400/50" />
                        {template.usageCount} uses
                      </div>
                    </div>
                  </div>

                  {/* Hover Overlay Action */}
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex flex-col gap-3 px-6 w-full translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <Button 
                        onClick={() => setActiveTemplateModal(template)} 
                        className="w-full justify-center shadow-lg shadow-indigo-500/20"
                      >
                        <Zap className="w-4 h-4 mr-2" /> Use Template
                      </Button>
                      <Button variant="secondary" className="w-full justify-center bg-transparent backdrop-blur-md">
                        <Eye className="w-4 h-4 mr-2" /> Preview Roles
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Detailed List View
            <div className="bg-[#121214] border border-[#27272A] rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#1A1A1E] text-zinc-400 border-b border-[#27272A]">
                  <tr>
                    <th className="px-6 py-4 font-medium">Template Name</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Roles Defined</th>
                    <th className="px-6 py-4 font-medium">Last Updated</th>
                    <th className="px-6 py-4 font-medium">Usage</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {filteredTemplates.map((template) => (
                    <tr key={template.id} className="hover:bg-[#1A1A1E]/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#27272A] flex items-center justify-center border border-[#3F3F46]">
                            <FileSignature className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div>
                            <div className="font-medium text-zinc-100">{template.title}</div>
                            <div className="text-xs text-zinc-500 truncate w-64">{template.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge colorClass="bg-[#27272A] text-zinc-300 border-[#3F3F46]">{template.category}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          {template.roles.slice(0, 4).map((r, i) => (
                            <div key={i} className="w-7 h-7 rounded-full border-2 border-[#121214] bg-[#27272A] flex items-center justify-center text-[10px] font-bold text-zinc-300" title={r.name}>
                              {r.name.charAt(0)}
                            </div>
                          ))}
                          {template.roles.length > 4 && (
                            <div className="w-7 h-7 rounded-full border-2 border-[#121214] bg-[#3F3F46] flex items-center justify-center text-[10px] font-bold text-zinc-100">
                              +{template.roles.length - 4}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {new Date(template.lastUpdated).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Zap className="w-4 h-4 text-emerald-400" />
                          {template.usageCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" className="p-1.5"><Eye className="w-4 h-4" /></Button>
                          <Button 
                            variant="primary" 
                            className="py-1.5 px-3 text-xs"
                            onClick={() => setActiveTemplateModal(template)}
                          >
                            Use
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Wizard Modal */}
      {activeTemplateModal && (
        <UseTemplateWizard 
          template={activeTemplateModal} 
          onClose={() => setActiveTemplateModal(null)} 
        />
      )}
    </div>
  );
}
