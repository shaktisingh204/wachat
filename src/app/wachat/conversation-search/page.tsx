'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMemo, useState, useTransition, useCallback, useEffect } from 'react';
import {
  Search,
  MessageCircle,
  Loader2,
  History,
  X,
  Filter,
  Calendar,
  Tag,
  User,
  Sparkles,
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

import { useZoruToast } from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { searchConversations } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/conversation-search - Full-text search across conversations.
 * Adds a facet rail (date / tag / agent / intent), a search-history
 * strip stored in localStorage, and result-count badges per facet.
 */

const HISTORY_KEY = 'wachat:search-history';
const DATE_FACETS = [
  { id: 'all', label: 'Any time' },
  { id: '24h', label: 'Past 24h', ms: 86_400_000 },
  { id: '7d', label: 'Past 7 days', ms: 7 * 86_400_000 },
  { id: '30d', label: 'Past 30 days', ms: 30 * 86_400_000 },
] as const;

type DateFacet = (typeof DATE_FACETS)[number]['id'];

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function highlight(text: string, q: string) {
  if (!q.trim() || !text) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="rounded bg-emerald-100/80 px-0.5 text-emerald-900">{match}</mark>
      {after}
    </>
  );
}

export default function ConversationSearchPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [dateFacet, setDateFacet] = useState<DateFacet>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeIntent, setActiveIntent] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const pushHistory = (q: string) => {
    if (!q.trim()) return;
    const next = [q, ...history.filter((h) => h !== q)].slice(0, 8);
    setHistory(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
    }
  };

  const handleSearch = useCallback(
    (q?: string) => {
      const term = (q ?? query).trim();
      if (!term || !projectId) return;
      if (q !== undefined) setQuery(q);
      setSearched(true);
      setActiveTag(null);
      setActiveAgent(null);
      setActiveIntent(null);
      pushHistory(term);
      startLoading(async () => {
        const res = await searchConversations(projectId, term);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
          setResults([]);
        } else {
          setResults(res.messages || []);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, projectId, toast, history],
  );

  const clearHistory = () => {
    setHistory([]);
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
    }
  };

  // Facets derived from results
  const facets = useMemo(() => {
    const tags = new Map<string, number>();
    const agents = new Map<string, number>();
    const intents = new Map<string, number>();
    for (const r of results) {
      const t: string[] = Array.isArray(r.tags) ? r.tags : Array.isArray(r.tagIds) ? r.tagIds : [];
      for (const tag of t) tags.set(String(tag), (tags.get(String(tag)) ?? 0) + 1);
      const a = r.agentName || r.assignedAgent || r.agent;
      if (a) agents.set(String(a), (agents.get(String(a)) ?? 0) + 1);
      const intent = r.intent || r.intentLabel;
      if (intent) intents.set(String(intent), (intents.get(String(intent)) ?? 0) + 1);
    }
    const sort = (m: Map<string, number>) =>
      Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      tags: sort(tags),
      agents: sort(agents),
      intents: sort(intents),
    };
  }, [results]);

  // Filter results client-side by selected facets + date range
  const filtered = useMemo(() => {
    const dateMs = DATE_FACETS.find((d) => d.id === dateFacet && 'ms' in d) as { ms: number } | undefined;
    const since = dateMs ? Date.now() - dateMs.ms : null;
    return results.filter((r) => {
      if (since !== null && r.timestamp) {
        const t = new Date(r.timestamp).getTime();
        if (!Number.isFinite(t) || t < since) return false;
      }
      if (activeTag) {
        const t: string[] = Array.isArray(r.tags) ? r.tags : Array.isArray(r.tagIds) ? r.tagIds : [];
        if (!t.map(String).includes(activeTag)) return false;
      }
      if (activeAgent) {
        const a = r.agentName || r.assignedAgent || r.agent;
        if (String(a || '') !== activeAgent) return false;
      }
      if (activeIntent) {
        const i = r.intent || r.intentLabel;
        if (String(i || '') !== activeIntent) return false;
      }
      return true;
    });
  }, [results, dateFacet, activeTag, activeAgent, activeIntent]);

  const hasFacets = facets.tags.length + facets.agents.length + facets.intents.length > 0;

  return (
    <WaPage>
      <PageHeader
        title="Conversation search"
        description="Search across every message in this project, then jump directly into the matching thread."
        kicker="Wachat · search"
        backHref="/wachat"
        eyebrowIcon={Search}
      />

      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className="mb-3 flex max-w-3xl items-center gap-2 rounded-full border border-zinc-200 bg-white p-1.5 transition-colors focus-within:border-zinc-400"
      >
        <span className="pl-3 text-zinc-400">
          <Search className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          placeholder="Search messages by content..."
          className="flex-1 bg-transparent text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          aria-label="Search conversations"
        />
        <WaButton
          size="sm"
          leftIcon={isLoading ? Loader2 : Search}
          onClick={() => handleSearch()}
          disabled={isLoading || !query.trim()}
        >
          Search
        </WaButton>
      </m.div>

      {/* Search history strip */}
      {history.length > 0 && (
        <div className="mb-3 flex max-w-3xl flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            <History className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Recent
          </span>
          {history.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => handleSearch(h)}
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-zinc-700 transition-colors duration-150 hover:border-zinc-900 active:scale-[0.97]"
            >
              {h}
            </button>
          ))}
          <button
            type="button"
            onClick={clearHistory}
            className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-900"
          >
            <X className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Clear
          </button>
        </div>
      )}

      {searched && !isLoading && (
        <p className="mb-3 text-[12.5px] tabular-nums text-zinc-500">
          {filtered.length.toLocaleString('en-IN')} of {results.length.toLocaleString('en-IN')} result
          {results.length !== 1 ? 's' : ''} shown
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        {/* Facet rail */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <h3 className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              <Calendar className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Date
            </h3>
            <div className="flex flex-col gap-1">
              {DATE_FACETS.map((d) => {
                const active = dateFacet === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDateFacet(d.id)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-left text-[12px] transition-colors duration-150 ${
                      active
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {facets.tags.length > 0 && (
            <FacetGroup
              icon={Tag}
              title="Tag"
              items={facets.tags}
              active={activeTag}
              onSelect={(v) => setActiveTag(activeTag === v ? null : v)}
            />
          )}
          {facets.agents.length > 0 && (
            <FacetGroup
              icon={User}
              title="Agent"
              items={facets.agents}
              active={activeAgent}
              onSelect={(v) => setActiveAgent(activeAgent === v ? null : v)}
            />
          )}
          {facets.intents.length > 0 && (
            <FacetGroup
              icon={Sparkles}
              title="Intent"
              items={facets.intents}
              active={activeIntent}
              onSelect={(v) => setActiveIntent(activeIntent === v ? null : v)}
            />
          )}
          {!hasFacets && searched && !isLoading && results.length > 0 && (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-3 text-center text-[11.5px] text-zinc-500">
              <Filter className="mx-auto mb-1 h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              No facet metadata on these results.
            </div>
          )}
        </aside>

        {/* Results */}
        <div className="min-w-0">
          {isLoading && (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
              <AnimatePresence initial={false}>
                {filtered.map((r: any, i) => (
                  <m.li
                    key={r._id || `${r.contactId}-${i}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.025, ease: EASE_OUT }}
                  >
                    <Link
                      href={`/wachat/chat?contactId=${r.contactId || ''}`}
                      className="group flex flex-col gap-1 px-4 py-3 transition-colors duration-150 hover:bg-zinc-50/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-zinc-900">
                          {r.contactName || r.contactId || r.from || 'Unknown'}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-zinc-400 tabular-nums">
                          {r.timestamp ? fmtDate(r.timestamp) : ''}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[12.5px] leading-snug text-zinc-600">
                        {highlight(String(r.content?.text || r.messageText || r.type || '-'), query)}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-zinc-500">
                        {(r.tags || r.tagIds || []).slice(0, 3).map((t: any, idx: number) => (
                          <span key={`t${idx}`} className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                            {String(t)}
                          </span>
                        ))}
                        {r.intent && (
                          <span
                            className="rounded-full px-1.5 py-0.5 font-semibold"
                            style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
                          >
                            {r.intent}
                          </span>
                        )}
                        {(r.agentName || r.agent) && (
                          <span className="ml-auto inline-flex items-center gap-1">
                            <User className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
                            {r.agentName || r.agent}
                          </span>
                        )}
                      </div>
                    </Link>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {!isLoading && !searched && (
            <EmptyState
              icon={Search}
              title="Start searching"
              description="Type a query above to find messages across every conversation in this project."
            />
          )}

          {!isLoading && searched && results.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title="No matches"
              description="No conversations contain that text. Try a different query or shorter keyword."
            />
          )}

          {!isLoading && searched && results.length > 0 && filtered.length === 0 && (
            <EmptyState
              icon={Filter}
              title="No results match facets"
              description="Clear a facet or pick a wider date range."
            />
          )}
        </div>
      </div>
    </WaPage>
  );
}

function FacetGroup({
  icon: Icon,
  title,
  items,
  active,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  title: string;
  items: [string, number][];
  active: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <h3 className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
        <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {title}
      </h3>
      <div className="flex flex-col gap-1">
        {items.map(([value, count]) => {
          const isActive = active === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-left text-[12px] transition-colors duration-150 ${
                isActive ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <span className="truncate">{value}</span>
              <span className={`tabular-nums ${isActive ? 'text-white/80' : 'text-zinc-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
