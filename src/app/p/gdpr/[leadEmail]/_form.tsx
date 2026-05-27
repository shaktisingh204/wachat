'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ClayButton, ClayCard } from '@/components/zoruui-domain';
import { Check, LoaderCircle, Search } from 'lucide-react';
import { grantPublicConsent } from '@/app/actions/worksuite/public.actions';

export interface ConsentPurpose {
  _id: string;
  title: string;
  description?: string;
  is_required?: boolean;
  granted?: boolean;
}

export function ConsentItem({
  purpose,
  granted,
  onChange,
  disabled
}: {
  purpose: ConsentPurpose;
  granted: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 cursor-pointer">
      <input
        type="checkbox"
        checked={granted}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || purpose.is_required}
        className="mt-1 h-4 w-4 rounded border-border accent-primary disabled:opacity-50"
      />
      <div>
        <p className="text-[13px] font-medium text-foreground">
          {purpose.title}
          {purpose.is_required ? (
            <span className="ml-1 text-[11.5px] text-accent-foreground">
              (required)
            </span>
          ) : null}
        </p>
        {purpose.description ? (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {purpose.description}
          </p>
        ) : null}
      </div>
    </label>
  );
}

export function ConsentForm({
  leadEmail,
  purposes,
}: {
  leadEmail: string;
  purposes: ConsentPurpose[];
}) {
  const router = useRouter();
  
  // Set required ones to true by default to ensure they are granted
  const [granted, setGranted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(purposes.map((p) => [p._id, p.is_required ? true : !!p.granted])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'default' | 'name' | 'required-first'>('default');

  const filteredAndSortedPurposes = useMemo(() => {
    let result = [...purposes];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        p => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    if (sortOrder === 'name') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === 'required-first') {
      result.sort((a, b) => {
        if (a.is_required === b.is_required) return 0;
        return a.is_required ? -1 : 1;
      });
    }

    return result;
  }, [purposes, search, sortOrder]);

  const submit = async () => {
    setError(null);
    for (const p of purposes) {
      if (p.is_required && !granted[p._id]) {
        setError(`"${p.title}" is required.`);
        return;
      }
    }
    const ids = Object.keys(granted).filter((k) => granted[k]);
    setBusy(true);
    
    try {
      const res = await grantPublicConsent(leadEmail, ids);
      if (!res.success) {
        setError(res.error || 'Failed to update preferences.');
        setBusy(false);
        return;
      }
      router.push('/p/thanks?type=gdpr');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setBusy(false);
    }
  };

  const handleGrantChange = (id: string, checked: boolean) => {
    setGranted((prev) => ({ ...prev, [id]: checked }));
  };

  return (
    <ClayCard>
      {purposes.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search purposes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-[13px]"
            />
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-[13px]"
          >
            <option value="default">Default Order</option>
            <option value="name">Alphabetical</option>
            <option value="required-first">Required First</option>
          </select>
        </div>
      )}

      {purposes.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          No consent purposes are currently defined.
        </p>
      ) : filteredAndSortedPurposes.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          No matching purposes found.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {filteredAndSortedPurposes.map((p) => (
            <ConsentItem
              key={p._id}
              purpose={p}
              granted={!!granted[p._id]}
              onChange={(checked) => handleGrantChange(p._id, checked)}
              disabled={busy}
            />
          ))}
        </div>
      )}
      
      {error ? (
        <p className="mt-4 text-[12.5px] text-accent-foreground font-medium bg-accent/10 p-2 rounded">{error}</p>
      ) : null}
      
      <div className="mt-4 flex justify-end">
        <ClayButton
          variant="obsidian"
          onClick={submit}
          disabled={busy || purposes.length === 0}
          leading={
            busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )
          }
        >
          {busy ? 'Saving...' : 'Save preferences'}
        </ClayButton>
      </div>
    </ClayCard>
  );
}
