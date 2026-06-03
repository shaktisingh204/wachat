"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Mail,
  CheckCircle,
  Clock,
  FileText,
  AlertCircle,
  ArrowRight,
  Download,
  Trash2,
  Copy,
  FolderPlus,
  RefreshCw,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  Edit2,
  Tag,
  Paperclip,
  Share2,
  Eye,
  Send,
  MoreHorizontal,
  ChevronDown,
  Calendar,
  User,
  Settings,
  Archive,
  Star,
  Zap,
  BarChart2,
  Bell
} from 'lucide-react';

// --- Types ---
type Recipient = {
  name: string;
  email: string;
  status: 'Signed' | 'Pending' | 'Viewed' | 'Declined';
};

type Envelope = {
  id: string;
  subject: string;
  status: 'Draft' | 'Sent' | 'Delivered' | 'Completed' | 'Declined' | 'Voided' | 'Action Required';
  sender: string;
  recipients: Recipient[];
  lastModified: string;
  created: string;
  size: string;
  tags: string[];
  folder: string;
  isStarred: boolean;
};

// --- Mock Data ---
const generateEnvelopes = (count: number): Envelope[] => {
  const statuses: Envelope['status'][] = ['Draft', 'Sent', 'Delivered', 'Completed', 'Declined', 'Voided', 'Action Required'];
  const subjects = [
    'NDA for Project Alpha',
    'Employment Agreement - John Doe',
    'Vendor Contract 2024 - TechCorp',
    'Q3 Sales Commission Plan',
    'Partnership Agreement v2',
    'Service Level Agreement (SLA)',
    'Master Services Agreement',
    'Lease Agreement - 104 Main St',
    'Non-Compete Agreement',
    'Independent Contractor Agreement',
    'Software License Agreement',
    'Data Processing Addendum',
    'Board Resolution Q2',
    'Equity Grant Notice'
  ];
  const recipientNames = ['Alice Smith', 'Bob Jones', 'Charlie Brown', 'David Lee', 'Eve Davis', 'Frank Miller'];
  
  return Array.from({ length: count }).map((_, i) => {
    const numRecipients = Math.floor(Math.random() * 4) + 1;
    const recipients: Recipient[] = Array.from({ length: numRecipients }).map(() => ({
      name: recipientNames[Math.floor(Math.random() * recipientNames.length)],
      email: `user${Math.floor(Math.random() * 1000)}@example.com`,
      status: ['Signed', 'Pending', 'Viewed', 'Declined'][Math.floor(Math.random() * 4)] as Recipient['status']
    }));

    return {
      id: `ENV-${100000 + i}`,
      subject: subjects[Math.floor(Math.random() * subjects.length)] + (i % 5 === 0 ? ' (Revised)' : ''),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      sender: 'me@sabdesk.com',
      recipients,
      lastModified: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      created: new Date(Date.now() - Math.random() * 20000000000).toISOString(),
      size: Math.floor(Math.random() * 5000) + 100 + ' KB',
      tags: Math.random() > 0.7 ? ['Urgent', 'Legal'] : (Math.random() > 0.5 ? ['Standard'] : []),
      folder: Math.random() > 0.6 ? 'Contracts' : (Math.random() > 0.3 ? 'HR Documents' : 'Inbox'),
      isStarred: Math.random() > 0.8
    };
  });
};

const MOCK_DATA = generateEnvelopes(150);

// --- Components ---

const StatusBadge = ({ status }: { status: Envelope['status'] }) => {
  const styles: Record<Envelope['status'], string> = {
    'Completed': 'bg-green-500/10 text-green-500 border-green-500/20',
    'Sent': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Delivered': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    'Draft': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    'Declined': 'bg-red-500/10 text-red-500 border-red-500/20',
    'Voided': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'Action Required': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  };

  const icons: Record<Envelope['status'], React.ReactNode> = {
    'Completed': <CheckCircle className="w-3 h-3 mr-1" />,
    'Sent': <Send className="w-3 h-3 mr-1" />,
    'Delivered': <Mail className="w-3 h-3 mr-1" />,
    'Draft': <FileText className="w-3 h-3 mr-1" />,
    'Declined': <X className="w-3 h-3 mr-1" />,
    'Voided': <AlertCircle className="w-3 h-3 mr-1" />,
    'Action Required': <Zap className="w-3 h-3 mr-1" />
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
};

export default function SabSignDashboard() {
  const [envelopes, setEnvelopes] = useState<Envelope[]>(MOCK_DATA);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('Inbox');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedEnvelopes, setSelectedEnvelopes] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'All' | 'Action Required' | 'Waiting for Others' | 'Expiring Soon'>('All');
  const [selectedEnvelopeDetail, setSelectedEnvelopeDetail] = useState<Envelope | null>(null);

  const folders = [
    { name: 'Inbox', icon: <Mail className="w-4 h-4" />, count: envelopes.filter(e => e.folder === 'Inbox').length },
    { name: 'Action Required', icon: <Zap className="w-4 h-4 text-yellow-500" />, count: envelopes.filter(e => e.status === 'Action Required').length },
    { name: 'Sent', icon: <Send className="w-4 h-4" />, count: envelopes.filter(e => e.status === 'Sent').length },
    { name: 'Drafts', icon: <FileText className="w-4 h-4" />, count: envelopes.filter(e => e.status === 'Draft').length },
    { name: 'Deleted', icon: <Trash2 className="w-4 h-4" />, count: 0 },
    { name: 'Contracts', icon: <FolderPlus className="w-4 h-4" />, count: envelopes.filter(e => e.folder === 'Contracts').length },
    { name: 'HR Documents', icon: <FolderPlus className="w-4 h-4" />, count: envelopes.filter(e => e.folder === 'HR Documents').length },
  ];

  const filteredEnvelopes = useMemo(() => {
    return envelopes.filter(env => {
      const matchesSearch = env.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            env.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFolder = true;
      if (selectedFolder === 'Inbox') matchesFolder = env.folder === 'Inbox' || !['Draft', 'Sent'].includes(env.status);
      else if (selectedFolder === 'Sent') matchesFolder = env.status === 'Sent' || env.status === 'Delivered';
      else if (selectedFolder === 'Drafts') matchesFolder = env.status === 'Draft';
      else if (selectedFolder === 'Action Required') matchesFolder = env.status === 'Action Required';
      else matchesFolder = env.folder === selectedFolder;

      let matchesTab = true;
      if (activeTab === 'Action Required') matchesTab = env.status === 'Action Required';
      if (activeTab === 'Waiting for Others') matchesTab = env.status === 'Sent' || env.status === 'Delivered';
      
      return matchesSearch && matchesFolder && matchesTab;
    });
  }, [envelopes, searchQuery, selectedFolder, activeTab]);

  const paginatedEnvelopes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEnvelopes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEnvelopes, currentPage]);

  const totalPages = Math.ceil(filteredEnvelopes.length / itemsPerPage);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedEnvelopes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEnvelopes(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedEnvelopes.size === paginatedEnvelopes.length) {
      setSelectedEnvelopes(new Set());
    } else {
      setSelectedEnvelopes(new Set(paginatedEnvelopes.map(e => e.id)));
    }
  };

  const handleRowClick = (envelope: Envelope) => {
    setSelectedEnvelopeDetail(envelope);
  };

  const closeDetail = () => {
    setSelectedEnvelopeDetail(null);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 border-r border-white/10 bg-[#111] transition-all duration-300 flex flex-col z-10`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          {isSidebarOpen ? (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Edit2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-white tracking-wide">SabSign</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
              <Edit2 className="w-4 h-4 text-white" />
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-white/5 rounded-md transition-colors">
            {isSidebarOpen ? <ChevronLeft className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400 mx-auto" />}
          </button>
        </div>

        <div className="p-4">
          <button className={`w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 ${!isSidebarOpen && 'px-0'}`}>
            <Plus className="w-5 h-5" />
            {isSidebarOpen && <span>New Envelope</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div className="space-y-1 px-2">
            {folders.map((folder, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedFolder(folder.name); setCurrentPage(1); }}
                className={`w-full flex items-center ${isSidebarOpen ? 'justify-between px-3' : 'justify-center'} py-2.5 rounded-lg transition-all ${selectedFolder === folder.name ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                title={!isSidebarOpen ? folder.name : ''}
              >
                <div className="flex items-center space-x-3">
                  {folder.icon}
                  {isSidebarOpen && <span className="text-sm font-medium">{folder.name}</span>}
                </div>
                {isSidebarOpen && folder.count > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedFolder === folder.name ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500'}`}>
                    {folder.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isSidebarOpen && (
            <div className="mt-8 px-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Filters</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-200 cursor-pointer transition-colors">
                  <Star className="w-4 h-4" /> <span>Starred</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-200 cursor-pointer transition-colors">
                  <Clock className="w-4 h-4" /> <span>Expiring Soon</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-200 cursor-pointer transition-colors">
                  <CheckCircle className="w-4 h-4" /> <span>Completed Recently</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          <div className={`flex items-center ${isSidebarOpen ? 'space-x-3' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex-shrink-0 border border-white/20"></div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Harsh K.</p>
                <p className="text-xs text-gray-500 truncate">Admin Account</p>
              </div>
            )}
            {isSidebarOpen && <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white" />}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-white">{selectedFolder}</h1>
            <div className="h-4 w-px bg-white/20 hidden md:block"></div>
            <div className="hidden md:flex space-x-1 bg-white/5 p-1 rounded-lg border border-white/5">
              {['All', 'Action Required', 'Waiting for Others', 'Expiring Soon'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === tab ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search envelopes, signers, IDs..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all w-64 md:w-80 text-gray-200 placeholder-gray-500"
              />
            </div>
            
            <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-all">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-all">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0d0d0d]">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                checked={selectedEnvelopes.size === paginatedEnvelopes.length && paginatedEnvelopes.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-white/20 bg-black/50 text-blue-500 focus:ring-blue-500/50 cursor-pointer"
              />
              <span className="text-sm text-gray-400 font-medium">
                {selectedEnvelopes.size > 0 ? `${selectedEnvelopes.size} selected` : 'Select All'}
              </span>
            </div>

            {selectedEnvelopes.size > 0 && (
              <div className="flex items-center space-x-2 ml-4 animate-in fade-in slide-in-from-left-4 duration-200">
                <div className="h-4 w-px bg-white/10"></div>
                <button className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors tooltip" title="Download">
                  <Download className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors tooltip" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors tooltip" title="Move to Folder">
                  <FolderPlus className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors tooltip" title="More Actions">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span>{Math.min((currentPage - 1) * itemsPerPage + 1, filteredEnvelopes.length)}-{Math.min(currentPage * itemsPerPage, filteredEnvelopes.length)} of {filteredEnvelopes.length}</span>
              <div className="flex items-center space-x-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Grid / List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0a] p-4 relative">
          
          {filteredEnvelopes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
                <Mail className="w-10 h-10 text-gray-600" />
              </div>
              <p className="text-lg">No envelopes found</p>
              <p className="text-sm">Try adjusting your filters or search query.</p>
              <button onClick={() => {setSearchQuery(''); setSelectedFolder('Inbox'); setActiveTab('All');}} className="mt-4 px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-colors text-sm font-medium">
                Clear Filters
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-1 pb-20">
              {/* List Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10 border-b border-white/5 mb-2">
                <div className="col-span-4 flex items-center space-x-4">
                  <span className="w-4"></span> {/* Checkbox spacer */}
                  <span>Subject</span>
                </div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Recipients</div>
                <div className="col-span-2">Last Modified</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {paginatedEnvelopes.map((env) => (
                <div 
                  key={env.id} 
                  onClick={() => handleRowClick(env)}
                  className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer group ${selectedEnvelopes.has(env.id) ? 'bg-blue-500/5 border-blue-500/20' : 'bg-[#111]'}`}
                >
                  <div className="col-span-4 flex items-center space-x-4 min-w-0">
                    <div onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedEnvelopes.has(env.id)}
                        onChange={() => toggleSelection(env.id)}
                        className="w-4 h-4 rounded border-white/20 bg-black/50 text-blue-500 focus:ring-blue-500/50 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{env.subject}</span>
                        {env.isStarred && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                        <span className="truncate">{env.id}</span>
                        <span>•</span>
                        <span className="truncate">{env.folder}</span>
                        {env.tags.map(tag => (
                          <React.Fragment key={tag}>
                            <span>•</span>
                            <span className="flex items-center text-gray-400 bg-white/5 px-1.5 rounded"><Tag className="w-2.5 h-2.5 mr-1"/>{tag}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <StatusBadge status={env.status} />
                  </div>
                  
                  <div className="col-span-3 min-w-0">
                    <div className="flex -space-x-2 overflow-hidden">
                      {env.recipients.slice(0, 3).map((rec, i) => (
                        <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-[#111] bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-[10px] font-bold text-white z-10" title={`${rec.name} (${rec.status})`}>
                          {rec.name.charAt(0)}
                        </div>
                      ))}
                      {env.recipients.length > 3 && (
                        <div className="inline-block h-6 w-6 rounded-full ring-2 ring-[#111] bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 z-0">
                          +{env.recipients.length - 3}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {env.recipients.length === 1 ? env.recipients[0].name : `${env.recipients.length} recipients`}
                    </div>
                  </div>
                  
                  <div className="col-span-2 text-sm text-gray-400">
                    <div>{new Date(env.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div className="text-xs text-gray-500">{new Date(env.lastModified).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  
                  <div className="col-span-1 flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => {e.stopPropagation();}} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors tooltip" title="Quick View">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => {e.stopPropagation();}} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors tooltip" title="More Options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
              {paginatedEnvelopes.map((env) => (
                <div 
                  key={env.id}
                  onClick={() => handleRowClick(env)}
                  className={`relative flex flex-col p-4 rounded-xl border border-white/5 bg-[#111] hover:border-white/20 hover:shadow-lg hover:shadow-black/50 transition-all cursor-pointer group ${selectedEnvelopes.has(env.id) ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : ''}`}
                >
                  <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedEnvelopes.has(env.id)}
                      onChange={() => toggleSelection(env.id)}
                      className="w-4 h-4 rounded border-white/20 bg-black/50 text-blue-500 focus:ring-blue-500/50 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity checked:opacity-100"
                    />
                  </div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <StatusBadge status={env.status} />
                    {env.isStarred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                  </div>
                  
                  <h3 className="text-base font-medium text-gray-200 mb-1 line-clamp-2 group-hover:text-white transition-colors">{env.subject}</h3>
                  <p className="text-xs text-gray-500 mb-4">{env.id}</p>
                  
                  <div className="mt-auto">
                    <div className="flex items-center justify-between py-3 border-t border-white/5 mt-2">
                      <div className="flex -space-x-2">
                        {env.recipients.slice(0, 3).map((rec, i) => (
                          <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-[#111] bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-[10px] font-bold text-white" title={`${rec.name} (${rec.status})`}>
                            {rec.name.charAt(0)}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400 flex items-center"><Paperclip className="w-3 h-3 mr-1"/> {env.size}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-white/5">
                      <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {new Date(env.lastModified).toLocaleDateString()}</span>
                      <span className="flex items-center px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{env.folder}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detailed Flyout Panel */}
        {selectedEnvelopeDetail && (
          <div className="absolute inset-y-0 right-0 w-full md:w-[480px] bg-[#1a1a1a] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111]">
              <div className="flex items-center space-x-3">
                <button onClick={closeDetail} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400">
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold text-white">Envelope Details</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                  <Star className={`w-5 h-5 ${selectedEnvelopeDetail.isStarred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                </button>
                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              {/* Title & Status */}
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h1 className="text-xl font-bold text-white leading-tight pr-4">{selectedEnvelopeDetail.subject}</h1>
                  <StatusBadge status={selectedEnvelopeDetail.status} />
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-400 mt-3">
                  <span className="flex items-center"><Hash className="w-4 h-4 mr-1 text-gray-500"/> {selectedEnvelopeDetail.id}</span>
                  <span className="flex items-center"><FolderPlus className="w-4 h-4 mr-1 text-gray-500"/> {selectedEnvelopeDetail.folder}</span>
                </div>
              </div>

              {/* Action Cards based on status */}
              {selectedEnvelopeDetail.status === 'Action Required' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-500 mb-1">Your signature is required</h4>
                    <p className="text-xs text-yellow-500/80 mb-3">Please review and sign this document to proceed.</p>
                    <button className="px-4 py-2 bg-yellow-500 text-black text-sm font-medium rounded-lg hover:bg-yellow-400 transition-colors">
                      Sign Now
                    </button>
                  </div>
                </div>
              )}

              {/* Recipients Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
                  <User className="w-4 h-4 mr-2" /> Recipients
                </h3>
                <div className="space-y-4">
                  {selectedEnvelopeDetail.recipients.map((rec, i) => (
                    <div key={i} className="flex items-start">
                      <div className="flex flex-col items-center mr-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                          rec.status === 'Signed' ? 'bg-green-500/20 border-green-500 text-green-500' :
                          rec.status === 'Declined' ? 'bg-red-500/20 border-red-500 text-red-500' :
                          'bg-gray-800 border-gray-600 text-gray-400'
                        }`}>
                          {rec.status === 'Signed' ? <CheckCircle className="w-4 h-4" /> : rec.name.charAt(0)}
                        </div>
                        {i < selectedEnvelopeDetail.recipients.length - 1 && (
                          <div className="w-px h-10 bg-white/10 my-1"></div>
                        )}
                      </div>
                      <div className="pt-1.5 flex-1 bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-200">{rec.name}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            rec.status === 'Signed' ? 'bg-green-500/10 text-green-400' :
                            rec.status === 'Declined' ? 'bg-red-500/10 text-red-400' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{rec.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2" /> Details
                </h3>
                <div className="bg-[#111] border border-white/5 rounded-xl p-1">
                  <div className="grid grid-cols-3 gap-4 p-3 border-b border-white/5">
                    <span className="text-xs text-gray-500">Sent By</span>
                    <span className="col-span-2 text-sm text-gray-300">{selectedEnvelopeDetail.sender}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 p-3 border-b border-white/5">
                    <span className="text-xs text-gray-500">Created</span>
                    <span className="col-span-2 text-sm text-gray-300">{new Date(selectedEnvelopeDetail.created).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 p-3 border-b border-white/5">
                    <span className="text-xs text-gray-500">Last Modified</span>
                    <span className="col-span-2 text-sm text-gray-300">{new Date(selectedEnvelopeDetail.lastModified).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 p-3 border-b border-white/5">
                    <span className="text-xs text-gray-500">File Size</span>
                    <span className="col-span-2 text-sm text-gray-300">{selectedEnvelopeDetail.size}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 p-3">
                    <span className="text-xs text-gray-500">Tags</span>
                    <div className="col-span-2 flex flex-wrap gap-2">
                      {selectedEnvelopeDetail.tags.length > 0 ? selectedEnvelopeDetail.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 flex items-center">
                          <Tag className="w-3 h-3 mr-1 text-gray-500"/> {tag}
                        </span>
                      )) : <span className="text-sm text-gray-500 italic">No tags</span>}
                      <button className="px-2 py-1 bg-transparent border border-dashed border-white/20 rounded text-xs text-gray-400 hover:text-white hover:border-white/50 transition-colors flex items-center">
                        <Plus className="w-3 h-3 mr-1"/> Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/10 bg-[#111] flex items-center justify-between space-x-3">
              <button className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors border border-white/10 flex items-center">
                <Download className="w-4 h-4 mr-2" /> Download
              </button>
              <div className="flex space-x-3">
                <button className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors border border-white/10 flex items-center">
                  <Copy className="w-4 h-4 mr-2" /> Clone
                </button>
                <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center">
                  <Eye className="w-4 h-4 mr-2" /> View Document
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backdrop for detail view on mobile/tablet */}
      {selectedEnvelopeDetail && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={closeDetail}
        />
      )}
    </div>
  );
}

// Icon helper since Hash wasn't imported directly at top
const Hash = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
);
