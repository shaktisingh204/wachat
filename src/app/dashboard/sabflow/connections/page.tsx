'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  LuPlus,
  LuTrash2,
  LuCable,
  LuKey,
  LuLoader,
  LuEye,
  LuEyeOff,
  LuSearch,
  LuCloud,
  LuArrowLeft,
  LuArrowRight,
  LuCheck,
  LuX,
  LuShield,
  LuExternalLink,
  LuSparkles,
  LuLock,
} from 'react-icons/lu';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import {
  CREDENTIAL_TYPE_LABEL,
  CREDENTIAL_FIELD_SCHEMAS,
  CREDENTIAL_TYPES,
  CREDENTIAL_CATEGORIES,
  CREDENTIAL_CATEGORY_LABEL,
  CREDENTIAL_TYPE_CATEGORY,
  type CredentialCategory,
  type CredentialField,
  type CredentialType,
  type MaskedCredential,
} from '@/lib/sabflow/credentials/types';
import {
  OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE,
  OAUTH_PROVIDER_LABEL,
  OAUTH_PROVIDER_ACCENT,
  OAUTH_PROVIDER_REQUIRES_SUBDOMAIN,
  OAUTH_PROVIDER_SUBDOMAIN_HINT,
  OAUTH_PROVIDER_SUBDOMAIN_SUFFIX,
} from '@/lib/sabflow/oauth/credential-type-map';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'pick' | 'authenticate' | 'status';
type OAuthPhase = 'idle' | 'opening' | 'waiting' | 'exchanging' | 'success' | 'error';

interface FormState {
  type: CredentialType | '';
  name: string;
  data: Record<string, string>;
}

const STEP_ORDER: Step[] = ['pick', 'authenticate', 'status'];
const STEP_LABEL: Record<Step, string> = {
  pick: 'Pick app',
  authenticate: 'Authenticate',
  status: 'Confirm',
};

function formatDate(d: string | Date | null | undefined, locale: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Category Chip ────────────────────────────────────────────────────────────

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-zoru-primary text-zoru-primary-foreground border-zoru-primary'
          : 'bg-zoru-bg text-zoru-ink border-zoru-line hover:bg-zoru-surface-2 hover:border-zoru-line-strong',
      )}
    >
      {children}
    </button>
  );
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const idx = STEP_ORDER.indexOf(current);
  const pct = ((idx + 1) / STEP_ORDER.length) * 100;
  return (
    <div className="px-1 pt-1">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-zoru-ink-subtle mb-1.5">
        <span>
          Step {idx + 1} of {STEP_ORDER.length} · {STEP_LABEL[current]}
        </span>
        <span className="flex items-center gap-1 text-zoru-ink-muted normal-case tracking-normal">
          <LuLock className="w-3 h-3" /> Tokens encrypted at rest
        </span>
      </div>
      <div className="h-1 rounded-full bg-zoru-surface-2 overflow-hidden">
        <m.div
          className="h-full bg-gradient-to-r from-zoru-primary to-emerald-500"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        />
      </div>
    </div>
  );
}

// ── Animated step wrapper ────────────────────────────────────────────────────

function StepShell({
  stepKey,
  direction,
  reduced,
  children,
}: {
  stepKey: string;
  direction: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const variants = reduced
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (dir: number) => ({ x: dir > 0 ? 32 : -32, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir > 0 ? -32 : 32, opacity: 0 }),
      };
  return (
    <m.div
      key={stepKey}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="space-y-4"
    >
      {children}
    </m.div>
  );
}

// ── Provider tile ────────────────────────────────────────────────────────────

function ProviderTile({
  type,
  onSelect,
  reduced,
  index,
}: {
  type: CredentialType;
  onSelect: (t: CredentialType) => void;
  reduced: boolean;
  index: number;
}) {
  const providerId = OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE[type];
  const hasOAuth = Boolean(providerId);
  return (
    <m.button
      onClick={() => onSelect(type)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reduced ? 0 : Math.min(index * 0.012, 0.18),
        type: 'spring',
        stiffness: 320,
        damping: 26,
      }}
      whileHover={reduced ? undefined : { y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2.5 rounded-[var(--zoru-radius)] border bg-zoru-bg text-left',
        'border-zoru-line hover:border-zoru-line-strong hover:bg-zoru-surface-2 transition-colors',
      )}
    >
      <span
        className={cn(
          'w-7 h-7 shrink-0 rounded-md flex items-center justify-center border border-zoru-line',
          hasOAuth ? 'bg-gradient-to-br' : 'bg-zoru-surface-2',
          hasOAuth && OAUTH_PROVIDER_ACCENT[providerId!],
        )}
      >
        {hasOAuth ? (
          <LuSparkles className="w-3.5 h-3.5 text-zoru-ink-muted" />
        ) : (
          <LuKey className="w-3.5 h-3.5 text-zoru-ink-muted" />
        )}
      </span>
      <span className="text-sm text-zoru-ink truncate flex-1">{CREDENTIAL_TYPE_LABEL[type]}</span>
      {hasOAuth && (
        <ZoruBadge variant="success" className="text-[10px] py-0 px-1.5">
          OAuth
        </ZoruBadge>
      )}
    </m.button>
  );
}

// ── Status icon (morphs between phases) ──────────────────────────────────────

function StatusIcon({ phase, reduced }: { phase: OAuthPhase; reduced: boolean }) {
  const tint =
    phase === 'success'
      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
      : phase === 'error'
      ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
      : 'bg-zoru-surface-2 text-zoru-ink-muted border-zoru-line';
  return (
    <m.div
      layout
      className={cn(
        'w-14 h-14 rounded-full border flex items-center justify-center',
        tint,
      )}
    >
      <AnimatePresence mode="wait">
        {phase === 'success' ? (
          <m.div
            key="ok"
            initial={reduced ? { opacity: 0 } : { scale: 0.4, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <LuCheck className="w-6 h-6" strokeWidth={2.5} />
          </m.div>
        ) : phase === 'error' ? (
          <m.div
            key="err"
            initial={reduced ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            <LuX className="w-6 h-6" strokeWidth={2.5} />
          </m.div>
        ) : (
          <m.div
            key="busy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LuLoader className="w-6 h-6 animate-spin" />
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

// ── Add Credential Modal ─────────────────────────────────────────────────────

function AddCredentialModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (cred: MaskedCredential) => void;
}) {
  const { t } = useT();
  const reduced = useReducedMotion() ?? false;

  const [step, setStep] = useState<Step>('pick');
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>({ type: '', name: '', data: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CredentialCategory | 'all'>('all');
  const [oauthPhase, setOauthPhase] = useState<OAuthPhase>('idle');
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState('');
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const credentialsBaselineRef = useRef<Set<string>>(new Set());

  const goStep = useCallback((next: Step) => {
    const from = STEP_ORDER.indexOf(step);
    const to = STEP_ORDER.indexOf(next);
    setDirection(to >= from ? 1 : -1);
    setStep(next);
  }, [step]);

  useEffect(() => {
    if (open) {
      setStep('pick');
      setDirection(1);
      setForm({ type: '', name: '', data: {} });
      setError(null);
      setSaving(false);
      setShowValues({});
      setQuery('');
      setActiveCategory('all');
      setOauthPhase('idle');
      setOauthMessage(null);
      setSubdomain('');
    } else {
      // Tear down any in-flight popup poll
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      try {
        popupRef.current?.close();
      } catch {
        /* ignore */
      }
      popupRef.current = null;
    }
  }, [open]);

  const filteredTypes = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return CREDENTIAL_TYPES.filter((tp) => {
      if (activeCategory !== 'all' && CREDENTIAL_TYPE_CATEGORY[tp] !== activeCategory) return false;
      if (!q) return true;
      return (
        CREDENTIAL_TYPE_LABEL[tp].toLowerCase().includes(q) ||
        tp.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  const groupedTypes = React.useMemo(() => {
    const groups = new Map<CredentialCategory, CredentialType[]>();
    for (const tp of filteredTypes) {
      const cat = CREDENTIAL_TYPE_CATEGORY[tp];
      const list = groups.get(cat) ?? [];
      list.push(tp);
      groups.set(cat, list);
    }
    return groups;
  }, [filteredTypes]);

  const fields =
    form.type && form.type !== 'custom'
      ? CREDENTIAL_FIELD_SCHEMAS[form.type as Exclude<CredentialType, 'custom'>] ?? []
      : [];

  const oauthProviderId = form.type
    ? OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE[form.type]
    : undefined;
  const oauthProviderLabel = oauthProviderId
    ? OAUTH_PROVIDER_LABEL[oauthProviderId] ?? oauthProviderId
    : null;
  const oauthAccent = oauthProviderId
    ? OAUTH_PROVIDER_ACCENT[oauthProviderId]
    : undefined;
  const oauthNeedsSubdomain = oauthProviderId
    ? OAUTH_PROVIDER_REQUIRES_SUBDOMAIN.has(oauthProviderId)
    : false;
  const subdomainSuffix = oauthProviderId
    ? OAUTH_PROVIDER_SUBDOMAIN_SUFFIX[oauthProviderId] ?? ''
    : '';
  const subdomainHint = oauthProviderId
    ? OAUTH_PROVIDER_SUBDOMAIN_HINT[oauthProviderId] ?? ''
    : '';
  const oauthCtaDisabled =
    !form.name.trim() || (oauthNeedsSubdomain && !subdomain.trim());

  function pickType(tp: CredentialType) {
    setForm((f) => ({ ...f, type: tp, name: defaultName(tp), data: {} }));
    goStep('authenticate');
  }

  function defaultName(tp: CredentialType): string {
    return `${CREDENTIAL_TYPE_LABEL[tp]} connection`;
  }

  async function handleSaveManual() {
    if (!form.type || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    setOauthPhase('exchanging');
    setOauthMessage(`Saving ${CREDENTIAL_TYPE_LABEL[form.type]} credentials…`);
    goStep('status');
    try {
      const res = await fetch('/api/sabflow/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, name: form.name.trim(), data: form.data }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? t('sabflow.connections.modal.errors.saveFailed'));

      const getRes = await fetch(`/api/sabflow/credentials/${json.id}`);
      const getJson = (await getRes.json()) as { credential?: MaskedCredential };
      if (getJson.credential) {
        onCreated(getJson.credential);
        setOauthPhase('success');
        setOauthMessage('Connection saved.');
        window.setTimeout(() => onClose(), 1100);
      } else {
        throw new Error('Credential saved but could not be loaded.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sabflow.connections.modal.errors.unknown');
      setError(msg);
      setOauthPhase('error');
      setOauthMessage(msg);
    } finally {
      setSaving(false);
    }
  }

  async function startOAuth() {
    if (!form.type || !oauthProviderId) return;
    setError(null);
    setOauthPhase('opening');
    setOauthMessage(`Opening ${oauthProviderLabel}…`);
    goStep('status');

    // Snapshot existing credential IDs so we can detect the new one after the
    // popup closes.
    try {
      const r = await fetch('/api/sabflow/credentials');
      const j = (await r.json()) as { credentials?: MaskedCredential[] };
      credentialsBaselineRef.current = new Set((j.credentials ?? []).map((c) => c.id));
    } catch {
      credentialsBaselineRef.current = new Set();
    }

    const returnTo = '/dashboard/sabflow/connections?oauth_popup=1';
    const authorizeUrl = new URL('/api/sabflow/oauth/authorize', window.location.origin);
    authorizeUrl.searchParams.set('provider', oauthProviderId);
    authorizeUrl.searchParams.set('label', form.name.trim() || defaultName(form.type));
    authorizeUrl.searchParams.set('credentialType', form.type);
    authorizeUrl.searchParams.set('returnTo', returnTo);
    if (oauthNeedsSubdomain && subdomain.trim()) {
      authorizeUrl.searchParams.set('subdomain', subdomain.trim());
    }

    const w = 600;
    const h = 750;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      authorizeUrl.toString(),
      'sabflow-oauth',
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );

    if (!popup) {
      // Popup blocked — fall back to full-page redirect.
      window.location.href = authorizeUrl.toString();
      return;
    }
    popupRef.current = popup;
    setOauthPhase('waiting');
    setOauthMessage(`Waiting for you to approve in ${oauthProviderLabel}…`);

    // Poll for popup closure, then refresh credentials list.
    pollRef.current = window.setInterval(async () => {
      if (popupRef.current?.closed) {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setOauthPhase('exchanging');
        setOauthMessage('Finalising connection…');
        try {
          const r = await fetch('/api/sabflow/credentials');
          const j = (await r.json()) as { credentials?: MaskedCredential[] };
          const list = j.credentials ?? [];
          const baseline = credentialsBaselineRef.current;
          const fresh = list.find((c) => !baseline.has(c.id));
          if (fresh) {
            onCreated(fresh);
            setOauthPhase('success');
            setOauthMessage(`${oauthProviderLabel} connected as “${fresh.name}”.`);
            window.setTimeout(() => onClose(), 1400);
          } else {
            setOauthPhase('error');
            setOauthMessage(
              'No new credential was saved. The window may have been closed before granting access.',
            );
          }
        } catch (err) {
          setOauthPhase('error');
          setOauthMessage(err instanceof Error ? err.message : 'Failed to refresh credentials.');
        }
      }
    }, 700);
  }

  function cancelOAuth() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    try {
      popupRef.current?.close();
    } catch {
      /* ignore */
    }
    popupRef.current = null;
    setOauthPhase('idle');
    setOauthMessage(null);
    goStep('authenticate');
  }

  return (
    <ZoruDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <ZoruDialogContent
        className={cn(
          step === 'pick' ? 'sm:max-w-3xl' : 'sm:max-w-md',
          'transition-[max-width] duration-300',
        )}
      >
        <ZoruDialogHeader>
          <ZoruDialogTitle className="flex items-center gap-2">
            <LuCable className="w-4 h-4 text-zoru-ink-muted" />
            {step === 'pick'
              ? 'Connect an app'
              : step === 'authenticate'
              ? `Connect ${form.type ? CREDENTIAL_TYPE_LABEL[form.type] : ''}`
              : 'Connection status'}
          </ZoruDialogTitle>
        </ZoruDialogHeader>

        <StepIndicator current={step} />

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {step === 'pick' && (
              <StepShell stepKey="pick" direction={direction} reduced={reduced}>
                <div className="space-y-1">
                  <p className="text-sm text-zoru-ink-muted">
                    Pick the app you want to connect. Apps marked{' '}
                    <ZoruBadge variant="success" className="text-[10px] py-0 px-1.5">
                      OAuth
                    </ZoruBadge>{' '}
                    use a one-click sign-in — no API keys to copy.
                  </p>
                </div>

                <div className="relative">
                  <LuSearch className="w-3.5 h-3.5 text-zoru-ink-subtle absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                  <ZoruInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('sabflow.connections.modal.searchPlaceholder')}
                    className="pl-9"
                    autoFocus
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <CategoryChip
                    active={activeCategory === 'all'}
                    onClick={() => setActiveCategory('all')}
                  >
                    {t('sabflow.connections.modal.filterAll')}
                  </CategoryChip>
                  {CREDENTIAL_CATEGORIES.map((cat) => (
                    <CategoryChip
                      key={cat}
                      active={activeCategory === cat}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {CREDENTIAL_CATEGORY_LABEL[cat]}
                    </CategoryChip>
                  ))}
                </div>

                <div className="max-h-[55vh] overflow-y-auto pr-1 -mr-1 space-y-5">
                  {filteredTypes.length === 0 ? (
                    <ZoruEmptyState
                      icon={<LuSearch />}
                      title="No apps match"
                      description={t('sabflow.connections.modal.searchEmpty', { query })}
                    />
                  ) : (
                    CREDENTIAL_CATEGORIES.map((cat) => {
                      const items = groupedTypes.get(cat);
                      if (!items?.length) return null;
                      return (
                        <div key={cat} className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wider text-zoru-ink-subtle">
                            {CREDENTIAL_CATEGORY_LABEL[cat]}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {items.map((tp, idx) => (
                              <ProviderTile
                                key={tp}
                                type={tp}
                                onSelect={pickType}
                                reduced={reduced}
                                index={idx}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </StepShell>
            )}

            {step === 'authenticate' && form.type && (
              <StepShell stepKey="auth" direction={direction} reduced={reduced}>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wider">
                    {t('sabflow.connections.modal.credentialName')}
                  </label>
                  <ZoruInput
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('sabflow.connections.modal.namePlaceholder', {
                      type: CREDENTIAL_TYPE_LABEL[form.type],
                    })}
                  />
                  <p className="text-xs text-zoru-ink-subtle">
                    Used to identify this connection in your flows.
                  </p>
                </div>

                {oauthProviderId ? (
                  <div className="space-y-3">
                    <div
                      className={cn(
                        'rounded-[var(--zoru-radius-lg)] border border-zoru-line p-4 bg-gradient-to-br',
                        oauthAccent ?? 'from-zoru-surface-2 to-zoru-bg',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-zoru-bg border border-zoru-line flex items-center justify-center shrink-0">
                          <LuShield className="w-4 h-4 text-zoru-ink-muted" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium text-zoru-ink">
                            Sign in with {oauthProviderLabel}
                          </p>
                          <p className="text-xs text-zoru-ink-muted leading-relaxed">
                            We&rsquo;ll open {oauthProviderLabel} in a popup. After you grant
                            access, SabFlow stores only the OAuth tokens — your password never
                            touches our servers.
                          </p>
                        </div>
                      </div>
                    </div>

                    {oauthNeedsSubdomain && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wider">
                          Workspace subdomain
                          <span className="text-zoru-danger ml-0.5">*</span>
                        </label>
                        <div className="flex items-stretch rounded-[var(--zoru-radius)] border border-zoru-line overflow-hidden bg-zoru-bg focus-within:border-zoru-line-strong transition-colors">
                          <input
                            value={subdomain}
                            onChange={(e) =>
                              setSubdomain(
                                e.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9-]/g, ''),
                              )
                            }
                            placeholder={subdomainHint || 'mycompany'}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoCorrect="off"
                            className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-zoru-ink outline-none"
                          />
                          <span className="px-3 py-2 text-xs text-zoru-ink-muted bg-zoru-surface-2 border-l border-zoru-line whitespace-nowrap flex items-center">
                            {subdomainSuffix}
                          </span>
                        </div>
                        <p className="text-xs text-zoru-ink-subtle">
                          Letters, numbers, and dashes only.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={startOAuth}
                      disabled={oauthCtaDisabled}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[var(--zoru-radius)]',
                        'bg-zoru-primary text-zoru-primary-foreground font-medium text-sm',
                        'hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity',
                      )}
                    >
                      <LuExternalLink className="w-3.5 h-3.5" />
                      Connect with {oauthProviderLabel}
                    </button>

                    <details className="group">
                      <summary className="text-xs text-zoru-ink-muted cursor-pointer hover:text-zoru-ink select-none">
                        Prefer to paste an API key? (advanced)
                      </summary>
                      <div className="pt-3">
                        {fields.length > 0 ? (
                          <ManualFields
                            fields={fields}
                            form={form}
                            setForm={setForm}
                            showValues={showValues}
                            setShowValues={setShowValues}
                          />
                        ) : (
                          <p className="text-xs text-zoru-ink-muted">
                            This provider only supports OAuth.
                          </p>
                        )}
                      </div>
                    </details>
                  </div>
                ) : fields.length > 0 ? (
                  <ManualFields
                    fields={fields}
                    form={form}
                    setForm={setForm}
                    showValues={showValues}
                    setShowValues={setShowValues}
                  />
                ) : (
                  <p className="text-xs text-zoru-ink-muted">
                    {t('sabflow.connections.modal.noFields')}
                  </p>
                )}

                {error && (
                  <p className="text-xs text-zoru-danger-ink bg-zoru-danger/10 border border-zoru-danger/20 rounded-[var(--zoru-radius)] px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2">
                  <ZoruButton variant="ghost" size="sm" onClick={() => goStep('pick')}>
                    <LuArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </ZoruButton>
                  {!oauthProviderId && (
                    <ZoruButton onClick={handleSaveManual} disabled={saving || !form.name.trim()}>
                      {saving && <LuLoader className="w-3.5 h-3.5 animate-spin" />}
                      {saving ? t('common.saving') : t('sabflow.connections.modal.save')}
                      {!saving && <LuArrowRight className="w-3.5 h-3.5" />}
                    </ZoruButton>
                  )}
                </div>
              </StepShell>
            )}

            {step === 'status' && (
              <StepShell stepKey="status" direction={direction} reduced={reduced}>
                <div
                  className="flex flex-col items-center text-center gap-3 py-6"
                  aria-live="polite"
                >
                  <StatusIcon phase={oauthPhase} reduced={reduced} />
                  <div className="space-y-1 max-w-xs">
                    <p className="text-sm font-medium text-zoru-ink">
                      {oauthPhase === 'opening' && 'Opening provider…'}
                      {oauthPhase === 'waiting' && 'Awaiting your approval…'}
                      {oauthPhase === 'exchanging' && 'Saving connection…'}
                      {oauthPhase === 'success' && 'You’re connected!'}
                      {oauthPhase === 'error' && 'Something went wrong'}
                      {oauthPhase === 'idle' && '—'}
                    </p>
                    {oauthMessage && (
                      <p className="text-xs text-zoru-ink-muted leading-relaxed">
                        {oauthMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {oauthPhase === 'error' ? (
                    <>
                      <ZoruButton variant="ghost" size="sm" onClick={() => goStep('authenticate')}>
                        <LuArrowLeft className="w-3.5 h-3.5" />
                        Try again
                      </ZoruButton>
                      <ZoruButton variant="ghost" size="sm" onClick={onClose}>
                        Close
                      </ZoruButton>
                    </>
                  ) : oauthPhase === 'success' ? (
                    <ZoruButton className="ml-auto" onClick={onClose}>
                      Done
                    </ZoruButton>
                  ) : (
                    <ZoruButton variant="ghost" size="sm" onClick={cancelOAuth}>
                      Cancel
                    </ZoruButton>
                  )}
                </div>
              </StepShell>
            )}
          </AnimatePresence>
        </div>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

// ── Manual fields sub-form ───────────────────────────────────────────────────

function ManualFields({
  fields,
  form,
  setForm,
  showValues,
  setShowValues,
}: {
  fields: ReadonlyArray<CredentialField>;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  showValues: Record<string, boolean>;
  setShowValues: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const isPassword = field.kind === 'password';
        const isVisible = showValues[field.key];
        return (
          <div key={field.key} className="space-y-1.5">
            <label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wider">
              {field.label}
              {field.required && <span className="text-zoru-danger ml-0.5">*</span>}
            </label>
            <div className="relative">
              <ZoruInput
                type={isPassword && !isVisible ? 'password' : 'text'}
                value={form.data[field.key] ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    data: { ...f.data, [field.key]: e.target.value },
                  }))
                }
                placeholder={field.placeholder}
                className="pr-9"
              />
              {isPassword && (
                <button
                  type="button"
                  onClick={() =>
                    setShowValues((sv) => ({ ...sv, [field.key]: !sv[field.key] }))
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zoru-ink-muted hover:text-zoru-ink"
                  aria-label={isVisible ? 'Hide value' : 'Show value'}
                >
                  {isVisible ? (
                    <LuEyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <LuEye className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
            {field.helpText && (
              <p className="text-xs text-zoru-ink-muted">{field.helpText}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SabFlowConnectionsPage() {
  const { t, locale } = useT();
  const [credentials, setCredentials] = useState<MaskedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<CredentialCategory | 'all'>('all');

  const visibleCredentials = React.useMemo(
    () =>
      filter === 'all'
        ? credentials
        : credentials.filter((c) => CREDENTIAL_TYPE_CATEGORY[c.type] === filter),
    [credentials, filter],
  );

  const credentialCategoryCounts = React.useMemo(() => {
    const counts: Partial<Record<CredentialCategory, number>> = {};
    for (const c of credentials) {
      const cat = CREDENTIAL_TYPE_CATEGORY[c.type];
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [credentials]);

  useEffect(() => {
    fetch('/api/sabflow/credentials')
      .then((r) => r.json())
      .then((j: { credentials?: MaskedCredential[] }) => {
        setCredentials(j.credentials ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm(t('sabflow.connections.confirmDelete'))) return;
    setDeleting(id);
    try {
      await fetch(`/api/sabflow/credentials/${id}`, { method: 'DELETE' });
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageEyebrow>{t('sabflow.connections.module')}</ZoruPageEyebrow>
          <ZoruPageTitle>{t('sabflow.connections.title')}</ZoruPageTitle>
          <ZoruPageDescription>{t('sabflow.connections.subtitle')}</ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton onClick={() => setModalOpen(true)}>
            <LuPlus className="w-4 h-4" />
            {t('sabflow.connections.addConnection')}
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!loading && credentials.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip active={filter === 'all'} onClick={() => setFilter('all')}>
            {t('sabflow.connections.filter.all', { count: credentials.length })}
          </CategoryChip>
          {CREDENTIAL_CATEGORIES.filter((c) => credentialCategoryCounts[c]).map((cat) => (
            <CategoryChip
              key={cat}
              active={filter === cat}
              onClick={() => setFilter(cat)}
            >
              {t('sabflow.connections.filter.category', {
                name: CREDENTIAL_CATEGORY_LABEL[cat],
                count: credentialCategoryCounts[cat] ?? 0,
              })}
            </CategoryChip>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LuLoader className="w-6 h-6 text-zoru-ink-muted animate-spin" />
        </div>
      ) : credentials.length === 0 ? (
        <ZoruEmptyState
          icon={<LuCable />}
          title={t('sabflow.connections.empty.title')}
          description={t('sabflow.connections.empty.subtitle')}
        />
      ) : (
        <>
          {/* Mobile: card list (under md) */}
          <div className="md:hidden space-y-2">
            {visibleCredentials.length === 0 ? (
              <ZoruCard variant="soft" className="text-center text-sm text-zoru-ink-muted py-10">
                {t('sabflow.connections.empty.categoryEmpty')}
              </ZoruCard>
            ) : (
              visibleCredentials.map((cred) => (
                <ZoruCard
                  key={cred.id}
                  variant="soft"
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <LuKey className="w-4 h-4 text-zoru-ink-muted shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-zoru-ink font-medium text-sm truncate">
                        {cred.name}
                      </span>
                      {isVercelManaged(cred) && <VercelManagedChip />}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ZoruBadge variant="secondary">
                        {CREDENTIAL_TYPE_LABEL[cred.type] ?? cred.type}
                      </ZoruBadge>
                      <span className="text-[11px] text-zoru-ink-muted">
                        {CREDENTIAL_CATEGORY_LABEL[CREDENTIAL_TYPE_CATEGORY[cred.type]] ?? '—'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zoru-ink-muted">
                      {formatDate(cred.createdAt, locale)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(cred.id)}
                    disabled={deleting === cred.id}
                    className="text-zoru-ink-muted hover:text-zoru-danger disabled:cursor-not-allowed p-1 -m-1"
                    aria-label="Delete credential"
                  >
                    {deleting === cred.id ? (
                      <LuLoader className="w-4 h-4 animate-spin" />
                    ) : (
                      <LuTrash2 className="w-4 h-4" />
                    )}
                  </button>
                </ZoruCard>
              ))
            )}
          </div>

          {/* Desktop: table (md+) */}
          <div className="hidden md:block rounded-[var(--zoru-radius-lg)] border border-zoru-line overflow-x-auto bg-zoru-bg">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>{t('sabflow.connections.table.name')}</ZoruTableHead>
                  <ZoruTableHead>{t('sabflow.connections.table.type')}</ZoruTableHead>
                  <ZoruTableHead>{t('sabflow.connections.table.category')}</ZoruTableHead>
                  <ZoruTableHead>{t('sabflow.connections.table.created')}</ZoruTableHead>
                  <ZoruTableHead />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {visibleCredentials.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={5}
                      className="text-center text-sm text-zoru-ink-muted py-10"
                    >
                      {t('sabflow.connections.empty.categoryEmpty')}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  visibleCredentials.map((cred) => (
                    <ZoruTableRow key={cred.id} className="group">
                      <ZoruTableCell>
                        <div className="flex items-center gap-2">
                          <LuKey className="w-3.5 h-3.5 text-zoru-ink-muted shrink-0" />
                          <span className="text-zoru-ink font-medium">{cred.name}</span>
                          {isVercelManaged(cred) && <VercelManagedChip />}
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant="secondary">
                          {CREDENTIAL_TYPE_LABEL[cred.type] ?? cred.type}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted text-xs">
                        {CREDENTIAL_CATEGORY_LABEL[CREDENTIAL_TYPE_CATEGORY[cred.type]] ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted text-xs">
                        {formatDate(cred.createdAt, locale)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <button
                          onClick={() => handleDelete(cred.id)}
                          disabled={deleting === cred.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-zoru-ink-muted hover:text-zoru-danger disabled:cursor-not-allowed"
                          aria-label="Delete credential"
                        >
                          {deleting === cred.id ? (
                            <LuLoader className="w-4 h-4 animate-spin" />
                          ) : (
                            <LuTrash2 className="w-4 h-4" />
                          )}
                        </button>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        </>
      )}

      <AddCredentialModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(cred) =>
          setCredentials((prev) =>
            prev.some((c) => c.id === cred.id) ? prev : [cred, ...prev],
          )
        }
      />
    </div>
  );
}

// ── Vercel-managed credential indicator ──────────────────────────────────────

function isVercelManaged(cred: MaskedCredential): boolean {
  if (cred.name && /marketplace/i.test(cred.name)) return true;
  const data = cred.data ?? {};
  for (const key of Object.keys(data)) {
    if (/^VERCEL_|_MARKETPLACE_/.test(key)) return true;
  }
  return false;
}

function VercelManagedChip() {
  return (
    <ZoruBadge variant="warning" title="Provisioned via Vercel Marketplace">
      <LuCloud className="w-3 h-3" />
      Vercel-managed
    </ZoruBadge>
  );
}
