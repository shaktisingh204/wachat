'use client';

import {
  Button,
  Calendar,
  Card,
  CardBody,
  CardDescription,
  CardTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
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
import { AdManagerProvider, useAdManager } from '@/context/ad-manager-context';
import {
  AdManagerShellContext,
  type AdManagerShellState,
} from '@/context/ad-manager-shell-context';

/**
 * /dashboard/ad-manager layout. 20ui chrome.
 *
 * Provides the AdManagerShell context (search, date range, preset)
 * that all child pages consume via useAdManagerShell(). Feature-locked
 * behind the `whatsappAds` plan feature.
 *
 * The sidebar and topbar come from the parent dashboard shell. this layout
 * only handles the in-page toolbar and feature gating.
 */

import * as React from 'react';

import { DATE_PRESETS } from '@/components/zoruui-domain/ad-manager/constants';

/* Feature lock overlay */

function MetaFeatureLock() {
  const router = useRouter();
  return (
    <Card className="mt-6">
      <CardBody className="flex flex-col items-center justify-center gap-5 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
          <Lock className="h-7 w-7 text-[var(--st-text-secondary)]" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div>
          <CardTitle className="text-[20px] font-semibold text-[var(--st-text)]">
            Meta Ads Manager is locked
          </CardTitle>
          <CardDescription className="mt-1.5 max-w-md text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
            Upgrade your plan to access Facebook and Instagram ad campaigns,
            audiences, creative library, and performance insights.
          </CardDescription>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push('/dashboard/user/billing#upgrade')}
        >
          Explore plans
        </Button>
      </CardBody>
    </Card>
  );
}

/* Date range picker */

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
        <Button variant="outline" size="sm" className="rounded-full" iconLeft={CalendarIcon}>
          {DATE_PRESETS.find((p) => p.id === preset)?.label ||
            (date?.from
              ? `${format(date.from, 'LLL dd')} - ${date.to ? format(date.to, 'LLL dd') : ''}`
              : 'Last 7 days')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto" align="end">
        <div className="flex">
          <ScrollArea className="h-[340px] border-r border-[var(--st-border)] w-40">
            <div className="p-2 flex flex-col gap-0.5">
              {DATE_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    'justify-start w-full text-left',
                    preset === p.id
                      ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)] font-medium'
                      : 'text-[var(--st-text-secondary)]',
                  )}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </ScrollArea>
          <Calendar
            mode="range"
            value={date}
            onChange={(d) => {
              setDate(d);
              setPreset('custom');
            }}
            numberOfMonths={2}
            autoFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* Account indicator pill */

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
        className="mr-1.5 flex h-4 w-4 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-text)] text-[8px] font-bold text-[var(--st-bg)]"
        aria-hidden="true"
      >
        {(activeAccount?.name || 'AD').slice(0, 2).toUpperCase()}
      </span>
      {activeAccount?.name || 'Select account'}
      <ChevronsUpDown className="ml-1.5 h-3 w-3 opacity-60" aria-hidden="true" />
    </Button>
  );
}

/* Layout */

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

  // Wrap children in `AdManagerProvider` so child pages, and the
  // `AccountPill` below, which calls `useAdManager`, always have a
  // provider in scope. Some higher-level chromes provide it ambiently
  // and others do not; making this layout self-sufficient avoids the
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
            <div className="hidden sm:block">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns..."
                iconLeft={Search}
                inputSize="sm"
                aria-label="Search campaigns"
                className="w-56"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DateRangeBar date={date} setDate={setDate} preset={preset} setPreset={setPreset} />
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              onClick={() => router.push('/dashboard/ad-manager/create')}
            >
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
