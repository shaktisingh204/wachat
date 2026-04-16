'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  LuGlobe,
  LuShield,
  LuCopy,
  LuCheck,
  LuClock,
  LuX,
  LuTrash2,
  LuLoader,
  LuTriangleAlert,
  LuChevronDown,
  LuChevronUp,
  LuInfo,
  LuRefreshCw,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type {
  CustomDomain,
  DomainStatus,
  SslStatus,
} from '@/lib/sabflow/domains/types';

/* ── Constants ───────────────────────────────────────────── */

const ACCENT = '#f76808';
/** Host users must point their CNAME to. Override via NEXT_PUBLIC_* at build. */
const CNAME_TARGET =
  process.env.NEXT_PUBLIC_SABFLOW_CNAME_TARGET ?? 'flow.sabnode.com';

/* ── Props ───────────────────────────────────────────────── */

export interface DomainsPanelProps {
  /** Optional: scope new domains to a specific flow. */
  flowId?: string;
  /** Optional friendly name shown in the header. */
  flowName?: string;
}

/* ── API helpers (client) ────────────────────────────────── */

interface ApiDomain extends Omit<CustomDomain, 'createdAt' | 'lastCheckedAt'> {
  createdAt: string;
  lastCheckedAt?: string;
}

function hydrate(d: ApiDomain): CustomDomain {
  return {
    ...d,
    createdAt: new Date(d.createdAt),
    lastCheckedAt: d.lastCheckedAt ? new Date(d.lastCheckedAt) : undefined,
  };
}

async function apiList(): Promise<CustomDomain[]> {
  const res = await fetch('/api/sabflow/domains', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load domains');
  const json = (await res.json()) as { domains: ApiDomain[] };
  return json.domains.map(hydrate);
}

async function apiCreate(domain: string, flowId?: string): Promise<CustomDomain> {
  const res = await fetch('/api/sabflow/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, flowId }),
  });
  const json = (await res.json()) as { domain?: ApiDomain; error?: string };
  if (!res.ok || !json.domain) {
    throw new Error(json.error ?? 'Failed to add domain');
  }
  return hydrate(json.domain);
}

async function apiVerify(
  id: string,
): Promise<{ verified: boolean; reason?: string; domain: CustomDomain }> {
  const res = await fetch(`/api/sabflow/domains/${id}/verify`, {
    method: 'POST',
  });
  const json = (await res.json()) as {
    verified?: boolean;
    reason?: string;
    domain?: ApiDomain;
    error?: string;
  };
  if (!res.ok || !json.domain) {
    throw new Error(json.error ?? 'Verification failed');
  }
  return {
    verified: !!json.verified,
    reason: json.reason,
    domain: hydrate(json.domain),
  };
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/sabflow/domains/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Failed to delete domain');
  }
}

/* ── Copy button ─────────────────────────────────────────── */

function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed silently
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors shrink-0',
        copied
          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
          : 'bg-[var(--gray-3)] text-[var(--gray-11)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]',
        className,
      )}
    >
      {copied ? (
        <LuCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <LuCopy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {copied ? 'Copied!' : label}
    </button>
  );
}

/* ── Status pill ─────────────────────────────────────────── */

function StatusPill({ status }: { status: DomainStatus }) {
  const { Icon, label, cls } = useMemo(() => {
    if (status === 'verified') {
      return {
        Icon: LuCheck,
        label: 'Verified',
        cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
      };
    }
    if (status === 'failed') {
      return {
        Icon: LuX,
        label: 'Failed',
        cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
      };
    }
    return {
      Icon: LuClock,
      label: 'Pending',
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    };
  }, [status]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        cls,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {label}
    </span>
  );
}

function SslPill({ status }: { status: SslStatus }) {
  const { label, cls } = useMemo(() => {
    if (status === 'issued') {
      return {
        label: 'SSL issued',
        cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
      };
    }
    if (status === 'failed') {
      return {
        label: 'SSL failed',
        cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
      };
    }
    return {
      label: 'SSL pending',
      cls: 'bg-[var(--gray-3)] text-[var(--gray-10)]',
    };
  }, [status]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        cls,
      )}
    >
      <LuShield className="h-3 w-3" strokeWidth={2} />
      {label}
    </span>
  );
}

/* ── DNS record row ──────────────────────────────────────── */

function DnsRecordRow({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
          {label}
        </span>
      </div>
      <dl className="space-y-2 text-[12px]">
        <div className="flex items-center gap-2">
          <dt className="w-16 shrink-0 text-[var(--gray-9)]">Name</dt>
          <dd className="flex-1 truncate font-mono text-[var(--gray-12)]">
            {name}
          </dd>
          <CopyButton text={name} />
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-16 shrink-0 text-[var(--gray-9)]">Value</dt>
          <dd className="flex-1 truncate font-mono text-[var(--gray-12)]">
            {value}
          </dd>
          <CopyButton text={value} />
        </div>
      </dl>
    </div>
  );
}

/* ── Domain row ──────────────────────────────────────────── */

function DomainRow({
  domain,
  onVerified,
  onDeleted,
}: {
  domain: CustomDomain;
  onVerified: (updated: CustomDomain) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(domain.status !== 'verified');
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setMessage(null);
    try {
      const res = await apiVerify(domain.id);
      onVerified(res.domain);
      setMessage({
        kind: res.verified ? 'success' : 'error',
        text: res.verified
          ? 'Domain verified successfully.'
          : res.reason ?? 'Verification failed.',
      });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Verification failed',
      });
    } finally {
      setVerifying(false);
    }
  }, [domain.id, onVerified]);

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        `Delete custom domain "${domain.domain}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setMessage(null);
    try {
      await apiDelete(domain.id);
      onDeleted(domain.id);
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Delete failed',
      });
      setDeleting(false);
    }
  }, [domain.domain, domain.id, onDeleted]);

  return (
    <li className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <LuGlobe
          className="h-4 w-4 shrink-0 text-[var(--gray-9)]"
          strokeWidth={1.8}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-[var(--gray-12)]">
              {domain.domain}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusPill status={domain.status} />
            <SslPill status={domain.sslStatus} />
            {domain.flowId ? (
              <span className="rounded-full bg-[var(--gray-3)] px-2 py-0.5 text-[11px] font-medium text-[var(--gray-10)]">
                Flow-scoped
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || deleting}
            title="Verify now"
            aria-label="Verify now"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--gray-3)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] transition-colors hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)] disabled:opacity-60"
          >
            {verifying ? (
              <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Verify now
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={verifying || deleting}
            title="Delete domain"
            aria-label="Delete domain"
            className="flex items-center justify-center rounded-lg p-1.5 text-[var(--gray-9)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            {deleting ? (
              <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <LuTrash2 className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Hide DNS records' : 'Show DNS records'}
            aria-label={expanded ? 'Hide DNS records' : 'Show DNS records'}
            aria-expanded={expanded}
            className="flex items-center justify-center rounded-lg p-1.5 text-[var(--gray-9)] transition-colors hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
          >
            {expanded ? (
              <LuChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <LuChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {/* Expanded: DNS instructions */}
      {expanded && (
        <div className="border-t border-[var(--gray-4)] bg-[var(--gray-2)] px-4 py-4 space-y-3">
          <p className="text-[12.5px] text-[var(--gray-10)] leading-relaxed">
            Add the following DNS records at your registrar.  Both are required
            — the <span className="font-semibold">TXT</span> record proves
            ownership, and the <span className="font-semibold">CNAME</span>{' '}
            record routes live traffic to SabFlow.
          </p>

          <DnsRecordRow
            label="TXT record (verification)"
            name={`_sabflow.${domain.domain}`}
            value={domain.verificationToken}
          />
          <DnsRecordRow
            label="CNAME record (routing)"
            name={domain.domain}
            value={CNAME_TARGET}
          />

          {message && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]',
                message.kind === 'error'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                  : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
              )}
            >
              {message.kind === 'error' ? (
                <LuTriangleAlert
                  className="h-3.5 w-3.5 shrink-0 mt-0.5"
                  strokeWidth={2}
                />
              ) : (
                <LuCheck
                  className="h-3.5 w-3.5 shrink-0 mt-0.5"
                  strokeWidth={2.5}
                />
              )}
              <span className="leading-relaxed">{message.text}</span>
            </div>
          )}

          {domain.lastCheckedAt && (
            <p className="text-[11px] text-[var(--gray-8)]">
              Last checked {domain.lastCheckedAt.toLocaleString()}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/* ── Add-domain form ─────────────────────────────────────── */

function AddDomainForm({
  flowId,
  onCreated,
}: {
  flowId?: string;
  onCreated: (d: CustomDomain) => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!value.trim() || loading) return;
      setLoading(true);
      setError(null);
      try {
        const created = await apiCreate(value.trim(), flowId);
        onCreated(created);
        setValue('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add domain');
      } finally {
        setLoading(false);
      }
    },
    [value, loading, flowId, onCreated],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] px-4 py-3"
    >
      <label
        htmlFor={inputId}
        className="mb-2 block text-[11.5px] font-medium text-[var(--gray-10)]"
      >
        Add a custom domain
      </label>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="chat.mysite.com"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] outline-none transition-colors focus:border-[var(--gray-8)] focus:ring-1 focus:ring-[var(--gray-6)]"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          style={{ backgroundColor: ACCENT }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? (
            <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : null}
          Add domain
        </button>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-red-600 dark:text-red-400">
          <LuTriangleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}
    </form>
  );
}

/* ── Main panel ──────────────────────────────────────────── */

export function DomainsPanel({ flowId, flowName }: DomainsPanelProps) {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiList()
      .then((list) => {
        if (!cancelled) setDomains(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scoped = useMemo(
    () => (flowId ? domains.filter((d) => !d.flowId || d.flowId === flowId) : domains),
    [domains, flowId],
  );

  const handleCreated = useCallback((d: CustomDomain) => {
    setDomains((prev) => [d, ...prev]);
  }, []);

  const handleVerified = useCallback((updated: CustomDomain) => {
    setDomains((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setDomains((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      {/* Page heading */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
          style={{ backgroundColor: `${ACCENT}18` }}
        >
          <LuGlobe
            className="h-5 w-5"
            strokeWidth={1.8}
            style={{ color: ACCENT }}
          />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-[var(--gray-12)]">
            Custom domains
          </h1>
          <p className="text-[12.5px] text-[var(--gray-10)]">
            {flowName ?? 'Serve your flows from your own domain'}
          </p>
        </div>
      </div>

      {/* Info callout */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] px-3.5 py-3">
        <LuInfo
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gray-9)]"
          strokeWidth={1.8}
        />
        <div className="space-y-1 text-[12.5px] text-[var(--gray-10)] leading-relaxed">
          <p>
            Point your own domain (e.g.{' '}
            <span className="font-mono text-[var(--gray-12)]">
              chat.mysite.com
            </span>
            ) at SabFlow to serve this flow under your brand.
          </p>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            DNS changes can take up to <strong>48 hours</strong> to propagate.
            If verification fails on the first try, wait a few minutes and try
            again.
          </p>
        </div>
      </div>

      {/* Add form */}
      <AddDomainForm flowId={flowId} onCreated={handleCreated} />

      {/* Domain list */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] px-4 py-10 text-[12.5px] text-[var(--gray-9)]">
          <LuLoader className="mr-2 h-4 w-4 animate-spin" strokeWidth={2} />
          Loading domains…
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-[12.5px] text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <LuTriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={2}
          />
          <span>{loadError}</span>
        </div>
      ) : scoped.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] px-4 py-10">
          <LuGlobe
            className="h-7 w-7 text-[var(--gray-7)]"
            strokeWidth={1.4}
          />
          <p className="text-[12.5px] font-medium text-[var(--gray-11)]">
            No custom domains yet
          </p>
          <p className="text-[11.5px] text-[var(--gray-9)] text-center max-w-xs">
            Add a domain above to serve your flow under your own brand.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {scoped.map((d) => (
            <DomainRow
              key={d.id}
              domain={d}
              onVerified={handleVerified}
              onDeleted={handleDeleted}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default DomainsPanel;
