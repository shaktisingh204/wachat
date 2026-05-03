'use client';

/**
 * /dashboard/ad-manager layout — Clay chrome.
 *
 * Provides the AdManagerShell context (search, date range, preset)
 * that all child pages consume via useAdManagerShell(). Feature-locked
 * behind the `whatsappAds` plan feature.
 *
 * The sidebar and topbar come from ClayDashboardLayout (context="meta-suite")
 * wired in the DashboardChromeDispatcher — this layout only handles
 * the in-page toolbar and feature gating.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  LuSearch,
  LuCalendar,
  LuPlus,
  LuChevronsUpDown,
  LuLock,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { useAdManager } from '@/context/ad-manager-context';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayInput } from '@/components/clay';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DATE_PRESETS } from '@/components/wabasimplify/ad-manager/constants';

/* ── Shell context ─────────────────────────────────────────────── */

export type AdManagerShellState = {
  search: string;
  setSearch: (s: string) => void;
  date: DateRange | undefined;
  setDate: (d: DateRange | undefined) => void;
  preset: string;
  setPreset: (p: string) => void;
};

const AdManagerShellContext = React.createContext<AdManagerShellState | null>(null);

export function useAdManagerShell() {
  const ctx = React.useContext(AdManagerShellContext);
  if (!ctx) throw new Error('useAdManagerShell must be used inside ad-manager layout');
  return ctx;
}

/* ── Feature lock overlay ──────────────────────────────────────── */

function MetaFeatureLock() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <LuLock className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} />
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
      <ClayButton
        variant="obsidian"
        size="md"
        onClick={() => router.push('/dashboard/user/billing#upgrade')}
      >
        Explore plans
      </ClayButton>
    </div>
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
      <PopoverTrigger asChild>
        <ClayButton variant="pill" size="sm">
          <LuCalendar className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          {DATE_PRESETS.find((p) => p.id === preset)?.label ||
            (date?.from
              ? `${format(date.from, 'LLL dd')} – ${date.to ? format(date.to, 'LLL dd') : ''}`
              : 'Last 7 days')}
        </ClayButton>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto" align="end">
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
      </PopoverContent>
    </Popover>
  );
}

/* ── Account indicator pill ────────────────────────────────────── */

function AccountPill() {
  const { activeAccount } = useAdManager();
  const router = useRouter();

  return (
    <ClayButton
      variant="pill"
      size="sm"
      trailing={<LuChevronsUpDown className="h-3 w-3 opacity-60" />}
      onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}
    >
      <span
        className="mr-1.5 flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold text-white"
        style={{ background: '#4F46E5' }}
      >
        {(activeAccount?.name || 'AD').slice(0, 2).toUpperCase()}
      </span>
      {activeAccount?.name || 'Select account'}
    </ClayButton>
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

  return (
    <AdManagerShellContext.Provider value={state}>
      {/* In-page toolbar */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <AccountPill />

          {/* Search */}
          <div className="relative hidden sm:block">
            <LuSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <ClayInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="h-8 w-56 pl-8 text-[12px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DateRangeBar date={date} setDate={setDate} preset={preset} setPreset={setPreset} />
          <ClayButton
            variant="obsidian"
            size="sm"
            onClick={() => router.push('/dashboard/ad-manager/create')}
          >
            <LuPlus className="mr-1 h-3.5 w-3.5" />
            Create
          </ClayButton>
        </div>
      </div>

      {/* Page content */}
      {children}
    </AdManagerShellContext.Provider>
  );
}
