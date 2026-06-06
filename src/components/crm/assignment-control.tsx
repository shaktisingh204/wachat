'use client';

/**
 * <AssignmentControl />
 *
 * Reusable assignee chip + picker sheet for any assignable CRM entity.
 * Renders:
 *   • current assignee avatar + name + designation
 *   • click → Sheet picker with search input + employee list
 *   • clicking an employee calls `onReassign` (or the default
 *     `reassignEntity` server action) and surfaces a toast
 *   • "Unassigned" empty state when no current assignee
 *
 * Designed to drop into right-rails, header areas, or table cells.
 */

import * as React from 'react';
import { Search, UserCircle2, UserMinus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Button,
  Input,
  Sheet,
  ZoruSheetClose,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';

import {
  getAssignableEmployees,
  getEmployeeById,
  reassignEntity,
  type AssignableEntity,
  type Employee,
} from '@/app/actions/crm-assignment.actions';

export interface AssignmentControlProps {
  entityType: AssignableEntity;
  entityId: string;
  currentAssigneeId?: string | null;
  /**
   * Optional override — when omitted, the component calls
   * `reassignEntity` directly. Use this to layer extra side-effects
   * (e.g. invalidating a list in client state).
   */
  onReassign?: (newAssigneeId: string | null) => Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /**
   * Optional label shown above the chip (e.g. "Owner", "Assigned to").
   * Defaults to "Assigned to".
   */
  label?: string;
}

function initials(emp: Employee): string {
  const first = emp.firstName?.[0] ?? '';
  const last = emp.lastName?.[0] ?? '';
  const seed = `${first}${last}`.trim();
  if (seed) return seed.toUpperCase();
  const email = emp.email?.[0] ?? '';
  return email ? email.toUpperCase() : '?';
}

function fullName(emp: Employee): string {
  const full = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
  return full || emp.email || 'Unnamed';
}

export function AssignmentControl({
  entityType,
  entityId,
  currentAssigneeId,
  onReassign,
  disabled,
  size = 'md',
  label = 'Assigned to',
}: AssignmentControlProps) {
  const { toast } = useZoruToast();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [employees, setEmployees] = React.useState<Employee[] | null>(null);
  const [employeesLoading, setEmployeesLoading] = React.useState(false);

  const [current, setCurrent] = React.useState<Employee | null>(null);
  const [currentLoading, setCurrentLoading] = React.useState(false);

  const [isSaving, startTransition] = React.useTransition();

  /* Hydrate current assignee chip whenever the id changes. */
  React.useEffect(() => {
    let cancelled = false;
    if (!currentAssigneeId) {
      setCurrent(null);
      return;
    }
    setCurrentLoading(true);
    void getEmployeeById(currentAssigneeId)
      .then((emp) => {
        if (!cancelled) setCurrent(emp);
      })
      .finally(() => {
        if (!cancelled) setCurrentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentAssigneeId]);

  /* Lazy-load the employee list when the sheet opens. */
  React.useEffect(() => {
    if (!open || employees !== null) return;
    let cancelled = false;
    setEmployeesLoading(true);
    void getAssignableEmployees({ activeOnly: true })
      .then((rows) => {
        if (!cancelled) setEmployees(rows);
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, employees]);

  const filtered = React.useMemo(() => {
    if (!employees) return [];
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const hay = `${e.firstName} ${e.lastName} ${e.email} ${e.designation ?? ''} ${e.department ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [employees, search]);

  const handlePick = React.useCallback(
    (newId: string | null) => {
      if (newId === (currentAssigneeId ?? null)) {
        setOpen(false);
        return;
      }
      startTransition(async () => {
        try {
          if (onReassign) {
            await onReassign(newId);
          } else {
            const res = await reassignEntity(entityType, entityId, newId);
            if (!res.ok) {
              toast({
                title: 'Reassign failed',
                description: res.error,
                variant: 'destructive',
              });
              return;
            }
          }
          toast({
            title: newId ? 'Assignee updated' : 'Assignee cleared',
          });
          setOpen(false);
          router.refresh();
        } catch (e) {
          toast({
            title: 'Reassign failed',
            description: e instanceof Error ? e.message : 'Unknown error',
            variant: 'destructive',
          });
        }
      });
    },
    [
      currentAssigneeId,
      entityId,
      entityType,
      onReassign,
      router,
      startTransition,
      toast,
    ],
  );

  const chipSize = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const textSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]';

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          {label}
        </span>
      ) : null}

      <button
        type="button"
        disabled={disabled || isSaving}
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1.5 text-left transition-colors',
          'hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-muted)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
        aria-label={current ? `Reassign from ${fullName(current)}` : 'Assign owner'}
      >
        <Avatar className={chipSize}>
          {current?.avatar ? (
            <ZoruAvatarImage src={current.avatar} alt={fullName(current)} />
          ) : null}
          <ZoruAvatarFallback>
            {current ? (
              initials(current)
            ) : (
              <UserCircle2 className="h-4 w-4 text-[var(--st-text-secondary)]" />
            )}
          </ZoruAvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          {currentLoading ? (
            <Skeleton className="h-3.5 w-24" />
          ) : current ? (
            <>
              <span className={cn('truncate font-medium text-[var(--st-text)]', textSize)}>
                {fullName(current)}
              </span>
              {current.designation ? (
                <span className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                  {current.designation}
                </span>
              ) : null}
            </>
          ) : (
            <span className={cn('text-[var(--st-text-secondary)]', textSize)}>
              Unassigned
            </span>
          )}
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <ZoruSheetContent className="flex w-full max-w-md flex-col gap-4">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Assign owner</ZoruSheetTitle>
            <ZoruSheetDescription>
              Pick a team member to take ownership of this {entityType}.
            </ZoruSheetDescription>
          </ZoruSheetHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, designation…"
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto rounded-[var(--zoru-radius-md)] border border-[var(--st-border)]">
            {employeesLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
                No employees match your search.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--st-border)]/60">
                {filtered.map((emp) => {
                  const isCurrent = emp._id === currentAssigneeId;
                  return (
                    <li key={emp._id}>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handlePick(emp._id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                          'hover:bg-[var(--st-bg-muted)]',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                          isCurrent ? 'bg-[var(--st-bg-muted)]' : '',
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          {emp.avatar ? (
                            <ZoruAvatarImage
                              src={emp.avatar}
                              alt={fullName(emp)}
                            />
                          ) : null}
                          <ZoruAvatarFallback>
                            {initials(emp)}
                          </ZoruAvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium text-[var(--st-text)]">
                            {fullName(emp)}
                          </span>
                          <span className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                            {emp.designation || emp.department || emp.email}
                          </span>
                        </div>
                        {isCurrent ? (
                          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-accent)]">
                            Current
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving || !currentAssigneeId}
              onClick={() => handlePick(null)}
            >
              <UserMinus className="mr-1.5 h-3.5 w-3.5" />
              Unassign
            </Button>
            <ZoruSheetClose asChild>
              <Button type="button" variant="outline" size="sm">
                Close
              </Button>
            </ZoruSheetClose>
          </div>
        </ZoruSheetContent>
      </Sheet>
    </div>
  );
}

export default AssignmentControl;
