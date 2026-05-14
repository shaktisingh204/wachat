/**
 * Discussions shared helpers — filter types and KPI math.
 */

import type {
    WsDiscussion,
    WsDiscussionCategory,
    WsDiscussionReply,
} from '@/lib/worksuite/knowledge-types';

export type DiscussionsKpiKey = 'all' | 'active' | 'pending' | 'archived';

export interface DiscussionsFilterState {
    search: string;
    kpiKey: DiscussionsKpiKey;
    category: string;
    author: string;
    fromIso: string;
    toIso: string;
}

export const DISCUSSIONS_INITIAL_FILTERS: DiscussionsFilterState = {
    search: '',
    kpiKey: 'all',
    category: '',
    author: '',
    fromIso: '',
    toIso: '',
};

export interface DiscussionsKpiCounts {
    total: number;
    active: number;
    pending: number;
    categories: number;
    totalComments: number;
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

export function fmtDateTime(v: unknown): string {
    const d = toDate(v);
    return d ? d.toLocaleString() : '—';
}

export function computeDiscussionsKpis(
    discussions: readonly WsDiscussion[],
    categories: readonly WsDiscussionCategory[],
    repliesByDiscussion: Map<string, WsDiscussionReply[]>,
): DiscussionsKpiCounts {
    let totalComments = 0;
    let active = 0;
    let pending = 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const d of discussions) {
        const replies = repliesByDiscussion.get(String(d._id)) ?? [];
        totalComments += replies.length;
        if (replies.length > 0) active += 1;
        else pending += 1;
        const latest = replies
            .map((r) => toDate(r.createdAt)?.getTime() ?? 0)
            .reduce((a, b) => Math.max(a, b), 0);
        if (latest < sevenDaysAgo && replies.length === 0) pending += 0; // already counted
    }
    return {
        total: discussions.length,
        active,
        pending,
        categories: categories.length,
        totalComments,
    };
}

export function filterDiscussions<T extends WsDiscussion>(
    discussions: T[],
    f: DiscussionsFilterState,
    repliesByDiscussion: Map<string, WsDiscussionReply[]>,
): T[] {
    const q = f.search.trim().toLowerCase();
    const from = f.fromIso ? new Date(f.fromIso).getTime() : null;
    const to = f.toIso ? new Date(f.toIso).getTime() : null;
    return discussions.filter((d) => {
        if (q) {
            const hay = `${d.title ?? ''} ${d.description ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        if (f.category && d.category_id !== f.category) return false;
        const created = toDate(d.createdAt);
        if (created && from !== null && created.getTime() < from) return false;
        if (created && to !== null && created.getTime() > to) return false;
        const replies = repliesByDiscussion.get(String(d._id)) ?? [];
        if (f.kpiKey === 'active' && replies.length === 0) return false;
        if (f.kpiKey === 'pending' && replies.length > 0) return false;
        return true;
    });
}

export function lastActivity(
    d: WsDiscussion,
    repliesByDiscussion: Map<string, WsDiscussionReply[]>,
): Date | null {
    const replies = repliesByDiscussion.get(String(d._id)) ?? [];
    const latestReply = replies
        .map((r) => toDate(r.createdAt)?.getTime() ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
    const updated = toDate(d.updatedAt)?.getTime() ?? toDate(d.createdAt)?.getTime() ?? 0;
    const ms = Math.max(latestReply, updated);
    return ms ? new Date(ms) : null;
}
