'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Loader2,
  Phone,
  Save,
  Sparkles } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getPhoneNumberProfiles,
  updatePhoneProfile,
  } from '@/app/actions/wachat-features.actions';
import { handleGenerateBusinessDescription } from '@/app/actions/ai-actions';

/**
 * Wachat Phone Number Settings — ZoruUI migration.
 * Per-number business profile editor.
 */

import * as React from 'react';

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

  // Edit-display-name dialog
  const [displayNameOpen, setDisplayNameOpen] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState('');

  const fetchPhones = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getPhoneNumberProfiles(pid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            variant: 'destructive',
          });
        } else {
          const nums = res.phoneNumbers || [];
          setPhones(nums);
          if (nums.length > 0) {
            setProfile({
              about: nums[0].about || '',
              address: nums[0].address || '',
              description: nums[0].description || '',
              email: nums[0].email || '',
              websites: Array.isArray(nums[0].websites) ? nums[0].websites.join(', ') : (nums[0].websites || ''),
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
        websites: Array.isArray(p.websites) ? p.websites.join(', ') : (p.websites || ''),
      });
    }
  };

  const handleSave = async () => {
    const phone = phones[selectedIdx];
    if (!phone || !projectId) return;

    // Client-side validation matching Meta API requirements
    const errors: string[] = [];
    if (profile.about && profile.about.length > 139) errors.push('About text must be 139 characters or less.');
    if (profile.address) {
      if (profile.address.length > 256) errors.push('Address must be 256 characters or less.');
      if (profile.address.length < 5) errors.push('Address must be at least 5 characters long to be accepted by Meta.');
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
      toast({
        title: 'Validation Error',
        description: errors.join('\n'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const finalProfile = { ...profile, websites: webs };

    const res = await updatePhoneProfile(
      projectId,
      phone.id || phone._id,
      finalProfile,
    );
    setIsSaving(false);
    if (res.error) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Saved',
        description: `Profile for ${phone.display_phone_number || phone.number || 'phone'} updated.`,
      });
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
      toast({
        title: 'Generation Failed',
        description: res.error,
        variant: 'destructive',
      });
    } else if (res.description) {
      setProfile((prev) => ({ ...prev, description: res.description }));
      toast({
        title: 'Success',
        description: 'Business description generated successfully.',
      });
    }
  };

  const fields = [
    { key: 'about', label: 'About', helpText: 'Max 139 characters.' },
    { key: 'description', label: 'Business Description', multiline: true, helpText: 'Max 512 characters. Displayed to users in chat.' },
    { key: 'address', label: 'Address', helpText: 'Physical location of your business. Min 5, Max 256 chars.' },
    { key: 'email', label: 'Email', helpText: 'Max 128 characters.' },
    { key: 'websites', label: 'Websites', helpText: 'Comma separated, maximum 2 URLs (e.g. https://example.com).' },
  ];

  const current = phones[selectedIdx];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Phone number settings</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mt-5">
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Phone number settings
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Manage business profile for each connected phone number.
        </p>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : phones.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Phone />}
            title="No phone numbers connected"
            description="Connect a WhatsApp Business number to manage its profile here."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {phones.map((p, i) => (
              <Button
                key={p.id || i}
                variant={selectedIdx === i ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectPhone(i)}
              >
                <Phone />
                {p.display_phone_number || p.number || `Phone ${i + 1}`}
              </Button>
            ))}
          </div>

          <Card className="mt-4 p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2">
                  <Phone className="h-6 w-6 text-zoru-ink-muted" />
                </span>
                <div>
                  <div className="text-[16px] text-zoru-ink">
                    {current?.display_phone_number || current?.number || '--'}
                  </div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    {current?.verified_name || current?.displayName || ''}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraftDisplayName(
                    current?.verified_name || current?.displayName || '',
                  );
                  setDisplayNameOpen(true);
                }}
              >
                Edit display name
              </Button>
            </div>

            <div className="flex max-w-lg flex-col gap-5">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5 relative">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`pn-${f.key}`}>{f.label}</Label>
                    {f.key === 'description' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[12px] text-zoru-brand"
                        onClick={generateDescription}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                        {isGenerating ? 'Generating...' : 'AI Generate'}
                      </Button>
                    )}
                  </div>
                  {f.multiline ? (
                    <Textarea
                      id={`pn-${f.key}`}
                      value={profile[f.key] || ''}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      rows={4}
                      maxLength={f.key === 'description' ? 512 : undefined}
                    />
                  ) : (
                    <Input
                      id={`pn-${f.key}`}
                      value={profile[f.key] || ''}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      maxLength={
                        f.key === 'about' ? 139 :
                        f.key === 'address' ? 256 :
                        f.key === 'email' ? 128 : undefined
                      }
                    />
                  )}
                  {f.helpText && (
                    <span className="text-[11.5px] text-zoru-ink-muted leading-tight">
                      {f.helpText}
                    </span>
                  )}
                </div>
              ))}
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                  {isSaving ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ── Edit display name dialog ── */}
      <Dialog open={displayNameOpen} onOpenChange={setDisplayNameOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit display name</ZoruDialogTitle>
            <ZoruDialogDescription>
              Update the verified display name shown to your WhatsApp customers.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={draftDisplayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setDisplayNameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: 'Display name updated',
                  description: `Submitted "${draftDisplayName}" for review.`,
                });
                setDisplayNameOpen(false);
              }}
              disabled={!draftDisplayName.trim()}
            >
              Save
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <div className="h-6" />
    </div>
  );
}
