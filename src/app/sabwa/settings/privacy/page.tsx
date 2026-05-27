'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Switch,
  Label,
  Input,
  Separator,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  EmptyState,
} from '@/components/zoruui';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  UserX,
  Plus,
  Loader2,
  Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import * as React from 'react';
import Link from 'next/link';

import { SettingsTabs } from '../_components/settings-tabs';
import {
  getPrivacySettings,
  updatePrivacySettings,
  rotateSessionKey,
  blockContact,
  unblockContact,
  type SabwaPrivacySettings,
  type SabwaVisibility,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';

const VISIBILITY_OPTIONS: { value: SabwaVisibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My contacts' },
  { value: 'nobody', label: 'Nobody' },
];

const TIMER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 86400, label: '24 hours' },
  { value: 604800, label: '7 days' },
  { value: 7776000, label: '90 days' },
];

const DEFAULT_SETTINGS: SabwaPrivacySettings = {
  twoFactorEnabled: false,
  readReceipts: true,
  lastSeen: 'contacts',
  groupAddPolicy: 'contacts',
  profilePicVisibility: 'contacts',
  statusVisibility: 'contacts',
  blocked: [],
  disappearingTimer: 0,
};

export default function PrivacySettingsPage() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const [settings, setSettings] = React.useState<SabwaPrivacySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  const [twoFAOpen, setTwoFAOpen] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [pinConfirm, setPinConfirm] = React.useState('');

  const [blockJid, setBlockJid] = React.useState('');
  const [blockOpen, setBlockOpen] = React.useState(false);

  React.useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPrivacySettings(sessionId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setSettings(res.settings);
      })
      .catch(() => {
        /* Phase 1 stub */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const save = (patch: Partial<Omit<SabwaPrivacySettings, 'blocked'>> & { twoFactorPin?: string }, label: string) => {
    startTransition(async () => {
      try {
        const res = await updatePrivacySettings({ sessionId, patch });
        if (res.ok) {
          toast.success(`${label} saved.`);
        } else {
          toast.error(res.error || 'Save failed');
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const onTwoFASubmit = () => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast.error('PIN must be 6 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      toast.error('PINs do not match.');
      return;
    }
    setSettings((s) => ({ ...s, twoFactorEnabled: true }));
    save({ twoFactorEnabled: true, twoFactorPin: pin }, 'Two-factor authentication');
    setTwoFAOpen(false);
    setPin('');
    setPinConfirm('');
  };

  const onDisable2FA = () => {
    setSettings((s) => ({ ...s, twoFactorEnabled: false }));
    save({ twoFactorEnabled: false }, 'Two-factor authentication');
  };

  const onUnblock = (jid: string) => {
    const prev = settings.blocked;
    const next = prev.filter((b) => b.jid !== jid);
    setSettings((s) => ({ ...s, blocked: next }));
    startTransition(async () => {
      try {
        const res = await unblockContact(sessionId, jid);
        if (res.ok) {
          toast.success('Contact unblocked.');
        } else {
          setSettings((s) => ({ ...s, blocked: prev }));
          toast.error(res.error || 'Unblock failed');
        }
      } catch (e) {
        setSettings((s) => ({ ...s, blocked: prev }));
        toast.error((e as Error).message);
      }
    });
  };

  const onBlockSubmit = () => {
    const v = blockJid.trim();
    if (!v) return;
    const prev = settings.blocked;
    const entry = { jid: v, blockedAt: new Date().toISOString() };
    setSettings((s) => ({ ...s, blocked: [...s.blocked, entry] }));
    setBlockJid('');
    setBlockOpen(false);
    startTransition(async () => {
      try {
        const res = await blockContact(sessionId, v);
        if (res.ok) {
          toast.success('Contact blocked.');
        } else {
          setSettings((s) => ({ ...s, blocked: prev }));
          toast.error(res.error || 'Block failed');
        }
      } catch (e) {
        setSettings((s) => ({ ...s, blocked: prev }));
        toast.error((e as Error).message);
      }
    });
  };

  const onRotate = () => {
    startTransition(async () => {
      try {
        const res = await rotateSessionKey(sessionId);
        if (res.ok) {
          toast.success('Session encryption key rotated.');
        } else {
          toast.error(res.error || 'Rotation failed');
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const visibilityRow = (
    title: string,
    description: string,
    field: keyof Pick<
      SabwaPrivacySettings,
      'lastSeen' | 'groupAddPolicy' | 'profilePicVisibility' | 'statusVisibility'
    >,
  ) => (
    <Card key={field}>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-base">{title}</ZoruCardTitle>
        <ZoruCardDescription>{description}</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="flex flex-wrap items-center gap-3 justify-between">
        <Select
          value={settings[field]}
          onValueChange={(v) => setSettings((s) => ({ ...s, [field]: v as SabwaVisibility }))}
          disabled={loading || pending}
        >
          <ZoruSelectTrigger className="w-56">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {VISIBILITY_OPTIONS.map((o) => (
              <ZoruSelectItem key={o.value} value={o.value}>
                {o.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Button size="sm" onClick={() => save({ [field]: settings[field] } as Partial<SabwaPrivacySettings>, title)} disabled={pending}>
          Save
        </Button>
      </ZoruCardContent>
    </Card>
  );

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-zoru-surface-2 p-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings — Privacy &amp; Security</h1>
          <p className="text-sm text-zoru-ink-muted mt-1">
            Lock down who can see what, who can reach you, and how your session is encrypted.
          </p>
        </div>
      </div>
      <SettingsTabs />

      {/* Two-factor authentication */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Two-factor authentication
          </ZoruCardTitle>
          <ZoruCardDescription>
            Require a 6-digit PIN when registering this phone number on a new device.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={settings.twoFactorEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  setTwoFAOpen(true);
                } else {
                  onDisable2FA();
                }
              }}
              disabled={loading || pending}
              aria-label="Toggle two-factor authentication"
            />
            <Label className="text-sm">
              {settings.twoFactorEnabled ? 'Enabled — PIN required for re-registration.' : 'Disabled'}
            </Label>
          </div>
          {settings.twoFactorEnabled && (
            <Button variant="outline" size="sm" onClick={() => setTwoFAOpen(true)} disabled={pending}>
              Change PIN
            </Button>
          )}
        </ZoruCardContent>
      </Card>

      {/* Blocked contacts */}
      <Card>
        <ZoruCardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <ZoruCardTitle className="flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Blocked contacts
            </ZoruCardTitle>
            <ZoruCardDescription>
              Numbers in this list cannot message or call you on WhatsApp.
            </ZoruCardDescription>
          </div>
          <Button size="sm" onClick={() => setBlockOpen(true)} disabled={pending}>
            <Plus className="mr-2 h-4 w-4" />
            Block contact
          </Button>
        </ZoruCardHeader>
        <ZoruCardContent>
          {settings.blocked.length === 0 ? (
            <p className="text-sm text-zoru-ink-muted">No blocked contacts.</p>
          ) : (
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Contact</ZoruTableHead>
                  <ZoruTableHead>Blocked</ZoruTableHead>
                  <ZoruTableHead className="w-24" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {settings.blocked.map((b) => (
                  <ZoruTableRow key={b.jid}>
                    <ZoruTableCell className="font-mono text-sm">{b.name || b.jid}</ZoruTableCell>
                    <ZoruTableCell className="text-sm text-zoru-ink-muted">
                      {b.blockedAt ? new Date(b.blockedAt).toLocaleDateString() : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUnblock(b.jid)}
                        disabled={pending}
                      >
                        Unblock
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          )}
        </ZoruCardContent>
      </Card>

      {/* Read receipts */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Read receipts</ZoruCardTitle>
          <ZoruCardDescription>
            If turned off, you won&apos;t send or receive read receipts. Group chats always send them.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={settings.readReceipts}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, readReceipts: checked }))
              }
              disabled={loading || pending}
              aria-label="Toggle read receipts"
            />
            <Label className="text-sm">Send read receipts</Label>
          </div>
          <Button size="sm" onClick={() => save({ readReceipts: settings.readReceipts }, 'Read receipts')} disabled={pending}>
            Save
          </Button>
        </ZoruCardContent>
      </Card>

      {/* Visibility selectors */}
      {visibilityRow('Last seen visibility', 'Who can see when you were last online.', 'lastSeen')}
      {visibilityRow('Who can add you to groups', 'Choose who is allowed to add you to WhatsApp groups.', 'groupAddPolicy')}
      {visibilityRow('Profile picture visibility', 'Who can see your profile picture.', 'profilePicVisibility')}
      {visibilityRow('Status visibility', 'Who can see your status updates.', 'statusVisibility')}

      {/* Disappearing messages default timer */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Default message timer</ZoruCardTitle>
          <ZoruCardDescription>
            Start new chats with disappearing messages turned on.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-wrap items-center gap-3 justify-between">
          <Select
            value={settings.disappearingTimer?.toString() || '0'}
            onValueChange={(v) => setSettings((s) => ({ ...s, disappearingTimer: parseInt(v, 10) }))}
            disabled={loading || pending}
          >
            <ZoruSelectTrigger className="w-56">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TIMER_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value.toString()}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => save({ disappearingTimer: settings.disappearingTimer }, 'Default message timer')}
            disabled={pending}
          >
            Save
          </Button>
        </ZoruCardContent>
      </Card>

      {/* E2EE disclaimer */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zoru-ink" />
            End-to-end encryption
          </ZoruCardTitle>
          <ZoruCardDescription>
            Messages, calls, and media you send to other WhatsApp users are protected with the Signal protocol —
            no one outside the chat, not even SabNode or WhatsApp, can read or listen to them. SabNode stores a
            local cache of decrypted messages so the SabWa inbox works; that cache is encrypted at rest with
            your session key.
          </ZoruCardDescription>
        </ZoruCardHeader>
      </Card>

      {/* Session key rotation */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Session encryption key
          </ZoruCardTitle>
          <ZoruCardDescription>
            Rotate the SabNode-side key that wraps this session&apos;s auth state. Existing chats stay intact;
            cached data is re-encrypted in the background.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <Button variant="outline" onClick={onRotate} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Rotate now
          </Button>
        </ZoruCardContent>
      </Card>

      <Separator />

      {/* 2FA setup dialog */}
      <Dialog open={twoFAOpen} onOpenChange={setTwoFAOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Set up two-factor PIN</ZoruDialogTitle>
            <ZoruDialogDescription>
              Choose a 6-digit PIN. You&apos;ll need it whenever you re-register this number on a new device.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pin">6-digit PIN</Label>
              <Input
                id="pin"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-confirm">Confirm PIN</Label>
              <Input
                id="pin-confirm"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                autoComplete="off"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setTwoFAOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onTwoFASubmit} disabled={pending}>
              Save PIN
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Block contact dialog (simple JID input — proper contact picker is a
          shared component slated for the broader Contacts work). */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Block a contact</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter the phone number (E.164) of the contact you want to block.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="block-jid">Phone number</Label>
            <Input
              id="block-jid"
              value={blockJid}
              onChange={(e) => setBlockJid(e.target.value)}
              placeholder="+919876543210"
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onBlockSubmit} disabled={pending}>
              Block
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
