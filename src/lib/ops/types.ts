/**
 * Reliability & Observability — shared type definitions.
 *
 * These types are intentionally framework-agnostic. They're consumed by:
 *   - the SLO calculator (`./slo`),
 *   - the synthetic check runner (`./synthetics`),
 *   - the RUM ingestion pipeline (`./rum`),
 *   - the public status page (`./status-page`),
 *   - and the incident / postmortem lifecycle (`./incident`, `./postmortem`).
 *
 * Nothing here imports runtime modules so the file can be safely consumed by
 * edge runtimes, workers, and API routes alike.
 */

/** Time window over which an SLO is evaluated. */
export type SloWindow = '1h' | '6h' | '24h' | '7d' | '28d' | '30d' | '90d';

/** A single Service Level Indicator (SLI) sample. */
export interface SliSample {
    /** Unix epoch milliseconds. */
    timestamp: number;
    /**
     * 1 = "good event", 0 = "bad event". Fractional values are allowed for
     * latency-style indicators where an event can be partially good (e.g.
     * 0.5 if duration was within an extended threshold).
     */
    good: number;
    /** Total weight of this sample. Defaults to 1 when omitted. */
    total?: number;
}

/** Indicator definition (availability, latency, freshness, ...) attached to an SLO. */
export interface SloIndicator {
    id: string;
    /** Human-readable label, e.g. "HTTP 2xx ratio". */
    name: string;
    type: 'availability' | 'latency' | 'freshness' | 'correctness' | 'custom';
    /** PromQL/MQL/whatever — opaque to the calculator. */
    query?: string;
    /** Optional threshold the calculator uses for "good event" decisions. */
    threshold?: number;
}

/** A complete Service Level Objective. */
export interface Slo {
    id: string;
    name?: string;
    /** Target as a fraction in [0, 1]. 0.999 = three nines. */
    target: number;
    window: SloWindow;
    indicators: SloIndicator[];
    description?: string;
    owner?: string;
}

/** Computed error-budget snapshot for an SLO. */
export interface ErrorBudget {
    sloId: string;
    window: SloWindow;
    /** Total budget (1 - target). */
    total: number;
    /** Remaining budget as a fraction in [0, 1]. */
    remaining: number;
    /** Burn rate as a multiple of "expected" burn (1.0 = on track). */
    burnRate: number;
    /** Timestamp of the snapshot in epoch millis. */
    computedAt: number;
}

/** Burn-rate alert tier. */
export type BurnRateAlert = 'fast' | 'slow' | 'ok';

/** Lifecycle states for an incident. */
export type IncidentStatus = 'open' | 'acknowledged' | 'mitigated' | 'resolved';

/** Severity classification. */
export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';

/** Single timeline entry attached to an incident. */
export interface IncidentEvent {
    timestamp: number;
    actor?: string;
    kind: 'note' | 'status_change' | 'comms' | 'action' | 'detection';
    message: string;
    metadata?: Record<string, unknown>;
}

/** A user-facing incident. */
export interface Incident {
    id: string;
    title: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    startedAt: number;
    acknowledgedAt?: number;
    mitigatedAt?: number;
    resolvedAt?: number;
    affectedComponents: string[];
    commander?: string;
    warRoomUrl?: string;
    timeline: IncidentEvent[];
    summary?: string;
}

/** Result of a 5-whys / contributing-factor analysis. */
export interface Postmortem {
    id: string;
    incidentId: string;
    createdAt: number;
    author?: string;
    summary: string;
    impact: string;
    rootCause: string;
    fiveWhys: string[];
    contributingFactors: string[];
    actionItems: PostmortemAction[];
    timeline: IncidentEvent[];
    lessonsLearned?: string;
}

/** A trackable follow-up item from a postmortem. */
export interface PostmortemAction {
    id: string;
    description: string;
    owner?: string;
    dueAt?: number;
    /** Tracking link (Jira, Linear, GitHub issue, ...). */
    link?: string;
    status: 'open' | 'in_progress' | 'done' | 'cancelled';
}

/** A configured synthetic check. */
export interface SyntheticCheck {
    id: string;
    name: string;
    type: 'http' | 'dns' | 'tcp' | 'browser';
    /** HTTP URL, DNS name, or `host:port` for TCP. */
    target: string;
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Frequency hint in seconds — informational only. */
    intervalSeconds?: number;
    /** Browser-flow steps when type === 'browser'. */
    flow?: BrowserStep[];
    /** Optional HTTP options. */
    http?: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
        headers?: Record<string, string>;
        body?: string;
        expectedStatus?: number | number[];
        expectedBody?: string | RegExp;
    };
    /** Optional DNS options. */
    dns?: {
        recordType?: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT';
        expectedAnswer?: string;
    };
    /** Region hint where the probe should run. */
    region?: string;
}

/** A single step in a browser-flow check (puppeteer-style). */
export interface BrowserStep {
    action: 'goto' | 'click' | 'type' | 'waitFor' | 'assertText';
    selector?: string;
    value?: string;
    url?: string;
    timeoutMs?: number;
}

/** Outcome of running a synthetic check. */
export interface SyntheticResult {
    checkId: string;
    runAt: number;
    success: boolean;
    durationMs: number;
    error?: string;
    /** Type-specific diagnostic blob. */
    details?: Record<string, unknown>;
}

/** Chaos experiment configuration. */
export interface ChaosExperiment {
    id: string;
    name: string;
    type: 'latency' | 'drop' | 'corrupt' | 'cpu' | 'memory';
    /** Target identifier — service name, queue, route, etc. */
    target: string;
    /** Duration in seconds. */
    durationSec: number;
    /** Type-specific parameters. */
    params?: Record<string, unknown>;
    /** Enabled flag — kill switch. */
    enabled: boolean;
}

/** A real-user-monitoring event. */
export interface RumEvent {
    /** Page navigation / event identifier. */
    id: string;
    sessionId: string;
    timestamp: number;
    /** Page URL where the event was observed. */
    url: string;
    /** Metric name — e.g. "LCP", "FID", "CLS", "TTFB", "INP". */
    metric: string;
    /** Numeric value. Lower is usually better. */
    value: number;
    /** Optional dimensions (route, country, device, ...). */
    dims?: Record<string, string>;
    userId?: string;
}

/** A probe definition — minimal contract used by health-checks. */
export interface Probe {
    name: string;
    /**
     * Returns `true` (or resolves) if the dependency is healthy.
     * Throwing or returning `false` marks it unhealthy.
     */
    check: () => Promise<boolean | void> | boolean | void;
    /** Optional timeout in ms. Defaults to 2000. */
    timeoutMs?: number;
    /** When false the probe is informational and does not affect readiness. */
    critical?: boolean;
}

/** A status-page component. */
export interface StatusComponent {
    id: string;
    name: string;
    description?: string;
    status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
    /** Component group (e.g. "API", "Workers", "Webhooks"). */
    group?: string;
    updatedAt: number;
}

/** Result of a single probe execution. */
export interface ProbeResult {
    name: string;
    healthy: boolean;
    durationMs: number;
    error?: string;
    critical: boolean;
}

/** Combined health response. */
export interface HealthSnapshot {
    healthy: boolean;
    checkedAt: number;
    probes: ProbeResult[];
}
