'use client';

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Modal,
  EmptyState,
  Field,
  Input,
  Textarea,
  Skeleton,
  Alert,
  Badge,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Loader2,
  Phone,
  Save,
  Sparkles,
  KeyRound,
  ShieldCheck,
  UploadCloud,
  Copy,
  Check } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import {
  getPhoneNumberProfiles,
  updatePhoneProfile,
  } from '@/app/actions/wachat-features.actions';
import {
  handleSetDisplayName,
  getDisplayNameStatus,
  handleGenerateFlowsEncryption,
  handleUploadFlowsEncryption,
  type DisplayNameStatusResult,
} from '@/app/actions/whatsapp.actions';
import { handleGenerateBusinessDescription } from '@/app/actions/ai-actions';

/**
 * Wachat Phone Number Settings — 20ui migration.
 * Per-number business profile editor.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

/** Map a Meta review-state string to a 20ui Badge tone. */
function statusTone(
  status?: string | null,
): 'success' | 'warning' | 'danger' | 'neutral' {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED' || s === 'AVAILABLE' || s === 'UPLOADED') return 'success';
  if (s.includes('PENDING') || s === 'NOT_UPLOADED') return 'warning';
  if (s.includes('DECLINED') || s.includes('REJECT') || s === 'FAILED') return 'danger';
  return 'neutral';
}

/** Human-friendly label for a review-state string. */
function statusLabel(status?: string | null): string {
  if (!status) return 'Unknown';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PhoneNumberSettingsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
  const [isSubmittingName, setIsSubmittingName] = useState(false);

  // Live display-name review status (per selected number)
  const [nameStatus, setNameStatus] = useState<DisplayNameStatusResult | null>(null);
  const [nameStatusError, setNameStatusError] = useState<string | null>(null);
  const [isLoadingNameStatus, setIsLoadingNameStatus] = useState(false);

  // Flows encryption
  const [flowsPublicKey, setFlowsPublicKey] = useState<string | null>(null);
  const [flowsMetaStatus, setFlowsMetaStatus] = useState<string | null>(null);
  const [flowsError, setFlowsError] = useState<string | null>(null);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [isUploadingKey, setIsUploadingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const fetchPhones = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getPhoneNumberProfiles(pid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            tone: 'danger',
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

  const phoneIdOf = (p: any): string | undefined =>
    (p?.id || p?._id)?.toString();

  const loadNameStatus = useCallback(
    async (pid: string, phoneNumberId: string) => {
      setIsLoadingNameStatus(true);
      setNameStatusError(null);
      const res = await getDisplayNameStatus(pid, phoneNumberId);
      setIsLoadingNameStatus(false);
      if (res.error) {
        setNameStatus(null);
        setNameStatusError(res.error);
      } else {
        setNameStatus(res.status);
      }
    },
    [],
  );

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
    // Reset per-number Wave-E panels so we never show stale state.
    setNameStatus(null);
    setNameStatusError(null);
    setFlowsPublicKey(null);
    setFlowsMetaStatus(null);
    setFlowsError(null);
    setKeyCopied(false);
  };

  // Load the live display-name review status whenever the selected number changes.
  useEffect(() => {
    const phone = phones[selectedIdx];
    const phoneNumberId = phoneIdOf(phone);
    if (projectId && phoneNumberId) {
      void loadNameStatus(projectId, phoneNumberId);
    }
  }, [projectId, phones, selectedIdx, loadNameStatus]);

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
        tone: 'danger',
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
        tone: 'danger',
      });
    } else {
      toast({
        title: 'Saved',
        description: `Profile for ${phone.display_phone_number || phone.number || 'phone'} updated.`,
        tone: 'success',
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
        tone: 'danger',
      });
    } else if (res.description) {
      setProfile((prev) => ({ ...prev, description: res.description }));
      toast({
        title: 'Success',
        description: 'Business description generated successfully.',
        tone: 'success',
      });
    }
  };

  // ── Display name: submit change for review ──
  const submitDisplayName = async () => {
    const phone = phones[selectedIdx];
    const phoneNumberId = phoneIdOf(phone);
    if (!projectId || !phoneNumberId) return;

    setIsSubmittingName(true);
    const res = await handleSetDisplayName(projectId, phoneNumberId, draftDisplayName);
    setIsSubmittingName(false);

    if (!res.success) {
      toast({
        title: 'Could not submit',
        description: res.error || 'Display name change failed.',
        tone: 'danger',
      });
      return;
    }
    toast({
      title: 'Submitted for review',
      description: res.message || `"${draftDisplayName.trim()}" submitted for review.`,
      tone: 'success',
    });
    setDisplayNameOpen(false);
    // Refresh the live status so the pending badge appears immediately.
    void loadNameStatus(projectId, phoneNumberId);
  };

  // ── Flows encryption: generate keypair ──
  const generateFlowsKeys = async () => {
    const phone = phones[selectedIdx];
    const phoneNumberId = phoneIdOf(phone);
    if (!projectId || !phoneNumberId) return;

    setIsGeneratingKeys(true);
    setFlowsError(null);
    const res = await handleGenerateFlowsEncryption(projectId, phoneNumberId);
    setIsGeneratingKeys(false);

    if (!res.success) {
      setFlowsError(res.error || 'Key generation failed.');
      return;
    }
    setFlowsPublicKey(res.publicKey || null);
    setFlowsMetaStatus(res.metaStatus || 'NOT_UPLOADED');
    setKeyCopied(false);
    toast({
      title: 'Keypair generated',
      description: res.message || 'Encryption keypair generated.',
      tone: 'success',
    });
  };

  // ── Flows encryption: upload public key to Meta ──
  const uploadFlowsKey = async () => {
    const phone = phones[selectedIdx];
    const phoneNumberId = phoneIdOf(phone);
    if (!projectId || !phoneNumberId) return;

    setIsUploadingKey(true);
    setFlowsError(null);
    const res = await handleUploadFlowsEncryption(projectId, phoneNumberId);
    setIsUploadingKey(false);

    if (!res.success) {
      setFlowsError(res.error || 'Upload to Meta failed.');
      setFlowsMetaStatus('FAILED');
      return;
    }
    setFlowsMetaStatus(res.metaStatus || 'UPLOADED');
    toast({
      title: 'Uploaded to Meta',
      description: res.message || 'Public key uploaded to Meta.',
      tone: 'success',
    });
  };

  const copyPublicKey = async () => {
    if (!flowsPublicKey) return;
    try {
      await navigator.clipboard.writeText(flowsPublicKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy the public key to the clipboard.',
        tone: 'danger',
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Phone number settings' },
      ]}
      title="Phone number settings"
      description="Manage business profile for each connected phone number."
      width="narrow"
    >
      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton height={36} width={256} radius="var(--st-radius)" />
          <Skeleton height={288} width="100%" radius="var(--st-radius-lg)" />
        </div>
      ) : phones.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No phone numbers connected"
          description="Connect a WhatsApp Business number to manage its profile here."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {phones.map((p, i) => (
              <Button
                key={p.id || i}
                variant={selectedIdx === i ? 'primary' : 'outline'}
                size="sm"
                iconLeft={Phone}
                onClick={() => selectPhone(i)}
              >
                {p.display_phone_number || p.number || `Phone ${i + 1}`}
              </Button>
            ))}
          </div>

          <Card className="mt-4" padding="lg">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-secondary)]">
                    <Phone className="h-6 w-6 text-[color:var(--st-text-secondary)]" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-[16px] text-[color:var(--st-text)]">
                      {current?.display_phone_number || current?.number || '--'}
                    </div>
                    <div className="text-[12px] text-[color:var(--st-text-secondary)]">
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
            </CardHeader>

            <CardBody>
              <div className="flex max-w-lg flex-col gap-5">
                {fields.map((f) => (
                  f.key === 'description' ? (
                    <div key={f.key} className="flex flex-col gap-1.5 relative">
                      <div className="flex items-center justify-between">
                        <label htmlFor={`pn-${f.key}`} className="text-[13px] text-[color:var(--st-text)]">
                          {f.label}
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          iconLeft={isGenerating ? undefined : Sparkles}
                          onClick={generateDescription}
                          disabled={isGenerating}
                        >
                          {isGenerating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                          {isGenerating ? 'Generating...' : 'AI Generate'}
                        </Button>
                      </div>
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
                        maxLength={512}
                      />
                      {f.helpText && (
                        <span className="text-[11.5px] leading-tight text-[color:var(--st-text-tertiary)]">
                          {f.helpText}
                        </span>
                      )}
                    </div>
                  ) : (
                    <Field key={f.key} label={f.label} help={f.helpText} id={`pn-${f.key}`}>
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
                    </Field>
                  )
                ))}
                <div className="pt-2">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={isSaving}
                    iconLeft={isSaving ? undefined : Save}
                  >
                    {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                    {isSaving ? 'Saving…' : 'Save profile'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* ── Edit display name dialog ── */}
      <Modal
        open={displayNameOpen}
        onClose={() => setDisplayNameOpen(false)}
        title="Edit display name"
        description="Update the verified display name shown to your WhatsApp customers."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisplayNameOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast({
                  title: 'Display name updated',
                  description: `Submitted "${draftDisplayName}" for review.`,
                  tone: 'success',
                });
                setDisplayNameOpen(false);
              }}
              disabled={!draftDisplayName.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Display name" id="display-name">
          <Input
            id="display-name"
            value={draftDisplayName}
            onChange={(e) => setDraftDisplayName(e.target.value)}
            placeholder="Acme Inc."
          />
        </Field>
      </Modal>
    </WachatPage>
  );
}
