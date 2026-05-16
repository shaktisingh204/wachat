'use client';

import React, { useEffect, useState } from 'react';
import {
  LuPlus,
  LuTrash2,
  LuCable,
  LuKey,
  LuLoader,
  LuX,
  LuEye,
  LuEyeOff,
  LuSearch,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
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

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'type' | 'fields';

interface FormState {
  type: CredentialType | '';
  name: string;
  data: Record<string, string>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
    return CREDENTIAL_TYPES.filter((t) => {
      if (activeCategory !== 'all' && CREDENTIAL_TYPE_CATEGORY[t] !== activeCategory) return false;
      if (!q) return true;
      return CREDENTIAL_TYPE_LABEL[t].toLowerCase().includes(q) || t.toLowerCase().includes(q);
    });
  }, [query, activeCategory]);

  const groupedTypes = React.useMemo(() => {
    const groups = new Map<CredentialCategory, CredentialType[]>();
    for (const t of filteredTypes) {
      const cat = CREDENTIAL_TYPE_CATEGORY[t];
      const list = groups.get(cat) ?? [];
      list.push(t);
      groups.set(cat, list);
    }
    return groups;
  }, [filteredTypes]);

  if (!open) return null;

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
      if (!res.ok) throw new Error(json.error ?? 'Failed to save credential');

      // Fetch the newly created record (masked)
      const getRes = await fetch(`/api/sabflow/credentials/${json.id}`);
      const getJson = (await getRes.json()) as { credential?: MaskedCredential };
      if (getJson.credential) onCreated(getJson.credential);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          'w-full bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col',
          step === 'type' ? 'max-w-3xl max-h-[80vh]' : 'max-w-md',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <LuKey className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-100">
              {step === 'type' ? 'Choose credential type' : `Add ${form.type ? CREDENTIAL_TYPE_LABEL[form.type] : ''}`}
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className={cn('px-6 py-5 space-y-4', step === 'type' && 'flex-1 min-h-0 flex flex-col overflow-hidden')}>
          {step === 'type' ? (
            <>
              {/* Search */}
              <div className="relative">
                <LuSearch className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search providers (e.g. slack, notion, postgres)…"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                  autoFocus
                />
              </div>

              {/* Category chips */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    activeCategory === 'all'
                      ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                      : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700/60',
                  )}
                >
                  All
                </button>
                {CREDENTIAL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      activeCategory === cat
                        ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                        : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700/60',
                    )}
                  >
                    {CREDENTIAL_CATEGORY_LABEL[cat]}
                  </button>
                ))}
              </div>

              {/* Grouped list */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-5">
                {filteredTypes.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-8 text-center">
                    No providers match “{query}”.
                  </p>
                ) : (
                  CREDENTIAL_CATEGORIES.map((cat) => {
                    const items = groupedTypes.get(cat);
                    if (!items?.length) return null;
                    return (
                      <div key={cat} className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                          {CREDENTIAL_CATEGORY_LABEL[cat]}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {items.map((t) => (
                            <button
                              key={t}
                              onClick={() => {
                                setForm((f) => ({ ...f, type: t, data: {} }));
                                setStep('fields');
                              }}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-700/60 bg-zinc-800/50 hover:bg-zinc-700/60 hover:border-zinc-600 transition-colors text-left"
                            >
                              <LuKey className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="text-sm text-zinc-200 truncate">
                                {CREDENTIAL_TYPE_LABEL[t]}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Credential name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={`My ${form.type ? CREDENTIAL_TYPE_LABEL[form.type] : 'credential'}`}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Dynamic fields */}
              {fields.length > 0 ? (
                fields.map((field) => {
                  const isPassword = field.kind === 'password';
                  const isVisible = showValues[field.key];
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={isPassword && !isVisible ? 'password' : 'text'}
                          value={form.data[field.key] ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              data: { ...f.data, [field.key]: e.target.value },
                            }))
                          }
                          placeholder={field.placeholder}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 pr-8"
                        />
                        {isPassword && (
                          <button
                            type="button"
                            onClick={() =>
                              setShowValues((sv) => ({ ...sv, [field.key]: !sv[field.key] }))
                            }
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                          >
                            {isVisible ? <LuEyeOff className="w-3.5 h-3.5" /> : <LuEye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      {field.helpText && (
                        <p className="text-xs text-zinc-500">{field.helpText}</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-zinc-500">
                  This credential type has no predefined fields. You can add custom key-value pairs later.
                </p>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'fields' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
            <button
              onClick={() => setStep('type')}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                saving || !form.name.trim()
                  ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-100 text-zinc-900 hover:bg-white',
              )}
            >
              {saving && <LuLoader className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Saving…' : 'Save credential'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SabFlowConnectionsPage() {
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
    if (!confirm('Delete this credential? Flows using it will stop working.')) return;
    setDeleting(id);
    try {
      await fetch(`/api/sabflow/credentials/${id}`, { method: 'DELETE' });
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-1">SabFlow</p>
            <h1 className="text-2xl font-bold text-zinc-100">Connections</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Saved credentials used by workflow blocks to authenticate with external services.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            Add connection
          </button>
        </div>

        {/* Category filter chips (only when credentials exist) */}
        {!loading && credentials.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                filter === 'all'
                  ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                  : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700/60',
              )}
            >
              All ({credentials.length})
            </button>
            {CREDENTIAL_CATEGORIES.filter((c) => credentialCategoryCounts[c]).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  filter === cat
                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                    : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700/60',
                )}
              >
                {CREDENTIAL_CATEGORY_LABEL[cat]} ({credentialCategoryCounts[cat]})
              </button>
            ))}
          </div>
        )}

        {/* Table / Empty */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LuLoader className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : credentials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
              <LuCable className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-zinc-300 font-medium">No connections yet</p>
            <p className="text-sm text-zinc-500 mt-1">
              Add a credential to let your flows authenticate with external APIs.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {visibleCredentials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
                      No credentials in this category.
                    </td>
                  </tr>
                ) : (
                  visibleCredentials.map((cred) => (
                    <tr key={cred.id} className="hover:bg-zinc-900/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <LuKey className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="text-zinc-200 font-medium">{cred.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                          {CREDENTIAL_TYPE_LABEL[cred.type] ?? cred.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {CREDENTIAL_CATEGORY_LABEL[CREDENTIAL_TYPE_CATEGORY[cred.type]] ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {formatDate(cred.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(cred.id)}
                          disabled={deleting === cred.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 disabled:cursor-not-allowed"
                        >
                          {deleting === cred.id ? (
                            <LuLoader className="w-4 h-4 animate-spin" />
                          ) : (
                            <LuTrash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddCredentialModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(cred) => setCredentials((prev) => [cred, ...prev])}
      />
    </div>
  );
}
