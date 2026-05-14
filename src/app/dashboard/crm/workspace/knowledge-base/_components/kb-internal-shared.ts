/**
 * Internal KB shared helpers — filter state, KPI math, category grouping.
 *
 * The internal KB schema is simpler than the customer-facing tickets KB:
 * no `status`, `viewCount`, or `helpful*` fields. We adapt the §1D bar:
 *   - "Published" = items where pinned === true.
 *   - "Drafts" = items where pinned === false.
 *   - "Most viewed" / "Helpful %" land as TODO 1D.1 deferred chips.
 */

import type {
    WsKnowledgeBase,
    WsKnowledgeBaseCategory,
    WsKnowledgeBaseType,
} from '@/lib/worksuite/knowledge-types';

export type KbInternalKpiKey = 'all' | 'published' | 'drafts' | 'pinned' | 'todo';

export type KbInternalTypeFilter = 'all' | WsKnowledgeBaseType;

export interface KbInternalFilterState {
    search: string;
    kpiKey: KbInternalKpiKey;
    typeFilter: KbInternalTypeFilter;
    category: string;
    fromIso: string;
    toIso: string;
}

export const KB_INTERNAL_INITIAL_FILTERS: KbInternalFilterState = {
    search: '',
    kpiKey: 'all',
    typeFilter: 'all',
    category: '',
    fromIso: '',
    toIso: '',
};

export interface KbInternalKpiCounts {
    total: number;
    published: number;
    drafts: number;
    pinned: number;
    todo: number;
}

export function toDate(v: unknown): Date | null {
    if (!v) return null;
    const d = new Date(v as string);
    return Number.isFinite(d.getTime()) ? d : null;
}

export function fmtDate(v: unknown): string {
    const d = toDate(v);
    return d ? d.toLocaleDateString() : '—';
}

export function computeKbInternalKpis(
    articles: readonly WsKnowledgeBase[],
): KbInternalKpiCounts {
    let published = 0;
    let pinned = 0;
    let todo = 0;
    for (const a of articles) {
        if (a.pinned) {
            pinned += 1;
            published += 1;
        }
        if (a.to_do === 'yes') todo += 1;
    }
    return {
        total: articles.length,
        published,
        drafts: articles.length - published,
        pinned,
        todo,
    };
}

export function filterKbInternal<T extends WsKnowledgeBase>(
    articles: T[],
    f: KbInternalFilterState,
): T[] {
    const q = f.search.trim().toLowerCase();
    const from = f.fromIso ? new Date(f.fromIso).getTime() : null;
    const to = f.toIso ? new Date(f.toIso).getTime() : null;
    return articles.filter((a) => {
        if (q) {
            const hay = `${a.title ?? ''} ${a.description ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        if (f.typeFilter !== 'all' && a.type !== f.typeFilter) return false;
        if (f.category && a.category_id !== f.category) return false;
        const created = toDate(a.createdAt);
        if (created && from !== null && created.getTime() < from) return false;
        if (created && to !== null && created.getTime() > to) return false;
        switch (f.kpiKey) {
            case 'published':
                if (!a.pinned) return false;
                break;
            case 'drafts':
                if (a.pinned) return false;
                break;
            case 'pinned':
                if (!a.pinned) return false;
                break;
            case 'todo':
                if (a.to_do !== 'yes') return false;
                break;
            default:
                break;
        }
        return true;
    });
}

export function groupArticlesByCategory(
    articles: WsKnowledgeBase[],
    categories: WsKnowledgeBaseCategory[],
): { id: string; name: string; articles: WsKnowledgeBase[] }[] {
    const map = new Map<string, WsKnowledgeBase[]>();
    for (const a of articles) {
        const key = a.category_id ?? '__uncat__';
        const list = map.get(key) ?? [];
        list.push(a);
        map.set(key, list);
    }
    const out: { id: string; name: string; articles: WsKnowledgeBase[] }[] = [];
    for (const c of categories) {
        out.push({ id: String(c._id), name: c.name, articles: map.get(String(c._id)) ?? [] });
    }
    if (map.has('__uncat__')) {
        out.push({ id: '__uncat__', name: 'Uncategorized', articles: map.get('__uncat__') ?? [] });
    }
    return out;
}
