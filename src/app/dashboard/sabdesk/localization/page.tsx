"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Globe, Search, Filter, Plus, Edit2, Trash2, Save, X, Check,
  ChevronDown, ChevronRight, MoreVertical, Download, Upload, AlertCircle,
  Clock, MapPin, Calendar, Settings, Languages, LayoutTemplate,
  MessageSquare, Shield, Activity, RefreshCcw, AlignLeft, AlignRight,
  Sun, Moon, Plane, Server, Database, Zap, FileText, ArrowRight,
  ToggleLeft, ToggleRight, History, Hash, Terminal, Cpu, HardDrive,
  Copy, CheckSquare, Square, SearchX, MousePointerClick, Maximize2, Minimize2
} from 'lucide-react';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface Language {
  code: string;
  name: string;
  dir: 'ltr' | 'rtl';
  completion: number;
  active: boolean;
  isDefault?: boolean;
}

interface TranslationItem {
  id: string;
  namespace: string;
  key: string;
  en: string;
  translations: Record<string, string>;
  status: 'approved' | 'needs_review' | 'missing' | 'auto_translated';
  lastUpdated: string;
  author: string;
  tags: string[];
}

interface BusinessHour {
  day: number; // 0-6
  isOpen: boolean;
  shifts: { start: string; end: string }[];
}

interface RegionSchedule {
  id: string;
  name: string;
  timezone: string;
  hours: BusinessHour[];
  holidays: { date: string; name: string }[];
  overrides: { date: string; shifts: { start: string; end: string }[] }[];
}

interface TimezoneMapping {
  id: string;
  serverRegion: string;
  localTimezone: string;
  offset: string;
  dst: boolean;
  latency: number;
  activeNodes: number;
}

// ==========================================
// MOCK DATA
// ==========================================

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English (US)', dir: 'ltr', completion: 100, active: true, isDefault: true },
  { code: 'es', name: 'Spanish', dir: 'ltr', completion: 92, active: true },
  { code: 'fr', name: 'French', dir: 'ltr', completion: 85, active: true },
  { code: 'de', name: 'German', dir: 'ltr', completion: 70, active: true },
  { code: 'ar', name: 'Arabic', dir: 'rtl', completion: 78, active: true },
  { code: 'he', name: 'Hebrew', dir: 'rtl', completion: 65, active: false },
  { code: 'ja', name: 'Japanese', dir: 'ltr', completion: 95, active: true },
  { code: 'zh-CN', name: 'Chinese (Simplified)', dir: 'ltr', completion: 99, active: true },
  { code: 'hi', name: 'Hindi', dir: 'ltr', completion: 45, active: false },
  { code: 'ru', name: 'Russian', dir: 'ltr', completion: 82, active: true },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', dir: 'ltr', completion: 88, active: true },
  { code: 'ko', name: 'Korean', dir: 'ltr', completion: 74, active: true },
  { code: 'it', name: 'Italian', dir: 'ltr', completion: 60, active: false },
];

const NAMESPACES = ['common', 'auth', 'dashboard', 'settings', 'errors', 'billing', 'notifications', 'onboarding', 'emails', 'sms'];
const TAGS = ['frontend', 'backend', 'mobile', 'legacy', 'v2', 'marketing', 'legal'];

const generateTranslations = (): TranslationItem[] => {
  const data: TranslationItem[] = [];
  const baseKeys = [
    'button.save', 'button.cancel', 'button.delete', 'button.edit', 'button.create',
    'title.dashboard', 'title.settings', 'title.profile', 'title.users', 'title.analytics',
    'message.success', 'message.error', 'message.warning', 'message.info',
    'label.email', 'label.password', 'label.username', 'label.phone', 'label.address',
    'placeholder.search', 'placeholder.enter_email', 'placeholder.enter_name',
    'error.required', 'error.invalid_email', 'error.password_too_short',
    'tooltip.help', 'tooltip.info', 'tooltip.close', 'tooltip.expand',
    'nav.home', 'nav.reports', 'nav.integrations', 'nav.billing', 'nav.support',
    'action.approve', 'action.reject', 'action.submit', 'action.review'
  ];
  
  for (let i = 0; i < 500; i++) {
    const ns = NAMESPACES[Math.floor(Math.random() * NAMESPACES.length)];
    const baseKey = baseKeys[Math.floor(Math.random() * baseKeys.length)];
    const key = i < baseKeys.length ? baseKey : `${baseKey}_${i}`;
    
    const statuses: TranslationItem['status'][] = ['approved', 'needs_review', 'missing', 'auto_translated'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    const itemTags = Array.from({ length: Math.floor(Math.random() * 3) }).map(() => TAGS[Math.floor(Math.random() * TAGS.length)]);
    
    data.push({
      id: `tr_${i}`,
      namespace: ns,
      key: key,
      en: `English source text for ${key} in ${ns}`,
      translations: {
        es: Math.random() > 0.2 ? `Texto en español para ${key}` : '',
        fr: Math.random() > 0.3 ? `Texte français pour ${key}` : '',
        de: Math.random() > 0.4 ? `Deutscher Text für ${key}` : '',
        ar: Math.random() > 0.5 ? `النص العربي لـ ${key}` : '',
        ja: Math.random() > 0.2 ? `${key} の日本語テキスト` : '',
        'zh-CN': Math.random() > 0.1 ? `${key} 的中文文本` : '',
      },
      status: status,
      lastUpdated: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      author: Math.random() > 0.5 ? 'system_bot' : 'human_translator_1',
      tags: [...new Set(itemTags)],
    });
  }
  return data;
};

const INITIAL_TRANSLATIONS = generateTranslations();

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
  'Australia/Sydney', 'Pacific/Auckland'
];

const INITIAL_REGIONS: RegionSchedule[] = [
  {
    id: 'reg_na',
    name: 'North America (HQ)',
    timezone: 'America/New_York',
    hours: Array.from({ length: 7 }).map((_, i) => ({
      day: i,
      isOpen: i >= 1 && i <= 5,
      shifts: i >= 1 && i <= 5 ? [{ start: '09:00', end: '17:00' }] : []
    })),
    holidays: [
      { date: '2026-07-04', name: 'Independence Day' },
      { date: '2026-11-26', name: 'Thanksgiving' },
      { date: '2026-12-25', name: 'Christmas Day' }
    ],
    overrides: [
      { date: '2026-12-24', shifts: [{ start: '09:00', end: '13:00' }] }
    ]
  },
  {
    id: 'reg_emea',
    name: 'EMEA Support',
    timezone: 'Europe/London',
    hours: Array.from({ length: 7 }).map((_, i) => ({
      day: i,
      isOpen: i >= 1 && i <= 5,
      shifts: i >= 1 && i <= 5 ? [{ start: '08:00', end: '18:00' }] : []
    })),
    holidays: [
      { date: '2026-05-04', name: 'Early May Bank Holiday' },
      { date: '2026-08-31', name: 'Summer Bank Holiday' }
    ],
    overrides: []
  },
  {
    id: 'reg_apac',
    name: 'APAC Support',
    timezone: 'Asia/Tokyo',
    hours: Array.from({ length: 7 }).map((_, i) => ({
      day: i,
      isOpen: i >= 1 && i <= 6, // Open Saturdays
      shifts: i >= 1 && i <= 5 ? [{ start: '09:00', end: '18:00' }] : i === 6 ? [{ start: '10:00', end: '15:00' }] : []
    })),
    holidays: [
      { date: '2026-01-01', name: 'New Year' },
      { date: '2026-05-05', name: 'Children\'s Day' }
    ],
    overrides: []
  }
];

const INITIAL_MAPPINGS: TimezoneMapping[] = [
  { id: 'map_1', serverRegion: 'us-east-1', localTimezone: 'America/New_York', offset: '-05:00', dst: true, latency: 12, activeNodes: 145 },
  { id: 'map_2', serverRegion: 'us-west-2', localTimezone: 'America/Los_Angeles', offset: '-08:00', dst: true, latency: 45, activeNodes: 89 },
  { id: 'map_3', serverRegion: 'eu-west-1', localTimezone: 'Europe/London', offset: '+00:00', dst: true, latency: 85, activeNodes: 112 },
  { id: 'map_4', serverRegion: 'eu-central-1', localTimezone: 'Europe/Berlin', offset: '+01:00', dst: true, latency: 90, activeNodes: 76 },
  { id: 'map_5', serverRegion: 'ap-northeast-1', localTimezone: 'Asia/Tokyo', offset: '+09:00', dst: false, latency: 150, activeNodes: 64 },
  { id: 'map_6', serverRegion: 'ap-south-1', localTimezone: 'Asia/Kolkata', offset: '+05:30', dst: false, latency: 210, activeNodes: 42 },
];


// ==========================================
// SUB-COMPONENTS
// ==========================================

// 1. Translations Tab
const TranslationsTab = ({ translations, setTranslations }: { translations: TranslationItem[], setTranslations: any }) => {
  const [search, setSearch] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [targetLang, setTargetLang] = useState<string>('es');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  const filteredTranslations = useMemo(() => {
    return translations.filter(t => {
      const matchesSearch = t.key.toLowerCase().includes(search.toLowerCase()) || 
                            t.en.toLowerCase().includes(search.toLowerCase()) ||
                            (t.translations[targetLang] && t.translations[targetLang].toLowerCase().includes(search.toLowerCase()));
      const matchesNs = namespaceFilter === 'all' || t.namespace === namespaceFilter;
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesNs && matchesStatus;
    });
  }, [translations, search, namespaceFilter, statusFilter, targetLang]);

  const paginated = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredTranslations.slice(start, start + itemsPerPage);
  }, [filteredTranslations, page]);

  const totalPages = Math.ceil(filteredTranslations.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const startEdit = (t: TranslationItem) => {
    setEditingId(t.id);
    setEditValue(t.translations[targetLang] || '');
  };

  const saveEdit = (id: string) => {
    setTranslations((prev: TranslationItem[]) => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          translations: { ...t.translations, [targetLang]: editValue },
          status: 'approved',
          lastUpdated: new Date().toISOString()
        };
      }
      return t;
    }));
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search keys or text..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 w-64 text-white"
            />
          </div>
          <select 
            value={namespaceFilter}
            onChange={e => setNamespaceFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white"
          >
            <option value="all">All Namespaces</option>
            {NAMESPACES.map(ns => <option key={ns} value={ns}>{ns}</option>)}
          </select>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="needs_review">Needs Review</option>
            <option value="missing">Missing</option>
            <option value="auto_translated">Auto Translated</option>
          </select>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
            <span className="text-xs text-gray-400 uppercase font-semibold">Target:</span>
            <select 
              value={targetLang}
              onChange={e => setTargetLang(e.target.value)}
              className="bg-transparent text-sm focus:outline-none text-white font-medium"
            >
              {LANGUAGES.filter(l => !l.isDefault).map(l => (
                <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
          
          <button className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors" title="Import CSV">
            <Upload className="w-4 h-4 text-gray-300" />
          </button>
          <button className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors" title="Export CSV">
            <Download className="w-4 h-4 text-gray-300" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Add Key
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-900/30 border border-blue-800/50 rounded-xl animate-in fade-in slide-in-from-top-2">
          <span className="text-sm text-blue-200">{selectedIds.size} items selected</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded border border-gray-700 text-white">Approve Selected</button>
            <button className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded border border-gray-700 text-white flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> Auto-Translate
            </button>
            <button className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900/80 text-xs font-medium rounded border border-red-800/50 text-red-200">Delete Selected</button>
          </div>
        </div>
      )}

      {/* Data Grid */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-12">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
                    {selectedIds.size > 0 && selectedIds.size === paginated.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">Key Information</th>
                <th className="px-4 py-3 font-semibold w-1/3">Source (English)</th>
                <th className="px-4 py-3 font-semibold w-1/3">Target ({targetLang})</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {paginated.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-800/30 transition-colors group ${selectedIds.has(t.id) ? 'bg-blue-900/10' : ''}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleSelect(t.id)} className="text-gray-500 hover:text-gray-300">
                      {selectedIds.has(t.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs text-blue-400 font-medium break-all">{t.key}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded-md bg-gray-800 text-[10px] text-gray-400 border border-gray-700">{t.namespace}</span>
                        {t.status === 'approved' && <span className="w-2 h-2 rounded-full bg-green-500" title="Approved"></span>}
                        {t.status === 'needs_review' && <span className="w-2 h-2 rounded-full bg-yellow-500" title="Needs Review"></span>}
                        {t.status === 'missing' && <span className="w-2 h-2 rounded-full bg-red-500" title="Missing"></span>}
                        {t.status === 'auto_translated' && <span className="w-2 h-2 rounded-full bg-purple-500" title="Auto Translated"></span>}
                      </div>
                      {t.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.tags.map(tag => (
                            <span key={tag} className="text-[9px] px-1 bg-gray-800 text-gray-500 rounded flex items-center gap-0.5">
                              <Hash className="w-2 h-2" /> {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{t.en}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {editingId === t.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea 
                          className="w-full bg-gray-950 border border-blue-500 rounded-lg p-2 text-sm text-white focus:outline-none resize-y min-h-[80px]"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-white bg-gray-800 rounded"><X className="w-4 h-4" /></button>
                          <button onClick={() => saveEdit(t.id)} className="p-1 text-green-400 hover:text-green-300 bg-green-900/30 rounded"><Check className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className={`text-sm whitespace-pre-wrap p-2 rounded-lg border border-transparent hover:border-gray-700 hover:bg-gray-800/50 cursor-text min-h-[40px] ${!t.translations[targetLang] ? 'text-gray-600 italic' : 'text-gray-200'}`}
                        onClick={() => startEdit(t)}
                      >
                        {t.translations[targetLang] || 'Empty translation... Click to add.'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg" onClick={() => startEdit(t)} title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded-lg" title="View History">
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <SearchX className="w-8 h-8 text-gray-600" />
                      <p>No translations found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-3 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredTranslations.length)} of {filteredTranslations.length} entries
          </span>
          <div className="flex items-center gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 bg-gray-800 disabled:opacity-50 border border-gray-700 rounded text-xs text-gray-300 hover:bg-gray-700"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-xs text-gray-400">Page {page} of {totalPages || 1}</span>
            <button 
              disabled={page === totalPages || totalPages === 0} 
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 bg-gray-800 disabled:opacity-50 border border-gray-700 rounded text-xs text-gray-300 hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. Regional Settings Tab
const RegionalSettingsTab = () => {
  const [activeLang, setActiveLang] = useState('en');
  const [previewText, setPreviewText] = useState('Welcome to our advanced dashboard. Please configure your settings below.');
  
  const currentLangObj = LANGUAGES.find(l => l.code === activeLang);
  const isRtl = currentLangObj?.dir === 'rtl';

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Settings Form */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Default Regional Preferences</h2>
              <p className="text-sm text-gray-400">Set the default formatting for users who haven't specified their preferences.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Primary Language</label>
              <select className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Fallback Language</label>
              <select className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" defaultValue="en">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
              <p className="text-xs text-gray-500">Used when a translation is missing in the primary language.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Default Timezone</label>
              <select className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Currency Format</label>
              <select className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500">
                <option value="USD">USD ($1,234.56)</option>
                <option value="EUR">EUR (1.234,56 €)</option>
                <option value="GBP">GBP (£1,234.56)</option>
                <option value="JPY">JPY (¥1,234)</option>
                <option value="INR">INR (₹1,234.56)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Date Format</label>
              <select className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500">
                <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Time Format</label>
              <select className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500">
                <option value="12h">12-hour (02:30 PM)</option>
                <option value="24h">24-hour (14:30)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-800 flex justify-end">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              <Save className="w-4 h-4" /> Save Preferences
            </button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
           <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Language Availability</h2>
              <p className="text-sm text-gray-400">Manage which languages are available to end users.</p>
            </div>
          </div>

          <div className="space-y-3">
            {LANGUAGES.map(lang => (
              <div key={lang.code} className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 uppercase">
                    {lang.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">{lang.name}</span>
                      {lang.isDefault && <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded border border-blue-800">Default</span>}
                      {lang.dir === 'rtl' && <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded border border-purple-800">RTL</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${lang.completion > 90 ? 'bg-green-500' : lang.completion > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={ width: `${lang.completion}%` }
                        />
                      </div>
                      <span className="text-xs text-gray-500">{lang.completion}% translated</span>
                    </div>
                  </div>
                </div>
                <button className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${lang.active ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${lang.active ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Preview Panel */}
      <div className="w-full lg:w-[400px] xl:w-[500px] flex flex-col gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 sticky top-4 flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-gray-400" /> Layout Preview
            </h2>
            <select 
              value={activeLang}
              onChange={e => setActiveLang(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
            >
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} ({l.dir.toUpperCase()})</option>)}
            </select>
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Test String</label>
            <textarea 
              value={previewText}
              onChange={e => setPreviewText(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-sm text-gray-300 focus:outline-none focus:border-gray-600"
              rows={2}
            />
          </div>

          <div className="border border-gray-700 rounded-lg overflow-hidden bg-white mt-4 relative min-h-[400px]">
            {/* Fake Browser Top */}
            <div className="bg-gray-200 px-3 py-2 flex items-center gap-2 border-b border-gray-300">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
              </div>
              <div className="mx-auto bg-white px-24 py-0.5 rounded text-[10px] text-gray-500 font-mono">dashboard.preview</div>
            </div>
            
            {/* Preview Content */}
            <div 
              className="p-6 text-gray-800 flex flex-col gap-6"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Header Mock */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
                  <div className="font-bold text-lg">AppName</div>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>Home</span>
                  <span>Analytics</span>
                  <span>Settings</span>
                </div>
              </div>

              {/* Main Content Mock */}
              <div className="flex gap-6">
                {/* Sidebar Mock */}
                <div className="w-32 flex flex-col gap-3">
                  <div className="h-6 bg-gray-200 rounded-md w-full"></div>
                  <div className="h-6 bg-gray-100 rounded-md w-4/5"></div>
                  <div className="h-6 bg-gray-100 rounded-md w-5/6"></div>
                  <div className="h-6 bg-gray-100 rounded-md w-3/4"></div>
                </div>
                
                {/* Content Area Mock */}
                <div className="flex-1 space-y-4">
                  <h1 className="text-2xl font-bold">{isRtl ? 'مرحبا بك في لوحة القيادة' : 'Dashboard Overview'}</h1>
                  
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-900 shadow-sm">
                    <p className="text-sm font-medium">{previewText}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg flex flex-col gap-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-8 bg-gray-100 rounded w-full mt-2"></div>
                      <div className="flex justify-end mt-2">
                        <div className="h-6 bg-blue-500 rounded w-16"></div>
                      </div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg flex flex-col gap-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      <div className="h-2 bg-gray-100 rounded w-full mt-2"></div>
                      <div className="h-2 bg-gray-100 rounded w-5/6"></div>
                      <div className="h-2 bg-gray-100 rounded w-4/6"></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>Direction: <strong className="text-gray-300 uppercase">{isRtl ? 'RTL' : 'LTR'}</strong></span>
            <span>Alignment: <strong className="text-gray-300">{isRtl ? 'Right-to-Left' : 'Left-to-Right'}</strong></span>
          </div>

        </div>
      </div>
    </div>
  );
};

// 3. Business Hours Tab
const BusinessHoursTab = () => {
  const [regions, setRegions] = useState<RegionSchedule[]>(INITIAL_REGIONS);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(INITIAL_REGIONS[0].id);

  const selectedRegion = useMemo(() => regions.find(r => r.id === selectedRegionId) || regions[0], [regions, selectedRegionId]);

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      
      {/* Sidebar List */}
      <div className="w-full lg:w-64 flex flex-col gap-3">
        <button className="flex items-center justify-center gap-2 w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Region
        </button>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {regions.map(r => (
            <button 
              key={r.id}
              onClick={() => setSelectedRegionId(r.id)}
              className={`w-full text-left px-4 py-3 flex flex-col gap-1 border-b border-gray-800 transition-colors last:border-0
                ${selectedRegionId === r.id ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/50 border-l-2 border-l-transparent'}`}
            >
              <span className="font-medium text-sm text-gray-200">{r.name}</span>
              <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {r.timezone}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {selectedRegion.name}
              <button className="text-gray-500 hover:text-white"><Edit2 className="w-4 h-4" /></button>
            </h2>
            <p className="text-sm text-gray-400 mt-1">Configure operating hours, timezone, and holidays for this region.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm border border-gray-700">Discard</button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Save Changes</button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          
          {/* General Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Timezone</label>
              <select 
                value={selectedRegion.timezone}
                onChange={() => {}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Status</label>
              <div className="flex items-center gap-3 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-white">Currently Open (Local time: 10:45 AM)</span>
              </div>
            </div>
          </div>

          {/* Weekly Schedule */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-400" /> Weekly Schedule</h3>
            <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950">
              {selectedRegion.hours.map((dayHour, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border-b border-gray-800 last:border-0 hover:bg-gray-900/50 transition-colors">
                  
                  <div className="w-32 flex items-center gap-3">
                    <button className={`w-10 h-6 rounded-full transition-colors relative ${dayHour.isOpen ? 'bg-blue-600' : 'bg-gray-700'}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${dayHour.isOpen ? 'left-5' : 'left-1'}`}></span>
                    </button>
                    <span className={`text-sm font-medium ${dayHour.isOpen ? 'text-gray-200' : 'text-gray-500'}`}>{daysOfWeek[dayHour.day]}</span>
                  </div>
                  
                  <div className="flex-1">
                    {dayHour.isOpen ? (
                      <div className="flex flex-col gap-2">
                        {dayHour.shifts.length > 0 ? (
                          dayHour.shifts.map((shift, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-2">
                              <input type="time" value={shift.start} onChange={() => {} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none" />
                              <span className="text-gray-500">-</span>
                              <input type="time" value={shift.end} onChange={() => {} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none" />
                              <button className="p-1.5 text-gray-500 hover:text-red-400 rounded"><X className="w-4 h-4" /></button>
                              {sIdx === dayHour.shifts.length - 1 && (
                                <button className="p-1.5 text-gray-500 hover:text-blue-400 rounded" title="Add Shift"><Plus className="w-4 h-4" /></button>
                              )}
                            </div>
                          ))
                        ) : (
                           <button className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"><Plus className="w-4 h-4" /> Add Hours</button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-600 italic">Closed</span>
                    )}
                  </div>
                  
                  <button className="text-gray-500 hover:text-white" title="Copy to all"><Copy className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Holidays & Exceptions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            <div>
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Calendar className="w-5 h-5 text-gray-400" /> Holidays (Closed)</h3>
                 <button className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
               </div>
               
               <div className="space-y-2">
                 {selectedRegion.holidays.length > 0 ? selectedRegion.holidays.map((h, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded-lg">
                     <div className="flex flex-col">
                       <span className="text-sm font-medium text-gray-200">{h.name}</span>
                       <span className="text-xs text-gray-500">{h.date}</span>
                     </div>
                     <button className="p-1.5 text-gray-500 hover:text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 )) : (
                   <div className="p-4 text-center border border-dashed border-gray-700 rounded-lg text-sm text-gray-500">No holidays configured</div>
                 )}
               </div>
            </div>

            <div>
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-semibold text-white flex items-center gap-2"><AlertCircle className="w-5 h-5 text-gray-400" /> Overrides (Custom Hours)</h3>
                 <button className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
               </div>
               
               <div className="space-y-2">
                 {selectedRegion.overrides.length > 0 ? selectedRegion.overrides.map((o, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded-lg">
                     <div className="flex flex-col gap-1">
                       <span className="text-sm font-medium text-gray-200">Date: {o.date}</span>
                       <div className="flex gap-2">
                         {o.shifts.map((s, si) => (
                           <span key={si} className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded border border-gray-700">{s.start} - {s.end}</span>
                         ))}
                       </div>
                     </div>
                     <button className="p-1.5 text-gray-500 hover:text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 )) : (
                   <div className="p-4 text-center border border-dashed border-gray-700 rounded-lg text-sm text-gray-500">No overrides configured</div>
                 )}
               </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

// 4. Content Delivery Tab (CDN & Timezone grid)
const ContentDeliveryTab = () => {
  const [mappings, setMappings] = useState<TimezoneMapping[]>(INITIAL_MAPPINGS);

  return (
    <div className="space-y-6 h-full flex flex-col">
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Active Edge Nodes</h3>
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white">528</div>
          <div className="text-xs text-green-400 mt-2 flex items-center gap-1">+12 this week</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Global Avg Latency</h3>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold text-white">42ms</div>
          <div className="text-xs text-green-400 mt-2 flex items-center gap-1">-5ms optimization</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Cached Assets</h3>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">99.8%</div>
          <div className="text-xs text-gray-500 mt-2">Hit ratio across all regions</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Localization Sync</h3>
            <RefreshCcw className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white">Healthy</div>
          <div className="text-xs text-gray-500 mt-2">Last sync 2 mins ago</div>
        </div>
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Regional Server Mapping</h2>
            <p className="text-sm text-gray-400">Map specific physical server regions to logical timezones to optimize routing for localized users.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm border border-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Mapping
          </button>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Server Region (AWS/GCP)</th>
                <th className="px-6 py-4 font-semibold">Assigned Timezone</th>
                <th className="px-6 py-4 font-semibold">UTC Offset</th>
                <th className="px-6 py-4 font-semibold">DST Active</th>
                <th className="px-6 py-4 font-semibold">Latency</th>
                <th className="px-6 py-4 font-semibold">Nodes</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {mappings.map(m => (
                <tr key={m.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-gray-500" />
                    {m.serverRegion}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      {m.localTimezone}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-400">
                    UTC {m.offset}
                  </td>
                  <td className="px-6 py-4">
                    {m.dst ? (
                      <span className="px-2 py-1 bg-yellow-900/30 text-yellow-500 rounded text-xs border border-yellow-800/50 flex w-fit items-center gap-1">
                        <Sun className="w-3 h-3" /> Yes
                      </span>
                    ) : (
                       <span className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs border border-gray-700 flex w-fit items-center gap-1">
                        <Moon className="w-3 h-3" /> No
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${m.latency < 50 ? 'bg-green-500' : m.latency < 100 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                      {m.latency}ms
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {m.activeNodes}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
                      <MoreVertical className="w-4 h-4" />
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


// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================

export default function LocalizationDashboard() {
  const [activeTab, setActiveTab] = useState<'translations' | 'regional' | 'business' | 'cdn'>('translations');
  
  // Data states lifted up if needed globally, otherwise kept in tabs
  const [translations, setTranslations] = useState<TranslationItem[]>(INITIAL_TRANSLATIONS);

  const TABS = [
    { id: 'translations', label: 'Translation Strings', icon: Languages },
    { id: 'regional', label: 'Regional Settings', icon: Globe },
    { id: 'business', label: 'Business Hours', icon: Clock },
    { id: 'cdn', label: 'Delivery & Timezones', icon: Server },
  ] as const;

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col font-sans">
      
      {/* Header */}
      <header className="h-16 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 shrink-0 z-20 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white leading-tight">Localization Hub</h1>
            <p className="text-xs text-gray-500">SabDesk Global Workspace Settings</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
            <Activity className="w-4 h-4 text-green-500" />
            Sync Status: <span className="text-white">Up to date</span>
          </div>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors relative">
            <MessageSquare className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500"></span>
          </button>
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center text-xs font-bold">
            AD
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-[1600px] w-full mx-auto px-6 py-6 gap-6">
        
        {/* Top Info Bar & Tabs Navigation */}
        <div className="flex flex-col gap-6 shrink-0">
          
          <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-px">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors relative top-[1px]
                    ${isActive 
                      ? 'border-blue-500 text-blue-400 bg-blue-900/10 rounded-t-lg' 
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/50 rounded-t-lg'}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'translations' && (
                    <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-[10px] border border-gray-700">
                      {translations.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Dynamic Tab Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'translations' && <TranslationsTab translations={translations} setTranslations={setTranslations} />}
          {activeTab === 'regional' && <RegionalSettingsTab />}
          {activeTab === 'business' && <BusinessHoursTab />}
          {activeTab === 'cdn' && <ContentDeliveryTab />}
        </div>

      </div>
    </div>
  );
}
