'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  ScrollArea,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
  } from 'lucide-react';

/**
 * SabWa Group Manager — single-group admin console (SABWA_PLAN.md §6 page 8).
 *
 * Sections (segmented Button — no tab UI, per ZoruUI directive):
 *   1. Members      — table with promote / demote / remove, add by phone,
 *                     bulk-select for "Bulk DM" wizard.
 *   2. Info         — subject / description / icon (SabFilePickerButton).
 *   3. Permissions  — announcement (admins-only send) + restrict (admins-only edit).
 *   4. Invite link  — copyable URL + QR + revoke/regenerate (confirm dialog).
 *   5. Pending      — community-group join requests (approve / deny).
 *   6. Export       — member-list CSV download.
 *
 * Confirm dialogs for destructive actions: remove member, revoke link,
 * demote super-admin.
 *
 * ZoruUI migration — visual swap only; data flow, server actions and
 * prop shapes are unchanged.
 */

import * as React from 'react';
import Link from 'next/link';

import { SabFilePickerButton } from '@/components/sabfiles';

import {
  getGroup,
  getInviteCode,
  updateGroup,
  updateGroupParticipants,
  type SabwaGroupDetail,
  type SabwaGroupParticipantDto,
  type SabwaGroupPatch,
} from '@/app/actions/sabwa.actions';
import {
  formatJid,
  useResolveJid,
  type JidResolver,
} from '@/lib/sabwa/format-jid';
import { useSabwaSession } from '@/lib/sabwa/session-context';

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadMembersCsv(group: SabwaGroupDetail) {
  const header = ['jid', 'name', 'role', 'joinedAt'];
  const rows = group.participants.map((p) => [
    p.jid,
    p.name ?? '',
    p.isSuperAdmin ? 'super_admin' : p.isAdmin ? 'admin' : 'member',
    p.joinedAt ? new Date(p.joinedAt).toISOString() : '',
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((v) => csvEscape(String(v))).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${group.subject || 'group'}-members.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Section keys (replaces Tabs) ───────────────────────────────────────────

type SectionKey =
  | 'members'
  | 'info'
  | 'permissions'
  | 'invite'
  | 'pending'
  | 'export';

interface SectionDef {
  key: SectionKey;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// ─── Add members dialog ─────────────────────────────────────────────────────

interface AddMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  groupJid: string;
  onDone: () => void;
}

function AddMembersDialog({
  open,
  onOpenChange,
  sessionId,
  groupJid,
  onDone,
}: AddMembersDialogProps) {
  const { toast } = useZoruToast();
  const [input, setInput] = React.useState('');
  const [jids, setJids] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setInput('');
      setJids([]);
    }
  }, [open]);

  const add = React.useCallback(() => {
    const trimmed = input.trim().replace(/[^0-9+]/g, '');
    if (!trimmed) return;
    setJids((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setInput('');
  }, [input]);

  const remove = React.useCallback((j: string) => {
    setJids((prev) => prev.filter((x) => x !== j));
  }, []);

  const onSubmit = React.useCallback(async () => {
    if (jids.length === 0) {
      toast({ title: 'Add at least one number', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateGroupParticipants({
        sessionId,
        groupJid,
        op: 'add',
        jids,
      });
      if (res.ok) {
        toast({ title: `Adding ${jids.length} member(s)…` });
        onDone();
        onOpenChange(false);
      } else {
        toast({
          title: 'Failed to add members',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Failed to add members',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, groupJid, jids, onDone, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Add members</ZoruDialogTitle>
          <ZoruDialogDescription>
            Paste phone numbers in E.164 format. Press Enter to add each one.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="+919876543210"
              autoFocus
            />
            <Button type="button" onClick={add}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {jids.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {jids.map((j) => (
                <Badge
                  key={j}
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => remove(j)}
                >
                  {j}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
        </div>
        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting || jids.length === 0}>
            {submitting ? 'Adding…' : `Add ${jids.length} member(s)`}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

// ─── Confirm dialog (generic) ───────────────────────────────────────────────

interface ConfirmState {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

// ─── Members table ──────────────────────────────────────────────────────────

interface MembersTabProps {
  group: SabwaGroupDetail;
  sessionId: string;
  selected: Set<string>;
  onToggleSelected: (jid: string) => void;
  onToggleAll: () => void;
  onAddMembers: () => void;
  onBulkDm: () => void;
  refresh: () => void;
  requestConfirm: (state: ConfirmState) => void;
  resolve: JidResolver;
}

function MembersTab({
  group,
  sessionId,
  selected,
  onToggleSelected,
  onToggleAll,
  onAddMembers,
  onBulkDm,
  refresh,
  requestConfirm,
  resolve,
}: MembersTabProps) {
  const { toast } = useZoruToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  const runParticipantOp = React.useCallback(
    async (
      op: 'add' | 'remove' | 'promote' | 'demote',
      jid: string,
      successMsg: string,
    ) => {
      setBusy(jid);
      try {
        const res = await updateGroupParticipants({
          sessionId,
          groupJid: group.jid,
          op,
          jids: [jid],
        });
        if (res.ok) {
          toast({ title: successMsg });
          refresh();
        } else {
          toast({
            title: 'Action failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      } catch (err) {
        toast({
          title: 'Action failed',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      } finally {
        setBusy(null);
      }
    },
    [sessionId, group.jid, refresh, toast],
  );

  const onPromote = React.useCallback(
    (p: SabwaGroupParticipantDto) =>
      runParticipantOp('promote', p.jid, `${p.name?.trim() || resolve(p.jid)} promoted`),
    [runParticipantOp, resolve],
  );

  const onDemote = React.useCallback(
    (p: SabwaGroupParticipantDto) => {
      const label = p.name?.trim() || resolve(p.jid);
      if (p.isSuperAdmin) {
        requestConfirm({
          title: 'Demote super-admin?',
          description: `${label} is the group creator. Demoting them is unusual and may not be reversible from WhatsApp.`,
          confirmLabel: 'Demote',
          destructive: true,
          onConfirm: () => runParticipantOp('demote', p.jid, 'Member demoted'),
        });
      } else {
        runParticipantOp('demote', p.jid, 'Member demoted');
      }
    },
    [runParticipantOp, requestConfirm, resolve],
  );

  const onRemove = React.useCallback(
    (p: SabwaGroupParticipantDto) => {
      const label = p.name?.trim() || resolve(p.jid);
      requestConfirm({
        title: 'Remove member?',
        description: `${label} will be removed from "${group.subject}".`,
        confirmLabel: 'Remove',
        destructive: true,
        onConfirm: () => runParticipantOp('remove', p.jid, 'Member removed'),
      });
    },
    [runParticipantOp, requestConfirm, group.subject, resolve],
  );

  const allSelected =
    group.participants.length > 0 && selected.size === group.participants.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-zoru-ink-muted">
          {group.participants.length} member{group.participants.length === 1 ? '' : 's'}
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onBulkDm}
            disabled={selected.size === 0}
          >
            <Send />
            Bulk DM ({selected.size})
          </Button>
          <Button onClick={onAddMembers}>
            <UserPlus />
            Add members
          </Button>
        </div>
      </div>

      <Card>
        <div className="hidden md:block">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleAll}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Member</ZoruTableHead>
                <ZoruTableHead>Role</ZoruTableHead>
                <ZoruTableHead>Joined</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {group.participants.map((p) => {
                const role = p.isSuperAdmin ? 'Super admin' : p.isAdmin ? 'Admin' : 'Member';
                const displayName = p.name?.trim() || resolve(p.jid);
                return (
                  <ZoruTableRow key={p.jid}>
                    <ZoruTableCell>
                      <Checkbox
                        checked={selected.has(p.jid)}
                        onCheckedChange={() => onToggleSelected(p.jid)}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {p.profilePicUrl ? <ZoruAvatarImage src={p.profilePicUrl} alt="" /> : null}
                          <ZoruAvatarFallback>{initials(displayName)}</ZoruAvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zoru-ink">
                            {displayName}
                          </div>
                          <div className="truncate text-xs text-zoru-ink-muted">
                            {formatJid(p.jid)}
                          </div>
                        </div>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={p.isAdmin ? 'secondary' : 'outline'}>{role}</Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">
                      {formatDate(p.joinedAt)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.isAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDemote(p)}
                            disabled={busy === p.jid}
                          >
                            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                            Demote
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPromote(p)}
                            disabled={busy === p.jid}
                          >
                            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                            Promote
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-zoru-danger hover:text-zoru-danger"
                          onClick={() => onRemove(p)}
                          disabled={busy === p.jid}
                        >
                          <UserMinus className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </Table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden">
          <ScrollArea className="max-h-[60vh]">
            <div className="divide-y divide-zoru-line">
              {group.participants.map((p) => {
                const role = p.isSuperAdmin ? 'Super admin' : p.isAdmin ? 'Admin' : 'Member';
                const displayName = p.name?.trim() || resolve(p.jid);
                return (
                  <div key={p.jid} className="flex items-center gap-3 p-3">
                    <Checkbox
                      checked={selected.has(p.jid)}
                      onCheckedChange={() => onToggleSelected(p.jid)}
                    />
                    <Avatar className="h-9 w-9">
                      {p.profilePicUrl ? <ZoruAvatarImage src={p.profilePicUrl} alt="" /> : null}
                      <ZoruAvatarFallback>{initials(displayName)}</ZoruAvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zoru-ink">{displayName}</div>
                      <div className="truncate text-xs text-zoru-ink-muted">{formatJid(p.jid)}</div>
                      <Badge variant="outline" className="mt-1">
                        {role}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => (p.isAdmin ? onDemote(p) : onPromote(p))}
                      aria-label={p.isAdmin ? 'Demote' : 'Promote'}
                      disabled={busy === p.jid}
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-zoru-danger"
                      onClick={() => onRemove(p)}
                      aria-label="Remove"
                      disabled={busy === p.jid}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}

// ─── Info tab ───────────────────────────────────────────────────────────────

interface InfoTabProps {
  group: SabwaGroupDetail;
  sessionId: string;
  refresh: () => void;
}

function InfoTab({ group, sessionId, refresh }: InfoTabProps) {
  const { toast } = useZoruToast();
  const [subject, setSubject] = React.useState(group.subject);
  const [description, setDescription] = React.useState(group.description ?? '');
  const [iconUrl, setIconUrl] = React.useState(group.iconUrl ?? '');
  const [ephemeralEnabled, setEphemeralEnabled] = React.useState(
    Boolean(group.ephemeralDuration),
  );
  const [submitting, setSubmitting] = React.useState(false);

  // Sync local state when group reloads.
  React.useEffect(() => {
    setSubject(group.subject);
    setDescription(group.description ?? '');
    setIconUrl(group.iconUrl ?? '');
    setEphemeralEnabled(Boolean(group.ephemeralDuration));
  }, [group]);

  const onSave = React.useCallback(async () => {
    setSubmitting(true);
    try {
      const patch: SabwaGroupPatch = {
        subject: subject !== group.subject ? subject : undefined,
        description:
          description !== (group.description ?? '') ? description : undefined,
        iconUrl: iconUrl !== (group.iconUrl ?? '') ? iconUrl : undefined,
        ephemeralDuration: ephemeralEnabled ? 7 * 24 * 3600 : 0,
      };
      const res = await updateGroup({
        sessionId,
        groupJid: group.jid,
        patch,
      });
      if (res.ok) {
        toast({ title: 'Group info saved' });
        refresh();
      } else {
        toast({
          title: 'Could not save group',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Could not save group',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    sessionId,
    group.jid,
    group.subject,
    group.description,
    group.iconUrl,
    subject,
    description,
    iconUrl,
    ephemeralEnabled,
    refresh,
    toast,
  ]);

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-base">Group identity</ZoruCardTitle>
        <ZoruCardDescription>Subject, description, icon and disappearing-message timer.</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-16 w-16">
            {iconUrl ? <ZoruAvatarImage src={iconUrl} alt="" /> : null}
            <ZoruAvatarFallback>
              <ImageIcon className="h-6 w-6 text-zoru-ink-muted" />
            </ZoruAvatarFallback>
          </Avatar>
          {/*
            SabFilePickerButton sources files from SabFiles per the
            project-wide SabFiles policy. It still routes through the
            shadcn Button variants internally; visual parity with ZoruUI
            is acceptable here since the component is consumed as-is.
          */}
          <SabFilePickerButton
            accept="image"
            variant="outline"
            onPick={(pick) => setIconUrl(pick.url)}
          >
            Change icon
          </SabFilePickerButton>
          {iconUrl ? (
            <Button variant="ghost" size="sm" onClick={() => setIconUrl('')}>
              Remove
            </Button>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grp-subject">Subject</Label>
          <Input
            id="grp-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grp-desc">Description</Label>
          <Textarea
            id="grp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
        <div className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line p-3">
          <div>
            <div className="text-sm font-medium text-zoru-ink">Disappearing messages</div>
            <div className="text-xs text-zoru-ink-muted">
              Messages auto-delete after 7 days.
            </div>
          </div>
          <Switch
            checked={ephemeralEnabled}
            onCheckedChange={setEphemeralEnabled}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </ZoruCardContent>
    </Card>
  );
}

// ─── Permissions tab ────────────────────────────────────────────────────────

function PermissionsTab({
  group,
  sessionId,
  refresh,
}: {
  group: SabwaGroupDetail;
  sessionId: string;
  refresh: () => void;
}) {
  const { toast } = useZoruToast();
  const [busy, setBusy] = React.useState(false);

  const applyPatch = React.useCallback(
    async (patch: SabwaGroupPatch, msg: string) => {
      setBusy(true);
      try {
        const res = await updateGroup({
          sessionId,
          groupJid: group.jid,
          patch,
        });
        if (res.ok) {
          toast({ title: msg });
          refresh();
        } else {
          toast({
            title: 'Could not update',
            description: res.error,
            variant: 'destructive',
          });
        }
      } catch (err) {
        toast({
          title: 'Could not update',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      } finally {
        setBusy(false);
      }
    },
    [sessionId, group.jid, refresh, toast],
  );

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-base">Permissions</ZoruCardTitle>
        <ZoruCardDescription>Control who can send messages and edit info.</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zoru-ink">Who can send messages</div>
            <div className="text-xs text-zoru-ink-muted">
              {group.announcement ? 'Only admins' : 'All participants'}
            </div>
          </div>
          <Switch
            checked={group.announcement}
            disabled={busy}
            onCheckedChange={(v) =>
              applyPatch({ announcement: v }, v ? 'Now admins-only send' : 'All can send now')
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zoru-ink">Who can edit group info</div>
            <div className="text-xs text-zoru-ink-muted">
              {group.restrict ? 'Only admins' : 'All participants'}
            </div>
          </div>
          <Switch
            checked={group.restrict}
            disabled={busy}
            onCheckedChange={(v) =>
              applyPatch({ restrict: v }, v ? 'Locked to admins' : 'Anyone can edit')
            }
          />
        </div>
      </ZoruCardContent>
    </Card>
  );
}

// ─── Invite link tab ────────────────────────────────────────────────────────

function InviteLinkTab({
  group,
  sessionId,
  requestConfirm,
  refresh,
}: {
  group: SabwaGroupDetail;
  sessionId: string;
  requestConfirm: (state: ConfirmState) => void;
  refresh: () => void;
}) {
  const { toast } = useZoruToast();
  const [code, setCode] = React.useState<string | null>(group.inviteCode ?? null);
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setCode(group.inviteCode ?? null);
  }, [group.inviteCode]);

  const url = code ? `https://chat.whatsapp.com/${code}` : null;

  const fetchCode = React.useCallback(
    async (revoke = false) => {
      setBusy(true);
      try {
        const res = await getInviteCode({
          sessionId,
          groupJid: group.jid,
          revoke,
        });
        if (res.ok) {
          setCode(res.code);
          toast({ title: revoke ? 'Invite link revoked & regenerated' : 'Invite link refreshed' });
          refresh();
        } else {
          toast({
            title: 'Could not fetch invite link',
            description: res.error,
            variant: 'destructive',
          });
        }
      } catch (err) {
        toast({
          title: 'Could not fetch invite link',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      } finally {
        setBusy(false);
      }
    },
    [sessionId, group.jid, refresh, toast],
  );

  const onCopy = React.useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }, [url, toast]);

  const onRevoke = React.useCallback(() => {
    requestConfirm({
      title: 'Revoke invite link?',
      description: 'The current link will stop working immediately and a new one will be generated.',
      confirmLabel: 'Revoke & regenerate',
      destructive: true,
      onConfirm: () => fetchCode(true),
    });
  }, [fetchCode, requestConfirm]);

  const qrUrl = url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`
    : null;

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-base">Invite link</ZoruCardTitle>
        <ZoruCardDescription>Share this link to let people join the group.</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-3">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-2">
            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-2 text-zoru-ink">
              <Link2 className="h-4 w-4" />
            </div>
            <Input value={url ?? 'No invite link yet'} readOnly className="font-mono text-xs" />
            <Button variant="outline" onClick={onCopy} disabled={!url}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt="Group invite QR code"
              width={120}
              height={120}
              className="rounded-[var(--zoru-radius)] border border-zoru-line"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fetchCode(false)} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1.5 h-4 w-4" />}
            {code ? 'Refresh' : 'Generate'}
          </Button>
          <Button variant="destructive" onClick={onRevoke} disabled={busy || !code}>
            <Trash2 />
            Revoke & regenerate
          </Button>
        </div>
      </ZoruCardContent>
    </Card>
  );
}

// ─── Pending requests tab ───────────────────────────────────────────────────

function PendingTab({
  group,
  sessionId,
  refresh,
  resolve,
}: {
  group: SabwaGroupDetail;
  sessionId: string;
  refresh: () => void;
  resolve: JidResolver;
}) {
  const { toast } = useZoruToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  const decide = React.useCallback(
    async (jid: string, approve: boolean) => {
      setBusy(jid);
      try {
        const res = await updateGroupParticipants({
          sessionId,
          groupJid: group.jid,
          op: approve ? 'add' : 'remove',
          jids: [jid],
        });
        if (res.ok) {
          toast({ title: approve ? 'Request approved' : 'Request denied' });
          refresh();
        } else {
          toast({
            title: 'Action failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      } finally {
        setBusy(null);
      }
    },
    [sessionId, group.jid, refresh, toast],
  );

  const pending = group.pendingRequests ?? [];

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-base">Pending join requests</ZoruCardTitle>
        <ZoruCardDescription>
          {group.isCommunity
            ? 'Community sub-groups can require approval before someone joins.'
            : 'This group does not have a pending-request queue.'}
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        {pending.length === 0 ? (
          <p className="py-4 text-center text-sm text-zoru-ink-muted">
            No pending requests.
          </p>
        ) : (
          <div className="divide-y divide-zoru-line">
            {pending.map((req) => {
              const displayName = resolve(req.jid);
              return (
              <div key={req.jid} className="flex items-center gap-3 py-2">
                <Avatar className="h-8 w-8">
                  <ZoruAvatarFallback>{initials(displayName)}</ZoruAvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zoru-ink">{displayName}</div>
                  <div className="text-xs text-zoru-ink-muted">
                    {formatJid(req.jid)} · Requested {formatDate(req.requestedAt)}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => decide(req.jid, true)}
                  disabled={busy === req.jid}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zoru-danger"
                  onClick={() => decide(req.jid, false)}
                  disabled={busy === req.jid}
                >
                  Deny
                </Button>
              </div>
              );
            })}
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}

// ─── Export tab ─────────────────────────────────────────────────────────────

function ExportTab({ group }: { group: SabwaGroupDetail }) {
  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="text-base">Export member list</ZoruCardTitle>
        <ZoruCardDescription>
          Downloads a CSV of all current participants.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        <Button onClick={() => downloadMembersCsv(group)}>
          <Download />
          Export CSV ({group.participants.length})
        </Button>
      </ZoruCardContent>
    </Card>
  );
}

// ─── Top-level client ───────────────────────────────────────────────────────

export function GroupManagerClient({ groupJid }: { groupJid: string }) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const { current } = useSabwaSession();
  const sessionId = current?.id ?? null;
  const resolve = useResolveJid(sessionId);

  const [group, setGroup] = React.useState<SabwaGroupDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [addOpen, setAddOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);

  // Segmented section state (replaces shadcn Tabs).
  const [section, setSection] = React.useState<SectionKey>('members');

  const fetchGroup = React.useCallback(async () => {
    if (!sessionId) {
      setGroup(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getGroup({ sessionId, groupJid });
      if (res.ok) {
        setGroup(res.group);
      } else {
        setLoadError(res.error);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId, groupJid]);

  React.useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const toggleSelected = React.useCallback((jid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  }, []);

  const toggleAllSelected = React.useCallback(() => {
    setSelected((prev) => {
      if (!group) return prev;
      if (prev.size === group.participants.length) return new Set();
      return new Set(group.participants.map((p) => p.jid));
    });
  }, [group]);

  const onBulkDm = React.useCallback(() => {
    if (selected.size === 0) return;
    const jids = Array.from(selected).join(',');
    router.push(`/sabwa/bulk?recipients=${encodeURIComponent(jids)}`);
  }, [router, selected]);

  // Segmented nav definition. `pending` is included only for community groups.
  const sections = React.useMemo<SectionDef[]>(() => {
    const base: SectionDef[] = [
      { key: 'members', label: 'Members', Icon: Users },
      { key: 'info', label: 'Info', Icon: Settings },
      { key: 'permissions', label: 'Permissions', Icon: ShieldCheck },
      { key: 'invite', label: 'Invite link', Icon: Link2 },
    ];
    if (group?.isCommunity) {
      base.push({ key: 'pending', label: 'Pending', Icon: MessageSquare });
    }
    base.push({ key: 'export', label: 'Export', Icon: Download });
    return base;
  }, [group?.isCommunity]);

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-3 px-4 pt-6 pb-10 md:px-6 lg:px-8">
        <Breadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/sabwa/groups">Groups</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Manage</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>
        <Button variant="ghost" asChild className="-ml-2">
          <Link href="/sabwa/groups">
            <ArrowLeft />
            Back to groups
          </Link>
        </Button>
        <Card>
          <ZoruCardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-zoru-ink-muted">
              Connect a SabWa session to manage groups.
            </p>
            <Button asChild>
              <Link href="/sabwa/connect">Connect now</Link>
            </Button>
          </ZoruCardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 px-4 pt-6 pb-10 md:px-6 lg:px-8">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa/groups">Groups</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>
              {group?.subject ? `${group.subject} · Manage` : 'Manage'}
            </ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild className="-ml-2">
          <Link href="/sabwa/groups">
            <ArrowLeft />
            Back to groups
          </Link>
        </Button>
      </div>

      {loadError ? (
        <Card>
          <ZoruCardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-zoru-danger">{loadError}</p>
            <Button variant="outline" onClick={fetchGroup}>
              Retry
            </Button>
          </ZoruCardContent>
        </Card>
      ) : loading || !group ? (
        <Card>
          <ZoruCardContent className="flex items-center justify-center gap-2 py-12 text-sm text-zoru-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading group…
          </ZoruCardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <Avatar className="h-14 w-14">
              {group.iconUrl ? <ZoruAvatarImage src={group.iconUrl} alt="" /> : null}
              <ZoruAvatarFallback>{initials(group.subject || '#')}</ZoruAvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[24px] font-semibold leading-[1.15] tracking-[-0.015em] text-zoru-ink">
                {group.subject}
              </h1>
              <p className="truncate text-xs text-zoru-ink-muted">{formatJid(group.jid)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {group.participants.length}
                </Badge>
                {group.announcement ? (
                  <Badge variant="outline">Announcement only</Badge>
                ) : null}
                {group.restrict ? (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                ) : null}
                {group.category ? (
                  <Badge variant="outline">{group.category}</Badge>
                ) : null}
              </div>
            </div>
          </div>

          {/*
            Segmented section nav. ZoruUI intentionally omits a tab
            primitive — we render a flat row of ZoruButtons with the
            active variant set to `default` and inactive to `outline`.
          */}
          <div
            role="tablist"
            aria-label="Group manager sections"
            className="flex w-full flex-wrap gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-1"
          >
            {sections.map(({ key, label, Icon }) => {
              const active = section === key;
              return (
                <Button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSection(key)}
                  className={cn(!active && 'text-zoru-ink-muted hover:text-zoru-ink')}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              );
            })}
          </div>

          <div className="pt-1">
            {section === 'members' ? (
              <MembersTab
                group={group}
                sessionId={sessionId}
                selected={selected}
                onToggleSelected={toggleSelected}
                onToggleAll={toggleAllSelected}
                onAddMembers={() => setAddOpen(true)}
                onBulkDm={onBulkDm}
                refresh={fetchGroup}
                requestConfirm={setConfirm}
                resolve={resolve}
              />
            ) : null}
            {section === 'info' ? (
              <InfoTab group={group} sessionId={sessionId} refresh={fetchGroup} />
            ) : null}
            {section === 'permissions' ? (
              <PermissionsTab group={group} sessionId={sessionId} refresh={fetchGroup} />
            ) : null}
            {section === 'invite' ? (
              <InviteLinkTab
                group={group}
                sessionId={sessionId}
                requestConfirm={setConfirm}
                refresh={fetchGroup}
              />
            ) : null}
            {section === 'pending' && group.isCommunity ? (
              <PendingTab
                group={group}
                sessionId={sessionId}
                refresh={fetchGroup}
                resolve={resolve}
              />
            ) : null}
            {section === 'export' ? <ExportTab group={group} /> : null}
          </div>

          <AddMembersDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            sessionId={sessionId}
            groupJid={group.jid}
            onDone={fetchGroup}
          />
        </>
      )}

      <ZoruAlertDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>{confirm?.title}</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>{confirm?.description}</ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              className={cn(
                confirm?.destructive && 'bg-zoru-danger text-zoru-danger-foreground hover:bg-zoru-danger/90',
              )}
              onClick={async () => {
                const state = confirm;
                setConfirm(null);
                if (state) await state.onConfirm();
              }}
            >
              {confirm?.confirmLabel ?? 'Confirm'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
