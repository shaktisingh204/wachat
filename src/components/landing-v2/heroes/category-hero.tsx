'use client';

import { m } from 'motion/react';
import { MODULES_BY_SLUG, type ModuleSlug } from '../modules-data';
import { CategoryMockup } from '../mockups';

interface CategoryHeroProps {
    slug: ModuleSlug;
}

export function CategoryHero({ slug }: CategoryHeroProps) {
    const mod = MODULES_BY_SLUG[slug];
    const Icon = mod.icon;
    return (
        <div className="relative h-full w-full">
            <div
                aria-hidden
                className="absolute inset-0 rounded-[2.5rem] blur-3xl"
                style={{ background: mod.glow, opacity: 0.55 }}
            />
            <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative h-full w-full"
            >
                {/* large card */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full max-w-md">
                        <CategoryMockup mod={mod} />
                    </div>
                </div>

                {/* floating accent chip top-left */}
                <m.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: [0, -4, 0] }}
                    transition={{ y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
                    className="absolute left-2 top-6 hidden items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[11px] font-semibold shadow-lg md:flex"
                    style={{ borderColor: `${mod.accentDeep}30`, color: mod.accentDeep, boxShadow: `0 12px 30px -10px ${mod.glow}` }}
                >
                    <span className={`grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}>
                        <Icon className="h-2.5 w-2.5 text-white" />
                    </span>
                    {mod.category}
                </m.div>

                {/* floating accent chip bottom-right */}
                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, y: [0, 4, 0] }}
                    transition={{ opacity: { delay: 0.4 }, y: { duration: 4, delay: 0.4, repeat: Infinity, ease: 'easeInOut' } }}
                    className="absolute -bottom-2 right-2 hidden items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-lg md:flex"
                    style={{ borderColor: `${mod.accentDeep}30`, boxShadow: `0 12px 30px -10px ${mod.glow}` }}
                >
                    <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: mod.accentDeep, boxShadow: `0 0 8px ${mod.glow}` }}
                    />
                    {mod.stats[0]?.value} {mod.stats[0]?.label}
                </m.div>
            </m.div>
        </div>
    );
}
