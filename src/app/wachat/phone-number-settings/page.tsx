'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Loader2, Phone, Save, Sparkles } from 'lucide-react';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  EmptyState,
  WaButton,
} from '@/components/wachat-ui';

import { useProject } from '@/context/project-context';
import {
  getPhoneNumberProfiles,
  updatePhoneProfile,
} from '@/app/actions/wachat-features.actions';
import { handleGenerateBusinessDescription } from '@/app/actions/ai-actions';

export default function PhoneNumberSettingsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [phones, setPhones] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [isLoading, startLoading] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [displayNameOpen, setDisplayNameOpen] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState('');

  const fetchPhones = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getPhoneNumberProfiles(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          const nums = res.phoneNumbers || [];
          setPhones(nums);
          if (nums.length > 0) {
            setProfile({
              about: nums[0].about || '',
              address: nums[0].address || '',
              description: nums[0].description || '',
              email: nums[0].email || '',
              websites: Array.isArray(nums[0].websites) ? nums[0].websites.join(', ') : nums[0].websites || '',
            });
          }
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchPhones(projectId);
  }, [projectId, fetchPhones]);

  const selectPhone = (idx: number) => {
    setSelectedIdx(idx);
    const p = phones[idx];
    if (p) {
      setProfile({
        about: p.about || '',
        address: p.address || '',
        description: p.description || '',
        email: p.email || '',
        websites: Array.isArray(p.websites) ? p.websites.join(', ') : p.websites || '',
      });
    }
  };

  const handleSave = async () => {
    const phone = phones[selectedIdx];
    if (!phone || !projectId) return;

    const errors: string[] = [];
    if (profile.about && profile.about.length > 139) errors.push('About text must be 139 characters or less.');
    if (profile.address) {
      if (profile.address.length > 256) errors.push('Address must be 256 characters or less.');
      if (profile.address.length < 5) errors.push('Address must be at least 5 characters long.');
    }
    if (profile.description && profile.description.length > 512) errors.push('Description must be 512 characters or less.');
    if (profile.email) {
      if (profile.email.length > 128) errors.push('Email must be 128 characters or less.');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profile.email)) errors.push('Email is invalid.');
    }

    let webs: string[] = [];
    if (profile.websites) {
      const urls = typeof profile.websites === 'string'
        ? profile.websites.split(',').map((w) => w.trim()).filter(Boolean)
        : (profile.websites as unknown as string[]);
      if (urls.length > 2) errors.push('Maximum 2 websites are allowed.');
      const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
      for (const url of urls) {
        if (url.length > 256) errors.push(`Website URL too long (max 256 chars): ${url}`);
        if (!urlRegex.test(url)) errors.push(`Invalid website URL format: ${url}`);
      }
      webs = urls;
    }

    if (errors.length > 0) {
      toast({ title: 'Validation error', description: errors.join('\n'), variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const finalProfile = { ...profile, websites: webs };
    const res = await updatePhoneProfile(projectId, phone.id || phone._id, finalProfile);
    setIsSaving(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: `Profile for ${phone.display_phone_number || phone.number || 'phone'} updated.` });
    }
  };

  const generateDescription = async () => {
    const phone = phones[selectedIdx];
    const name = phone?.verified_name || phone?.displayName || phone?.display_phone_number || 'Business';
    const context = `${name}. ${profile.about || ''} ${profile.address || ''}`.trim();
    setIsGenerating(true);
    const res = await handleGenerateBusinessDescription(context);
    setIsGenerating(false);
    if (res.error) {
      toast({ title: 'Generation failed', description: res.error, variant: 'destructive' });
    } else if (res.description) {
      const generated: string = res.description;
      setProfile((prev) => ({ ...prev, description: generated }));
      toast({ title: 'Done', description: 'Business description generated.' });
    }
  };

  const fields = [
    { key: 'about', label: 'About', helpText: 'Max 139 characters.' },
    { key: 'description', label: 'Business description', multiline: true, helpText: 'Max 512 characters. Shown to users in chat.' },
    { key: 'address', label: 'Address', helpText: 'Physical location. Min 5, max 256 chars.' },
    { key: 'email', label: 'Email', helpText: 'Max 128 characters.' },
    { key: 'websites', label: 'Websites', helpText: 'Comma separated. Maximum 2 URLs.' },
  ];

  const current = phones[selectedIdx];

  return (
    <WaPage>
      <PageHeader
        title="Phone number settings"
        description="Manage the business profile for each connected phone number."
        kicker="Wachat · numbers"
        backHref="/wachat"
        eyebrowIcon={Phone}
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        </div>
      ) : phones.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No phone numbers connected"
          description="Connect a WhatsApp Business number to manage its profile here."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {phones.map((p, i) => {
              const active = selectedIdx === i;
              return (
                <button
                  key={p.id || i}
                  type="button"
                  onClick={() => selectPhone(i)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                    active
                      ? 'border-transparent text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900'
                  }`}
                  style={active ? { background: 'var(--mt-accent)' } : undefined}
                >
                  <Phone className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                  {p.display_phone_number || p.number || `Phone ${i + 1}`}
                </button>
              );
            })}
          </div>

          <Section
            title={current?.display_phone_number || current?.number || 'Profile'}
            description={current?.verified_name || current?.displayName || ''}
            action={
              <WaButton size="sm" variant="outline" onClick={() => {
                setDraftDisplayName(current?.verified_name || current?.displayName || '');
                setDisplayNameOpen(true);
              }}>
                Edit display name
              </WaButton>
            }
          >
            <div className="flex max-w-xl flex-col gap-5">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`pn-${f.key}`} className="text-[12px] font-semibold text-zinc-700">
                      {f.label}
                    </Label>
                    {f.key === 'description' && (
                      <WaButton size="sm" variant="ghost" onClick={generateDescription} disabled={isGenerating} leftIcon={isGenerating ? Loader2 : Sparkles}>
                        {isGenerating ? 'Generating' : 'AI generate'}
                      </WaButton>
                    )}
                  </div>
                  {f.multiline ? (
                    <Textarea
                      id={`pn-${f.key}`}
                      value={profile[f.key] || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      rows={4}
                      maxLength={f.key === 'description' ? 512 : undefined}
                      className="rounded-xl"
                    />
                  ) : (
                    <Input
                      id={`pn-${f.key}`}
                      value={profile[f.key] || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      maxLength={f.key === 'about' ? 139 : f.key === 'address' ? 256 : f.key === 'email' ? 128 : undefined}
                      className="rounded-xl"
                    />
                  )}
                  {f.helpText && (
                    <span className="text-[11.5px] text-zinc-500">{f.helpText}</span>
                  )}
                </div>
              ))}
              <div className="pt-2">
                <WaButton onClick={handleSave} disabled={isSaving} leftIcon={isSaving ? Loader2 : Save}>
                  {isSaving ? 'Saving' : 'Save profile'}
                </WaButton>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Edit display name */}
      <Dialog open={displayNameOpen} onOpenChange={setDisplayNameOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit display name</ZoruDialogTitle>
            <ZoruDialogDescription>
              Update the verified display name shown to your WhatsApp customers.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input id="display-name" value={draftDisplayName} onChange={(e) => setDraftDisplayName(e.target.value)} placeholder="Acme Inc." className="rounded-xl" />
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setDisplayNameOpen(false)}>Cancel</WaButton>
            <WaButton
              onClick={() => {
                toast({ title: 'Display name updated', description: `Submitted "${draftDisplayName}" for review.` });
                setDisplayNameOpen(false);
              }}
              disabled={!draftDisplayName.trim()}
            >
              Save
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
