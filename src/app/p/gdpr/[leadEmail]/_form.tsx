'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search } from 'lucide-react';
import {
  Card,
  Button,
  Checkbox,
  Input,
  Field,
  Alert,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
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
  disabled,
}: {
  purpose: ConsentPurpose;
  granted: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 cursor-pointer">
      <Checkbox
        className="mt-1"
        checked={granted}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || purpose.is_required}
      />
      <div>
        <p className="text-[13px] font-medium text-[var(--st-text)]">
          {purpose.title}
          {purpose.is_required ? (
            <span className="ml-1 text-[11.5px] text-[var(--st-text-secondary)]">
              (required)
            </span>
          ) : null}
        </p>
        {purpose.description ? (
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
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
        (p) => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
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
    <Card>
      {purposes.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <Field className="flex-1">
            <Input
              inputSize="sm"
              type="text"
              placeholder="Search purposes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              iconLeft={Search}
              aria-label="Search purposes"
            />
          </Field>
          <Select
            value={sortOrder}
            onValueChange={(v) => setSortOrder(v as 'default' | 'name' | 'required-first')}
          >
            <SelectTrigger aria-label="Sort order" className="sm:w-48">
              <SelectValue placeholder="Default Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Order</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
              <SelectItem value="required-first">Required First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {purposes.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--st-text-secondary)]">
          No consent purposes are currently defined.
        </p>
      ) : filteredAndSortedPurposes.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--st-text-secondary)]">
          No matching purposes found.
        </p>
      ) : (
        <div className="divide-y divide-[var(--st-border)]">
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
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          onClick={submit}
          disabled={busy || purposes.length === 0}
          loading={busy}
          iconLeft={Check}
        >
          {busy ? 'Saving...' : 'Save preferences'}
        </Button>
      </div>
    </Card>
  );
}
