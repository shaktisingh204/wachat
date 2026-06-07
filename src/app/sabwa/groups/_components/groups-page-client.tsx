'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  ScrollArea,
  ScrollBar,
  Skeleton,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
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
 * SabWa Groups - list page client (SABWA_PLAN.md section 6 page 6).
 *
 * - Top toolbar: search + "New group".
 * - Category strip (horizontally scrollable) with "All" / "Uncategorised" /
 *   each user-defined category. Active pill drives `?category=` re-fetch.
 * - Grid of group cards with subject, member count, admin / announcement
 *   badges, mute icon, last-activity timestamp.
 * - Right-click / long-press opens a context menu (Open chat / Manage /
 *   Mute / Leave). Drag a card onto a category pill calls setGroupCategory.
 * - "New group" dialog: subject + contact-searcher calls createGroup.
 *
 * All server side-effects are routed through `@/app/actions/sabwa.actions`.
 *
 * 20ui design system - pure 20ui primitives; data flow, server actions and
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

// --- Helpers ----------------------------------------------------------------

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

// --- New group dialog -------------------------------------------------------

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
  const { toast } = useToast();
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
        tone: 'danger',
      });
      return;
    }
    if (!subject.trim()) {
      toast({ title: 'Subject is required', tone: 'danger' });
      return;
    }
    if (participants.length === 0) {
      toast({ title: 'Add at least one participant', tone: 'danger' });
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
        toast({ title: 'Group queued for creation', tone: 'success' });
        onCreated();
        onOpenChange(false);
      } else {
        toast({
          title: 'Failed to create group',
          description: res.error,
          tone: 'danger',
        });
      }
    } catch (err) {
      toast({
        title: 'Failed to create group',
        description: err instanceof Error ? err.message : 'Unknown error',
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, subject, participants, toast, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Create a WhatsApp group with the selected participants.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Subject">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Group name"
              maxLength={100}
            />
          </Field>
          <Field label="Participants">
            <Command className="rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <CommandInput
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
              <CommandList>
                <CommandEmpty>Type a phone number to add it.</CommandEmpty>
                {phoneInput.trim().length > 0 && (
                  <CommandGroup heading="Add">
                    <CommandItem onSelect={addParticipant}>
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Add {phoneInput.trim()}
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {participants.map((p) => (
                  <Badge
                    key={p}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeParticipant(p)}
                  >
                    {p}
                    <span className="ml-1 text-[var(--st-text-secondary)]">x</span>
                  </Badge>
                ))}
              </div>
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} loading={submitting} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Group card -------------------------------------------------------------

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
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <div
        draggable
        onDragStart={handleDragStart}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Card
          padding="none"
          className="cursor-pointer transition hover:shadow-[var(--st-shadow-md)] focus-within:ring-2 focus-within:ring-[var(--st-text)]"
        >
          <CardBody className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 shrink-0">
                {group.profilePicUrl ? (
                  <AvatarImage src={group.profilePicUrl} alt="" />
                ) : null}
                <AvatarFallback>{initials(displayName || '#')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Button
                    variant="ghost"
                    className="min-w-0 max-w-full truncate text-left text-base font-semibold text-[var(--st-text)] hover:underline"
                    onClick={onOpenChat}
                    title={displayName}
                  >
                    {displayName}
                  </Button>
                  <DropdownMenuTrigger asChild>
                    <IconButton
                      label="Group actions"
                      icon={MoreHorizontal}
                      variant="ghost"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </DropdownMenuTrigger>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {group.participantCount}
                  </span>
                  {group.muted ? (
                    <span title="Muted" className="inline-flex items-center">
                      <BellOff className="h-3 w-3" aria-hidden="true" />
                    </span>
                  ) : null}
                  {group.lastActivityAt ? (
                    <span>&middot; {formatRelative(group.lastActivityAt)}</span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {group.isAdmin ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Admin
                    </Badge>
                  ) : null}
                  {group.announcement ? (
                    <Badge variant="outline">Announcement only</Badge>
                  ) : null}
                  {group.category ? (
                    <Badge variant="outline" className="gap-1">
                      <Tag className="h-3 w-3" aria-hidden="true" />
                      {group.category}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onContextAction('open', group.jid)}>
          <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
          Open chat
        </DropdownMenuItem>
        {group.isAdmin ? (
          <DropdownMenuItem onSelect={() => onContextAction('manage', group.jid)}>
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            Manage group
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => onContextAction('mute', group.jid)}>
          {group.muted ? (
            <>
              <Volume2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Unmute
            </>
          ) : (
            <>
              <BellOff className="mr-2 h-4 w-4" aria-hidden="true" />
              Mute
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[var(--st-danger)] focus:text-[var(--st-danger)]"
          onSelect={() => onContextAction('leave', group.jid)}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Leave group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// --- Category pill ----------------------------------------------------------

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
    <Button
      variant="ghost"
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
        'shrink-0 gap-2 rounded-full border px-3 py-1.5 text-xs',
        active
          ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-text-inverted)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-secondary)]',
        isOver && 'ring-2 ring-[var(--st-text)] ring-offset-2',
      )}
    >
      {color ? (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      ) : null}
      <span>{label}</span>
      {typeof count === 'number' ? (
        <span
          className={cn(
            'rounded-full px-1.5 text-[10px]',
            active
              ? 'bg-[var(--st-text-inverted)]/20 text-[var(--st-text-inverted)]'
              : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]',
          )}
        >
          {count}
        </span>
      ) : null}
    </Button>
  );
}

// --- Main client component --------------------------------------------------

export function GroupsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
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
          toast({ title: 'Category updated', tone: 'success' });
          fetchAll();
        } else {
          toast({
            title: 'Could not update category',
            description: res.error,
            tone: 'danger',
          });
        }
      } catch (err) {
        toast({
          title: 'Could not update category',
          description: err instanceof Error ? err.message : String(err),
          tone: 'danger',
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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Groups</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeaderHeading>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-3 text-[var(--st-text)]"
              aria-hidden="true"
            >
              <Users className="h-6 w-6" />
            </span>
            <div>
              <PageTitle>Groups</PageTitle>
              <PageDescription>
                All WhatsApp groups linked to this session.
              </PageDescription>
            </div>
          </div>
        </PageHeaderHeading>
        <PageActions>
          <Input
            iconLeft={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            aria-label="Search groups"
            className="w-56"
          />
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setNewGroupOpen(true)}
            disabled={!sessionId}
          >
            New group
          </Button>
          <Link href="/sabwa/groups/categories">
            <Button variant="outline" iconLeft={Tag}>
              Categories
            </Button>
          </Link>
        </PageActions>
      </PageHeader>

      <ScrollArea className="mt-4 w-full whitespace-nowrap">
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
          <Link href="/sabwa/groups/categories" className="shrink-0">
            <Button variant="ghost" size="sm" iconRight={ChevronRight}>
              Manage
            </Button>
          </Link>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {!sessionId ? (
        <Card className="mt-4">
          <CardBody>
            <EmptyState
              icon={Users}
              title="Connect a WhatsApp device to see your groups."
              action={
                <Link href="/sabwa/connect">
                  <Button variant="primary">Connect now</Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : loading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="mt-4">
          <CardBody>
            <EmptyState
              icon={Users}
              title={search ? 'No groups match your search.' : 'No groups yet.'}
            />
          </CardBody>
        </Card>
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
