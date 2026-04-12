'use client';

/**
 * Meta-style Ad Manager in-page toolbar.
 *
 * The left-hand navigation lives in the app's main AppSidebar (see
 * `adManagerMenuItems` in dashboard-config.ts), so this shell only
 * renders an in-content toolbar (account switcher, search, date
 * range, create, help) and a context provider that child pages use
 * to read the global search / date state.
 *
 * It does NOT use negative margins or force a fixed height — it
 * lays out naturally inside the dashboard's main content area.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ChevronsUpDown, Search, Bell, HelpCircle, Facebook,
    Calendar as CalendarIcon, Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdManager } from '@/context/ad-manager-context';
import { DATE_PRESETS } from './constants';

function AccountSwitcher() {
    const { activeAccount } = useAdManager();
    return (
        <Link href="/dashboard/ad-manager/ad-accounts" className="shrink-0 hidden sm:block">
            <Button
                variant="outline"
                className="h-10 justify-between gap-3 rounded-lg px-3 text-left text-sm font-medium w-[200px] lg:w-[240px] xl:w-[260px]"
            >
                <div className="flex items-center gap-2 truncate">
                    <Avatar className="h-6 w-6 border">
                        <AvatarFallback className="text-[10px] bg-[#1877F2] text-white">
                            {(activeAccount?.name || 'AD').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="truncate">
                        <div className="truncate leading-tight">
                            {activeAccount?.name || 'Select ad account'}
                        </div>
                        {activeAccount?.account_id && (
                            <div className="text-[10px] font-mono text-muted-foreground">
                                {activeAccount.account_id}
                            </div>
                        )}
                    </div>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
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
                <Button variant="outline" size="sm" className="h-10 rounded-lg">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {DATE_PRESETS.find((p) => p.id === preset)?.label ||
                        (date?.from
                            ? `${format(date.from, 'LLL dd')} – ${date.to ? format(date.to, 'LLL dd') : ''}`
                            : 'Last 7 days')}
                </Button>
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
                                        'text-left text-sm px-2 py-1.5 rounded hover:bg-muted',
                                        preset === p.id && 'bg-[#1877F2]/10 text-[#1877F2] font-medium',
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
                {/* In-page Meta toolbar — two rows on narrow, one on wide */}
                <div className="rounded-xl border bg-background shadow-sm p-2 space-y-2 md:space-y-0">
                    {/* Row 1: logo + account + search (always on top on narrow) */}
                    <div className="flex items-center gap-2 md:flex-1 md:min-w-0">
                        <div className="flex items-center gap-2 font-semibold text-[#1877F2] pr-2 border-r mr-1 shrink-0">
                            <div className="h-7 w-7 rounded-md bg-[#1877F2] text-white flex items-center justify-center">
                                <Facebook className="h-4 w-4" />
                            </div>
                            <span className="hidden md:inline text-sm tracking-tight">Ads Manager</span>
                        </div>

                        <AccountSwitcher />

                        <div className="relative flex-1 min-w-0 max-w-xl">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name, ID or metric"
                                className="h-10 pl-9 rounded-lg bg-muted/60 border-0 focus-visible:ring-2 focus-visible:ring-[#1877F2]/40"
                            />
                        </div>

                        {/* Desktop-only controls (inline on md+) */}
                        <div className="hidden md:flex items-center gap-1.5 shrink-0">
                            <DateRangeBar date={date} setDate={setDate} preset={preset} setPreset={setPreset} />
                            <Button
                                size="sm"
                                className="h-10 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white rounded-lg"
                                onClick={() => router.push('/dashboard/ad-manager/create')}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Create
                            </Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
                                <Bell className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
                                        <HelpCircle className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Help & resources</DropdownMenuLabel>
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
                        </div>
                    </div>

                    {/* Row 2 on narrow: date + create + icons */}
                    <div className="flex md:hidden items-center gap-1.5">
                        <div className="flex-1">
                            <DateRangeBar date={date} setDate={setDate} preset={preset} setPreset={setPreset} />
                        </div>
                        <Button
                            size="sm"
                            className="h-10 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white rounded-lg"
                            onClick={() => router.push('/dashboard/ad-manager/create')}
                        >
                            <Plus className="h-4 w-4 mr-1" /> Create
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
                            <Bell className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
                                    <HelpCircle className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Help & resources</DropdownMenuLabel>
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
