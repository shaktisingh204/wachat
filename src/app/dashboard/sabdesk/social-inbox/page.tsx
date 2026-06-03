"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, Filter, CheckCircle2, AlertCircle, MessageCircle, 
  MoreVertical, Clock, CheckSquare, XSquare, Archive, Tag, 
  UserPlus, ThumbsUp, MessageSquare, Repeat, ExternalLink, 
  CornerUpLeft, Send, Paperclip, Image as ImageIcon, Smile, 
  Zap, Sparkles, ChevronDown, Plus, MoreHorizontal, 
  AlertOctagon, Check, Hash, LayoutGrid, List, SlidersHorizontal,
  Mail, Bell, Settings, LogOut, ChevronRight, Maximize2,
  Minimize2, RefreshCw, Command, ChevronLeft, ArrowRight,
  User, Building2, MapPin, Globe, Phone, FileText, Heart,
  Share2, BarChart2, ShieldAlert, BadgeCheck, X
} from 'lucide-react';

// ==========================================
// SVGs & Icons
// ==========================================

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.04c-5.5 0-10 4.48-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10.05 10.05 0 0 0 8.44-9.9c0-5.54-4.5-10.02-10-10.02Z"/>
  </svg>
);

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.45 20.45h-3.56v-5.36c0-1.28-.02-2.92-1.78-2.92-1.78 0-2.05 1.39-2.05 2.83v5.45h-3.56v-10.7h3.41v1.46h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v5.64zM5.34 8.29c-1.14 0-2.06-.92-2.06-2.06 0-1.14.92-2.06 2.06-2.06 1.14 0 2.06.92 2.06 2.06 0 1.14-.92 2.06-2.06 2.06zm1.78 12.16H3.56v-10.7h3.56v10.7zM22.22 0H1.78C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.78 24h20.44c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0z"/>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.67 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.25-.15-4.77-1.69-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.67-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 2.69.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.36-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.36-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm5.22-10.53a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44z"/>
  </svg>
);

const PlatformIcon = ({ platform, className = "" }: { platform: string, className?: string }) => {
  switch (platform) {
    case 'twitter': return <XIcon className={`text-white ${className}`} />;
    case 'facebook': return <FacebookIcon className={`text-blue-500 ${className}`} />;
    case 'linkedin': return <LinkedInIcon className={`text-blue-400 ${className}`} />;
    case 'instagram': return <InstagramIcon className={`text-pink-500 ${className}`} />;
    default: return <MessageSquare className={`text-gray-400 ${className}`} />;
  }
};

// ==========================================
// Types & Interfaces
// ==========================================

type Platform = 'twitter' | 'facebook' | 'linkedin' | 'instagram';
type Sentiment = 'positive' | 'neutral' | 'negative';
type Status = 'open' | 'pending' | 'resolved' | 'spam';
type Priority = 'high' | 'medium' | 'low';

interface Author {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  followers: number;
  isVerified: boolean;
  vipStatus?: boolean;
  location?: string;
  company?: string;
  crmId?: string;
  sentiment_score?: number;
}

interface Metric {
  likes: number;
  shares: number;
  comments: number;
  views?: number;
}

interface SocialMessage {
  id: string;
  platform: Platform;
  author: Author;
  content: string;
  media?: string[];
  timestamp: string;
  sentiment: Sentiment;
  status: Status;
  priority: Priority;
  tags: string[];
  metrics: Metric;
  isRead: boolean;
  assignedTo?: string;
  threadId?: string;
}

// ==========================================
// Mock Data Generation
// ==========================================

const AVATARS = [
  "https://i.pravatar.cc/150?u=a042581f4e29026024d",
  "https://i.pravatar.cc/150?u=a042581f4e29026704d",
  "https://i.pravatar.cc/150?u=a04258114e29026702d",
  "https://i.pravatar.cc/150?u=a048581f4e29026701d",
  "https://i.pravatar.cc/150?u=a04258a2462d826712d",
  "https://i.pravatar.cc/150?u=a042581f4e29026703d",
];

const NAMES = ["Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince", "Evan Wright", "Fiona Gallagher", "George Costanza"];
const HANDLES = ["@alicesmith", "@bobjones_dev", "@charlie_b", "@dianap", "@evanw", "@fionag", "@gcostanza"];
const CONTENTS = [
  "Just tried the new features in SabDesk and I'm blown away! 🚀 The omnichannel routing is exactly what our team needed. Great job!",
  "Experiencing some downtime with the API today. Can someone from support help out? Getting 503 errors consistently for the past hour.",
  "I've been using SabDesk for 3 months now and it has completely transformed how we handle customer queries. Highly recommend! 💯",
  "Is there a way to export analytics to CSV? I can't seem to find the button anywhere in the dashboard.",
  "The mobile app keeps crashing after the latest update on iOS 17. Please fix this ASAP! We rely on this heavily.",
  "Excited to announce our integration with SabDesk is now live! 🎉 Check out our blog post for more details.",
  "I don't understand how the pricing model works. We were charged extra this month without any clear explanation. Very frustrating.",
  "SabDesk's UI is unmatched. The dark mode is simply gorgeous. Kudos to the design team!",
  "Does anyone know if they plan to add WhatsApp integration soon? That's the only thing missing for us.",
  "Shoutout to the support team at SabDesk! They resolved my issue in less than 5 minutes. Stellar service!"
];

const generateMockMessages = (count: number): SocialMessage[] => {
  return Array.from({ length: count }).map((_, i) => {
    const platform = ['twitter', 'facebook', 'linkedin', 'instagram'][Math.floor(Math.random() * 4)] as Platform;
    const sentiment = ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)] as Sentiment;
    const status = ['open', 'pending', 'resolved', 'spam'][Math.floor(Math.random() * 4)] as Status;
    const priority = ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as Priority;
    
    const authorIdx = Math.floor(Math.random() * NAMES.length);
    const contentIdx = Math.floor(Math.random() * CONTENTS.length);
    
    // Adjust sentiment based on content index slightly to make it somewhat realistic
    let finalSentiment = sentiment;
    if (contentIdx === 1 || contentIdx === 4 || contentIdx === 6) finalSentiment = 'negative';
    if (contentIdx === 0 || contentIdx === 2 || contentIdx === 5 || contentIdx === 7 || contentIdx === 9) finalSentiment = 'positive';

    const tags = [];
    if (finalSentiment === 'negative') tags.push('bug', 'urgent');
    if (contentIdx === 3) tags.push('feature-request');
    if (contentIdx === 6) tags.push('billing');

    return {
      id: `msg-${1000 + i}`,
      platform,
      author: {
        id: `auth-${authorIdx}`,
        name: NAMES[authorIdx],
        handle: HANDLES[authorIdx],
        avatar: AVATARS[authorIdx % AVATARS.length],
        followers: Math.floor(Math.random() * 50000),
        isVerified: Math.random() > 0.7,
        vipStatus: Math.random() > 0.8,
        location: ['San Francisco, CA', 'New York, NY', 'London, UK', 'Remote'][Math.floor(Math.random() * 4)],
        company: ['Acme Corp', 'TechFlow', 'Stark Industries', 'Wayne Enterprises'][Math.floor(Math.random() * 4)],
        crmId: `crm-${Math.floor(Math.random() * 10000)}`,
        sentiment_score: Math.floor(Math.random() * 100)
      },
      content: CONTENTS[contentIdx],
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(),
      sentiment: finalSentiment,
      status,
      priority,
      tags,
      metrics: {
        likes: Math.floor(Math.random() * 1000),
        shares: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 50),
        views: Math.floor(Math.random() * 10000)
      },
      isRead: Math.random() > 0.3,
      assignedTo: Math.random() > 0.5 ? 'currentUser' : undefined,
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const initialMessages = generateMockMessages(150);

// ==========================================
// Components
// ==========================================

const SentimentBadge = ({ sentiment }: { sentiment: Sentiment }) => {
  const config = {
    positive: { icon: Smile, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    neutral: { icon: Meh, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
    negative: { icon: Frown, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' }
  };
  // Fallbacks if lucide doesn't have Meh/Frown
  const Icon = sentiment === 'positive' ? Smile : sentiment === 'negative' ? AlertCircle : MinusCircle;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${config[sentiment].bg} ${config[sentiment].border} ${config[sentiment].color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="capitalize">{sentiment}</span>
    </div>
  );
};

// Missing MinusCircle in lucide imports, let's create a quick fallback
const MinusCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const Frown = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);
const Meh = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="15" x2="16" y2="15" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const StatusBadge = ({ status }: { status: Status }) => {
  const config = {
    open: { icon: AlertOctagon, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    pending: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    resolved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    spam: { icon: Archive, color: 'text-gray-400', bg: 'bg-gray-500/10' }
  };
  const Icon = config[status].icon;
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config[status].bg} ${config[status].color}`}>
      <Icon className="w-3 h-3" />
      <span className="capitalize">{status}</span>
    </div>
  );
};

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const colors = {
    high: 'text-rose-400 bg-rose-500/10',
    medium: 'text-amber-400 bg-amber-500/10',
    low: 'text-blue-400 bg-blue-500/10'
  };
  return (
    <div className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority]}`}>
      P{priority === 'high' ? '1' : priority === 'medium' ? '2' : '3'}
    </div>
  );
};


// ==========================================
// Main Page Component
// ==========================================

export default function SocialInbox() {
  const [messages, setMessages] = useState<SocialMessage[]>(initialMessages);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('open');
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'me' | 'unassigned'>('all');

  // UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Derived State
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (platformFilter !== 'all' && msg.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && msg.status !== statusFilter) return false;
      if (sentimentFilter !== 'all' && msg.sentiment !== sentimentFilter) return false;
      if (assigneeFilter === 'me' && msg.assignedTo !== 'currentUser') return false;
      if (assigneeFilter === 'unassigned' && msg.assignedTo) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          msg.content.toLowerCase().includes(query) ||
          msg.author.name.toLowerCase().includes(query) ||
          msg.author.handle.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [messages, platformFilter, statusFilter, sentimentFilter, assigneeFilter, searchQuery]);

  const activeMessage = useMemo(() => 
    messages.find(m => m.id === activeMessageId), 
  [messages, activeMessageId]);

  // Handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredMessages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)));
    }
  };

  const markAsRead = (ids: Set<string>) => {
    setMessages(prev => prev.map(m => ids.has(m.id) ? { ...m, isRead: true } : m));
    if (ids.size > 1) setSelectedIds(new Set());
  };

  const changeStatus = (ids: Set<string>, status: Status) => {
    setMessages(prev => prev.map(m => ids.has(m.id) ? { ...m, status } : m));
    if (ids.size > 1) setSelectedIds(new Set());
  };

  const handleSendReply = () => {
    if (!replyContent.trim() || !replyingTo) return;
    
    // Mock sending reply
    console.log("Sending reply to", replyingTo, ":", replyContent);
    
    // Mark as resolved and read
    setMessages(prev => prev.map(m => m.id === replyingTo ? { ...m, status: 'resolved', isRead: true } : m));
    
    setReplyContent("");
    setReplyingTo(null);
  };

  const generateAiReply = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      setReplyContent("Thank you for reaching out! We've noted your feedback and our team is looking into this immediately. Please let us know if you have any other questions via DM.");
      setIsAiGenerating(false);
    }, 1500);
  };

  // Format Date
  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    return `${Math.floor(diff/86400)}d`;
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      {/* ========================================== */}
      {/* LEFT SIDEBAR - FILTERS */}
      {/* ========================================== */}
      <aside className={`flex flex-col border-r border-white/10 bg-[#09090b]/95 backdrop-blur-xl transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              Inbox
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-md hover:bg-white/5 text-zinc-400 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {!isSidebarCollapsed ? (
            <div className="px-3 space-y-6">
              
              {/* Status Filters */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">Views</h3>
                <div className="space-y-0.5">
                  {[
                    { id: 'open', label: 'Open', icon: InboxIcon, count: messages.filter(m => m.status === 'open').length },
                    { id: 'pending', label: 'Pending', icon: Clock, count: messages.filter(m => m.status === 'pending').length },
                    { id: 'resolved', label: 'Resolved', icon: CheckCircle2, count: messages.filter(m => m.status === 'resolved').length },
                    { id: 'spam', label: 'Spam', icon: AlertOctagon, count: messages.filter(m => m.status === 'spam').length }
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setStatusFilter(item.id as Status | 'all')}
                      className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors ${statusFilter === item.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full">{item.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Filters */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">Channels</h3>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setPlatformFilter('all')}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${platformFilter === 'all' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>All Channels</span>
                  </button>
                  {[
                    { id: 'twitter', label: 'X (Twitter)', icon: XIcon },
                    { id: 'facebook', label: 'Facebook', icon: FacebookIcon },
                    { id: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon },
                    { id: 'instagram', label: 'Instagram', icon: InstagramIcon }
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setPlatformFilter(item.id as Platform)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${platformFilter === item.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignment */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">Assignment</h3>
                <div className="space-y-0.5">
                  {[
                    { id: 'all', label: 'All Messages', icon: UsersIcon },
                    { id: 'me', label: 'Assigned to me', icon: User },
                    { id: 'unassigned', label: 'Unassigned', icon: HelpCircleIcon }
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setAssigneeFilter(item.id as any)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${assigneeFilter === item.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Tags */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">Tags</h3>
                <div className="flex flex-wrap gap-2 px-2">
                  {['bug', 'urgent', 'feature-request', 'billing', 'feedback'].map(tag => (
                    <span key={tag} className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/10 cursor-pointer transition-colors">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          ) : (
             <div className="flex flex-col items-center gap-4 pt-2">
                <button className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><InboxIcon className="w-5 h-5"/></button>
                <button className="p-2 rounded-xl text-zinc-400 hover:bg-white/5"><XIcon className="w-5 h-5"/></button>
                <button className="p-2 rounded-xl text-zinc-400 hover:bg-white/5"><LinkedInIcon className="w-5 h-5"/></button>
                <button className="p-2 rounded-xl text-zinc-400 hover:bg-white/5"><FacebookIcon className="w-5 h-5"/></button>
             </div>
          )}
        </div>
      </aside>

      {/* ========================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================== */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        
        {/* Top Header / Search / Bulk Actions */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-white/10 bg-[#09090b]/80 backdrop-blur-md z-10">
          
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search messages, users, or keywords... (Cmd+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                 <Command className="w-3 h-3 text-zinc-500" />
                 <span className="text-xs text-zinc-500 font-medium">K</span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10"></div>

            <div className="flex items-center gap-2">
               <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-sm text-zinc-300 transition-colors border border-white/5">
                 <Filter className="w-4 h-4" />
                 More Filters
               </button>
               <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-sm text-zinc-300 transition-colors border border-white/5">
                 <SlidersHorizontal className="w-4 h-4" />
                 Sort: Newest
               </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button className="p-2 rounded-full hover:bg-white/10 text-zinc-400 transition-colors relative">
               <Bell className="w-5 h-5" />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-[#09090b]"></span>
             </button>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[2px] cursor-pointer">
               <img src="https://i.pravatar.cc/150?img=11" alt="User" className="w-full h-full rounded-full border border-black/50" />
             </div>
          </div>
        </header>

        {/* Bulk Action Bar (Appears when items selected) */}
        {selectedIds.size > 0 && (
          <div className="h-14 flex items-center justify-between px-6 bg-indigo-500/10 border-b border-indigo-500/20 animate-in slide-in-from-top-2 duration-200">
             <div className="flex items-center gap-4">
               <span className="text-sm font-medium text-indigo-400 bg-indigo-500/20 px-2.5 py-1 rounded-md">
                 {selectedIds.size} selected
               </span>
               <div className="h-4 w-px bg-indigo-500/20"></div>
               <button onClick={() => markAsRead(selectedIds)} className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors">
                 <CheckCircle2 className="w-4 h-4" /> Mark Read
               </button>
               <button onClick={() => changeStatus(selectedIds, 'resolved')} className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors">
                 <CheckSquare className="w-4 h-4" /> Resolve
               </button>
               <button onClick={() => changeStatus(selectedIds, 'spam')} className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors">
                 <AlertOctagon className="w-4 h-4" /> Mark Spam
               </button>
               <button className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors">
                 <UserPlus className="w-4 h-4" /> Assign
               </button>
               <button className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors">
                 <Tag className="w-4 h-4" /> Add Tag
               </button>
             </div>
             <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-md hover:bg-indigo-500/20 text-indigo-400 transition-colors">
                <X className="w-5 h-5" />
             </button>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Feed List */}
          <div className={`flex flex-col border-r border-white/10 transition-all duration-300 ${activeMessageId ? 'w-[45%]' : 'w-full'}`}>
             
             {/* List Header */}
             <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#09090b]">
                <div className="flex items-center gap-3">
                  <button onClick={toggleAll} className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors">
                    {selectedIds.size === filteredMessages.length && filteredMessages.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <div className="w-5 h-5 border-[1.5px] border-zinc-500 rounded flex items-center justify-center">
                        {selectedIds.size > 0 && <div className="w-3 h-0.5 bg-indigo-400 rounded-full" />}
                      </div>
                    )}
                  </button>
                  <span className="text-sm font-medium text-zinc-400">
                    Showing {filteredMessages.length} conversations
                  </span>
                </div>
                <button className="p-1.5 rounded-md hover:bg-white/5 text-zinc-400 transition-colors">
                   <RefreshCw className="w-4 h-4" />
                </button>
             </div>

             {/* Messages List */}
             <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                    <p>No messages match your filters.</p>
                  </div>
                ) : (
                  filteredMessages.map(msg => {
                    const isSelected = selectedIds.has(msg.id);
                    const isActive = activeMessageId === msg.id;
                    
                    return (
                      <div 
                        key={msg.id}
                        onClick={() => {
                           if (!msg.isRead) markAsRead(new Set([msg.id]));
                           setActiveMessageId(msg.id);
                        }}
                        className={`group flex gap-3 p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden
                          ${isActive 
                            ? 'bg-indigo-500/5 border-indigo-500/30' 
                            : isSelected 
                              ? 'bg-indigo-500/10 border-indigo-500/20' 
                              : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                          }
                        `}
                      >
                         {/* Unread Indicator */}
                         {!msg.isRead && (
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                         )}

                         {/* Checkbox & Avatar */}
                         <div className="flex flex-col items-center gap-2 pt-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleSelection(msg.id); }}
                              className={`p-0.5 rounded transition-colors ${isSelected ? 'text-indigo-400' : 'text-zinc-600 group-hover:text-zinc-400'}`}
                            >
                               {isSelected ? <CheckSquare className="w-5 h-5" /> : <div className="w-5 h-5 border-[1.5px] border-current rounded" />}
                            </button>
                            <div className="relative">
                              <img src={msg.author.avatar} alt={msg.author.name} className="w-10 h-10 rounded-full border border-white/10 object-cover" />
                              <div className="absolute -bottom-1 -right-1 p-0.5 bg-[#09090b] rounded-full">
                                <PlatformIcon platform={msg.platform} className="w-3.5 h-3.5" />
                              </div>
                            </div>
                         </div>

                         {/* Content */}
                         <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-2">
                               <div className="flex items-center gap-2 truncate">
                                 <span className="font-medium text-zinc-100 truncate">{msg.author.name}</span>
                                 <span className="text-sm text-zinc-500 truncate">{msg.author.handle}</span>
                                 {msg.author.vipStatus && (
                                   <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 uppercase tracking-wider">
                                     <Sparkles className="w-3 h-3" /> VIP
                                   </span>
                                 )}
                               </div>
                               <span className="text-xs text-zinc-500 whitespace-nowrap flex-shrink-0">
                                 {timeAgo(msg.timestamp)}
                               </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mb-1">
                               <StatusBadge status={msg.status} />
                               <SentimentBadge sentiment={msg.sentiment} />
                               {msg.priority !== 'low' && <PriorityBadge priority={msg.priority} />}
                            </div>

                            <p className={`text-sm line-clamp-2 ${msg.isRead ? 'text-zinc-400' : 'text-zinc-200 font-medium'}`}>
                              {msg.content}
                            </p>

                            <div className="flex items-center justify-between mt-1">
                               <div className="flex items-center gap-3 text-zinc-500">
                                  <div className="flex items-center gap-1 text-xs"><ThumbsUp className="w-3 h-3"/> {msg.metrics.likes}</div>
                                  <div className="flex items-center gap-1 text-xs"><Repeat className="w-3 h-3"/> {msg.metrics.shares}</div>
                                  <div className="flex items-center gap-1 text-xs"><MessageCircle className="w-3 h-3"/> {msg.metrics.comments}</div>
                               </div>
                               <div className="flex items-center gap-1">
                                  {msg.tags.slice(0,2).map(tag => (
                                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5">
                                      #{tag}
                                    </span>
                                  ))}
                                  {msg.tags.length > 2 && <span className="text-[10px] text-zinc-500">+{msg.tags.length - 2}</span>}
                               </div>
                            </div>
                         </div>
                      </div>
                    )
                  })
                )}
             </div>
          </div>

          {/* Detailed View / Editor (Right Panel) */}
          {activeMessageId && activeMessage && (
             <div className="w-[55%] flex flex-col h-full bg-[#0d0d0f] relative animate-in slide-in-from-right-4 duration-300">
               
               {/* Detail Header */}
               <div className="h-14 flex items-center justify-between px-6 border-b border-white/10 shrink-0 bg-[#09090b]/50 backdrop-blur-md">
                 <div className="flex items-center gap-3">
                   <button onClick={() => setActiveMessageId(null)} className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400">
                     <ChevronLeft className="w-5 h-5" />
                   </button>
                   <div className="h-4 w-px bg-white/10"></div>
                   <div className="flex items-center gap-2">
                     <PlatformIcon platform={activeMessage.platform} className="w-5 h-5" />
                     <span className="font-medium capitalize text-zinc-200">{activeMessage.platform} Conversation</span>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 transition-colors tooltip" title="Copy Link">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 transition-colors tooltip" title="More Actions">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                 </div>
               </div>

               {/* Scrollable Content Area */}
               <div className="flex-1 overflow-y-auto custom-scrollbar flex">
                  
                  {/* Left Side: Conversation Thread */}
                  <div className="flex-1 p-6 flex flex-col gap-6">
                     
                     {/* Original Message Large Card */}
                     <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 shadow-xl">
                        <div className="flex items-start justify-between mb-4">
                           <div className="flex items-center gap-3">
                             <img src={activeMessage.author.avatar} alt="" className="w-12 h-12 rounded-full border border-white/10" />
                             <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg text-zinc-100">{activeMessage.author.name}</h3>
                                  {activeMessage.author.isVerified && <BadgeCheck className="w-4 h-4 text-blue-400" />}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-zinc-400">
                                  <span>{activeMessage.author.handle}</span>
                                  <span>•</span>
                                  <span>{formatTime(activeMessage.timestamp)}</span>
                                </div>
                             </div>
                           </div>
                           <div className="flex flex-col items-end gap-2">
                              <StatusBadge status={activeMessage.status} />
                              <SentimentBadge sentiment={activeMessage.sentiment} />
                           </div>
                        </div>

                        <div className="text-zinc-200 text-lg leading-relaxed mb-6 whitespace-pre-wrap">
                          {activeMessage.content}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                           <div className="flex items-center gap-6">
                              <button className="flex items-center gap-2 text-zinc-400 hover:text-indigo-400 transition-colors group">
                                <div className="p-2 rounded-full group-hover:bg-indigo-500/10 transition-colors"><MessageCircle className="w-4 h-4"/></div>
                                <span className="text-sm font-medium">{activeMessage.metrics.comments}</span>
                              </button>
                              <button className="flex items-center gap-2 text-zinc-400 hover:text-emerald-400 transition-colors group">
                                <div className="p-2 rounded-full group-hover:bg-emerald-500/10 transition-colors"><Repeat className="w-4 h-4"/></div>
                                <span className="text-sm font-medium">{activeMessage.metrics.shares}</span>
                              </button>
                              <button className="flex items-center gap-2 text-zinc-400 hover:text-rose-400 transition-colors group">
                                <div className="p-2 rounded-full group-hover:bg-rose-500/10 transition-colors"><Heart className="w-4 h-4"/></div>
                                <span className="text-sm font-medium">{activeMessage.metrics.likes}</span>
                              </button>
                              <button className="flex items-center gap-2 text-zinc-400 hover:text-blue-400 transition-colors group">
                                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors"><BarChart2 className="w-4 h-4"/></div>
                                <span className="text-sm font-medium">{activeMessage.metrics.views || 0}</span>
                              </button>
                           </div>
                           <div className="flex items-center gap-2">
                              <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 transition-colors border border-white/10">
                                <Share2 className="w-4 h-4" /> Share
                              </button>
                              <button 
                                onClick={() => {
                                  setReplyingTo(activeMessage.id);
                                  setTimeout(() => document.getElementById('reply-textarea')?.focus(), 100);
                                }}
                                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-lg shadow-indigo-500/20"
                              >
                                <CornerUpLeft className="w-4 h-4" /> Reply
                              </button>
                           </div>
                        </div>
                     </div>

                     {/* Inline Reply Editor */}
                     {replyingTo === activeMessage.id && (
                       <div className="bg-[#121214] border border-indigo-500/30 rounded-2xl p-1 shadow-2xl shadow-indigo-500/10 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
                          <div className="p-3 pb-0">
                            <textarea
                              id="reply-textarea"
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder={`Reply to ${activeMessage.author.name} on ${activeMessage.platform}...`}
                              className="w-full min-h-[120px] bg-transparent border-none resize-none text-zinc-100 placeholder:text-zinc-600 focus:outline-none p-2"
                            />
                          </div>
                          
                          <div className="flex items-center justify-between p-3 border-t border-white/5 bg-white/[0.02] rounded-b-xl">
                            <div className="flex items-center gap-1">
                               <button className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 transition-colors"><Paperclip className="w-4 h-4"/></button>
                               <button className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 transition-colors"><ImageIcon className="w-4 h-4"/></button>
                               <button className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 transition-colors"><Smile className="w-4 h-4"/></button>
                               <div className="w-px h-5 bg-white/10 mx-2"></div>
                               <button 
                                 onClick={generateAiReply}
                                 disabled={isAiGenerating}
                                 className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all text-sm font-medium disabled:opacity-50"
                               >
                                 {isAiGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                 {isAiGenerating ? 'Generating...' : 'AI Suggest'}
                               </button>
                            </div>
                            <div className="flex items-center gap-3">
                               <button 
                                 onClick={() => setReplyingTo(null)}
                                 className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                               >
                                 Cancel
                               </button>
                               <button 
                                 onClick={handleSendReply}
                                 disabled={!replyContent.trim()}
                                 className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white font-medium shadow-lg transition-all"
                               >
                                 Send Reply <Send className="w-4 h-4" />
                               </button>
                            </div>
                          </div>
                       </div>
                     )}

                     {/* Internal Notes / Thread could go here */}
                     {!replyingTo && (
                       <div className="flex items-center gap-4 py-4 px-6 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-zinc-500" />
                          </div>
                          <div className="flex-1">
                             <p className="text-sm text-zinc-400">No internal notes for this conversation yet.</p>
                          </div>
                          <button className="text-sm text-indigo-400 font-medium hover:text-indigo-300">Add Note</button>
                       </div>
                     )}

                  </div>

                  {/* Right Side: User Context Sidebar */}
                  <div className="w-72 border-l border-white/10 bg-[#09090b]/80 p-5 overflow-y-auto hidden xl:block">
                     
                     <div className="flex flex-col items-center text-center pb-6 border-b border-white/10">
                        <img src={activeMessage.author.avatar} alt="" className="w-20 h-20 rounded-full border-2 border-white/10 mb-3" />
                        <h4 className="font-semibold text-lg text-zinc-100">{activeMessage.author.name}</h4>
                        <p className="text-zinc-500 text-sm mb-3">{activeMessage.author.handle}</p>
                        
                        <div className="flex items-center gap-2">
                           <button className="flex-1 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-sm text-zinc-300 border border-white/10 transition-colors">
                             View CRM
                           </button>
                           <button className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-colors">
                             <MoreHorizontal className="w-5 h-5" />
                           </button>
                        </div>
                     </div>

                     <div className="py-5 border-b border-white/10 space-y-4">
                        <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">About</h5>
                        
                        <div className="flex items-center gap-3 text-sm text-zinc-300">
                           <Building2 className="w-4 h-4 text-zinc-500" />
                           <span>{activeMessage.author.company || 'Unknown Company'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-zinc-300">
                           <MapPin className="w-4 h-4 text-zinc-500" />
                           <span>{activeMessage.author.location || 'Unknown Location'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-zinc-300">
                           <Globe className="w-4 h-4 text-zinc-500" />
                           <span className="text-indigo-400">Website URL</span>
                        </div>
                     </div>

                     <div className="py-5 border-b border-white/10">
                        <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Influence Metrics</h5>
                        <div className="grid grid-cols-2 gap-3">
                           <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                              <div className="text-xl font-bold text-zinc-100">
                                {(activeMessage.author.followers / 1000).toFixed(1)}k
                              </div>
                              <div className="text-xs text-zinc-500">Followers</div>
                           </div>
                           <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                              <div className="text-xl font-bold text-zinc-100 flex items-center gap-1">
                                {activeMessage.author.sentiment_score}
                                <span className="text-xs text-emerald-400">↑</span>
                              </div>
                              <div className="text-xs text-zinc-500">Health Score</div>
                           </div>
                        </div>
                     </div>

                     <div className="py-5">
                        <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Past Interactions</h5>
                        <div className="space-y-4">
                           {[1,2,3].map((i) => (
                             <div key={i} className="flex gap-3 relative">
                                <div className="w-px h-full bg-white/10 absolute left-[15px] top-6"></div>
                                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 relative z-10">
                                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-zinc-300">Ticket closed</div>
                                  <div className="text-xs text-zinc-500 mt-0.5">{i} week{i>1?'s':''} ago · Resolved by Agent</div>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>

                  </div>
               </div>
             </div>
          )}
        </div>
      </main>

      {/* Global CSS overrides for scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}

// Fallback Icons
const InboxIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);
