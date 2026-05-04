'use client';

/**
 * /dashboard/facebook/audience — Audience segments (ZoruUI).
 *
 * Mirrors the wachat segments pattern: segment grid as ZoruCards, plus a
 * create/edit ZoruSheet driving saveAudienceSegment, and a destructive
 * ZoruAlertDialog for deleteAudienceSegment.
 */

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useFormStatus } from 'react-dom';
import {
  AlertCircle,
  Info,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';

import {
  deleteAudienceSegment,
  getAudienceSegments,
  saveAudienceSegment,
} from '@/app/actions/facebook.actions';

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
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';

const initialState: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
};

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-32" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ZoruSkeleton className="h-28" />
        <ZoruSkeleton className="h-28" />
        <ZoruSkeleton className="h-28" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ZoruSkeleton className="h-48" />
        <ZoruSkeleton className="h-48" />
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Save segment
    </ZoruButton>
  );
}

type Segment = {
  _id: string;
  name?: string;
  description?: string;
  filterCity?: string;
  filterCountry?: string;
  filterGender?: string;
  filterAgeMin?: number | string;
  filterAgeMax?: number | string;
  createdAt?: string | Date;
};

export default function AudiencePage() {
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [gender, setGender] = useState('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [state, formAction] = useActionState(saveAudienceSegment, initialState);

  useEffect(() => {
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  const fetchSegments = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { segments: fetched, error: fetchError } =
        await getAudienceSegments(projectId);
      if (fetchError) setError(fetchError);
      else if (fetched) {
        setError(null);
        setSegments(fetched as Segment[]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    fetchSegments();
  }, [projectId, fetchSegments]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      formRef.current?.reset();
      setGender('all');
      setSheetOpen(false);
      fetchSegments();
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, fetchSegments]);

  const handleDelete = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await deleteAudienceSegment(id);
        if (result.error) {
          toast({
            title: 'Error',
            description: result.error,
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Segment removed' });
          fetchSegments();
        }
        setConfirmId(null);
      });
    },
    [toast, fetchSegments],
  );

  const stats = useMemo(() => {
    const withGender = segments.filter(
      (s) => s.filterGender && s.filterGender !== 'all',
    ).length;
    const withGeo = segments.filter(
      (s) => s.filterCity || s.filterCountry,
    ).length;
    return { total: segments.length, withGender, withGeo };
  }, [segments]);

  if (isLoading && segments.length === 0) return <PageSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Audience</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Audience</ZoruPageEyebrow>
          <ZoruPageTitle>Audience segments</ZoruPageTitle>
          <ZoruPageDescription>
            Build reusable audience filters by demographics, then target them
            from broadcasts and campaigns.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton size="sm" onClick={() => setSheetOpen(true)}>
            <Plus /> New segment
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!projectId ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Select a project from the dashboard to view its segments.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : error ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not load segments</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <ZoruStatCard
              label="Total segments"
              value={stats.total.toLocaleString()}
              period="Saved filters"
              icon={<Users />}
            />
            <ZoruStatCard
              label="With gender filter"
              value={stats.withGender.toLocaleString()}
              period="Demographic-aware"
              icon={<Users />}
            />
            <ZoruStatCard
              label="With geo filter"
              value={stats.withGeo.toLocaleString()}
              period="City or country"
              icon={<Users />}
            />
          </div>

          <ZoruAlert className="mt-6">
            <Info className="h-4 w-4" />
            <ZoruAlertTitle>How segments work</ZoruAlertTitle>
            <ZoruAlertDescription>
              Segments filter your audience by demographics. Use them when
              sending broadcasts to target specific groups instead of your
              entire subscriber list.
            </ZoruAlertDescription>
          </ZoruAlert>

          {segments.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {segments.map((seg) => (
                <ZoruCard key={seg._id} className="flex flex-col p-0">
                  <ZoruCardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <ZoruCardTitle className="text-base">
                        {seg.name || 'Untitled segment'}
                      </ZoruCardTitle>
                      <ZoruButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete segment"
                        onClick={() => setConfirmId(seg._id)}
                      >
                        <Trash2 />
                      </ZoruButton>
                    </div>
                    {seg.description ? (
                      <ZoruCardDescription>
                        {seg.description}
                      </ZoruCardDescription>
                    ) : null}
                  </ZoruCardHeader>
                  <ZoruCardContent className="flex flex-1 flex-col gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {seg.filterCity ? (
                        <ZoruBadge variant="outline">
                          City: {seg.filterCity}
                        </ZoruBadge>
                      ) : null}
                      {seg.filterCountry ? (
                        <ZoruBadge variant="outline">
                          Country: {seg.filterCountry}
                        </ZoruBadge>
                      ) : null}
                      {seg.filterGender && seg.filterGender !== 'all' ? (
                        <ZoruBadge variant="outline">
                          Gender: {seg.filterGender}
                        </ZoruBadge>
                      ) : null}
                      {seg.filterAgeMin ? (
                        <ZoruBadge variant="outline">
                          Min age: {seg.filterAgeMin}
                        </ZoruBadge>
                      ) : null}
                      {seg.filterAgeMax ? (
                        <ZoruBadge variant="outline">
                          Max age: {seg.filterAgeMax}
                        </ZoruBadge>
                      ) : null}
                      {!seg.filterCity &&
                      !seg.filterCountry &&
                      (!seg.filterGender || seg.filterGender === 'all') &&
                      !seg.filterAgeMin &&
                      !seg.filterAgeMax ? (
                        <span className="text-[11.5px] text-zoru-ink-subtle">
                          No filters — full audience
                        </span>
                      ) : null}
                    </div>
                    {seg.createdAt ? (
                      <p className="mt-auto text-[11px] text-zoru-ink-subtle">
                        Created{' '}
                        {new Date(seg.createdAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </ZoruCardContent>
                </ZoruCard>
              ))}
            </div>
          ) : (
            <ZoruEmptyState
              className="mt-6"
              icon={<Users />}
              title="No segments yet"
              description="Create your first audience segment to start targeting broadcasts."
              action={
                <ZoruButton size="sm" onClick={() => setSheetOpen(true)}>
                  <Plus /> New segment
                </ZoruButton>
              }
            />
          )}
        </>
      )}

      {/* ── Save-segment sheet ── */}
      <ZoruSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <ZoruSheetContent className="sm:max-w-lg flex flex-col gap-5">
          <ZoruSheetHeader>
            <ZoruSheetTitle>New audience segment</ZoruSheetTitle>
            <ZoruSheetDescription>
              Configure demographic filters. Leave a field empty to match
              everyone for that dimension.
            </ZoruSheetDescription>
          </ZoruSheetHeader>

          <form
            ref={formRef}
            action={formAction}
            className="flex flex-col gap-4"
          >
            <input
              type="hidden"
              name="projectId"
              value={projectId ?? ''}
            />
            <input type="hidden" name="filterGender" value={gender} />

            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="seg-name">Name</ZoruLabel>
              <ZoruInput
                id="seg-name"
                name="name"
                placeholder="e.g. Young Adults — US"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="seg-desc">Description</ZoruLabel>
              <ZoruInput
                id="seg-desc"
                name="description"
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="seg-city">City</ZoruLabel>
                <ZoruInput
                  id="seg-city"
                  name="filterCity"
                  placeholder="Any city"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="seg-country">Country</ZoruLabel>
                <ZoruInput
                  id="seg-country"
                  name="filterCountry"
                  placeholder="Any country"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel>Gender</ZoruLabel>
              <ZoruSelect value={gender} onValueChange={setGender}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All</ZoruSelectItem>
                  <ZoruSelectItem value="male">Male</ZoruSelectItem>
                  <ZoruSelectItem value="female">Female</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="seg-age-min">Min age</ZoruLabel>
                <ZoruInput
                  id="seg-age-min"
                  name="filterAgeMin"
                  type="number"
                  placeholder="18"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="seg-age-max">Max age</ZoruLabel>
                <ZoruInput
                  id="seg-age-max"
                  name="filterAgeMax"
                  type="number"
                  placeholder="65"
                />
              </div>
            </div>

            <ZoruSheetFooter className="mt-2">
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
              >
                Cancel
              </ZoruButton>
              <SubmitButton />
            </ZoruSheetFooter>
          </form>
        </ZoruSheetContent>
      </ZoruSheet>

      {/* ── Delete confirm ── */}
      <ZoruAlertDialog
        open={confirmId !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmId(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete segment?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the audience segment. Broadcasts using
              it will fall back to your full subscriber list.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              onClick={() => confirmId && handleDelete(confirmId)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
