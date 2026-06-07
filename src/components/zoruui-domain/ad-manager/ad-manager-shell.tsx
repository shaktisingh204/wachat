'use client';

import {
  Avatar,
  AvatarFallback,
  Button,
  IconButton,
  Calendar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  cn,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
import {
  ChevronsUpDown,
  Search,
  Bell,
  HelpCircle,
  Facebook,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

/**
 * Meta-style Ad Manager in-page toolbar.
 *
 * The left-hand navigation lives in the app's main AppSidebar (see
 * `adManagerMenuItems` in dashboard-config.ts), so this shell only
 * renders an in-content toolbar (account switcher, search, date
 * range, create, help) and a context provider that child pages use
 * to read the global search / date state.
 *
 * It does NOT use negative margins or force a fixed height. It
 * lays out naturally inside the dashboard's main content area.
 */

import * as React from 'react';
import Link from 'next/link';

import { useAdManager } from '@/context/ad-manager-context';
import { DATE_PRESETS } from './constants';

function AccountSwitcher() {
    const { activeAccount } = useAdManager();
    return (
        <Link href="/dashboard/ad-manager/ad-accounts" className="shrink-0 hidden sm:block">
            <Button
                variant="outline"
                className="h-10 justify-between gap-3 px-3 text-left text-sm font-medium w-[200px] lg:w-[240px] xl:w-[260px]"
            >
                <span className="flex items-center gap-2 truncate">
                    <Avatar className="h-6 w-6 border-[var(--st-border)]">
                        <AvatarFallback className="text-[10px] bg-[var(--st-text)] text-white">
                            {(activeAccount?.name || 'AD').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                        <span className="block truncate leading-tight">
                            {activeAccount?.name || 'Select ad account'}
                        </span>
                        {activeAccount?.account_id && (
                            <span className="block text-[10px] font-mono text-[var(--st-text-secondary)]">
                                {activeAccount.account_id}
                            </span>
                        )}
                    </span>
                </span>
                <ChevronsUpDown className="h-4 w-4 text-[var(--st-text-secondary)] shrink-0" aria-hidden="true" />
            </Button>
        </Link>
    );
}

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
                <Button variant="outline" size="sm" className="h-10" iconLeft={CalendarIcon}>
                    {DATE_PRESETS.find((p) => p.id === preset)?.label ||
                        (date?.from
                            ? `${format(date.from, 'LLL dd')} to ${date.to ? format(date.to, 'LLL dd') : ''}`
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
                                        'justify-start h-auto py-1.5 text-left text-sm',
                                        preset === p.id && 'bg-[var(--st-text)]/10 text-[var(--st-text)] font-medium',
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
    if (!ctx) throw new Error('useAdManagerShell must be used inside AdManagerShell');
    return ctx;
}

function HelpMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton label="Help and resources" icon={HelpCircle} className="h-10 w-10" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Help and resources</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <a href="https://www.facebook.com/business/help" target="_blank" rel="noreferrer">
                        Meta Business Help Center
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <a href="https://developers.facebook.com/docs/marketing-apis" target="_blank" rel="noreferrer">
                        Marketing API docs
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AdManagerShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [search, setSearch] = React.useState('');
    const [date, setDate] = React.useState<DateRange | undefined>();
    const [preset, setPreset] = React.useState<string>('last_7d');

    const state: AdManagerShellState = React.useMemo(
        () => ({ search, setSearch, date, setDate, preset, setPreset }),
        [search, date, preset],
    );

    return (
        <AdManagerShellContext.Provider value={state}>
            <div className="flex flex-col gap-4">
                {/* In-page Meta toolbar: two rows on narrow, one on wide */}
                <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-sm p-2 space-y-2 md:space-y-0">
                    {/* Row 1: logo + account + search (always on top on narrow) */}
                    <div className="flex items-center gap-2 md:flex-1 md:min-w-0">
                        <div className="flex items-center gap-2 font-semibold text-[var(--st-text)] pr-2 border-r border-[var(--st-border)] mr-1 shrink-0">
                            <div className="h-7 w-7 rounded-md bg-[var(--st-text)] text-white flex items-center justify-center">
                                <Facebook className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <span className="hidden md:inline text-sm tracking-tight">Ads Manager</span>
                        </div>

                        <AccountSwitcher />

                        <div className="flex-1 min-w-0 max-w-xl">
                            <Field className="!gap-0" label={<span className="sr-only">Search ads</span>}>
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name, ID or metric"
                                    iconLeft={Search}
                                    className="h-10"
                                />
                            </Field>
                        </div>

                        {/* Desktop-only controls (inline on md+) */}
                        <div className="hidden md:flex items-center gap-1.5 shrink-0">
                            <DateRangeBar date={date} setDate={setDate} preset={preset} setPreset={setPreset} />
                            <Button
                                variant="primary"
                                size="sm"
                                className="h-10"
                                iconLeft={Plus}
                                onClick={() => router.push('/dashboard/ad-manager/create')}
                            >
                                Create
                            </Button>
                            <IconButton label="Notifications" icon={Bell} className="h-10 w-10" />
                            <HelpMenu />
                        </div>
                    </div>

                    {/* Row 2 on narrow: date + create + icons */}
                    <div className="flex md:hidden items-center gap-1.5">
                        <div className="flex-1">
                            <DateRangeBar date={date} setDate={setDate} preset={preset} setPreset={setPreset} />
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            className="h-10"
                            iconLeft={Plus}
                            onClick={() => router.push('/dashboard/ad-manager/create')}
                        >
                            Create
                        </Button>
                        <IconButton label="Notifications" icon={Bell} className="h-10 w-10" />
                        <HelpMenu />
                    </div>
                </div>

                {/* Page content */}
                <div className="min-h-[400px]">
                    {children}
                </div>
            </div>
        </AdManagerShellContext.Provider>
    );
}
