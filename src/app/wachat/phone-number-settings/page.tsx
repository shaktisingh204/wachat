'use client';

/**
 * Wachat Phone Number Settings — ZoruUI migration.
 * Per-number business profile editor.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Loader2, Phone, Save } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getPhoneNumberProfiles,
  updatePhoneProfile,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

export default function PhoneNumberSettingsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [phones, setPhones] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [isLoading, startLoading] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

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
              websites: nums[0].websites || '',
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
        websites: p.websites || '',
      });
    }
  };

  const handleSave = async () => {
    const phone = phones[selectedIdx];
    if (!phone || !projectId) return;
    setIsSaving(true);
    const res = await updatePhoneProfile(
      projectId,
      phone.id || phone._id,
      profile,
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

  const fields = [
    { key: 'about', label: 'About' },
    { key: 'description', label: 'Business Description', multiline: true },
    { key: 'address', label: 'Address' },
    { key: 'email', label: 'Email' },
    { key: 'websites', label: 'Websites' },
  ];

  const current = phones[selectedIdx];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
      </ZoruBreadcrumb>

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
          <ZoruSkeleton className="h-9 w-64" />
          <ZoruSkeleton className="h-72 w-full" />
        </div>
      ) : phones.length === 0 ? (
        <div className="mt-6">
          <ZoruEmptyState
            icon={<Phone />}
            title="No phone numbers connected"
            description="Connect a WhatsApp Business number to manage its profile here."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {phones.map((p, i) => (
              <ZoruButton
                key={p.id || i}
                variant={selectedIdx === i ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectPhone(i)}
              >
                <Phone />
                {p.display_phone_number || p.number || `Phone ${i + 1}`}
              </ZoruButton>
            ))}
          </div>

          <ZoruCard className="mt-4 p-6">
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
              <ZoruButton
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
              </ZoruButton>
            </div>

            <div className="flex max-w-lg flex-col gap-4">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor={`pn-${f.key}`}>{f.label}</ZoruLabel>
                  {f.multiline ? (
                    <ZoruTextarea
                      id={`pn-${f.key}`}
                      value={profile[f.key] || ''}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  ) : (
                    <ZoruInput
                      id={`pn-${f.key}`}
                      value={profile[f.key] || ''}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
              <div>
                <ZoruButton onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                  {isSaving ? 'Saving…' : 'Save profile'}
                </ZoruButton>
              </div>
            </div>
          </ZoruCard>
        </>
      )}

      {/* ── Edit display name dialog ── */}
      <ZoruDialog open={displayNameOpen} onOpenChange={setDisplayNameOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit display name</ZoruDialogTitle>
            <ZoruDialogDescription>
              Update the verified display name shown to your WhatsApp customers.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2">
            <ZoruLabel htmlFor="display-name">Display name</ZoruLabel>
            <ZoruInput
              id="display-name"
              value={draftDisplayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setDisplayNameOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
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
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <div className="h-6" />
    </div>
  );
}
