'use client';

/**
 * Wachat Contact Blacklist — block spam phone numbers.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuShieldBan, LuPlus, LuTrash2, LuUpload } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

export default function ContactBlacklistPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [numbers, setNumbers] = useState<string[]>(['+1234567890', '+9876543210']);
  const [phone, setPhone] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const addNumber = () => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    if (numbers.includes(trimmed)) {
      toast({ title: 'Duplicate', description: 'Number already blacklisted.', variant: 'destructive' });
      return;
    }
    setNumbers((prev) => [trimmed, ...prev]);
    setPhone('');
    toast({ title: 'Added', description: `${trimmed} blacklisted.` });
  };

  const bulkAdd = () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const unique = lines.filter((l) => !numbers.includes(l));
    if (unique.length === 0) { toast({ title: 'No new numbers', variant: 'destructive' }); return; }
    setNumbers((prev) => [...unique, ...prev]);
    setBulkText('');
    setShowBulk(false);
    toast({ title: 'Added', description: `${unique.length} numbers blacklisted.` });
  };

  const removeNumber = (num: string) => {
    setNumbers((prev) => prev.filter((n) => n !== num));
    toast({ title: 'Removed', description: `${num} removed from blacklist.` });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Contact Blacklist' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Contact Blacklist
          </h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">
            Block phone numbers from sending messages to your project.
          </p>
        </div>
        <ClayBadge tone="neutral">{numbers.length} blocked</ClayBadge>
      </div>

      {/* Add single */}
      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Add Number</h2>
        <div className="flex gap-3">
          <input
            type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+1234567890"
            onKeyDown={(e) => e.key === 'Enter' && addNumber()}
            className="flex-1 rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none"
          />
          <ClayButton size="sm" onClick={addNumber} disabled={!phone.trim()}>
            <LuPlus className="mr-1.5 h-3.5 w-3.5" /> Add
          </ClayButton>
          <ClayButton size="sm" variant="ghost" onClick={() => setShowBulk(!showBulk)}>
            <LuUpload className="mr-1.5 h-3.5 w-3.5" /> Bulk
          </ClayButton>
        </div>
        {showBulk && (
          <div className="mt-4">
            <textarea
              value={bulkText} onChange={(e) => setBulkText(e.target.value)}
              rows={4} placeholder="One phone number per line..."
              className="clay-input min-h-[80px] resize-y py-2.5 w-full"
            />
            <ClayButton size="sm" className="mt-2" onClick={bulkAdd} disabled={!bulkText.trim()}>
              Add All
            </ClayButton>
          </div>
        )}
      </ClayCard>

      {/* Table */}
      {numbers.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Phone Number</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((num, i) => (
                <tr key={num} className="border-b border-clay-border last:border-0">
                  <td className="px-5 py-3 text-[13px] text-clay-ink-muted">{i + 1}</td>
                  <td className="px-5 py-3 font-mono text-[13px] text-clay-ink">{num}</td>
                  <td className="px-5 py-3 text-right">
                    <ClayButton size="sm" variant="ghost" onClick={() => removeNumber(num)}>
                      <LuTrash2 className="mr-1 h-3.5 w-3.5" /> Remove
                    </ClayButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuShieldBan className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No numbers blacklisted.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
