'use client';

/**
 * Present mode client view.
 *
 * - Full-screen 16:9 canvas reusing the same absolute-positioning
 *   element renderer the editor uses.
 * - Arrow keys (left/right/Space/Esc) advance / exit.
 * - "n" toggles speaker / presenter view (current + next + notes).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonitorOff, X } from 'lucide-react';

import { Button, EmptyState, Kbd } from '@/components/sabcrm/20ui';
import type { SabshowSlideDoc } from '@/lib/rust-client/sabshow-slides';
import type { SabshowElementDoc } from '@/lib/rust-client/sabshow-elements';

const CANVAS_W = 1920;
const CANVAS_H = 1080;

interface PresentViewProps {
    deckTitle: string;
    slides: SabshowSlideDoc[];
    elementsBySlide: Record<string, SabshowElementDoc[]>;
    initialIndex: number;
}

export function PresentView({
    deckTitle,
    slides,
    elementsBySlide,
    initialIndex,
}: PresentViewProps) {
    const router = useRouter();
    const [idx, setIdx] = useState(initialIndex);
    const [presenterView, setPresenterView] = useState(false);

    const total = slides.length;
    const current = slides[idx] ?? null;
    const nextSlide = slides[idx + 1] ?? null;

    const advance = useCallback(
        (delta: number) => setIdx((i) => Math.min(total - 1, Math.max(0, i + delta))),
        [total]
    );

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
                advance(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                advance(-1);
            } else if (e.key === 'Escape') {
                router.back();
            } else if (e.key === 'n' || e.key === 'N') {
                setPresenterView((p) => !p);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [advance, router]);

    if (!current) {
        return (
            <div className="ui20 flex h-screen items-center justify-center bg-black">
                <EmptyState
                    icon={MonitorOff}
                    title="No slides to present"
                    description="This deck has no slides yet. Add a slide in the editor, then start present mode again."
                    action={
                        <Button variant="primary" onClick={() => router.back()}>
                            Back to editor
                        </Button>
                    }
                />
            </div>
        );
    }

    return (
        <div className="ui20 flex h-screen w-screen flex-col bg-black text-white">
            <div className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="font-medium">{deckTitle}</span>
                <span className="text-white/70">
                    {idx + 1} / {total}. Press <Kbd>n</Kbd> for presenter view, or{' '}
                    <Kbd>esc</Kbd> to exit.
                </span>
                <Button size="sm" variant="ghost" iconLeft={X} onClick={() => router.back()}>
                    Exit
                </Button>
            </div>

            {presenterView ? (
                <PresenterLayout
                    current={current}
                    next={nextSlide}
                    elementsBySlide={elementsBySlide}
                />
            ) : (
                <div className="flex flex-1 items-center justify-center p-4">
                    <SlideCanvas
                        slide={current}
                        elements={elementsBySlide[current._id ?? ''] ?? []}
                    />
                </div>
            )}
        </div>
    );
}

function PresenterLayout({
    current,
    next,
    elementsBySlide,
}: {
    current: SabshowSlideDoc;
    next: SabshowSlideDoc | null;
    elementsBySlide: Record<string, SabshowElementDoc[]>;
}) {
    return (
        <div className="grid flex-1 grid-cols-3 gap-3 p-3">
            <div className="col-span-2 flex items-center justify-center">
                <SlideCanvas
                    slide={current}
                    elements={elementsBySlide[current._id ?? ''] ?? []}
                />
            </div>
            <div className="flex flex-col gap-3">
                {next ? (
                    <SlideCanvas
                        slide={next}
                        elements={elementsBySlide[next._id ?? ''] ?? []}
                        scale={0.5}
                    />
                ) : (
                    <div className="flex h-1/3 items-center justify-center rounded-[var(--st-radius)] border border-white/20 text-sm text-white/60">
                        (last slide)
                    </div>
                )}
                <div className="flex-1 overflow-auto rounded-[var(--st-radius)] border border-white/20 p-3 text-sm">
                    <div className="mb-2 text-xs uppercase text-white/60">
                        Speaker notes
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                        {current.notes ?? ''}
                    </pre>
                </div>
            </div>
        </div>
    );
}

export function SlideCanvas({
    slide,
    elements,
    scale = 1,
}: {
    slide: SabshowSlideDoc;
    elements: SabshowElementDoc[];
    scale?: number;
}) {
    const sorted = useMemo(
        () => elements.slice().sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
        [elements]
    );
    return (
        <div
            className="relative aspect-video max-h-full w-full max-w-full origin-top-left overflow-hidden rounded-[var(--st-radius)] bg-white shadow-2xl"
            style={{
                transform: scale !== 1 ? `scale(${scale})` : undefined,
            }}
        >
            {sorted.map((el) => {
                const xPct = (el.x / CANVAS_W) * 100;
                const yPct = (el.y / CANVAS_H) * 100;
                const wPct = (el.w / CANVAS_W) * 100;
                const hPct = (el.h / CANVAS_H) * 100;
                const cfg = (el.configJson ?? {}) as Record<string, unknown>;
                return (
                    <div
                        key={el._id}
                        className="absolute"
                        style={{
                            left: `${xPct}%`,
                            top: `${yPct}%`,
                            width: `${wPct}%`,
                            height: `${hPct}%`,
                            transform: el.rotation
                                ? `rotate(${el.rotation}deg)`
                                : undefined,
                            background:
                                el.kind === 'shape' &&
                                typeof cfg.fill === 'string'
                                    ? (cfg.fill as string)
                                    : undefined,
                            color: el.kind === 'text' ? 'var(--st-text)' : undefined,
                        }}
                    >
                        {el.kind === 'text' ? (
                            <div className="h-full w-full overflow-hidden p-2 text-base">
                                {typeof cfg.value === 'string'
                                    ? (cfg.value as string)
                                    : ''}
                            </div>
                        ) : null}
                        {el.kind === 'image' ? (
                            <div className="flex h-full w-full items-center justify-center bg-[var(--st-bg-muted)] text-xs text-[var(--st-text)]">
                                {typeof cfg.fileId === 'string'
                                    ? `image: ${cfg.fileId as string}`
                                    : 'image'}
                            </div>
                        ) : null}
                        {el.kind === 'code' ? (
                            <pre className="h-full w-full overflow-hidden bg-[var(--st-text)] p-2 text-xs text-white">
                                {typeof cfg.value === 'string'
                                    ? (cfg.value as string)
                                    : ''}
                            </pre>
                        ) : null}
                    </div>
                );
            })}
            <span className="absolute right-2 top-1 text-[10px] text-[var(--st-text-secondary)]">
                {slide.title ?? ''}
            </span>
        </div>
    );
}
