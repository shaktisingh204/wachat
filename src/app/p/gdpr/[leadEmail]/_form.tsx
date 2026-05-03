'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClayButton, ClayCard } from '@/components/clay';
import { Check, LoaderCircle } from 'lucide-react';
import { grantPublicConsent } from '@/app/actions/worksuite/public.actions';

export interface ConsentPurpose {
  _id: string;
  title: string;
  description?: string;
  is_required?: boolean;
  granted?: boolean;
}

export function ConsentForm({
  leadEmail,
  purposes,
}: {
  leadEmail: string;
  purposes: ConsentPurpose[];
}) {
  const router = useRouter();
  const [granted, setGranted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(purposes.map((p) => [p._id, !!p.granted])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    // Ensure required purposes are granted.
    for (const p of purposes) {
      if (p.is_required && !granted[p._id]) {
        setError(`"${p.title}" is required.`);
        return;
      }
    }
    const ids = Object.keys(granted).filter((k) => granted[k]);
    setBusy(true);
    const res = await grantPublicConsent(leadEmail, ids);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push('/p/thanks?type=gdpr');
  };

  return (
    <ClayCard>
      {purposes.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          No consent purposes are currently defined.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {purposes.map((p) => (
            <label
              key={p._id}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
            >
              <input
                type="checkbox"
                checked={!!granted[p._id]}
                onChange={(e) =>
                  setGranted((prev) => ({ ...prev, [p._id]: e.target.checked }))
                }
                disabled={busy}
                className="mt-1 h-4 w-4 rounded border-border accent-primary"
              />
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  {p.title}
                  {p.is_required ? (
                    <span className="ml-1 text-[11.5px] text-accent-foreground">
                      (required)
                    </span>
                  ) : null}
                </p>
                {p.description ? (
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {p.description}
                  </p>
                ) : null}
              </div>
            </label>
          ))}
        </div>
      )}
      {error ? (
        <p className="mt-3 text-[12.5px] text-accent-foreground">{error}</p>
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
          Save preferences
        </ClayButton>
      </div>
    </ClayCard>
  );
}
