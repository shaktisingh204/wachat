"use client";

import React, { useState, useMemo } from 'react';
import {
  Globe, Search, Plus, Edit2, Trash2, Save, X, Check,
  MoreVertical, Download, Upload, AlertCircle,
  Clock, MapPin, Calendar, Settings, Languages, LayoutTemplate,
  MessageSquare, Activity, RefreshCcw,
  Sun, Moon, Server, Database, Zap,
  History, Hash, SearchX, Maximize2
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  Input,
  Textarea,
  Checkbox,
  Switch,
  Badge,
  Dot,
  Tag,
  Progress,
  StatCard,
  Avatar,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Pagination,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';

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
      { date: '2026-05-05', name: "Children's Day" }
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

const STATUS_TONE: Record<TranslationItem['status'], 'success' | 'warning' | 'danger' | 'accent'> = {
  approved: 'success',
  needs_review: 'warning',
  missing: 'danger',
  auto_translated: 'accent',
};

const STATUS_LABEL: Record<TranslationItem['status'], string> = {
  approved: 'Approved',
  needs_review: 'Needs Review',
  missing: 'Missing',
  auto_translated: 'Auto Translated',
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

// 1. Translations Tab
const TranslationsTab = ({ translations, setTranslations }: { translations: TranslationItem[], setTranslations: React.Dispatch<React.SetStateAction<TranslationItem[]>> }) => {
  const { toast } = useToast();
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
          status: 'approved' as const,
          lastUpdated: new Date().toISOString()
        };
      }
      return t;
    }));
    setEditingId(null);
    toast.success('Translation saved');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const allSelected = selectedIds.size > 0 && selectedIds.size === paginated.length;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)]">
        <div className="flex items-center gap-3">
          <Input
            iconLeft={Search}
            type="text"
            placeholder="Search keys or text..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search translations"
            className="w-64"
          />
          <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
            <SelectTrigger aria-label="Filter by namespace" className="min-w-[160px]">
              <SelectValue placeholder="All Namespaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Namespaces</SelectItem>
              {NAMESPACES.map(ns => <SelectItem key={ns} value={ns}>{ns}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter by status" className="min-w-[150px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
              <SelectItem value="auto_translated">Auto Translated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--st-text-secondary)] uppercase font-semibold">Target</span>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger aria-label="Target language" className="min-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.filter(l => !l.isDefault).map(l => (
                  <SelectItem key={l.code} value={l.code}>{l.name} ({l.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <IconButton label="Import CSV" icon={Upload} variant="outline" onClick={() => toast.info('Import dialog coming soon')} />
          <IconButton label="Export CSV" icon={Download} variant="outline" onClick={() => toast.info('Export started')} />
          <Button variant="primary" iconLeft={Plus} onClick={() => toast.info('Add key form coming soon')}>
            Add Key
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-[var(--st-accent-soft)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)]">
          <span className="text-sm text-[var(--st-accent)]">{selectedIds.size} items selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => toast.success(`${selectedIds.size} approved`)}>Approve Selected</Button>
            <Button size="sm" variant="secondary" iconLeft={RefreshCcw} onClick={() => toast.info('Auto-translation queued')}>Auto-Translate</Button>
            <Button size="sm" variant="danger" onClick={() => toast.error(`${selectedIds.size} deleted`)}>Delete Selected</Button>
          </div>
        </div>
      )}

      {/* Data Grid */}
      <Card padding="none" className="flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <Table stickyHeader>
            <THead>
              <Tr>
                <Th align="center" width={48}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedIds.size > 0 && !allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all translations on this page"
                  />
                </Th>
                <Th>Key Information</Th>
                <Th width="33%">Source (English)</Th>
                <Th width="33%">Target ({targetLang})</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {paginated.map((t) => (
                <Tr key={t.id} selected={selectedIds.has(t.id)} className="group">
                  <Td align="center">
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      aria-label={`Select ${t.key}`}
                    />
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1 align-top">
                      <span className="font-mono text-xs text-[var(--st-accent)] font-medium break-all">{t.key}</span>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral" kind="outline">{t.namespace}</Badge>
                        <Dot tone={STATUS_TONE[t.status]} aria-label={STATUS_LABEL[t.status]} />
                      </div>
                      {t.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.tags.map((tag, ti) => (
                            <Tag key={`${tag}-${ti}`}>
                              <Hash size={9} aria-hidden="true" /> {tag}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <p className="text-[var(--st-text)] text-sm whitespace-pre-wrap align-top">{t.en}</p>
                  </Td>
                  <Td>
                    {editingId === t.id ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          aria-label={`Edit translation for ${t.key}`}
                          autoFocus
                          rows={3}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <IconButton label="Cancel edit" icon={X} variant="ghost" size="sm" onClick={cancelEdit} />
                          <IconButton label="Save translation" icon={Check} variant="primary" size="sm" onClick={() => saveEdit(t.id)} />
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        className={`!h-auto !justify-start !block w-full text-left text-sm whitespace-pre-wrap !p-2 !rounded-[var(--st-radius)] border border-transparent hover:border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] cursor-text min-h-[40px] ${!t.translations[targetLang] ? 'text-[var(--st-text-tertiary)] italic' : 'text-[var(--st-text)]'}`}
                        onClick={() => startEdit(t)}
                      >
                        {t.translations[targetLang] || 'Empty translation. Click to add.'}
                      </Button>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton label="Edit" icon={Edit2} variant="ghost" size="sm" onClick={() => startEdit(t)} />
                      <IconButton label="View history" icon={History} variant="ghost" size="sm" onClick={() => toast.info('History view coming soon')} />
                      <IconButton label="Delete" icon={Trash2} variant="ghost" size="sm" onClick={() => toast.error('Deleted')} />
                    </div>
                  </Td>
                </Tr>
              ))}
              {paginated.length === 0 && (
                <Tr>
                  <Td colSpan={5}>
                    <EmptyState
                      icon={SearchX}
                      title="No translations found"
                      description="No translations match your current search and filters."
                    />
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between">
          <span className="text-xs text-[var(--st-text-tertiary)]">
            Showing {filteredTranslations.length === 0 ? 0 : (page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredTranslations.length)} of {filteredTranslations.length} entries
          </span>
          <Pagination
            page={page}
            pageCount={totalPages || 1}
            onPageChange={setPage}
          />
        </div>
      </Card>
    </div>
  );
};

// 2. Regional Settings Tab
const RegionalSettingsTab = () => {
  const { toast } = useToast();
  const [activeLang, setActiveLang] = useState('en');
  const [previewText, setPreviewText] = useState('Welcome to our advanced dashboard. Please configure your settings below.');
  const [langActive, setLangActive] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LANGUAGES.map(l => [l.code, l.active]))
  );

  const currentLangObj = LANGUAGES.find(l => l.code === activeLang);
  const isRtl = currentLangObj?.dir === 'rtl';

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Settings Form */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">

        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-[var(--st-accent-soft)] rounded-[var(--st-radius)] text-[var(--st-accent)]">
                <Languages size={20} aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Default Regional Preferences</CardTitle>
                <CardDescription>Set the default formatting for users who have not specified their preferences.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Primary Language">
                <Select defaultValue="en">
                  <SelectTrigger aria-label="Primary language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Fallback Language" help="Used when a translation is missing in the primary language.">
                <Select defaultValue="en">
                  <SelectTrigger aria-label="Fallback language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Default Timezone">
                <Select defaultValue="UTC">
                  <SelectTrigger aria-label="Default timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Currency Format">
                <Select defaultValue="USD">
                  <SelectTrigger aria-label="Currency format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($1,234.56)</SelectItem>
                    <SelectItem value="EUR">EUR (1.234,56 €)</SelectItem>
                    <SelectItem value="GBP">GBP (£1,234.56)</SelectItem>
                    <SelectItem value="JPY">JPY (¥1,234)</SelectItem>
                    <SelectItem value="INR">INR (₹1,234.56)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date Format">
                <Select defaultValue="MM/DD/YYYY">
                  <SelectTrigger aria-label="Date format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Time Format">
                <Select defaultValue="12h">
                  <SelectTrigger aria-label="Time format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour (02:30 PM)</SelectItem>
                    <SelectItem value="24h">24-hour (14:30)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--st-border)] flex justify-end">
              <Button variant="primary" iconLeft={Save} onClick={() => toast.success('Preferences saved')}>
                Save Preferences
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-[var(--st-accent-soft)] rounded-[var(--st-radius)] text-[var(--st-accent)]">
                <LayoutTemplate size={20} aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Language Availability</CardTitle>
                <CardDescription>Manage which languages are available to end users.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {LANGUAGES.map(lang => (
                <div key={lang.code} className="flex items-center justify-between p-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center text-xs font-bold text-[var(--st-text-secondary)] uppercase">
                      {lang.code}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--st-text)]">{lang.name}</span>
                        {lang.isDefault && <Badge tone="accent" kind="outline">Default</Badge>}
                        {lang.dir === 'rtl' && <Badge tone="info" kind="outline">RTL</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress
                          value={lang.completion}
                          tone={lang.completion > 90 ? 'success' : lang.completion > 50 ? 'warning' : 'danger'}
                          size="sm"
                          className="w-24"
                          aria-label={`${lang.name} translation progress`}
                        />
                        <span className="text-xs text-[var(--st-text-tertiary)]">{lang.completion}% translated</span>
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={langActive[lang.code]}
                    onCheckedChange={(next) => setLangActive(prev => ({ ...prev, [lang.code]: next }))}
                    aria-label={`Toggle ${lang.name} availability`}
                  />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

      </div>

      {/* Preview Panel */}
      <div className="w-full lg:w-[400px] xl:w-[500px] flex flex-col gap-4">
        <Card padding="lg" className="sticky top-4 flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-2">
              <Maximize2 size={16} className="text-[var(--st-text-secondary)]" aria-hidden="true" /> Layout Preview
            </h2>
            <Select value={activeLang} onValueChange={setActiveLang}>
              <SelectTrigger aria-label="Preview language" className="min-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name} ({l.dir.toUpperCase()})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-4">
            <Field label="Test String">
              <Textarea
                value={previewText}
                onChange={e => setPreviewText(e.target.value)}
                rows={2}
              />
            </Field>
          </div>

          <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden bg-white mt-4 relative min-h-[400px]">
            {/* Fake Browser Top */}
            <div className="bg-gray-200 px-3 py-2 flex items-center gap-2 border-b border-gray-300">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" aria-hidden="true"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" aria-hidden="true"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" aria-hidden="true"></span>
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
                  <div className="w-8 h-8 bg-blue-600 rounded-lg" aria-hidden="true"></div>
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
                <div className="w-32 flex flex-col gap-3" aria-hidden="true">
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

                  <div className="grid grid-cols-2 gap-4" aria-hidden="true">
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

          <div className="mt-4 flex items-center justify-between text-xs text-[var(--st-text-tertiary)]">
            <span>Direction: <strong className="text-[var(--st-text)] uppercase">{isRtl ? 'RTL' : 'LTR'}</strong></span>
            <span>Alignment: <strong className="text-[var(--st-text)]">{isRtl ? 'Right-to-Left' : 'Left-to-Right'}</strong></span>
          </div>

        </Card>
      </div>
    </div>
  );
};

// 3. Business Hours Tab
const BusinessHoursTab = () => {
  const { toast } = useToast();
  const [regions] = useState<RegionSchedule[]>(INITIAL_REGIONS);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(INITIAL_REGIONS[0].id);

  const selectedRegion = useMemo(() => regions.find(r => r.id === selectedRegionId) || regions[0], [regions, selectedRegionId]);

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">

      {/* Sidebar List */}
      <div className="w-full lg:w-64 flex flex-col gap-3">
        <Button variant="secondary" block iconLeft={Plus} onClick={() => toast.info('Add region form coming soon')}>
          Add Region
        </Button>

        <Card padding="none" className="overflow-hidden">
          {regions.map(r => {
            const isActive = selectedRegionId === r.id;
            return (
              <Button
                key={r.id}
                variant="ghost"
                onClick={() => setSelectedRegionId(r.id)}
                aria-pressed={isActive}
                className={`!h-auto !justify-start w-full text-left !px-4 !py-3 flex flex-col !items-start gap-1 border-b border-[var(--st-border)] transition-colors last:border-0 border-l-2 !rounded-none
                  ${isActive ? 'bg-[var(--st-accent-soft)] border-l-[var(--st-accent)]' : 'hover:bg-[var(--st-bg-muted)] border-l-transparent'}`}
              >
                <span className="font-medium text-sm text-[var(--st-text)]">{r.name}</span>
                <span className="text-xs text-[var(--st-text-tertiary)] flex items-center gap-1"><MapPin size={12} aria-hidden="true" /> {r.timezone}</span>
              </button>
            );
          })}
        </Card>
      </div>

      {/* Main Content */}
      <Card padding="none" className="flex-1 overflow-y-auto">

        {/* Header */}
        <div className="p-6 border-b border-[var(--st-border)] flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--st-text)] flex items-center gap-2">
              {selectedRegion.name}
              <IconButton label="Rename region" icon={Edit2} variant="ghost" size="sm" onClick={() => toast.info('Rename coming soon')} />
            </h2>
            <p className="text-sm text-[var(--st-text-secondary)] mt-1">Configure operating hours, timezone, and holidays for this region.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => toast.info('Changes discarded')}>Discard</Button>
            <Button variant="primary" onClick={() => toast.success('Changes saved')}>Save Changes</Button>
          </div>
        </div>

        <div className="p-6 space-y-8">

          {/* General Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Timezone">
              <Select value={selectedRegion.timezone} onValueChange={() => {}}>
                <SelectTrigger aria-label="Region timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <div className="flex items-center gap-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] px-4 py-2.5">
                <Dot tone="success" pulse aria-label="Open" />
                <span className="text-sm text-[var(--st-text)]">Currently Open (Local time: 10:45 AM)</span>
              </div>
            </Field>
          </div>

          {/* Weekly Schedule */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--st-text)] mb-4 flex items-center gap-2"><Clock size={20} className="text-[var(--st-text-secondary)]" aria-hidden="true" /> Weekly Schedule</h3>
            <div className="border border-[var(--st-border)] rounded-[var(--st-radius-lg)] overflow-hidden bg-[var(--st-bg-secondary)]">
              {selectedRegion.hours.map((dayHour, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)] transition-colors">

                  <div className="w-32 flex items-center gap-3">
                    <Switch checked={dayHour.isOpen} aria-label={`Toggle ${daysOfWeek[dayHour.day]}`} />
                    <span className={`text-sm font-medium ${dayHour.isOpen ? 'text-[var(--st-text)]' : 'text-[var(--st-text-tertiary)]'}`}>{daysOfWeek[dayHour.day]}</span>
                  </div>

                  <div className="flex-1">
                    {dayHour.isOpen ? (
                      <div className="flex flex-col gap-2">
                        {dayHour.shifts.length > 0 ? (
                          dayHour.shifts.map((shift, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-2">
                              <Input type="time" value={shift.start} onChange={() => {}} inputSize="sm" aria-label="Shift start" className="w-auto" />
                              <span className="text-[var(--st-text-tertiary)]">-</span>
                              <Input type="time" value={shift.end} onChange={() => {}} inputSize="sm" aria-label="Shift end" className="w-auto" />
                              <IconButton label="Remove shift" icon={X} variant="ghost" size="sm" />
                              {sIdx === dayHour.shifts.length - 1 && (
                                <IconButton label="Add shift" icon={Plus} variant="ghost" size="sm" />
                              )}
                            </div>
                          ))
                        ) : (
                          <Button size="sm" variant="ghost" iconLeft={Plus}>Add Hours</Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--st-text-tertiary)] italic">Closed</span>
                    )}
                  </div>

                  <IconButton label="Copy hours to all days" icon={History} variant="ghost" size="sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Holidays & Exceptions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-2"><Calendar size={20} className="text-[var(--st-text-secondary)]" aria-hidden="true" /> Holidays (Closed)</h3>
                <Button size="sm" variant="ghost" iconLeft={Plus}>Add</Button>
              </div>

              <div className="space-y-2">
                {selectedRegion.holidays.length > 0 ? selectedRegion.holidays.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--st-text)]">{h.name}</span>
                      <span className="text-xs text-[var(--st-text-tertiary)]">{h.date}</span>
                    </div>
                    <IconButton label={`Remove holiday ${h.name}`} icon={Trash2} variant="ghost" size="sm" />
                  </div>
                )) : (
                  <div className="p-4 text-center border border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] text-sm text-[var(--st-text-tertiary)]">No holidays configured</div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-2"><AlertCircle size={20} className="text-[var(--st-text-secondary)]" aria-hidden="true" /> Overrides (Custom Hours)</h3>
                <Button size="sm" variant="ghost" iconLeft={Plus}>Add</Button>
              </div>

              <div className="space-y-2">
                {selectedRegion.overrides.length > 0 ? selectedRegion.overrides.map((o, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--st-text)]">Date: {o.date}</span>
                      <div className="flex gap-2">
                        {o.shifts.map((s, si) => (
                          <Badge key={si} tone="neutral" kind="outline">{s.start} - {s.end}</Badge>
                        ))}
                      </div>
                    </div>
                    <IconButton label={`Remove override ${o.date}`} icon={Trash2} variant="ghost" size="sm" />
                  </div>
                )) : (
                  <div className="p-4 text-center border border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] text-sm text-[var(--st-text-tertiary)]">No overrides configured</div>
                )}
              </div>
            </div>

          </div>

        </div>
      </Card>
    </div>
  );
};

// 4. Content Delivery Tab (CDN & Timezone grid)
const ContentDeliveryTab = () => {
  const { toast } = useToast();
  const [mappings] = useState<TimezoneMapping[]>(INITIAL_MAPPINGS);

  return (
    <div className="space-y-6 h-full flex flex-col">

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Active Edge Nodes" value="528" icon={Server} delta={{ value: '+12 this week', tone: 'up' }} />
        <StatCard label="Global Avg Latency" value="42ms" icon={Zap} delta={{ value: '-5ms optimization', tone: 'up' }} />
        <StatCard label="Cached Assets" value="99.8%" icon={Database} delta={{ value: 'Hit ratio all regions', tone: 'neutral' }} />
        <StatCard label="Localization Sync" value="Healthy" icon={RefreshCcw} delta={{ value: 'Last sync 2 mins ago', tone: 'neutral' }} />
      </div>

      <Card padding="none" className="flex-1 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-[var(--st-border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--st-text)]">Regional Server Mapping</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">Map physical server regions to logical timezones to optimize routing for localized users.</p>
          </div>
          <Button variant="secondary" iconLeft={Plus} onClick={() => toast.info('Add mapping form coming soon')}>
            Add Mapping
          </Button>
        </div>

        <div className="flex-1 overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Server Region (AWS/GCP)</Th>
                <Th>Assigned Timezone</Th>
                <Th>UTC Offset</Th>
                <Th>DST Active</Th>
                <Th>Latency</Th>
                <Th>Nodes</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {mappings.map(m => (
                <Tr key={m.id}>
                  <Td>
                    <span className="font-medium text-[var(--st-text)] flex items-center gap-2">
                      <Server size={16} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      {m.serverRegion}
                    </span>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Globe size={16} className="text-[var(--st-accent)]" aria-hidden="true" />
                      {m.localTimezone}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[var(--st-text-secondary)]">UTC {m.offset}</span>
                  </Td>
                  <Td>
                    {m.dst ? (
                      <Badge tone="warning" kind="soft"><Sun size={12} aria-hidden="true" /> Yes</Badge>
                    ) : (
                      <Badge tone="neutral" kind="soft"><Moon size={12} aria-hidden="true" /> No</Badge>
                    )}
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Dot tone={m.latency < 50 ? 'success' : m.latency < 100 ? 'warning' : 'danger'} aria-label="Latency status" />
                      {m.latency}ms
                    </span>
                  </Td>
                  <Td>{m.activeNodes}</Td>
                  <Td align="right">
                    <IconButton label={`Actions for ${m.serverRegion}`} icon={MoreVertical} variant="ghost" size="sm" />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
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
    <div className="ui20 dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] flex flex-col">

      {/* Header */}
      <header className="h-16 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between px-6 shrink-0 z-20 sticky top-0">
        <div className="flex items-center gap-4">
          <span className="w-8 h-8 rounded-[var(--st-radius)] bg-[var(--st-accent)] flex items-center justify-center">
            <Globe size={16} className="text-[var(--st-text-inverted)]" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-bold text-[var(--st-text)] leading-tight">Localization Hub</h1>
            <p className="text-xs text-[var(--st-text-tertiary)]">SabDesk Global Workspace Settings</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge tone="success" kind="soft" dot>
            <Activity size={14} aria-hidden="true" /> Sync Status: Up to date
          </Badge>
          <IconButton label="Messages" icon={MessageSquare} variant="ghost" />
          <IconButton label="Settings" icon={Settings} variant="ghost" />
          <Avatar name="Ada Diaz" size="md" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-[1600px] w-full mx-auto px-6 py-6 gap-6">

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'translations' | 'regional' | 'business' | 'cdn')}
          className="flex-1 flex flex-col overflow-hidden gap-6"
        >
          <TabsList className="shrink-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id}>
                  <span className="flex items-center gap-2">
                    <Icon size={16} aria-hidden="true" />
                    {tab.label}
                    {tab.id === 'translations' && (
                      <Badge tone="neutral" kind="soft">{translations.length}</Badge>
                    )}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Dynamic Tab Content Area */}
          <div className="flex-1 overflow-hidden relative">
            <TabsContent value="translations" className="h-full">
              <TranslationsTab translations={translations} setTranslations={setTranslations} />
            </TabsContent>
            <TabsContent value="regional" className="h-full">
              <RegionalSettingsTab />
            </TabsContent>
            <TabsContent value="business" className="h-full">
              <BusinessHoursTab />
            </TabsContent>
            <TabsContent value="cdn" className="h-full">
              <ContentDeliveryTab />
            </TabsContent>
          </div>
        </Tabs>

      </div>
    </div>
  );
}
