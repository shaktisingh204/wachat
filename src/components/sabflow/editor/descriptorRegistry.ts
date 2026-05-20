'use client';
/**
 * descriptorRegistry — dynamic registry sourced from the Rust `sabflow-nodes`
 * crate. Calls `/api/sabflow/nodes` once per app session and transforms each
 * `NodeDescriptor` into a `BlockRegistryEntry` so it can be rendered by the
 * existing `BlocksSideBar` / `CategorySection` UI.
 *
 * Categories surface a "(n8n)" suffix in the label so users can tell native
 * SabFlow blocks apart from the auto-imported n8n-parity nodes.
 */
import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  LuActivity,
  LuChartBar,
  LuBox,
  LuBrain,
  LuCalendar,
  LuSquareCheck,
  LuClipboardList,
  LuClock,
  LuCloud,
  LuCode,
  LuCreditCard,
  LuDatabase,
  LuFileCode,
  LuFileText,
  LuFolder,
  LuGitBranch,
  LuGitMerge,
  LuGithub,
  LuGlobe,
  LuHardDrive,
  LuHash,
  LuInbox,
  LuKey,
  LuLayers,
  LuLayoutGrid,
  LuChartLine,
  LuLink,
  LuLock,
  LuMail,
  LuMerge,
  LuMessageCircle,
  LuMessageSquare,
  LuPencil,
  LuPhone,
  LuPlay,
  LuPlug,
  LuReply,
  LuRocket,
  LuRss,
  LuSend,
  LuServer,
  LuShare2,
  LuShoppingBag,
  LuShoppingCart,
  LuSparkles,
  LuTable,
  LuTable2,
  LuTerminal,
  LuTrello,
  LuUsers,
  LuVideo,
  LuWebhook,
  LuCircleDashed,
  LuUnplug,
} from 'react-icons/lu';
import type { BlockCategory, BlockType } from '@/lib/sabflow/types';
import type { BlockRegistryEntry } from './blockRegistry';

/* ── Descriptor shape (camelCase from Rust serde) ─────────────────────────── */

export interface FetchedDescriptor {
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  isTrigger: boolean;
  inputs: number;
  outputs: number;
  outputNames: string[];
  stub: boolean;
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

/* ── Icon name → component map ────────────────────────────────────────────── */

const ICON_MAP: Record<string, IconComponent> = {
  send: LuSend as IconComponent,
  globe: LuGlobe as IconComponent,
  mail: LuMail as IconComponent,
  inbox: LuInbox as IconComponent,
  'message-square': LuMessageSquare as IconComponent,
  'message-circle': LuMessageCircle as IconComponent,
  hash: LuHash as IconComponent,
  rocket: LuRocket as IconComponent,
  phone: LuPhone as IconComponent,
  video: LuVideo as IconComponent,
  github: LuGithub as IconComponent,
  gitlab: LuGitBranch as IconComponent,
  book: LuFileText as IconComponent,
  table: LuTable as IconComponent,
  'table-2': LuTable2 as IconComponent,
  database: LuDatabase as IconComponent,
  users: LuUsers as IconComponent,
  cloud: LuCloud as IconComponent,
  sparkles: LuSparkles as IconComponent,
  'credit-card': LuCreditCard as IconComponent,
  trello: LuTrello as IconComponent,
  layers: LuLayers as IconComponent,
  'check-square': LuSquareCheck as IconComponent,
  'layout-grid': LuLayoutGrid as IconComponent,
  calendar: LuCalendar as IconComponent,
  'line-chart': LuChartLine as IconComponent,
  'bar-chart-3': LuChartBar as IconComponent,
  'file-code': LuFileCode as IconComponent,
  key: LuKey as IconComponent,
  lock: LuLock as IconComponent,
  clock: LuClock as IconComponent,
  rss: LuRss as IconComponent,
  'share-2': LuShare2 as IconComponent,
  terminal: LuTerminal as IconComponent,
  folder: LuFolder as IconComponent,
  box: LuBox as IconComponent,
  'hard-drive': LuHardDrive as IconComponent,
  server: LuServer as IconComponent,
  'clipboard-list': LuClipboardList as IconComponent,
  'git-branch': LuGitBranch as IconComponent,
  'git-merge': LuGitMerge as IconComponent,
  merge: LuMerge as IconComponent,
  webhook: LuWebhook as IconComponent,
  code: LuCode as IconComponent,
  pencil: LuPencil as IconComponent,
  'circle-dashed': LuCircleDashed as IconComponent,
  play: LuPlay as IconComponent,
  reply: LuReply as IconComponent,
  'shopping-bag': LuShoppingBag as IconComponent,
  'shopping-cart': LuShoppingCart as IconComponent,
  link: LuLink as IconComponent,
  brain: LuBrain as IconComponent,
  activity: LuActivity as IconComponent,
  plug: LuPlug as IconComponent,
};

const DEFAULT_ICON: IconComponent = LuUnplug as IconComponent;

export function iconForDescriptor(name: string): IconComponent {
  if (!name) return DEFAULT_ICON;
  return ICON_MAP[name] ?? DEFAULT_ICON;
}

/* ── Category mapping ─────────────────────────────────────────────────────── */

/** Rust NodeCategory → existing SabFlow BlockCategory (best-effort). */
function mapCategory(c: string): BlockCategory {
  switch (c) {
    case 'trigger':
      return 'events';
    case 'logic':
    case 'transform':
      return 'logic';
    case 'ai':
      return 'ai';
    default:
      return 'integrations';
  }
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

interface UseDescriptorCategoriesResult {
  loading: boolean;
  error: string | null;
  /** Categories ready to feed `CategorySection`. Empty until the fetch resolves. */
  categories: Array<{
    key: string;
    label: string;
    color: string;
    entries: BlockRegistryEntry[];
  }>;
  /** Flat list of every descriptor entry — useful for global search. */
  allEntries: BlockRegistryEntry[];
}

// Category metadata for the rust-side n8n nodes. Order = display order.
const RUST_CATEGORY_META: Record<string, { label: string; color: string; order: number }> = {
  communication: { label: 'Communication',  color: '#0ea5e9', order: 1 },
  productivity:  { label: 'Productivity',   color: '#a855f7', order: 2 },
  crm:           { label: 'CRM',            color: '#3b82f6', order: 3 },
  sales:         { label: 'Sales',          color: '#6366f1', order: 4 },
  marketing:     { label: 'Marketing',      color: '#ec4899', order: 5 },
  finance:       { label: 'Finance',        color: '#22c55e', order: 6 },
  storage:       { label: 'Storage',        color: '#0891b2', order: 7 },
  files:         { label: 'Files',          color: '#f59e0b', order: 8 },
  database:      { label: 'Databases',      color: '#336791', order: 9 },
  analytics:     { label: 'Analytics',      color: '#14b8a6', order: 10 },
  ai:            { label: 'AI',             color: '#f76808', order: 11 },
  developer:     { label: 'Developer',      color: '#737373', order: 12 },
  hr:            { label: 'HR',             color: '#10b981', order: 13 },
  action:        { label: 'Actions',        color: '#f97316', order: 14 },
  trigger:       { label: 'Triggers',       color: '#8b5cf6', order: 15 },
  logic:         { label: 'Logic',          color: '#fb923c', order: 16 },
  transform:     { label: 'Transform',      color: '#9333ea', order: 17 },
  misc:          { label: 'Miscellaneous',  color: '#94a3b8', order: 18 },
};

let _cache: FetchedDescriptor[] | null = null;
let _inflight: Promise<FetchedDescriptor[]> | null = null;

async function fetchDescriptors(): Promise<FetchedDescriptor[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = fetch('/api/sabflow/nodes')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j: { nodes?: FetchedDescriptor[] }) => {
      _cache = j.nodes ?? [];
      _inflight = null;
      return _cache;
    })
    .catch((e: Error) => {
      _inflight = null;
      throw e;
    });
  return _inflight;
}

export function useDescriptorCategories(): UseDescriptorCategoriesResult {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: FetchedDescriptor[] }>(() => ({
    loading: _cache === null,
    error: null,
    data: _cache ?? [],
  }));

  useEffect(() => {
    if (_cache !== null) return;
    let cancelled = false;
    fetchDescriptors()
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: null, data });
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ loading: false, error: e.message, data: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Skip native node names — those are already shown via blockRegistry. We
  // identify natives by checking the existing register elsewhere; here we just
  // include every descriptor and let de-dup happen at search level.
  const buckets = new Map<string, BlockRegistryEntry[]>();
  for (const d of state.data) {
    const blockCategory = mapCategory(d.category);
    const entry: BlockRegistryEntry = {
      type: d.name as BlockType,
      label: d.displayName,
      icon: iconForDescriptor(d.icon),
      category: blockCategory,
      description: d.stub ? `${d.description} (coming soon)` : d.description,
      color: d.color || '#94a3b8',
    };
    const arr = buckets.get(d.category) ?? [];
    arr.push(entry);
    buckets.set(d.category, arr);
  }

  const categories = Array.from(buckets.entries())
    .map(([key, entries]) => ({
      key: `n8n-${key}`,
      label: RUST_CATEGORY_META[key]?.label ?? key,
      color: RUST_CATEGORY_META[key]?.color ?? '#94a3b8',
      order: RUST_CATEGORY_META[key]?.order ?? 99,
      entries: entries.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, color, entries }) => ({ key, label, color, entries }));

  const allEntries = categories.flatMap((c) => c.entries);

  return { loading: state.loading, error: state.error, categories, allEntries };
}
