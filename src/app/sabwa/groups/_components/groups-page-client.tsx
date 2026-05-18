'use client';

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruScrollArea,
  ZoruScrollBar,
  ZoruSkeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import {
  BellOff,
  ChevronRight,
  ExternalLink,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  Volume2,
  } from 'lucide-react';

/**
 * SabWa Groups — list page client (SABWA_PLAN.md §6 page 6).
 *
 * - Top toolbar: search + "New group".
 * - Category strip (horizontally scrollable) with "All" / "Uncategorised" /
 *   each user-defined category. Active pill drives `?category=` re-fetch.
 * - Grid of group cards with subject, member count, admin / announcement
 *   badges, mute icon, last-activity timestamp.
 * - Right-click / long-press → context menu (Open chat / Manage /
 *   Mute / Leave). Drag a card onto a category pill → setGroupCategory.
 * - "New group" dialog: subject + contact-searcher → createGroup.
 *
 * All server side-effects are routed through `@/app/actions/sabwa.actions`.
 *
 * ZoruUI migration — visual swap only; data flow, server actions and
 * prop shapes are unchanged.
 */

import * as React from 'react';
import Link from 'next/link';

import {
  createGroup,
  listGroupCategories,
  listGroups,
  setGroupCategory,
  type SabwaGroupCategory,
  type SabwaGroupSummary,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import { useResolveJid, type JidResolver } from '@/lib/sabwa/format-jid';

// ─── Helpers ────────────────────────────────────────────────────────────────

const UNCATEGORISED = '__uncategorised__';

function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── New group dialog ───────────────────────────────────────────────────────

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  onCreated: () => void;
}

function NewGroupDialog({
  open,
  onOpenChange,
  sessionId,
  onCreated,
}: NewGroupDialogProps) {
  const { toast } = useZoruToast();
  const [subject, setSubject] = React.useState('');
  const [phoneInput, setPhoneInput] = React.useState('');
  const [participants, setParticipants] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setSubject('');
      setPhoneInput('');
      setParticipants([]);
    }
  }, [open]);

  const addParticipant = React.useCallback(() => {
    const trimmed = phoneInput.trim().replace(/[^0-9+]/g, '');
    if (!trimmed) return;
    setParticipants((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setPhoneInput('');
  }, [phoneInput]);

  const removeParticipant = React.useCallback((p: string) => {
    setParticipants((prev) => prev.filter((x) => x !== p));
  }, []);

  const onSubmit = React.useCallback(async () => {
    if (!sessionId) {
      toast({
        title: 'No active SabWa session',
        description: 'Connect a WhatsApp device first.',
        variant: 'destructive',
      });
      return;
    }
    if (!subject.trim()) {
      toast({ title: 'Subject is required', variant: 'destructive' });
      return;
    }
    if (participants.length === 0) {
      toast({ title: 'Add at least one participant', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await createGroup({
        sessionId,
        subject: subject.trim(),
        participants,
      });
      if (res.ok) {
        toast({ title: 'Group queued for creation' });
        onCreated();
        onOpenChange(false);
      } else {
        toast({
          title: 'Failed to create group',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Failed to create group',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, subject, participants, toast, onCreated, onOpenChange]);

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>New group</ZoruDialogTitle>
          <ZoruDialogDescription>
            Create a WhatsApp group with the selected participants.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="new-group-subject">Subject</ZoruLabel>
            <ZoruInput
              id="new-group-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Group name"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="new-group-participants">Participants</ZoruLabel>
            <ZoruCommand className="rounded-[var(--zoru-radius)] border border-zoru-line">
              <ZoruCommandInput
                placeholder="Type a phone number (E.164) and press Enter"
                value={phoneInput}
                onValueChange={setPhoneInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addParticipant();
                  }
                }}
              />
              <ZoruCommandList>
                <ZoruCommandEmpty>Type a phone number to add it.</ZoruCommandEmpty>
                {phoneInput.trim().length > 0 && (
                  <ZoruCommandGroup heading="Add">
                    <ZoruCommandItem onSelect={addParticipant}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add {phoneInput.trim()}
                    </ZoruCommandItem>
                  </ZoruCommandGroup>
                )}
              </ZoruCommandList>
            </ZoruCommand>
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {participants.map((p) => (
                  <ZoruBadge
                    key={p}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeParticipant(p)}
                  >
                    {p}
                    <span className="ml-1 text-zoru-ink-muted">×</span>
                  </ZoruBadge>
                ))}
              </div>
            )}
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create group'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

// ─── Group card ─────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: SabwaGroupSummary;
  onDragStart: (jid: string) => void;
  onContextAction: (action: ContextAction, jid: string) => void;
  resolve: JidResolver;
}

type ContextAction = 'open' | 'manage' | 'mute' | 'leave';

const GroupCard = React.memo(function GroupCard({
  group,
  onDragStart,
  onContextAction,
  resolve,
}: GroupCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContextMenu = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(true);
  }, []);

  const handleTouchStart = React.useCallback(() => {
    longPressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const onOpenChat = React.useCallback(() => {
    router.push(`/sabwa/inbox?jid=${encodeURIComponent(group.jid)}`);
  }, [group.jid, router]);

  const handleDragStart = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/sabwa-group-jid', group.jid);
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(group.jid);
    },
    [group.jid, onDragStart],
  );

  const displayName = group.subject?.trim() || resolve(group.jid);

  return (
    <ZoruDropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <div
        draggable
        onDragStart={handleDragStart}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <ZoruCard className="cursor-pointer transition hover:shadow-[var(--zoru-shadow-md)] focus-within:ring-2 focus-within:ring-zoru-ink">
          <ZoruCardContent className="p-4">
            <div className="flex items-start gap-3">
              <ZoruAvatar className="h-12 w-12 shrink-0">
                {group.profilePicUrl ? (
                  <ZoruAvatarImage src={group.profilePicUrl} alt="" />
                ) : null}
                <ZoruAvatarFallback>{initials(displayName || '#')}</ZoruAvatarFallback>
              </ZoruAvatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 truncate text-left text-base font-semibold text-zoru-ink hover:underline"
                    onClick={onOpenChat}
                    title={displayName}
                  >
                    {displayName}
                  </button>
                  <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Group actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </ZoruButton>
                  </ZoruDropdownMenuTrigger>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zoru-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {group.participantCount}
                  </span>
                  {group.muted ? (
                    <span title="Muted" className="inline-flex items-center">
                      <BellOff className="h-3 w-3" />
                    </span>
                  ) : null}
                  {group.lastActivityAt ? (
                    <span>· {formatRelative(group.lastActivityAt)}</span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {group.isAdmin ? (
                    <ZoruBadge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Admin
                    </ZoruBadge>
                  ) : null}
                  {group.announcement ? (
                    <ZoruBadge variant="outline">Announcement only</ZoruBadge>
                  ) : null}
                  {group.category ? (
                    <ZoruBadge variant="outline" className="gap-1">
                      <Tag className="h-3 w-3" />
                      {group.category}
                    </ZoruBadge>
                  ) : null}
                </div>
              </div>
            </div>
          </ZoruCardContent>
        </ZoruCard>
      </div>
      <ZoruDropdownMenuContent align="end">
        <ZoruDropdownMenuItem onSelect={() => onContextAction('open', group.jid)}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open chat
        </ZoruDropdownMenuItem>
        {group.isAdmin ? (
          <ZoruDropdownMenuItem onSelect={() => onContextAction('manage', group.jid)}>
            <Settings className="mr-2 h-4 w-4" />
            Manage group
          </ZoruDropdownMenuItem>
        ) : null}
        <ZoruDropdownMenuItem onSelect={() => onContextAction('mute', group.jid)}>
          {group.muted ? (
            <>
              <Volume2 className="mr-2 h-4 w-4" />
              Unmute
            </>
          ) : (
            <>
              <BellOff className="mr-2 h-4 w-4" />
              Mute
            </>
          )}
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuSeparator />
        <ZoruDropdownMenuItem
          className="text-zoru-danger focus:text-zoru-danger"
          onSelect={() => onContextAction('leave', group.jid)}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Leave group
        </ZoruDropdownMenuItem>
      </ZoruDropdownMenuContent>
    </ZoruDropdownMenu>
  );
});

// ─── Category pill ──────────────────────────────────────────────────────────

interface CategoryPillProps {
  active: boolean;
  label: string;
  color?: string;
  count?: number;
  onSelect: () => void;
  onDrop?: (jid: string) => void;
}

function CategoryPill({
  active,
  label,
  color,
  count,
  onSelect,
  onDrop,
}: CategoryPillProps) {
  const [isOver, setIsOver] = React.useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      onDragOver={(e) => {
        if (!onDrop) return;
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        if (!onDrop) return;
        e.preventDefault();
        setIsOver(false);
        const jid = e.dataTransfer.getData('text/sabwa-group-jid');
        if (jid) onDrop(jid);
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition',
        active
          ? 'border-zoru-ink bg-zoru-ink text-zoru-on-primary'
          : 'border-zoru-line bg-zoru-bg text-zoru-ink hover:border-zoru-line-strong hover:bg-zoru-surface',
        isOver && 'ring-2 ring-zoru-ink ring-offset-2',
      )}
    >
      {color ? (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      ) : null}
      <span>{label}</span>
      {typeof count === 'number' ? (
        <span
          className={cn(
            'rounded-full px-1.5 text-[10px]',
            active
              ? 'bg-zoru-on-primary/20 text-zoru-on-primary'
              : 'bg-zoru-surface text-zoru-ink-muted',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

// ─── Main client component ──────────────────────────────────────────────────

export function GroupsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useZoruToast();
  const { current } = useSabwaSession();
  const sessionId = current?.id ?? null;
  const resolve = useResolveJid(sessionId);

  const activeCategory = searchParams.get('category');

  const [search, setSearch] = React.useState('');
  const [groups, setGroups] = React.useState<SabwaGroupSummary[]>([]);
  const [categories, setCategories] = React.useState<SabwaGroupCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newGroupOpen, setNewGroupOpen] = React.useState(false);

  const fetchAll = React.useCallback(async () => {
    if (!sessionId) {
      setGroups([]);
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [groupsRes, catsRes] = await Promise.all([
        listGroups({
          sessionId,
          category:
            activeCategory === UNCATEGORISED
              ? null
              : activeCategory ?? undefined,
        }).catch((err) => ({ ok: false as const, error: String(err?.message ?? err) })),
        listGroupCategories(sessionId).catch((err) => ({
          ok: false as const,
          error: String(err?.message ?? err),
        })),
      ]);

      if (groupsRes.ok) {
        setGroups(groupsRes.groups);
      } else {
        setGroups([]);
      }
      if (catsRes.ok) {
        setCategories(catsRes.categories);
      } else {
        setCategories([]);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, activeCategory]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const byCategory =
      activeCategory === UNCATEGORISED
        ? groups.filter((g) => !g.category)
        : groups;
    if (!q) return byCategory;
    return byCategory.filter((g) => g.subject.toLowerCase().includes(q));
  }, [groups, search, activeCategory]);

  const handleSelectCategory = React.useCallback(
    (value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete('category');
      } else {
        params.set('category', value);
      }
      const qs = params.toString();
      router.push(qs ? `/sabwa/groups?${qs}` : '/sabwa/groups');
    },
    [router, searchParams],
  );

  const handleDropOnCategory = React.useCallback(
    async (categoryId: string | null, jid: string) => {
      if (!sessionId) return;
      try {
        const res = await setGroupCategory({
          sessionId,
          groupJid: jid,
          categoryId,
        });
        if (res.ok) {
          toast({ title: 'Category updated' });
          fetchAll();
        } else {
          toast({
            title: 'Could not update category',
            description: res.error,
            variant: 'destructive',
          });
        }
      } catch (err) {
        toast({
          title: 'Could not update category',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      }
    },
    [sessionId, fetchAll, toast],
  );

  const handleContextAction = React.useCallback(
    (action: ContextAction, jid: string) => {
      if (action === 'open') {
        router.push(`/sabwa/inbox?jid=${encodeURIComponent(jid)}`);
      } else if (action === 'manage') {
        router.push(`/sabwa/groups/${encodeURIComponent(jid)}/manage`);
      } else if (action === 'mute') {
        toast({ title: 'Mute toggle queued', description: jid });
      } else if (action === 'leave') {
        toast({
          title: 'Leave group',
          description: 'Confirm from the group manager.',
        });
      }
    },
    [router, toast],
  );

  const onCardDragStart = React.useCallback(() => {
    // no-op; included for symmetry / future telemetry
  }, []);

  const uncategorisedCount = React.useMemo(
    () => groups.filter((g) => !g.category).length,
    [groups],
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-10 md:px-6 lg:px-8">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Groups</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-[var(--zoru-radius)] bg-zoru-surface p-3 text-zoru-ink">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.015em] text-zoru-ink">
              Groups
            </h1>
            <p className="mt-0.5 text-[13px] text-zoru-ink-muted">
              All WhatsApp groups linked to this session.
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <ZoruInput
              leadingSlot={<Search />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups…"
              className="w-56"
            />
          </div>
          <ZoruButton
            onClick={() => setNewGroupOpen(true)}
            disabled={!sessionId}
          >
            <Plus />
            New group
          </ZoruButton>
          <ZoruButton asChild variant="outline">
            <Link href="/sabwa/groups/categories">
              <Tag />
              Categories
            </Link>
          </ZoruButton>
        </div>
      </div>

      <ZoruScrollArea className="mt-4 w-full whitespace-nowrap">
        <div className="flex items-center gap-2 pb-3">
          <CategoryPill
            active={!activeCategory}
            label="All"
            count={groups.length}
            onSelect={() => handleSelectCategory(null)}
            onDrop={(jid) => handleDropOnCategory(null, jid)}
          />
          <CategoryPill
            active={activeCategory === UNCATEGORISED}
            label="Uncategorised"
            count={uncategorisedCount}
            onSelect={() => handleSelectCategory(UNCATEGORISED)}
            onDrop={(jid) => handleDropOnCategory(null, jid)}
          />
          {categories.map((cat) => (
            <CategoryPill
              key={cat.id}
              active={activeCategory === cat.id}
              label={cat.name}
              color={cat.color}
              count={cat.groupCount}
              onSelect={() => handleSelectCategory(cat.id)}
              onDrop={(jid) => handleDropOnCategory(cat.id, jid)}
            />
          ))}
          <ZoruButton
            variant="ghost"
            size="sm"
            className="shrink-0"
            asChild
          >
            <Link href="/sabwa/groups/categories">
              Manage
              <ChevronRight className="ml-1 h-3 w-3" />
            </Link>
          </ZoruButton>
        </div>
        <ZoruScrollBar orientation="horizontal" />
      </ZoruScrollArea>

      {!sessionId ? (
        <ZoruCard className="mt-4">
          <ZoruCardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-zoru-ink-muted" />
            <p className="text-sm text-zoru-ink-muted">
              Connect a WhatsApp device to see your groups.
            </p>
            <ZoruButton asChild>
              <Link href="/sabwa/connect">Connect now</Link>
            </ZoruButton>
          </ZoruCardContent>
        </ZoruCard>
      ) : loading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <ZoruCard className="mt-4">
          <ZoruCardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-zoru-ink-muted" />
            <p className="text-sm text-zoru-ink-muted">
              {search ? 'No groups match your search.' : 'No groups yet.'}
            </p>
          </ZoruCardContent>
        </ZoruCard>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredGroups.map((g) => (
            <GroupCard
              key={g.jid}
              group={g}
              onDragStart={onCardDragStart}
              onContextAction={handleContextAction}
              resolve={resolve}
            />
          ))}
        </div>
      )}

      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        sessionId={sessionId}
        onCreated={fetchAll}
      />
    </div>
  );
}
