'use client';

/**
 * Wachat Phone Number Settings — per-number business profile editor.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuPhone, LuSave } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

type PhoneProfile = {
  number: string; displayName: string; about: string;
  address: string; description: string; email: string; websites: string;
};

const PHONE_NUMBERS: PhoneProfile[] = [
  { number: '+91 98765 43210', displayName: 'SabNode Support', about: 'Official support line', address: 'Mumbai, India', description: 'Customer support for SabNode products', email: 'support@sabnode.com', websites: 'https://sabnode.com' },
  { number: '+91 87654 32109', displayName: 'SabNode Sales', about: 'Sales inquiries', address: 'Delhi, India', description: 'Sales and partnership inquiries', email: 'sales@sabnode.com', websites: 'https://sabnode.com/pricing' },
];

export default function PhoneNumberSettingsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [profiles, setProfiles] = useState<PhoneProfile[]>(PHONE_NUMBERS);

  const current = profiles[selectedIdx];

  const updateField = (field: keyof PhoneProfile, value: string) => {
    setProfiles((prev) => prev.map((p, i) => i === selectedIdx ? { ...p, [field]: value } : p));
  };

  const handleSave = () => {
    toast({ title: 'Saved', description: `Profile for ${current.number} updated.` });
  };

  const fields: { key: keyof PhoneProfile; label: string; multiline?: boolean }[] = [
    { key: 'displayName', label: 'Display Name' },
    { key: 'about', label: 'About' },
    { key: 'description', label: 'Business Description', multiline: true },
    { key: 'address', label: 'Address' },
    { key: 'email', label: 'Email' },
    { key: 'websites', label: 'Websites' },
  ];

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Phone Number Settings' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Phone Number Settings</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Manage business profile for each connected phone number.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {profiles.map((p, i) => (
          <ClayButton key={p.number} variant={selectedIdx === i ? 'obsidian' : 'pill'} size="sm"
            onClick={() => setSelectedIdx(i)}
            leading={<LuPhone className="h-3.5 w-3.5" />}>
            {p.number}
          </ClayButton>
        ))}
      </div>

      <ClayCard padded={false} className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-surface-2">
            <LuPhone className="h-6 w-6 text-clay-ink-muted" />
          </span>
          <div>
            <div className="text-[16px] font-semibold text-clay-ink">{current.number}</div>
            <div className="text-[12px] text-clay-ink-muted">{current.displayName}</div>
          </div>
        </div>

        <div className="flex flex-col gap-4 max-w-lg">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-[13px] font-medium text-clay-ink mb-1.5 block">{f.label}</label>
              {f.multiline ? (
                <textarea value={current[f.key]} onChange={(e) => updateField(f.key, e.target.value)} rows={3}
                  className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none resize-none" />
              ) : (
                <input type="text" value={current[f.key]} onChange={(e) => updateField(f.key, e.target.value)}
                  className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
              )}
            </div>
          ))}
          <div>
            <ClayButton variant="obsidian" size="md" onClick={handleSave}
              leading={<LuSave className="h-3.5 w-3.5" />}>
              Save Profile
            </ClayButton>
          </div>
        </div>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
