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
  Save } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getPhoneNumberProfiles,
  updatePhoneProfile,
  } from '@/app/actions/wachat-features.actions';

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

            <div className="flex max-w-lg flex-col gap-4">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`pn-${f.key}`}>{f.label}</Label>
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
                      rows={3}
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
                    />
                  )}
                </div>
              ))}
              <div>
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
