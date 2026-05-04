'use client';

/**
 * Wachat Phone Number Settings -- per-number business profile editor.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuPhone, LuSave, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { getPhoneNumberProfiles, updatePhoneProfile } from '@/app/actions/wachat-features.actions';

export default function PhoneNumberSettingsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [phones, setPhones] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [isLoading, startLoading] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const fetchPhones = useCallback((pid: string) => {
    startLoading(async () => {
      const res = await getPhoneNumberProfiles(pid);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        const nums = res.phoneNumbers || [];
        setPhones(nums);
        if (nums.length > 0) {
          setProfile({
            about: nums[0].about || '',
            address: nums[0].address || '',
            description: nums[0].description || '',
            email: nums[0].email || '',
            websites: nums[0].websites || '',
          });
        }
      }
    });
  }, [toast]);

  useEffect(() => { if (projectId) fetchPhones(projectId); }, [projectId, fetchPhones]);

  const selectPhone = (idx: number) => {
    setSelectedIdx(idx);
    const p = phones[idx];
    if (p) setProfile({ about: p.about || '', address: p.address || '', description: p.description || '', email: p.email || '', websites: p.websites || '' });
  };

  const handleSave = async () => {
    const phone = phones[selectedIdx];
    if (!phone || !projectId) return;
    setIsSaving(true);
    const res = await updatePhoneProfile(projectId, phone.id || phone._id, profile);
    setIsSaving(false);
    if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
    else toast({ title: 'Saved', description: `Profile for ${phone.display_phone_number || phone.number || 'phone'} updated.` });
  };

  const fields = [
    { key: 'about', label: 'About' },
    { key: 'description', label: 'Business Description', multiline: true },
    { key: 'address', label: 'Address' },
    { key: 'email', label: 'Email' },
    { key: 'websites', label: 'Websites' },
  ];

  const current = phones[selectedIdx];

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject?.name || 'Project', href: '/wachat' },
        { label: 'Phone Number Settings' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Phone Number Settings</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Manage business profile for each connected phone number.</p>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center"><LuLoader className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : phones.length === 0 ? (
        <ClayCard className="p-12 text-center">
          <LuPhone className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">No phone numbers connected.</p>
        </ClayCard>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {phones.map((p, i) => (
              <ClayButton key={p.id || i} variant={selectedIdx === i ? 'obsidian' : 'pill'} size="sm"
                onClick={() => selectPhone(i)} leading={<LuPhone className="h-3.5 w-3.5" />}>
                {p.display_phone_number || p.number || `Phone ${i + 1}`}
              </ClayButton>
            ))}
          </div>

          <ClayCard padded={false} className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <LuPhone className="h-6 w-6 text-muted-foreground" />
              </span>
              <div>
                <div className="text-[16px] font-semibold text-foreground">{current?.display_phone_number || current?.number || '--'}</div>
                <div className="text-[12px] text-muted-foreground">{current?.verified_name || current?.displayName || ''}</div>
              </div>
            </div>

            <div className="flex flex-col gap-4 max-w-lg">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-[13px] font-medium text-foreground mb-1.5 block">{f.label}</label>
                  {f.multiline ? (
                    <textarea value={profile[f.key] || ''} onChange={(e) => setProfile((prev) => ({ ...prev, [f.key]: e.target.value }))} rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none resize-none" />
                  ) : (
                    <input type="text" value={profile[f.key] || ''} onChange={(e) => setProfile((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
                  )}
                </div>
              ))}
              <div>
                <ClayButton variant="obsidian" size="md" onClick={handleSave} disabled={isSaving}
                  leading={isSaving ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : <LuSave className="h-3.5 w-3.5" />}>
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </ClayButton>
              </div>
            </div>
          </ClayCard>
        </>
      )}
      <div className="h-6" />
    </div>
  );
}
