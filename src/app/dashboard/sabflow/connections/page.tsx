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
  } from 'react-icons/lu';
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
  type CredentialType,
  type MaskedCredential,
  } from '@/lib/sabflow/credentials/types';

import React, { useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'type' | 'fields';

interface FormState {
  type: CredentialType | '';
  name: string;
  data: Record<string, string>;
}

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
  const [step, setStep] = useState<Step>('type');
  const [form, setForm] = useState<FormState>({ type: '', name: '', data: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CredentialCategory | 'all'>('all');

  useEffect(() => {
    if (open) {
      setStep('type');
      setForm({ type: '', name: '', data: {} });
      setError(null);
      setSaving(false);
      setShowValues({});
      setQuery('');
      setActiveCategory('all');
    }
  }, [open]);

  const filteredTypes = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return CREDENTIAL_TYPES.filter((tp) => {
      if (activeCategory !== 'all' && CREDENTIAL_TYPE_CATEGORY[tp] !== activeCategory) return false;
      if (!q) return true;
      return CREDENTIAL_TYPE_LABEL[tp].toLowerCase().includes(q) || tp.toLowerCase().includes(q);
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

  async function handleSave() {
    if (!form.type || !form.name.trim()) return;
    setSaving(true);
    setError(null);
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
      if (getJson.credential) onCreated(getJson.credential);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sabflow.connections.modal.errors.unknown'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ZoruDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <ZoruDialogContent className={cn(step === 'type' ? 'sm:max-w-3xl' : 'sm:max-w-md')}>
        <ZoruDialogHeader>
          <ZoruDialogTitle className="flex items-center gap-2">
            <LuKey className="w-4 h-4 text-zoru-ink-muted" />
            {step === 'type'
              ? t('sabflow.connections.modal.chooseType')
              : t('sabflow.connections.modal.addType', {
                  type: form.type ? CREDENTIAL_TYPE_LABEL[form.type] : '',
                })}
          </ZoruDialogTitle>
        </ZoruDialogHeader>

        {step === 'type' ? (
          <div className="flex flex-col gap-4 max-h-[70vh] overflow-hidden">
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

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-5">
              {filteredTypes.length === 0 ? (
                <p className="text-sm text-zoru-ink-muted py-8 text-center">
                  {t('sabflow.connections.modal.searchEmpty', { query })}
                </p>
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
                        {items.map((tp) => (
                          <button
                            key={tp}
                            onClick={() => {
                              setForm((f) => ({ ...f, type: tp, data: {} }));
                              setStep('fields');
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg hover:bg-zoru-surface-2 hover:border-zoru-line-strong transition-colors text-left"
                          >
                            <LuKey className="w-3.5 h-3.5 text-zoru-ink-muted shrink-0" />
                            <span className="text-sm text-zoru-ink truncate">
                              {CREDENTIAL_TYPE_LABEL[tp]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wider">
                {t('sabflow.connections.modal.credentialName')}
              </label>
              <ZoruInput
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={
                  form.type
                    ? t('sabflow.connections.modal.namePlaceholder', {
                        type: CREDENTIAL_TYPE_LABEL[form.type],
                      })
                    : t('sabflow.connections.modal.namePlaceholderGeneric')
                }
              />
            </div>

            {fields.length > 0 ? (
              fields.map((field) => {
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
                        >
                          {isVisible ? <LuEyeOff className="w-3.5 h-3.5" /> : <LuEye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    {field.helpText && (
                      <p className="text-xs text-zoru-ink-muted">{field.helpText}</p>
                    )}
                  </div>
                );
              })
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
              <ZoruButton variant="ghost" size="sm" onClick={() => setStep('type')}>
                {t('sabflow.connections.modal.back')}
              </ZoruButton>
              <ZoruButton onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving && <LuLoader className="w-3.5 h-3.5 animate-spin" />}
                {saving ? t('common.saving') : t('sabflow.connections.modal.save')}
              </ZoruButton>
            </div>
          </div>
        )}
      </ZoruDialogContent>
    </ZoruDialog>
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
        onCreated={(cred) => setCredentials((prev) => [cred, ...prev])}
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
