'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* ── Types ────────────────────────────────────────────────── */

export type NodeAnalytics = {
  groupId: string;
  blockId?: string;
  totalVisits: number;
  dropOffCount: number;
  /** 0–1 */
  dropOffRate: number;
  completionCount: number;
  averageTimeMs?: number;
};

export type AnalyticsDateRange = {
  start: Date;
  end: Date;
};

type AnalyticsStatus = 'idle' | 'loading' | 'success' | 'error';

export type AnalyticsContextValue = {
  /** Keyed by `${groupId}-${blockId ?? ''}` (group-level entries use trailing dash). */
  data: Map<string, NodeAnalytics>;
  isEnabled: boolean;
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;
  refresh: () => Promise<void>;
  dateRange: AnalyticsDateRange;
  setDateRange: (range: AnalyticsDateRange) => void;
  status: AnalyticsStatus;
  error: string | null;
  /** Aggregate totals for the current fetch — surfaced to the toolbar popover. */
  totals: {
    totalSessions: number;
    completionRate: number;
    averageCompletionTime: number | null;
  } | null;
  /** Traversal counts per edge id, used by HeatmapOverlay. */
  edgeTraversals: Map<string, number>;
};

/* ── Helpers ──────────────────────────────────────────────── */

export const makeAnalyticsKey = (groupId: string, blockId?: string): string =>
  `${groupId}-${blockId ?? ''}`;

const noop = () => {};
const noopAsync = async () => {};

const defaultRange = (): AnalyticsDateRange => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

const rangeKey = (range: AnalyticsDateRange): string =>
  `${range.start.toISOString()}__${range.end.toISOString()}`;

/* ── API response shape (mirrors analytics route) ─────────── */

type DropOffByBlock = {
  blockId: string;
  blockLabel: string;
  dropOffCount: number;
};

type AnalyticsResponse = {
  totalSessions: number;
  completionRate: number;
  averageCompletionTime: number | null;
  dropOffByBlock: DropOffByBlock[];
  submissionsOverTime: { date: string; count: number }[];
  /** Optional — populated when the route exposes per-node metrics in the future. */
  nodeAnalytics?: NodeAnalytics[];
  /** Optional — edge traversal counts keyed by edge id. */
  edgeTraversals?: Record<string, number>;
};

type CacheEntry = {
  data: Map<string, NodeAnalytics>;
  edgeTraversals: Map<string, number>;
  totals: AnalyticsContextValue['totals'];
  fetchedAt: number;
};

/* ── Context ──────────────────────────────────────────────── */

const AnalyticsContext = createContext<AnalyticsContextValue>({
  data: new Map(),
  isEnabled: false,
  toggleEnabled: noop,
  setEnabled: noop,
  refresh: noopAsync,
  dateRange: defaultRange(),
  setDateRange: noop,
  status: 'idle',
  error: null,
  totals: null,
  edgeTraversals: new Map(),
});

/* ── Provider ─────────────────────────────────────────────── */

type Props = {
  flowId: string | undefined;
  children: ReactNode;
};

export function AnalyticsProvider({ flowId, children }: Props) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [dateRange, setDateRangeState] = useState<AnalyticsDateRange>(defaultRange);
  const [status, setStatus] = useState<AnalyticsStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<Map<string, NodeAnalytics>>(new Map());
  const [edgeTraversals, setEdgeTraversals] = useState<Map<string, number>>(new Map());
  const [totals, setTotals] = useState<AnalyticsContextValue['totals']>(null);

  // Cache keyed by ISO range — avoids re-fetching when users toggle back.
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  // Track the most recent in-flight request so late responses can't overwrite newer ones.
  const latestRequestIdRef = useRef(0);

  const applyCache = useCallback((entry: CacheEntry) => {
    setData(entry.data);
    setEdgeTraversals(entry.edgeTraversals);
    setTotals(entry.totals);
    setStatus('success');
    setError(null);
  }, []);

  const fetchAnalytics = useCallback(
    async (range: AnalyticsDateRange): Promise<void> => {
      if (!flowId) return;

      const key = rangeKey(range);
      const cached = cacheRef.current.get(key);
      if (cached) {
        applyCache(cached);
        return;
      }

      const requestId = ++latestRequestIdRef.current;
      setStatus('loading');
      setError(null);

      try {
        const params = new URLSearchParams({
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        });
        const res = await fetch(
          `/api/sabflow/${flowId}/analytics?${params.toString()}`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          const msg = `Analytics request failed (${res.status})`;
          throw new Error(msg);
        }

        const json = (await res.json()) as AnalyticsResponse;

        // Ignore stale responses.
        if (requestId !== latestRequestIdRef.current) return;

        const nextData = new Map<string, NodeAnalytics>();

        // Prefer explicit per-node analytics when the route returns them.
        if (Array.isArray(json.nodeAnalytics)) {
          for (const node of json.nodeAnalytics) {
            nextData.set(makeAnalyticsKey(node.groupId, node.blockId), node);
          }
        } else {
          // Fallback: synthesise per-group drop-off counts from dropOffByBlock.
          // The current route treats `blockId` as the groupId (see route.ts).
          const total = json.totalSessions || 0;
          for (const row of json.dropOffByBlock ?? []) {
            if (!row.blockId || row.blockId === 'unknown') continue;
            const dropOffCount = row.dropOffCount;
            const dropOffRate = total > 0 ? dropOffCount / total : 0;
            const totalVisits = total;
            const completionCount = Math.max(0, totalVisits - dropOffCount);
            const entry: NodeAnalytics = {
              groupId: row.blockId,
              totalVisits,
              dropOffCount,
              dropOffRate,
              completionCount,
            };
            nextData.set(makeAnalyticsKey(entry.groupId), entry);
          }
        }

        const nextEdgeTraversals = new Map<string, number>();
        if (json.edgeTraversals) {
          for (const [edgeId, count] of Object.entries(json.edgeTraversals)) {
            nextEdgeTraversals.set(edgeId, count);
          }
        }

        const nextTotals: AnalyticsContextValue['totals'] = {
          totalSessions: json.totalSessions,
          completionRate: json.completionRate,
          averageCompletionTime: json.averageCompletionTime,
        };

        const entry: CacheEntry = {
          data: nextData,
          edgeTraversals: nextEdgeTraversals,
          totals: nextTotals,
          fetchedAt: Date.now(),
        };
        cacheRef.current.set(key, entry);
        applyCache(entry);
      } catch (err: unknown) {
        if (requestId !== latestRequestIdRef.current) return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setStatus('error');
        setError(msg);
      }
    },
    [flowId, applyCache],
  );

  // Fetch whenever analytics is enabled or the date range changes.
  useEffect(() => {
    if (!isEnabled || !flowId) return;
    void fetchAnalytics(dateRange);
  }, [isEnabled, flowId, dateRange, fetchAnalytics]);

  // Reset UI state when analytics is disabled so badges unmount cleanly.
  useEffect(() => {
    if (isEnabled) return;
    setStatus('idle');
    setError(null);
  }, [isEnabled]);

  const setDateRange = useCallback((range: AnalyticsDateRange) => {
    setDateRangeState(range);
  }, []);

  const toggleEnabled = useCallback(() => setIsEnabled((v) => !v), []);
  const setEnabled = useCallback((next: boolean) => setIsEnabled(next), []);

  const refresh = useCallback(async () => {
    // Invalidate current cache slot and refetch.
    const key = rangeKey(dateRange);
    cacheRef.current.delete(key);
    await fetchAnalytics(dateRange);
  }, [dateRange, fetchAnalytics]);

  const value = useMemo<AnalyticsContextValue>(
    () => ({
      data,
      isEnabled,
      toggleEnabled,
      setEnabled,
      refresh,
      dateRange,
      setDateRange,
      status,
      error,
      totals,
      edgeTraversals,
    }),
    [
      data,
      isEnabled,
      toggleEnabled,
      setEnabled,
      refresh,
      dateRange,
      setDateRange,
      status,
      error,
      totals,
      edgeTraversals,
    ],
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

/* ── Hook ─────────────────────────────────────────────────── */

export const useAnalytics = (): AnalyticsContextValue => useContext(AnalyticsContext);
