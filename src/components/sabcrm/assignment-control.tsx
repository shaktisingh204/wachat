'use client';

/**
 * SabCRM — record assignee picker (client).
 *
 * A compact, reusable control that shows the current assignee of a CRM record
 * and lets an authorised member (re)assign it to any workspace member (or clear
 * the assignment). It is the SabCRM-native counterpart of the legacy
 * `src/components/crm/assignment-control.tsx`, which targets the HR "employee"
 * directory + the `reassignEntity` action and is therefore *not* reusable here:
 * SabCRM assigns to **workspace members** and persists via the gated
 * {@link assignRecordAction}, which writes `data.assigneeId` on the record.
 *
 * Member roster
 * -------------
 * SabCRM has no members-listing server action yet, so — exactly like the
 * sibling {@link import('./activity-composer').ActivityComposer} — the host
 * supplies the roster it already has on hand via the `members` prop (each
 * `{ id, name, email?, avatarUrl? }`). The prop is intentionally compatible
 * with `ActivityComposerMember`, so a page can resolve the roster once and feed
 * both the composer's @-mention menu and this picker. When `members` is empty
 * the picker still renders the current avatar and an empty-state message.
 *
 * Two presentation modes share one picker:
 *   • `variant="row"`    — labelled trigger styled like a detail metadata row
 *     (record detail right rail).
 *   • `variant="compact"`— bare avatar (with optional name), for dense surfaces
 *     such as board cards. Clicking opens the same Popover picker.
 *
 * Assignment is optimistic: the chip updates immediately, then reconciles
 * against the server result (rolling back on failure). `router.refresh()`
 * re-pulls server data after a successful write so sibling surfaces (timeline,
 * board columns) stay in sync.
 *
 * UI is ZoruUI-only (black-&-white `--zoru-*` tokens); no raw Tailwind accents
 * or legacy primitives. This control has no FILE inputs, so SabFiles is N/A.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, UserMinus, UserPlus } from 'lucide-react';

import { Avatar, AvatarImage, AvatarFallback, Button, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, Popover, PopoverContent, PopoverTrigger, cn, useToast } from '@/components/sabcrm/20ui';

import { assignRecordAction } from '@/app/actions/sabcrm.actions';

/* -------------------------------------------------------------------------- */
/* Props                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A workspace member that can own a record. Shape-compatible with
 * `ActivityComposerMember` so a page can share one roster between the activity
 * composer and this picker.
 */
export interface AssignableMember {
  /** Stable user id persisted on the record's `data.assigneeId`. */
  id: string;
  /** Display name shown in the picker and chip. */
  name: string;
  /** Optional secondary line (e.g. email) shown in the picker. */
  email?: string;
  /** Optional avatar URL; falls back to initials when absent. */
  avatarUrl?: string;
}

export interface AssignmentControlProps {
  /** Object slug the record belongs to (kept for call-site clarity). */
  object: string;
  /** Record id whose `data.assigneeId` is being managed. */
  recordId: string;
  /** Current assignee's workspace-member id, or null when unassigned. */
  assigneeId: string | null;
  /**
   * The workspace roster to pick from. Supplied by the host (which already has
   * it for @-mentions). Defaults to an empty list.
   */
  members?: AssignableMember[];
  /**
   * Optional project override forwarded to the assignment action. Defaults to
   * the caller's first project (resolved server-side by the gate).
   */
  projectId?: string;
  /**
   * `row`    — labelled metadata-row trigger (record detail right rail).
   * `compact`— bare avatar trigger (board cards / tables).
   */
  variant?: 'row' | 'compact';
  /** Show the member name beside the avatar in `compact` mode. */
  showName?: boolean;
  /** Disables interaction (e.g. for view-only members). */
  disabled?: boolean;
  /**
   * Optional callback fired after a successful (re)assignment, with the new
   * assignee id (or null when cleared). Lets parents update local state without
   * waiting for `router.refresh()`.
   */
  onAssigned?: (assigneeId: string | null) => void;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Two-letter initials from a member's display name (falls back to email). */
function initials(member: AssignableMember): string {
  const source = member.name?.trim() || member.email?.trim() || '';
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/** Human label for a member (name → email → id). */
function memberLabel(member: AssignableMember): string {
  return member.name?.trim() || member.email?.trim() || member.id;
}

/* -------------------------------------------------------------------------- */
/* Avatar chip                                                                */
/* -------------------------------------------------------------------------- */

interface AssigneeAvatarProps {
  member: AssignableMember | null;
  size: 'sm' | 'md';
  loading?: boolean;
}

function AssigneeAvatar({ member, size, loading }: AssigneeAvatarProps) {
  const dims = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  if (loading) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 animate-pulse rounded-full bg-[var(--st-bg-muted)]',
          dims,
        )}
        aria-hidden
      />
    );
  }
  if (!member) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--st-border)] text-[var(--st-text-secondary)]',
          dims,
        )}
        aria-hidden
      >
        <UserPlus className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <Avatar className={cn('shrink-0', dims)}>
      {member.avatarUrl ? (
        <AvatarImage src={member.avatarUrl} alt={memberLabel(member)} />
      ) : null}
      <AvatarFallback className={size === 'sm' ? 'text-[10px]' : 'text-xs'}>
        {initials(member)}
      </AvatarFallback>
    </Avatar>
  );
}

/* -------------------------------------------------------------------------- */
/* Control                                                                    */
/* -------------------------------------------------------------------------- */

export function AssignmentControl({
  object: _object,
  recordId,
  assigneeId,
  members,
  projectId,
  variant = 'row',
  showName = false,
  disabled = false,
  onAssigned,
}: AssignmentControlProps): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();

  const roster = React.useMemo<AssignableMember[]>(
    () => members ?? [],
    [members],
  );

  const [open, setOpen] = React.useState(false);

  // Optimistic assignee id: mirrors `assigneeId` until the user acts.
  const [optimisticId, setOptimisticId] = React.useState<string | null>(
    assigneeId,
  );
  const [pending, startTransition] = React.useTransition();

  // Keep the optimistic value in sync when the prop changes (e.g. refresh).
  React.useEffect(() => {
    setOptimisticId(assigneeId);
  }, [assigneeId]);

  const current = React.useMemo(
    () => roster.find((m) => m.id === optimisticId) ?? null,
    [roster, optimisticId],
  );

  // We may know *someone* is assigned even if that member isn't in the roster
  // (e.g. a deactivated user). `currentKnown` drives the empty/clear state.
  const currentKnown = optimisticId !== null;

  const assign = React.useCallback(
    (nextId: string | null) => {
      if (nextId === optimisticId) {
        setOpen(false);
        return;
      }
      const previousId = optimisticId;
      setOptimisticId(nextId);
      setOpen(false);

      startTransition(() => {
        void assignRecordAction(recordId, nextId, projectId)
          .then((res) => {
            if (res.ok) {
              const assignedMember = roster.find((m) => m.id === nextId);
              toast({
                title:
                  nextId === null
                    ? 'Assignment cleared'
                    : assignedMember
                      ? `Assigned to ${memberLabel(assignedMember)}`
                      : 'Record assigned',
              });
              onAssigned?.(nextId);
              router.refresh();
            } else {
              setOptimisticId(previousId);
              toast({
                title: 'Assignment failed',
                description: res.error,
                variant: 'destructive',
              });
            }
          })
          .catch(() => {
            setOptimisticId(previousId);
            toast({
              title: 'Assignment failed',
              description: 'Something went wrong.',
              variant: 'destructive',
            });
          });
      });
    },
    [optimisticId, recordId, projectId, roster, toast, onAssigned, router],
  );

  /* ----- Trigger ----- */

  const triggerLabel = current
    ? memberLabel(current)
    : currentKnown
      ? 'Assigned'
      : 'Unassigned';

  const trigger =
    variant === 'compact' ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled || pending}
        aria-label={`Assignee: ${triggerLabel}. Click to reassign.`}
        className={cn(
          'h-auto w-auto gap-1.5 rounded-full p-0.5',
          showName && 'pr-2',
        )}
      >
        <AssigneeAvatar
          member={current}
          size="sm"
          loading={pending && !current}
        />
        {showName ? (
          <span className="max-w-[8rem] truncate text-xs text-[var(--st-text)]">
            {triggerLabel}
          </span>
        ) : null}
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="md"
        block
        disabled={disabled || pending}
        aria-label={`Assignee: ${triggerLabel}. Click to reassign.`}
        className="justify-between gap-2 font-normal"
      >
        <span className="flex min-w-0 items-center gap-2">
          <AssigneeAvatar
            member={current}
            size="sm"
            loading={pending && !current}
          />
          <span
            className={cn('truncate', !currentKnown && 'text-[var(--st-text-secondary)]')}
          >
            {triggerLabel}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className={cn(
          'p-0',
          variant === 'row' && 'w-[--radix-popover-trigger-width]',
        )}
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search members…" />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup>
              {roster.map((member) => {
                const isCurrent = member.id === optimisticId;
                return (
                  <CommandItem
                    key={member.id}
                    value={`${member.name} ${member.email ?? ''}`}
                    onSelect={() => assign(member.id)}
                    className="gap-2"
                  >
                    <AssigneeAvatar member={member} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-[var(--st-text)]">
                        {memberLabel(member)}
                      </span>
                      {member.name && member.email ? (
                        <span className="truncate text-xs text-[var(--st-text-secondary)]">
                          {member.email}
                        </span>
                      ) : null}
                    </span>
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4 shrink-0',
                        isCurrent ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {currentKnown ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__unassign__"
                    onSelect={() => assign(null)}
                    className="gap-2 text-[var(--st-danger)]"
                  >
                    <UserMinus className="h-4 w-4 shrink-0" />
                    Clear assignment
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default AssignmentControl;
