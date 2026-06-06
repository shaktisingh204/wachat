'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea, zoruSonnerToast } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { AlertCircle,
  Plus,
  RefreshCw,
  Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useProject } from '@/context/project-context';
import {
  getAudienceSegments,
  getPageFanDemographics,
  saveAudienceSegment,
  } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/audience — Audience demographics + saved segments.
 *
 * Top panel: Page-fan demographics (gender, age, top countries) rendered
 * with Progress bars. Bottom panel: saved audience segments with a
 * "New segment" dialog. Backed by Rust BFF actions in
 * `src/app/actions/facebook.actions.ts`.
 */

import * as React from 'react';

interface AudienceSegment {
  _id?: string;
  id?: string;
  name?: string;
  description?: string;
  size?: number;
  contactCount?: number;
  filterCity?: string;
  filterCountry?: string;
  filterGender?: string;
  filterAgeMin?: number;
  filterAgeMax?: number;
  createdAt?: string;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

interface DemoBucket {
  label: string;
  value: number;
}

/**
 * Normalises whatever shape comes back from `getPageFanDemographics`
 * into three lists: gender, age, top countries. The Rust response keys
 * vary across Page API versions — we accept both Graph-style keys
 * (`fans_gender_age`, `fans_country`) and BFF-flattened keys
 * (`gender`, `age`, `countries`).
 */
function normalizeDemographics(d: any): {
  gender: DemoBucket[];
  age: DemoBucket[];
  countries: DemoBucket[];
} {
  if (!d || typeof d !== 'object') {
    return { gender: [], age: [], countries: [] };
  }

  const genderRaw =
    d.gender ?? d.fans_gender ?? d.fans_by_gender ?? d.fans_gender_age ?? {};
  const ageRaw = d.age ?? d.fans_age ?? d.fans_by_age ?? d.fans_gender_age ?? {};
  const countryRaw =
    d.countries ?? d.fans_country ?? d.fans_by_country ?? d.country ?? {};

  const gMap: Record<string, number> = {};
  const aMap: Record<string, number> = {};
  if (genderRaw && typeof genderRaw === 'object') {
    for (const [k, v] of Object.entries(genderRaw)) {
      const num = typeof v === 'number' ? v : Number(v);
      if (Number.isNaN(num)) continue;
      // Keys like "M.25-34" → gender = M, age = 25-34.
      const m = k.match(/^([MFUmfu])\.(.+)$/);
      if (m) {
        const gk = m[1].toUpperCase();
        gMap[gk] = (gMap[gk] ?? 0) + num;
        aMap[m[2]] = (aMap[m[2]] ?? 0) + num;
      } else {
        gMap[k] = (gMap[k] ?? 0) + num;
      }
    }
  }
  if (ageRaw && typeof ageRaw === 'object' && Object.keys(aMap).length === 0) {
    for (const [k, v] of Object.entries(ageRaw)) {
      const num = typeof v === 'number' ? v : Number(v);
      if (!Number.isNaN(num)) aMap[k] = num;
    }
  }
  const cMap: Record<string, number> = {};
  if (countryRaw && typeof countryRaw === 'object') {
    for (const [k, v] of Object.entries(countryRaw)) {
      const num = typeof v === 'number' ? v : Number(v);
      if (!Number.isNaN(num)) cMap[k] = num;
    }
  }

  const sortDesc = (a: DemoBucket, b: DemoBucket) => b.value - a.value;
  const genderPretty: Record<string, string> = { M: 'Male', F: 'Female', U: 'Unknown' };
  return {
    gender: Object.entries(gMap)
      .map(([k, v]) => ({ label: genderPretty[k] ?? k, value: v }))
      .sort(sortDesc),
    age: Object.entries(aMap)
      .map(([k, v]) => ({ label: k, value: v }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    countries: Object.entries(cMap)
      .map(([k, v]) => ({ label: k, value: v }))
      .sort(sortDesc)
      .slice(0, 8),
  };
}

function DemoBars({ title, buckets }: { title: string; buckets: DemoBucket[] }) {
  const total = buckets.reduce((acc, b) => acc + b.value, 0);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {title}
      </p>
      {buckets.length === 0 ? (
        <p className="text-xs text-[var(--st-text-secondary)]">No data.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {buckets.map((b) => {
            const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
            return (
              <li key={b.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--st-text)]">{b.label}</span>
                  <span className="text-[var(--st-text-secondary)]">{pct}%</span>
                </div>
                <Progress value={pct} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function FacebookAudiencePage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [demographics, setDemographics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formGender, setFormGender] = useState<string>('any');
  const [formAgeMin, setFormAgeMin] = useState('');
  const [formAgeMax, setFormAgeMax] = useState('');

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const [segRes, demoRes] = await Promise.all([
        getAudienceSegments(projectId),
        getPageFanDemographics(projectId),
      ]);
      if (segRes.error && demoRes.error) {
        setError(segRes.error);
      } else {
        setError(null);
      }
      setSegments((segRes.segments as AudienceSegment[]) ?? []);
      setDemographics(demoRes.demographics ?? null);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const buckets = useMemo(() => normalizeDemographics(demographics), [demographics]);

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormGender('any');
    setFormAgeMin('');
    setFormAgeMax('');
  };

  const handleSave = () => {
    if (!projectId) return;
    if (!formName.trim()) {
      zoruSonnerToast.error('Segment name is required.');
      return;
    }
    startSaving(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      fd.set('name', formName.trim());
      if (formDesc.trim()) fd.set('description', formDesc.trim());
      if (formGender && formGender !== 'any') fd.set('filterGender', formGender);
      if (formAgeMin) fd.set('filterAgeMin', formAgeMin);
      if (formAgeMax) fd.set('filterAgeMax', formAgeMax);
      const res = await saveAudienceSegment(undefined, fd);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success(res.message ?? 'Segment saved.');
      setDialogOpen(false);
      resetForm();
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Users />}
          title="No project selected"
          description="Pick a Facebook page / project to view audience demographics and segments."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Audience</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Audience</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Demographic breakdown of Page fans and reusable audience segments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New segment
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load audience data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {loading && !demographics ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : (
          <>
            <DemoBars title="Gender" buckets={buckets.gender} />
            <DemoBars title="Age" buckets={buckets.age} />
            <DemoBars title="Top countries" buckets={buckets.countries} />
          </>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Saved segments</CardTitle>
        </CardHeader>
        <CardBody>
          {loading && segments.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : segments.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No segments yet"
              description="Create a segment to group people by gender, age, or location for campaigns."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {segments.map((s) => {
                const key = s._id ?? s.id ?? s.name ?? Math.random().toString(36);
                const size = s.size ?? s.contactCount ?? 0;
                const crit: string[] = [];
                if (s.filterGender) crit.push(`gender: ${s.filterGender}`);
                if (s.filterAgeMin || s.filterAgeMax) {
                  crit.push(
                    `age: ${s.filterAgeMin ?? '?'}-${s.filterAgeMax ?? '?'}`,
                  );
                }
                if (s.filterCountry) crit.push(`country: ${s.filterCountry}`);
                if (s.filterCity) crit.push(`city: ${s.filterCity}`);
                return (
                  <li
                    key={key}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--st-border)] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-[var(--st-text)]">
                        {s.name ?? '(untitled)'}
                      </p>
                      {s.description ? (
                        <p className="line-clamp-1 text-xs text-[var(--st-text-secondary)]">
                          {s.description}
                        </p>
                      ) : null}
                      {crit.length > 0 ? (
                        <p className="mt-0.5 text-[11px] text-[var(--st-text-tertiary)]">
                          {crit.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="secondary">
                      {Number(size).toLocaleString()} contacts
                    </Badge>
                    <span className="text-[11px] text-[var(--st-text-secondary)]">
                      {fmtDate(s.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New audience segment</DialogTitle>
            <DialogDescription>
              Define a reusable segment by gender, age, or freeform notes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seg-name">Name</Label>
              <Input
                id="seg-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="High-intent women, 25-34"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seg-desc">Description</Label>
              <Textarea
                id="seg-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                placeholder="Optional notes about who this segment targets."
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="seg-gender">Gender</Label>
                <Select value={formGender} onValueChange={setFormGender}>
                  <SelectTrigger id="seg-gender">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="seg-age-min">Min age</Label>
                <Input
                  id="seg-age-min"
                  type="number"
                  min={13}
                  value={formAgeMin}
                  onChange={(e) => setFormAgeMin(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="seg-age-max">Max age</Label>
                <Input
                  id="seg-age-max"
                  type="number"
                  min={13}
                  value={formAgeMax}
                  onChange={(e) => setFormAgeMax(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save segment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
