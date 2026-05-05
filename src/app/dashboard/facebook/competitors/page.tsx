"use client";

/**
 * /dashboard/facebook/competitors — Competitor tracking (ZoruUI rebuild).
 *
 * List of tracked competitor Pages with stats, plus an add-competitor
 * dialog and a side-by-side compare view that picks any two competitors
 * and shows their fan / follower counts beside each other.
 *
 * Server actions preserved:
 *   - getTrackedCompetitors(projectId)
 *   - addCompetitor(projectId, pageId)
 *   - removeCompetitor(competitorId)
 *   - syncCompetitorData(competitorId)
 */

import * as React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Heart,
  Plus,
  RefreshCw,
  Scale,
  Target,
  Trash2,
  Users,
} from "lucide-react";

import {
  addCompetitor,
  getTrackedCompetitors,
  removeCompetitor,
  syncCompetitorData,
} from "@/app/actions/facebook.actions";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
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
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  useZoruToast,
  cn,
} from "@/components/zoruui";

/* ── types ────────────────────────────────────────────────────────── */

type Competitor = {
  _id?: string;
  id?: string;
  pageId?: string;
  name?: string;
  category?: string;
  about?: string;
  link?: string;
  pictureUrl?: string;
  picture?: string; // legacy
  fanCount?: number;
  fan_count?: number; // legacy
  followersCount?: number;
  followers_count?: number; // legacy
  lastSyncedAt?: string;
  lastSynced?: string; // legacy
};

function compId(c: Competitor): string {
  return (c._id || c.id || c.pageId || "") as string;
}

function fans(c: Competitor): number {
  return c.fanCount ?? c.fan_count ?? 0;
}
function followers(c: Competitor): number {
  return c.followersCount ?? c.followers_count ?? 0;
}
function pictureOf(c: Competitor): string | undefined {
  return c.pictureUrl ?? c.picture;
}
function syncedAt(c: Competitor): string | undefined {
  return c.lastSyncedAt ?? c.lastSynced;
}

/* ── skeleton ─────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-32" />
      </div>
      <ZoruSkeleton className="mt-6 h-24 w-full" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}

/* ── compare panel ────────────────────────────────────────────────── */

function ComparePanel({
  competitor,
  emptyLabel,
  onPick,
  options,
}: {
  competitor: Competitor | null;
  emptyLabel: string;
  onPick: (id: string) => void;
  options: Competitor[];
}) {
  return (
    <ZoruCard className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
          {emptyLabel}
        </p>
        <ZoruDropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <ZoruButton variant="outline" size="sm">
              {competitor?.name ?? "Pick a competitor"}
              <ChevronDown className="opacity-60" />
            </ZoruButton>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent align="end" className="max-h-72 w-60">
            <ZoruDropdownMenuLabel>Select competitor</ZoruDropdownMenuLabel>
            <ZoruDropdownMenuRadioGroup
              value={competitor ? compId(competitor) : ""}
              onValueChange={onPick}
            >
              {options.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11.5px] text-zoru-ink-subtle">
                  No competitors yet.
                </p>
              ) : (
                options.map((c) => (
                  <ZoruDropdownMenuRadioItem key={compId(c)} value={compId(c)}>
                    {c.name ?? "Unknown"}
                  </ZoruDropdownMenuRadioItem>
                ))
              )}
            </ZoruDropdownMenuRadioGroup>
          </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
      </div>

      {competitor ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {pictureOf(competitor) ? (
              <Image
                src={pictureOf(competitor)!}
                alt={competitor.name ?? "Competitor"}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                <Users className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[14px] text-zoru-ink">
                {competitor.name ?? "Unknown"}
              </p>
              {competitor.category ? (
                <ZoruBadge variant="secondary" className="mt-1">
                  {competitor.category}
                </ZoruBadge>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CompareStat label="Fans" value={fans(competitor)} icon={<Heart />} />
            <CompareStat
              label="Followers"
              value={followers(competitor)}
              icon={<Users />}
            />
          </div>
          {competitor.about ? (
            <p className="line-clamp-3 text-[12px] text-zoru-ink-muted">
              {competitor.about}
            </p>
          ) : null}
          {syncedAt(competitor) ? (
            <p className="text-[10.5px] text-zoru-ink-subtle">
              Synced{" "}
              {formatDistanceToNow(new Date(syncedAt(competitor)!), {
                addSuffix: true,
              })}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Scale className="h-5 w-5 text-zoru-ink-subtle" />
          <p className="text-[12px] text-zoru-ink-muted">
            No competitor selected.
          </p>
        </div>
      )}
    </ZoruCard>
  );
}

function CompareStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2">
      <p className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-zoru-ink-subtle [&_svg]:size-3">
        {icon} {label}
      </p>
      <p className="mt-1 text-[18px] tracking-tight text-zoru-ink">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────── */

export default function FacebookCompetitorsPage() {
  const { toast } = useZoruToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isAdding, startAddTransition] = useTransition();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newPageId, setNewPageId] = useState("");

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  useEffect(() => {
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  const fetchCompetitors = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { competitors: fetched, error: fetchError } =
        await getTrackedCompetitors(projectId);
      if (fetchError) {
        setError(fetchError);
      } else if (fetched) {
        setError(null);
        setCompetitors(fetched as Competitor[]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    fetchCompetitors();
  }, [projectId, fetchCompetitors]);

  // Auto-pick the first two competitors for comparison the first time
  // they load.
  useEffect(() => {
    if (!leftId && competitors[0]) setLeftId(compId(competitors[0]));
    if (!rightId && competitors[1]) setRightId(compId(competitors[1]));
  }, [competitors, leftId, rightId]);

  const handleAdd = () => {
    if (!projectId || !newPageId.trim()) return;
    startAddTransition(async () => {
      const result = await addCompetitor(projectId, newPageId.trim());
      if (result.error) {
        toast({
          title: "Could not add competitor",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "Competitor added" });
        setNewPageId("");
        setAddOpen(false);
        fetchCompetitors();
      }
    });
  };

  const handleSync = async (competitorId: string) => {
    setSyncingId(competitorId);
    const result = await syncCompetitorData(competitorId);
    setSyncingId(null);
    if (result.error) {
      toast({
        title: "Sync failed",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({ title: "Synced", description: "Competitor data refreshed." });
      fetchCompetitors();
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoveId) return;
    const id = pendingRemoveId;
    setPendingRemoveId(null);
    const result = await removeCompetitor(id);
    if (result.error) {
      toast({
        title: "Could not remove",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({ title: "Competitor removed" });
      setCompetitors((prev) => prev.filter((c) => compId(c) !== id));
      if (leftId === id) setLeftId(null);
      if (rightId === id) setRightId(null);
    }
  };

  const leftCompetitor = useMemo(
    () => competitors.find((c) => compId(c) === leftId) ?? null,
    [competitors, leftId],
  );
  const rightCompetitor = useMemo(
    () => competitors.find((c) => compId(c) === rightId) ?? null,
    [competitors, rightId],
  );

  if (isLoading && competitors.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* ── Breadcrumb ── */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Competitors</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* ── Page header ── */}
      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Insights</ZoruPageEyebrow>
          <ZoruPageTitle>Competitor tracker</ZoruPageTitle>
          <ZoruPageDescription>
            Track competitor Facebook Pages and compare their fan and follower
            growth side-by-side.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" size="sm" onClick={fetchCompetitors}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add competitor
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!projectId ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Pick a project from the main dashboard to view competitors.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : error ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Error</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <>
          {/* ── Side-by-side compare ── */}
          {competitors.length > 0 ? (
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Scale className="h-4 w-4 text-zoru-ink-muted" />
                <h2 className="text-[14px] font-medium text-zoru-ink">
                  Side-by-side compare
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ComparePanel
                  competitor={leftCompetitor}
                  emptyLabel="Competitor A"
                  onPick={setLeftId}
                  options={competitors}
                />
                <ComparePanel
                  competitor={rightCompetitor}
                  emptyLabel="Competitor B"
                  onPick={setRightId}
                  options={competitors}
                />
              </div>
            </section>
          ) : null}

          {/* ── Tracked competitors list ── */}
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-zoru-ink">
                Tracked Pages ({competitors.length})
              </h2>
            </div>
            {competitors.length === 0 ? (
              <ZoruEmptyState
                icon={<Target />}
                title="No competitors tracked"
                description="Enter a Facebook Page ID to start tracking a competitor's performance."
                action={
                  <ZoruButton size="sm" onClick={() => setAddOpen(true)}>
                    <Plus /> Add competitor
                  </ZoruButton>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {competitors.map((c) => {
                  const id = compId(c);
                  const pic = pictureOf(c);
                  const synced = syncedAt(c);
                  const isSelected = leftId === id || rightId === id;
                  return (
                    <ZoruCard
                      key={id}
                      className={cn(
                        "flex h-full flex-col p-0",
                        isSelected && "ring-1 ring-zoru-ink",
                      )}
                    >
                      <ZoruCardContent className="flex-1 space-y-3 p-5">
                        <div className="flex items-center gap-3">
                          {pic ? (
                            <Image
                              src={pic}
                              alt={c.name ?? "Competitor"}
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                              <Users className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-[14px] text-zoru-ink">
                              {c.name ?? "Unknown Page"}
                            </p>
                            {c.category ? (
                              <ZoruBadge variant="secondary" className="mt-1">
                                {c.category}
                              </ZoruBadge>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-[12px]">
                          <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-subtle">
                              Fans
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1 text-zoru-ink">
                              <Heart className="h-3 w-3" />
                              {fans(c).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-subtle">
                              Followers
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1 text-zoru-ink">
                              <Users className="h-3 w-3" />
                              {followers(c).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {c.about ? (
                          <p className="line-clamp-2 text-[12px] text-zoru-ink-muted">
                            {c.about}
                          </p>
                        ) : null}

                        {c.link ? (
                          <a
                            href={c.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] text-zoru-ink hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> View on
                            Facebook
                          </a>
                        ) : null}

                        {synced ? (
                          <p className="text-[10.5px] text-zoru-ink-subtle">
                            Synced{" "}
                            {formatDistanceToNow(new Date(synced), {
                              addSuffix: true,
                            })}
                          </p>
                        ) : null}
                      </ZoruCardContent>

                      <div className="flex gap-2 border-t border-zoru-line p-3">
                        <ZoruButton
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSync(id)}
                          disabled={syncingId === id}
                        >
                          <RefreshCw
                            className={syncingId === id ? "animate-spin" : ""}
                          />
                          {syncingId === id ? "Syncing…" : "Sync"}
                        </ZoruButton>
                        <ZoruButton
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingRemoveId(id)}
                        >
                          <Trash2 /> Remove
                        </ZoruButton>
                      </div>
                    </ZoruCard>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Add competitor dialog ── */}
      <ZoruDialog open={addOpen} onOpenChange={setAddOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add competitor</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste a public Facebook Page ID to start tracking the Page's
              fans, followers, and category.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2">
            <ZoruLabel htmlFor="pageId">Facebook Page ID</ZoruLabel>
            <ZoruInput
              id="pageId"
              autoFocus
              placeholder="e.g. 123456789012345"
              value={newPageId}
              onChange={(e) => setNewPageId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={handleAdd}
              disabled={isAdding || !newPageId.trim()}
            >
              <Plus /> {isAdding ? "Adding…" : "Track competitor"}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* ── Remove-competitor confirm ── */}
      <ZoruAlertDialog
        open={pendingRemoveId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingRemoveId(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Remove competitor?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The competitor will no longer be tracked. Their stored history
              will be deleted.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleConfirmRemove}>
              Remove
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
