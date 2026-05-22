'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  Input,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ScrollArea,
  Select,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Search,
  Calendar as CalendarIcon,
  Plus,
  ChevronsUpDown,
  Lock,
  } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { AdManagerProvider,
  useAdManager } from '@/context/ad-manager-context';
import {
  AdManagerShellContext,
  type AdManagerShellState,
  } from '@/context/ad-manager-shell-context';

/**
 * /dashboard/ad-manager layout — ZoruUI chrome.
 *
 * Provides the AdManagerShell context (search, date range, preset)
 * that all child pages consume via useAdManagerShell(). Feature-locked
 * behind the `whatsappAds` plan feature.
 *
 * The sidebar and topbar come from the parent dashboard ZoruHomeShell —
 * this layout only handles the in-page toolbar and feature gating.
 */

import * as React from 'react';

import { Calendar } from '@/components/ui/calendar';
import { DATE_PRESETS } from '@/components/wabasimplify/ad-manager/constants';

/* ── Feature lock overlay ──────────────────────────────────────── */

function MetaFeatureLock() {
  const router = useRouter();
  return (
    <Card className="mt-6">
      <ZoruCardContent className="flex flex-col items-center justify-center gap-5 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Lock className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold text-foreground">
            Meta Ads Manager is locked
          </h2>
          <p className="mt-1.5 max-w-md text-[13px] text-muted-foreground leading-relaxed">
            Upgrade your plan to access Facebook & Instagram ad campaigns,
            audiences, creative library, and performance insights.
          </p>
        </div>
        <Button
          variant="default"
          size="md"
          onClick={() => router.push('/dashboard/user/billing#upgrade')}
        >
          Explore plans
        </Button>
      </ZoruCardContent>
    </Card>
  );
}

/* ── Date range picker ─────────────────────────────────────────── */

function DateRangeBar({
  date,
  setDate,
  preset,
  setPreset,
}: {
  date: DateRange | undefined;
  setDate: (d: DateRange | undefined) => void;
  preset: string;
  setPreset: (p: string) => void;
}) {
  return (
    <Popover>
      <ZoruPopoverTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          {DATE_PRESETS.find((p) => p.id === preset)?.label ||
            (date?.from
              ? `${format(date.from, 'LLL dd')} – ${date.to ? format(date.to, 'LLL dd') : ''}`
              : 'Last 7 days')}
        </Button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent className="p-0 w-auto" align="end">
        <div className="flex">
          <ScrollArea className="h-[340px] border-r w-40">
            <div className="p-2 flex flex-col">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    'text-left text-sm px-2 py-1.5 rounded transition',
                    preset === p.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </ScrollArea>
          <Calendar
            mode="range"
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setPreset('custom');
            }}
            numberOfMonths={2}
            initialFocus
          />
        </div>
      </ZoruPopoverContent>
    </Popover>
  );
}

/* ── Account indicator pill ────────────────────────────────────── */

function AccountPill() {
  const { activeAccount } = useAdManager();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}
    >
      <span
        className="mr-1.5 flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold text-white"
        style={{ background: '#4F46E5' }}
      >
        {(activeAccount?.name || 'AD').slice(0, 2).toUpperCase()}
      </span>
      {activeAccount?.name || 'Select account'}
      <ChevronsUpDown className="ml-1.5 h-3 w-3 opacity-60" />
    </Button>
  );
}

/* ── Layout ────────────────────────────────────────────────────── */

export default function AdManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sessionUser } = useProject();
  const isAllowed = sessionUser?.plan?.features?.whatsappAds ?? false;

  const [search, setSearch] = React.useState('');
  const [date, setDate] = React.useState<DateRange | undefined>();
  const [preset, setPreset] = React.useState<string>('last_7d');

  const state: AdManagerShellState = React.useMemo(
    () => ({ search, setSearch, date, setDate, preset, setPreset }),
    [search, date, preset],
  );

  if (!isAllowed) {
    return <MetaFeatureLock />;
  }

  // Wrap children in `AdManagerProvider` so child pages — and the
  // `AccountPill` below, which calls `useAdManager` — always have a
  // provider in scope. Some higher-level chromes provide it ambiently
  // and others don't; making this layout self-sufficient avoids the
  // "useAdManager must be used within an AdManagerProvider" runtime
  // crash on direct `/dashboard/ad-manager/*` page loads.
  return (
    <AdManagerProvider>
      <AdManagerShellContext.Provider value={state}>
        {/* In-page toolbar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <AccountPill />

          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 z-10" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="h-8 w-56 pl-8 text-[12px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DateRangeBar date={date} setDate={setDate} preset={preset} setPreset={setPreset} />
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push('/dashboard/ad-manager/create')}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      </div>

        {/* Page content */}
        {children}
      </AdManagerShellContext.Provider>
    </AdManagerProvider>
  );
}
