'use client';

/**
 * Header dropdown that lists the user's SabFlow workspaces and lets them:
 *   - switch the currently-active workspace (persisted to localStorage + cookie)
 *   - jump to workspace settings
 *   - create a new workspace
 *
 * The active workspace id is stored in:
 *   localStorage -> "sabflow.currentWorkspaceId"
 *   cookie       -> "sabflow_workspace_id" (SameSite=Lax, 1-year max-age)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Check,
  ChevronDown,
  Plus,
  Settings,
} from 'lucide-react';
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  useToast,
} from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/lib/sabflow/workspaces/types';

const STORAGE_KEY = 'sabflow.currentWorkspaceId';
const COOKIE_NAME = 'sabflow_workspace_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function writeWorkspaceCookie(id: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function readStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface Props {
  /**
   * Optional initial list. If not provided, the component fetches
   * `/api/sabflow/workspaces` on mount.
   */
  initialWorkspaces?: Workspace[];
  /** Default workspace id to select if nothing is stored yet. */
  initialWorkspaceId?: string;
  /** Called after a switch so the parent can update its state. */
  onWorkspaceChange?: (workspace: Workspace) => void;
  className?: string;
}

export function WorkspaceSwitcher({
  initialWorkspaces,
  initialWorkspaceId,
  onWorkspaceChange,
  className,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(
    initialWorkspaces ?? [],
  );
  const [currentId, setCurrentId] = useState<string | null>(
    initialWorkspaceId ?? null,
  );
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  /* Load workspaces on mount when not pre-hydrated */
  useEffect(() => {
    if (initialWorkspaces && initialWorkspaces.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/sabflow/workspaces', {
          cache: 'no-store',
        });
        const data = (await res.json()) as { workspaces?: Workspace[] };
        if (!cancelled && res.ok && data.workspaces) {
          setWorkspaces(data.workspaces);
        }
      } catch {
        // non-fatal, switcher stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialWorkspaces]);

  /* Pick an initial current workspace */
  useEffect(() => {
    if (currentId) return;
    if (workspaces.length === 0) return;
    const stored = readStoredWorkspaceId();
    const pick =
      (stored && workspaces.find((w) => w.id === stored)?.id) ||
      initialWorkspaceId ||
      workspaces[0]?.id;
    if (pick) {
      setCurrentId(pick);
      writeWorkspaceCookie(pick);
    }
  }, [currentId, initialWorkspaceId, workspaces]);

  /* Focus the create input when the inline form opens */
  useEffect(() => {
    if (showCreate) {
      // Defer so Radix has settled focus inside the open menu first.
      const t = window.setTimeout(() => nameInputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [showCreate]);

  const current = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? null,
    [workspaces, currentId],
  );

  const handleSwitch = useCallback(
    (ws: Workspace) => {
      setCurrentId(ws.id);
      try {
        window.localStorage.setItem(STORAGE_KEY, ws.id);
      } catch {
        /* ignore */
      }
      writeWorkspaceCookie(ws.id);
      setOpen(false);
      onWorkspaceChange?.(ws);
    },
    [onWorkspaceChange],
  );

  const handleCreate = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const name = newName.trim();
      if (!name) return;
      setCreating(true);
      setError(null);
      try {
        const res = await fetch('/api/sabflow/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = (await res.json()) as {
          workspace?: Workspace;
          error?: string;
        };
        if (!res.ok || !data.workspace) {
          throw new Error(data.error ?? 'Failed to create workspace');
        }
        setWorkspaces((prev) => [data.workspace as Workspace, ...prev]);
        handleSwitch(data.workspace);
        setShowCreate(false);
        setNewName('');
        toast.success(`Workspace "${data.workspace.name}" created`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create workspace';
        setError(message);
        toast.error(message);
      } finally {
        setCreating(false);
      }
    },
    [handleSwitch, newName, toast],
  );

  const goToSettings = useCallback(() => {
    if (!current) return;
    setOpen(false);
    router.push(`/dashboard/sabflow/workspaces/${current.id}/settings`);
  }, [current, router]);

  /* Render */

  return (
    <div className={cn('relative', className)}>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setShowCreate(false);
            setNewName('');
            setError(null);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            iconRight={ChevronDown}
            aria-label="Switch workspace"
          >
            <span className="inline-flex items-center gap-2">
              <Avatar
                name={current?.name ?? 'Workspace'}
                src={current?.iconUrl}
                size="xs"
                shape="square"
              />
              <span className="max-w-[160px] truncate">
                {current?.name ?? 'Select workspace'}
              </span>
            </span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          <div className="max-h-72 overflow-y-auto py-1">
            {workspaces.length === 0 ? (
              <EmptyState
                icon={Building2}
                size="sm"
                title="No workspaces yet"
                description="Create your first workspace to get started."
              />
            ) : (
              workspaces.map((ws) => {
                const active = ws.id === currentId;
                return (
                  <DropdownMenuItem
                    key={ws.id}
                    onSelect={() => handleSwitch(ws)}
                    aria-current={active ? 'true' : undefined}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={ws.name}
                        src={ws.iconUrl}
                        size="sm"
                        shape="square"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--st-text)]">
                          {ws.name}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--st-text-secondary)]">
                          {ws.memberCount != null
                            ? `${ws.memberCount} member${ws.memberCount === 1 ? '' : 's'}`
                            : ws.slug}
                        </span>
                      </span>
                    </span>
                    {active ? (
                      <Check
                        size={16}
                        className="text-[var(--st-accent)]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          <DropdownMenuSeparator />

          {current ? (
            <DropdownMenuItem iconLeft={Settings} onSelect={goToSettings}>
              Workspace settings
            </DropdownMenuItem>
          ) : null}

          {!showCreate ? (
            <DropdownMenuItem
              iconLeft={Plus}
              onSelect={(e) => {
                // Keep the menu open so the inline create form can render.
                e.preventDefault();
                setShowCreate(true);
              }}
            >
              Create new workspace
            </DropdownMenuItem>
          ) : (
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-2 px-2 py-2"
              // Stop key + pointer events from reaching Radix's menu typeahead
              // so typing in the input does not jump focus between items.
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Field error={error ?? undefined}>
                <Input
                  ref={nameInputRef}
                  inputSize="sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  aria-label="New workspace name"
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreate(false);
                    setNewName('');
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={creating}
                  disabled={!newName.trim()}
                >
                  Create
                </Button>
              </div>
            </form>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Keep a Link in the DOM so Next.js route-prefetches the settings page. */}
      {current ? (
        <Link
          href={`/dashboard/sabflow/workspaces/${current.id}/settings`}
          prefetch
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        >
          Prefetch workspace settings
        </Link>
      ) : null}
    </div>
  );
}

export default WorkspaceSwitcher;
