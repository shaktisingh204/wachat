'use client';

import { m } from 'motion/react';
import { useMemo } from 'react';
import { MODULES_BY_SLUG, type ModuleSlug } from '../modules-data';

interface GenericHeroProps {
    slug: ModuleSlug;
}

export function GenericHero({ slug }: GenericHeroProps) {
    const mod = MODULES_BY_SLUG[slug];
    const Icon = mod.icon;
    // Deterministic-ish orbit positions derived from feature count, so each module's
    // generic hero feels themed and stable across renders.
    const positions = useMemo(() => {
        const n = Math.min(mod.features.length, 6);
        const r = 38;
        const out: { x: number; y: number; a: number }[] = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            out.push({ x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a), a });
        }
        return out;
    }, [mod.features.length]);

    return (
        <div className="relative h-full w-full">
            {/* glow */}
            <div
                aria-hidden
                className="absolute inset-0 rounded-[2rem] blur-3xl"
                style={{ background: mod.glow, opacity: 0.55 }}
            />

            <m.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="relative h-full w-full overflow-hidden rounded-[2rem] border backdrop-blur"
                style={{
                    background: `linear-gradient(150deg, ${mod.surface}, transparent 70%)`,
                    borderColor: `${mod.text}1a`,
                    boxShadow: `0 30px 80px -20px ${mod.glow}`,
                }}
            >
                {/* dot grid */}
                <div
                    aria-hidden
                    className="absolute inset-0 opacity-40"
                    style={{
                        backgroundImage: `radial-gradient(circle, ${mod.muted}55 1px, transparent 1px)`,
                        backgroundSize: '22px 22px',
                    }}
                />

                {/* orbit rings */}
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {[24, 36, 44].map((r, i) => (
                        <m.circle
                            key={r}
                            cx="50"
                            cy="50"
                            r={r}
                            fill="none"
                            stroke={mod.muted}
                            strokeOpacity={0.18 - i * 0.04}
                            strokeWidth="0.25"
                            strokeDasharray="2 2"
                            initial={{ rotate: 0 }}
                            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
                            transition={{ duration: 60 + i * 20, repeat: Infinity, ease: 'linear' }}
                            style={{ transformOrigin: '50% 50%' }}
                        />
                    ))}
                </svg>

                {/* center icon */}
                <m.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring' }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    <m.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        className={`relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-[0_18px_60px_-10px_rgba(0,0,0,0.5)]`}
                    >
                        <Icon className="h-10 w-10 text-white" />
                        <m.span
                            aria-hidden
                            className="absolute inset-0 rounded-3xl"
                            animate={{ opacity: [0, 0.45, 0] }}
                            transition={{ duration: 2.4, repeat: Infinity }}
                            style={{ background: `radial-gradient(circle at 50% 50%, ${mod.glow}, transparent 70%)` }}
                        />
                    </m.div>
                    <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: mod.muted }}>
                        {mod.tag}
                    </p>
                </m.div>

                {/* feature satellites */}
                {positions.map((pos, i) => {
                    const f = mod.features[i];
                    if (!f) return null;
                    const FIcon = f.icon;
                    return (
                        <m.div
                            key={f.title}
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 + i * 0.08, type: 'spring' }}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                        >
                            <m.div
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                                className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur"
                                style={{
                                    background: `${mod.text}0d`,
                                    borderColor: `${mod.muted}44`,
                                    color: mod.text,
                                }}
                            >
                                <div
                                    className={`grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}
                                >
                                    <FIcon className="h-3 w-3 text-white" />
                                </div>
                                {f.title}
                            </m.div>
                        </m.div>
                    );
                })}

                {/* bottom status bar */}
                <m.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-xl border px-4 py-2.5 text-[11px] backdrop-blur"
                    style={{
                        borderColor: `${mod.text}1a`,
                        background: `${mod.bg}cc`,
                        color: mod.text,
                    }}
                >
                    <div className="flex items-center gap-2">
                        <m.span
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ duration: 1.6, repeat: Infinity }}
                            className="h-2 w-2 rounded-full"
                            style={{ background: mod.muted, boxShadow: `0 0 8px ${mod.glow}` }}
                        />
                        <span className="font-semibold">{mod.name} · live</span>
                    </div>
                    <span style={{ color: `${mod.muted}cc` }}>
                        {mod.stats[0]?.value ?? '—'} · {mod.stats[0]?.label ?? ''}
                    </span>
                </m.div>
            </m.div>
        </div>
    );
}
