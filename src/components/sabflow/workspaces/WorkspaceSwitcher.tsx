'use client';

/**
 * Header dropdown that lists the user's SabFlow workspaces and lets them:
 *   - switch the currently-active workspace (persisted to localStorage + cookie)
 *   - jump to workspace settings
 *   - create a new workspace
 *
 * The active workspace id is stored in:
 *   localStorage → "sabflow.currentWorkspaceId"
 *   cookie       → "sabflow_workspace_id" (SameSite=Lax, 1-year max-age)
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
  LuBuilding,
  LuCheck,
  LuChevronDown,
  LuPlus,
  LuSettings,
} from 'react-icons/lu';
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* ── Load workspaces on mount when not pre-hydrated ─────── */
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
        // non-fatal — switcher stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialWorkspaces]);

  /* ── Pick an initial current workspace ──────────────────── */
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

  /* ── Click-away to close ────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create workspace');
      } finally {
        setCreating(false);
      }
    },
    [handleSwitch, newName],
  );

  const goToSettings = useCallback(() => {
    if (!current) return;
    setOpen(false);
    router.push(`/dashboard/sabflow/workspaces/${current.id}/settings`);
  }, [current, router]);

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-gray-800 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
          {current?.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.iconUrl}
              alt=""
              className="h-6 w-6 rounded-md object-cover"
            />
          ) : (
            <LuBuilding className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>
        <span className="max-w-[160px] truncate">
          {current?.name ?? 'Select workspace'}
        </span>
        <LuChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="max-h-72 overflow-y-auto py-1">
            {workspaces.length === 0 ? (
              <div className="px-3 py-3 text-[13px] text-gray-500">
                No workspaces yet.
              </div>
            ) : (
              workspaces.map((ws) => {
                const active = ws.id === currentId;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => handleSwitch(ws)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-zinc-800',
                      active && 'bg-gray-50 dark:bg-zinc-800',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {ws.iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ws.iconUrl}
                            alt=""
                            className="h-7 w-7 rounded-md object-cover"
                          />
                        ) : (
                          <LuBuilding
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 dark:text-white">
                          {ws.name}
                        </div>
                        <div className="truncate text-[11px] text-gray-500">
                          {ws.memberCount != null
                            ? `${ws.memberCount} member${ws.memberCount === 1 ? '' : 's'}`
                            : ws.slug}
                        </div>
                      </div>
                    </div>
                    {active && (
                      <LuCheck
                        className="h-4 w-4 text-[var(--color-primary,#f76808)]"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-100 py-1 dark:border-zinc-800">
            {current && (
              <button
                type="button"
                role="menuitem"
                onClick={goToSettings}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <LuSettings className="h-4 w-4" aria-hidden="true" />
                Workspace settings
              </button>
            )}
            {!showCreate ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                Create new workspace
              </button>
            ) : (
              <form
                onSubmit={handleCreate}
                className="flex flex-col gap-2 px-3 py-2"
              >
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[13px] focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
                {error && (
                  <div className="text-[11px] text-red-600">{error}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setNewName('');
                      setError(null);
                    }}
                    className="rounded-md px-2 py-1 text-[12px] text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="rounded-md bg-[var(--color-primary,#f76808)] px-3 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Keep a Link in the DOM so Next.js route-prefetches the settings page. */}
      {current && (
        <Link
          href={`/dashboard/sabflow/workspaces/${current.id}/settings`}
          prefetch
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        >
          Prefetch workspace settings
        </Link>
      )}
    </div>
  );
}

export default WorkspaceSwitcher;
