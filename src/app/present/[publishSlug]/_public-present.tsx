'use client';

import { useCallback, useEffect, useState } from 'react';

import type { SabshowSlideDoc } from '@/lib/rust-client/sabshow-slides';
import type { SabshowElementDoc } from '@/lib/rust-client/sabshow-elements';

import { SlideCanvas } from '@/app/dashboard/sabshow/[deckId]/present/_present-view';

interface PublicPresentProps {
    slug: string;
    slides: SabshowSlideDoc[];
    elementsBySlide: Record<string, SabshowElementDoc[]>;
}

export function PublicPresent({
    slug,
    slides,
    elementsBySlide,
}: PublicPresentProps) {
    const [idx, setIdx] = useState(0);
    const total = slides.length;
    const current = slides[idx] ?? null;

    const advance = useCallback(
        (delta: number) => setIdx((i) => Math.min(total - 1, Math.max(0, i + delta))),
        [total]
    );

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (
                e.key === 'ArrowRight' ||
                e.key === ' ' ||
                e.key === 'PageDown'
            ) {
                advance(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                advance(-1);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [advance]);

    if (!current) {
        return (
            <div className="zoruui sabshow-public flex h-screen items-center justify-center bg-black text-white">
                No slides
            </div>
        );
    }

    return (
        <div className="zoruui sabshow-public flex h-screen w-screen flex-col bg-black text-white">
            <div className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="font-medium">/present/{slug}</span>
                <span>
                    {idx + 1} / {total}
                </span>
            </div>
            <div className="flex flex-1 items-center justify-center p-4">
                <SlideCanvas
                    slide={current}
                    elements={elementsBySlide[current._id ?? ''] ?? []}
                />
            </div>
        </div>
    );
}
