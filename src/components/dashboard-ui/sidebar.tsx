'use client';

import Link from 'next/link';
import { m, AnimatePresence } from 'motion/react';
import { ChevronRight, Search, X, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { MODULES_BY_SLUG, type ModuleSlug } from '@/components/landing-v2/modules-data';
import { ModuleTheme, EASE_OUT } from './module-theme';

// Mirror of the existing ZoruSidebarLeaf / Group shape so we can drop
// in the auto-resolved per-module menus without duplicating data.
export interface SidebarLeaf {
    id: string;
    label: string;
    href?: string;
    active?: boolean;
    icon?: ReactNode;
    badge?: ReactNode;
    onClick?: () => void;
    children?: SidebarLeaf[];
    defaultOpen?: boolean;
    adminOnly?: boolean;
}
export interface SidebarGroup {
    id: string;
    label?: string;
    defaultOpen?: boolean;
    items: SidebarLeaf[];
}

export interface SidebarProps {
    activeSlug: ModuleSlug;
    heading?: ReactNode;
    caption?: ReactNode;
    groups: SidebarGroup[];
    footer?: ReactNode;
    /** Hide the in-sidebar search input. */
    hideSearch?: boolean;
    searchPlaceholder?: string;
}

/**
 * Sidebar — 248px-wide column. Wrapped in <ModuleTheme>, so the heading,
 * active item, and accent everywhere resolve to the current module's color.
 */
export function Sidebar({
    activeSlug,
    heading,
    caption,
    groups,
    footer,
    hideSearch = false,
    searchPlaceholder = 'Find anything',
}: SidebarProps) {
    const [q, setQ] = useState('');
    const mod = MODULES_BY_SLUG[activeSlug];
    const ModIcon = mod.icon;
    const resolvedHeading = heading ?? mod.name;
    const resolvedCaption = caption ?? mod.tag;

    const filteredGroups = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return groups;
        const walk = (items: SidebarLeaf[]): SidebarLeaf[] => {
            const out: SidebarLeaf[] = [];
            for (const it of items) {
                if (it.label.toLowerCase().includes(term)) {
                    out.push(it);
                    continue;
                }
                if (it.children) {
                    const kept = walk(it.children);
                    if (kept.length > 0) out.push({ ...it, children: kept, defaultOpen: true });
                }
            }
            return out;
        };
        return groups.map((g) => ({ ...g, items: walk(g.items) })).filter((g) => g.items.length > 0);
    }, [groups, q]);

    return (
        <ModuleTheme
            slug={activeSlug}
            as="aside"
            className="relative z-20 flex h-full w-[248px] shrink-0 flex-col border-r border-zinc-200 bg-[#fafaf7]"
        >
            {/* Heading: module icon + name in accent, tag below */}
            <div className="border-b border-zinc-200/70 px-4 pb-4 pt-5">
                <div className="flex items-center gap-2.5">
                    <span
                        className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-[0_8px_18px_-8px_var(--mt-accent-glow)]"
                        style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 60%, white))' }}
                    >
                        <ModIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-950">{resolvedHeading}</h2>
                        {resolvedCaption && (
                            <p className="truncate text-[11px] text-zinc-500">{resolvedCaption}</p>
                        )}
                    </div>
                </div>

                {!hideSearch && (
                    <label className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 transition-colors focus-within:border-zinc-400">
                        <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                            aria-label="Search this module"
                        />
                        {q && (
                            <button
                                type="button"
                                onClick={() => setQ('')}
                                aria-label="Clear"
                                className="text-zinc-400 hover:text-zinc-700"
                            >
                                <X className="h-3 w-3" strokeWidth={2.25} />
                            </button>
                        )}
                    </label>
                )}
            </div>

            {/* Grouped nav */}
            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {filteredGroups.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[12px] text-zinc-500">No matches.</p>
                ) : (
                    filteredGroups.map((group, gi) => (
                        <GroupBlock key={group.id} group={group} index={gi} forceOpen={!!q.trim()} />
                    ))
                )}
            </nav>

            {/* Optional footer (plan card, upgrade prompt, etc.) */}
            {footer && <div className="border-t border-zinc-200/70 p-3">{footer}</div>}
        </ModuleTheme>
    );
}

function GroupBlock({ group, index, forceOpen }: { group: SidebarGroup; index: number; forceOpen: boolean }) {
    return (
        <div className={index > 0 ? 'mt-4' : ''}>
            {group.label && (
                <h3 className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    {group.label}
                </h3>
            )}
            <ul className="space-y-0.5">
                {group.items.map((item, ii) => (
                    <li key={item.id}>
                        <LeafRow item={item} depth={0} delay={0.02 + ii * 0.015} forceOpen={forceOpen} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

function LeafRow({ item, depth, delay, forceOpen }: { item: SidebarLeaf; depth: number; delay: number; forceOpen: boolean }) {
    const hasKids = !!item.children?.length;
    const [open, setOpen] = useState(forceOpen || !!item.defaultOpen);

    if (forceOpen && !open) setOpen(true);

    const indent = depth === 0 ? 'pl-2' : depth === 1 ? 'pl-7' : 'pl-12';
    const isActive = !!item.active;

    const inner = (
        <>
            {/* Active indicator: thin gradient bar on left */}
            {isActive && (
                <m.span
                    layoutId="sidebar-active-bar"
                    aria-hidden
                    className="absolute left-0 top-1.5 h-[18px] w-[3px] rounded-r-full"
                    style={{ background: 'var(--mt-accent)' }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                />
            )}
            {item.icon && (
                <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
                    style={{ color: isActive ? 'var(--mt-accent)' : '#71717a' }}
                >
                    {/* shrink any lucide icon to size */}
                    <span className="[&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>
                </span>
            )}
            <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.label}</span>
            {item.badge && (
                <span className="ml-1 inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider" style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}>
                    {item.badge}
                </span>
            )}
            {hasKids && (
                <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                    strokeWidth={2.25}
                    aria-hidden
                />
            )}
        </>
    );

    const rowCls = `group relative flex w-full items-center gap-2 rounded-md py-1.5 pr-2 ${indent} text-left transition-[background-color,color] duration-150 active:scale-[0.985]`;
    const rowStyle: React.CSSProperties = {
        backgroundColor: isActive ? 'var(--mt-accent-soft)' : 'transparent',
        color: isActive ? 'var(--mt-accent)' : '#3f3f46',
        fontWeight: isActive ? 600 : 500,
    };

    return (
        <m.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay, ease: EASE_OUT }}
        >
            {hasKids ? (
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                    className={`${rowCls} hover:bg-zinc-900/[0.04] hover:text-zinc-900`}
                    style={rowStyle}
                >
                    {inner}
                </button>
            ) : item.href ? (
                <Link
                    href={item.href}
                    onClick={item.onClick}
                    className={`${rowCls} hover:bg-zinc-900/[0.04] hover:text-zinc-900`}
                    style={rowStyle}
                    aria-current={isActive ? 'page' : undefined}
                >
                    {inner}
                </Link>
            ) : (
                <button
                    type="button"
                    onClick={item.onClick}
                    className={`${rowCls} hover:bg-zinc-900/[0.04] hover:text-zinc-900`}
                    style={rowStyle}
                >
                    {inner}
                </button>
            )}

            <AnimatePresence initial={false}>
                {hasKids && open && (
                    <m.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                        className="overflow-hidden"
                    >
                        {item.children!.map((kid, ki) => (
                            <li key={kid.id}>
                                <LeafRow item={kid} depth={depth + 1} delay={ki * 0.01} forceOpen={forceOpen} />
                            </li>
                        ))}
                    </m.ul>
                )}
            </AnimatePresence>
        </m.div>
    );
}
