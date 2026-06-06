'use client';

/**
 * SabShow deck editor — three-pane shell:
 *
 *   ┌──────────┬─────────────────────────┬────────────┐
 *   │ slides   │  canvas (selected slide)│ properties │
 *   │ sidebar  │  + toolbar              │ panel      │
 *   ├──────────┴─────────────────────────┴────────────┤
 *   │ speaker notes drawer                            │
 *   └─────────────────────────────────────────────────┘
 *
 * State model:
 *   - `slides` is the authoritative list of slides for the deck.
 *   - `elements` holds the elements for the currently selected slide.
 *   - `selectedElementId` drives the properties panel and the focus
 *     ring on the canvas.
 *
 * All mutations go through server actions (`sabshow.actions`) and the
 * local state is reconciled with the returned doc. Optimistic updates
 * for drag/resize are local-only and saved on mouseup.
 *
 * Real-time collab is wired through `IShowTransport` from
 * `src/lib/sabshow/transport.ts`; today only the `MockTransport` is
 * mounted, so peers see nothing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
    Input,
    Label,
    Textarea,
    Separator,
    ScrollArea,
} from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
    addSabshowElement,
    addSabshowSlide,
    deleteSabshowElement,
    deleteSabshowSlide,
    duplicateSabshowSlide,
    listSabshowElements,
    reorderSabshowSlide,
    saveSabshowVersion,
    updateSabshowDeck,
    updateSabshowElement,
    updateSabshowSlide,
} from '@/app/actions/sabshow.actions';
import { createShowTransport, type IShowTransport } from '@/lib/sabshow/transport';
import type { SabshowDeckDoc } from '@/lib/rust-client/sabshow-decks';
import type {
    SabshowSlideDoc,
    SabshowSlideLayoutKind,
} from '@/lib/rust-client/sabshow-slides';
import type {
    SabshowElementDoc,
    SabshowElementKind,
} from '@/lib/rust-client/sabshow-elements';

// 16:9 canvas in absolute units. Slides are rendered at this size and
// CSS-scaled to the visible viewport.
const CANVAS_W = 1920;
const CANVAS_H = 1080;

interface DeckEditorShellProps {
    deck: SabshowDeckDoc;
    initialSlides: SabshowSlideDoc[];
    initialElements: SabshowElementDoc[];
    initialSlideId: string | null;
}

type DragMode = 'move' | 'resize-se' | null;

export function DeckEditorShell({
    deck,
    initialSlides,
    initialElements,
    initialSlideId,
}: DeckEditorShellProps) {
    const [slides, setSlides] = useState<SabshowSlideDoc[]>(initialSlides);
    const [selectedSlideId, setSelectedSlideId] = useState<string | null>(
        initialSlideId
    );
    const [elements, setElements] = useState<SabshowElementDoc[]>(initialElements);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [title, setTitle] = useState(deck.title);
    const [pending, setPending] = useState(false);

    /* ── transport (mock for now) ─────────────────────────────────── */
    const transportRef = useRef<IShowTransport | null>(null);
    useEffect(() => {
        if (!deck._id) return;
        const t = createShowTransport();
        transportRef.current = t;
        void t.connect(deck._id);
        return () => {
            void t.disconnect();
            transportRef.current = null;
        };
    }, [deck._id]);

    /* ── slide switch reloads elements ────────────────────────────── */
    useEffect(() => {
        if (!selectedSlideId) {
            setElements([]);
            return;
        }
        let cancelled = false;
        (async () => {
            const next = await listSabshowElements(selectedSlideId);
            if (!cancelled) setElements(next);
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedSlideId]);

    const selectedElement = useMemo(
        () => elements.find((e) => e._id === selectedElementId) ?? null,
        [elements, selectedElementId]
    );

    /* ── title persist ───────────────────────────────────────────── */
    const persistTitle = useCallback(async () => {
        if (!deck._id || title === deck.title) return;
        await updateSabshowDeck(deck._id, { title });
    }, [deck._id, deck.title, title]);

    /* ── slide actions ────────────────────────────────────────────── */
    async function handleAddSlide(layoutKind: SabshowSlideLayoutKind = 'content') {
        if (!deck._id) return;
        setPending(true);
        try {
            const slide = await addSabshowSlide(deck._id, undefined, layoutKind);
            setSlides((s) => [...s, slide]);
            setSelectedSlideId(slide._id ?? null);
            setSelectedElementId(null);
        } finally {
            setPending(false);
        }
    }
    async function handleDuplicateSlide(slideId: string) {
        setPending(true);
        try {
            const slide = await duplicateSabshowSlide(slideId);
            // Refetch full slide list to get correct positions.
            const newSlide = slide;
            setSlides((s) => {
                const next = [...s];
                next.splice(newSlide.position, 0, newSlide);
                return next.map((sl, i) => ({ ...sl, position: i }));
            });
            setSelectedSlideId(newSlide._id ?? null);
        } finally {
            setPending(false);
        }
    }
    async function handleDeleteSlide(slideId: string) {
        if (!deck._id) return;
        setPending(true);
        try {
            await deleteSabshowSlide(slideId, deck._id);
            setSlides((s) =>
                s.filter((sl) => sl._id !== slideId).map((sl, i) => ({ ...sl, position: i }))
            );
            if (selectedSlideId === slideId) {
                setSelectedSlideId(null);
            }
        } finally {
            setPending(false);
        }
    }
    async function handleMoveSlide(slideId: string, delta: -1 | 1) {
        const idx = slides.findIndex((s) => s._id === slideId);
        if (idx < 0) return;
        const next = idx + delta;
        if (next < 0 || next >= slides.length) return;
        const updated = await reorderSabshowSlide(slideId, next);
        setSlides((s) => {
            const copy = [...s];
            const [m] = copy.splice(idx, 1);
            copy.splice(next, 0, { ...m, position: next });
            return copy.map((sl, i) => ({ ...sl, position: i }));
        });
        // Server's authoritative `position` is now `updated.position`.
        void updated;
    }

    /* ── element actions ──────────────────────────────────────────── */
    async function handleInsertElement(
        kind: SabshowElementKind,
        configJson: unknown = {}
    ) {
        if (!selectedSlideId) return;
        const defaults: Record<SabshowElementKind, { w: number; h: number }> = {
            text: { w: 480, h: 80 },
            image: { w: 480, h: 320 },
            shape: { w: 200, h: 200 },
            chart: { w: 600, h: 360 },
            video: { w: 640, h: 360 },
            code: { w: 600, h: 240 },
        };
        const { w, h } = defaults[kind];
        const element = await addSabshowElement(selectedSlideId, kind, {
            x: 120,
            y: 120,
            w,
            h,
            configJson:
                kind === 'text'
                    ? { value: 'New text' }
                    : kind === 'shape'
                      ? { shape: 'rect', fill: '#22c55e' }
                      : kind === 'code'
                        ? { lang: 'ts', value: '// code' }
                        : configJson,
        });
        setElements((els) => [...els, element]);
        setSelectedElementId(element._id ?? null);
    }

    async function handleUpdateElement(
        elementId: string,
        patch: Partial<SabshowElementDoc>
    ) {
        // Optimistic.
        setElements((els) =>
            els.map((e) => (e._id === elementId ? { ...e, ...patch } : e))
        );
        const server = await updateSabshowElement(elementId, patch);
        setElements((els) => els.map((e) => (e._id === elementId ? server : e)));
    }

    async function handleDeleteElement(elementId: string) {
        if (!deck._id) return;
        await deleteSabshowElement(elementId, deck._id);
        setElements((els) => els.filter((e) => e._id !== elementId));
        if (selectedElementId === elementId) setSelectedElementId(null);
    }

    /* ── canvas drag/resize ──────────────────────────────────────── */
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{
        mode: DragMode;
        elementId: string;
        startX: number;
        startY: number;
        original: SabshowElementDoc;
    } | null>(null);

    function canvasCoords(clientX: number, clientY: number): { x: number; y: number } {
        const el = canvasRef.current;
        if (!el) return { x: 0, y: 0 };
        const rect = el.getBoundingClientRect();
        const scale = rect.width / CANVAS_W;
        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale,
        };
    }

    function startDrag(
        e: React.MouseEvent,
        element: SabshowElementDoc,
        mode: 'move' | 'resize-se'
    ) {
        e.stopPropagation();
        if (!element._id) return;
        setSelectedElementId(element._id);
        const start = canvasCoords(e.clientX, e.clientY);
        dragRef.current = {
            mode,
            elementId: element._id,
            startX: start.x,
            startY: start.y,
            original: element,
        };
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    }

    function onDragMove(e: MouseEvent) {
        const drag = dragRef.current;
        if (!drag) return;
        const cur = canvasCoords(e.clientX, e.clientY);
        const dx = cur.x - drag.startX;
        const dy = cur.y - drag.startY;
        setElements((els) =>
            els.map((el) => {
                if (el._id !== drag.elementId) return el;
                if (drag.mode === 'move') {
                    return { ...el, x: drag.original.x + dx, y: drag.original.y + dy };
                }
                return {
                    ...el,
                    w: Math.max(40, drag.original.w + dx),
                    h: Math.max(30, drag.original.h + dy),
                };
            })
        );
        // Broadcast presence cursor + element echo.
        const t = transportRef.current;
        if (t) {
            t.setCursor(selectedSlideId ?? '', cur.x, cur.y);
        }
    }

    function onDragEnd() {
        const drag = dragRef.current;
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
        dragRef.current = null;
        if (!drag) return;
        const el = elements.find((e) => e._id === drag.elementId);
        if (!el?._id) return;
        void handleUpdateElement(el._id, { x: el.x, y: el.y, w: el.w, h: el.h });
    }

    /* ── version save ─────────────────────────────────────────────── */
    async function handleSaveVersion() {
        if (!deck._id) return;
        setPending(true);
        try {
            await saveSabshowVersion(deck._id, 'manual save');
        } finally {
            setPending(false);
        }
    }

    /* ── render ───────────────────────────────────────────────────── */
    return (
        <div className="zoruui flex h-[calc(100vh-3rem)] w-full flex-col bg-zoru-surface">
            {/* top bar */}
            <div className="flex items-center gap-3 border-b px-4 py-2">
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={persistTitle}
                    className="max-w-xs"
                />
                <span className="text-xs text-zoru-ink-muted">
                    v{deck.version ?? 1}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveVersion}
                        disabled={pending}
                    >
                        Save version
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/sabshow/${deck._id}/history`}>
                            History
                        </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/sabshow/${deck._id}/publish`}>
                            Publish
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href={`/dashboard/sabshow/${deck._id}/present`}>
                            Present
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* slide sidebar */}
                <aside className="flex w-56 flex-col border-r">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="text-xs font-medium uppercase text-zoru-ink-muted">
                            Slides
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAddSlide('content')}
                            disabled={pending}
                        >
                            +
                        </Button>
                    </div>
                    <ScrollArea className="flex-1">
                        <ul className="space-y-1 px-2 pb-3">
                            {slides.map((slide, idx) => (
                                <li key={slide._id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedSlideId(slide._id ?? null);
                                            setSelectedElementId(null);
                                        }}
                                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                                            selectedSlideId === slide._id
                                                ? 'bg-zoru-surface-2'
                                                : 'hover:bg-zoru-surface-2/60'
                                        }`}
                                    >
                                        <span className="w-5 text-xs text-zoru-ink-muted">
                                            {idx + 1}
                                        </span>
                                        <span className="line-clamp-1">
                                            {slide.title ?? slide.layoutKind ?? 'Slide'}
                                        </span>
                                    </button>
                                    {selectedSlideId === slide._id ? (
                                        <div className="mt-1 flex gap-1 px-2 pb-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    slide._id &&
                                                    handleMoveSlide(slide._id, -1)
                                                }
                                            >
                                                ↑
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    slide._id &&
                                                    handleMoveSlide(slide._id, 1)
                                                }
                                            >
                                                ↓
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    slide._id &&
                                                    handleDuplicateSlide(slide._id)
                                                }
                                            >
                                                Dupe
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    slide._id &&
                                                    handleDeleteSlide(slide._id)
                                                }
                                            >
                                                Del
                                            </Button>
                                        </div>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                </aside>

                {/* canvas + toolbar */}
                <main className="flex flex-1 flex-col overflow-hidden">
                    {/* toolbar */}
                    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInsertElement('text')}
                        >
                            + Text
                        </Button>
                        <SabFilePickerButton
                            accept="image"
                            onPick={(pick) =>
                                handleInsertElement('image', {
                                    fileId: pick.id,
                                    fit: 'cover',
                                })
                            }
                        >
                            + Image
                        </SabFilePickerButton>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInsertElement('shape')}
                        >
                            + Shape
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInsertElement('chart')}
                        >
                            + Chart
                        </Button>
                        <SabFilePickerButton
                            accept="video"
                            onPick={(pick) =>
                                handleInsertElement('video', { fileId: pick.id })
                            }
                        >
                            + Video
                        </SabFilePickerButton>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInsertElement('code')}
                        >
                            + Code
                        </Button>
                        <Separator orientation="vertical" className="mx-2 h-6" />
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={!selectedElement}
                            onClick={() =>
                                selectedElement?._id &&
                                handleUpdateElement(selectedElement._id, {
                                    zIndex:
                                        Math.max(
                                            0,
                                            ...elements.map((e) => e.zIndex ?? 0)
                                        ) + 1,
                                })
                            }
                        >
                            Bring forward
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={!selectedElement}
                            onClick={() =>
                                selectedElement?._id &&
                                handleUpdateElement(selectedElement._id, {
                                    zIndex:
                                        Math.min(
                                            0,
                                            ...elements.map((e) => e.zIndex ?? 0)
                                        ) - 1,
                                })
                            }
                        >
                            Send back
                        </Button>
                    </div>

                    {/* canvas */}
                    <div
                        className="flex-1 overflow-auto bg-zoru-surface-2/30 p-6"
                        onMouseDown={() => setSelectedElementId(null)}
                    >
                        <div className="mx-auto w-full max-w-[1280px]">
                            <div
                                ref={canvasRef}
                                className="relative aspect-video w-full overflow-hidden rounded-lg border bg-white shadow-sm"
                                style={{
                                    backgroundColor: '#ffffff',
                                }}
                            >
                                <CanvasInner
                                    elements={elements}
                                    selectedElementId={selectedElementId}
                                    onSelectElement={(id) => setSelectedElementId(id)}
                                    onStartDrag={startDrag}
                                    onCommitText={(elementId, value) =>
                                        handleUpdateElement(elementId, {
                                            configJson: { value },
                                        })
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* speaker notes */}
                    <NotesDrawer
                        slide={
                            slides.find((s) => s._id === selectedSlideId) ?? null
                        }
                        onChange={async (notes) => {
                            if (!selectedSlideId) return;
                            const updated = await updateSabshowSlide(selectedSlideId, {
                                notes,
                            });
                            setSlides((s) =>
                                s.map((sl) =>
                                    sl._id === selectedSlideId ? updated : sl
                                )
                            );
                        }}
                    />
                </main>

                {/* properties panel */}
                <aside className="w-72 border-l p-3">
                    {selectedElement ? (
                        <PropertiesPanel
                            element={selectedElement}
                            onChange={(patch) =>
                                selectedElement._id &&
                                handleUpdateElement(selectedElement._id, patch)
                            }
                            onDelete={() =>
                                selectedElement._id &&
                                handleDeleteElement(selectedElement._id)
                            }
                        />
                    ) : (
                        <SlidePropertiesPanel
                            slide={
                                slides.find((s) => s._id === selectedSlideId) ?? null
                            }
                            onChange={async (patch) => {
                                if (!selectedSlideId) return;
                                const updated = await updateSabshowSlide(
                                    selectedSlideId,
                                    patch
                                );
                                setSlides((s) =>
                                    s.map((sl) =>
                                        sl._id === selectedSlideId ? updated : sl
                                    )
                                );
                            }}
                        />
                    )}
                </aside>
            </div>
        </div>
    );
}

/* ─── inner canvas (renders + drag handles) ───────────────────────── */

interface CanvasInnerProps {
    elements: SabshowElementDoc[];
    selectedElementId: string | null;
    onSelectElement: (id: string) => void;
    onStartDrag: (
        e: React.MouseEvent,
        el: SabshowElementDoc,
        mode: 'move' | 'resize-se'
    ) => void;
    onCommitText: (elementId: string, value: string) => void;
}

function CanvasInner({
    elements,
    selectedElementId,
    onSelectElement,
    onStartDrag,
    onCommitText,
}: CanvasInnerProps) {
    return (
        <>
            {elements
                .slice()
                .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
                .map((el) => {
                    const sel = selectedElementId === el._id;
                    const xPct = (el.x / CANVAS_W) * 100;
                    const yPct = (el.y / CANVAS_H) * 100;
                    const wPct = (el.w / CANVAS_W) * 100;
                    const hPct = (el.h / CANVAS_H) * 100;
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
                                outline: sel ? '2px solid #22c55e' : undefined,
                            }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                if (el._id) onSelectElement(el._id);
                                onStartDrag(e, el, 'move');
                            }}
                        >
                            <ElementRenderer
                                element={el}
                                editable={sel && el.kind === 'text'}
                                onCommitText={(v) =>
                                    el._id && onCommitText(el._id, v)
                                }
                            />
                            {sel ? (
                                <div
                                    className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm bg-zoru-ink"
                                    onMouseDown={(e) => onStartDrag(e, el, 'resize-se')}
                                />
                            ) : null}
                        </div>
                    );
                })}
        </>
    );
}

function ElementRenderer({
    element,
    editable,
    onCommitText,
}: {
    element: SabshowElementDoc;
    editable: boolean;
    onCommitText: (value: string) => void;
}) {
    const cfg = (element.configJson ?? {}) as Record<string, unknown>;
    switch (element.kind) {
        case 'text': {
            const value =
                typeof cfg.value === 'string' ? (cfg.value as string) : 'Text';
            if (editable) {
                return (
                    <textarea
                        defaultValue={value}
                        onBlur={(e) => onCommitText(e.target.value)}
                        className="h-full w-full resize-none border-0 bg-transparent p-1 text-sm outline-none"
                    />
                );
            }
            return (
                <div className="h-full w-full overflow-hidden p-1 text-sm">
                    {value}
                </div>
            );
        }
        case 'image': {
            const fileId = typeof cfg.fileId === 'string' ? cfg.fileId : null;
            return (
                <div className="flex h-full w-full items-center justify-center bg-zoru-surface-2 text-xs text-zoru-ink-muted">
                    {fileId ? `image: ${fileId}` : 'image'}
                </div>
            );
        }
        case 'shape': {
            const fill =
                typeof cfg.fill === 'string' ? (cfg.fill as string) : '#22c55e';
            return <div className="h-full w-full" style={{ background: fill }} />;
        }
        case 'chart':
            return (
                <div className="flex h-full w-full items-center justify-center bg-zoru-surface-2 text-xs text-zoru-ink-muted">
                    chart placeholder
                </div>
            );
        case 'video':
            return (
                <div className="flex h-full w-full items-center justify-center bg-black text-xs text-white">
                    video
                </div>
            );
        case 'code':
            return (
                <pre className="h-full w-full overflow-hidden bg-zoru-ink p-2 text-xs text-white">
                    {typeof cfg.value === 'string' ? (cfg.value as string) : ''}
                </pre>
            );
        default:
            return null;
    }
}

/* ─── side panels + notes ─────────────────────────────────────────── */

function PropertiesPanel({
    element,
    onChange,
    onDelete,
}: {
    element: SabshowElementDoc;
    onChange: (patch: Partial<SabshowElementDoc>) => void;
    onDelete: () => void;
}) {
    return (
        <Card className="space-y-3 p-3">
            <div className="text-sm font-medium">{element.kind}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <Label>X</Label>
                <Input
                    type="number"
                    value={Math.round(element.x)}
                    onChange={(e) => onChange({ x: Number(e.target.value) })}
                />
                <Label>Y</Label>
                <Input
                    type="number"
                    value={Math.round(element.y)}
                    onChange={(e) => onChange({ y: Number(e.target.value) })}
                />
                <Label>W</Label>
                <Input
                    type="number"
                    value={Math.round(element.w)}
                    onChange={(e) => onChange({ w: Number(e.target.value) })}
                />
                <Label>H</Label>
                <Input
                    type="number"
                    value={Math.round(element.h)}
                    onChange={(e) => onChange({ h: Number(e.target.value) })}
                />
                <Label>Rotation</Label>
                <Input
                    type="number"
                    value={Math.round(element.rotation ?? 0)}
                    onChange={(e) => onChange({ rotation: Number(e.target.value) })}
                />
            </div>
            <Button variant="destructive" size="sm" onClick={onDelete}>
                Delete
            </Button>
        </Card>
    );
}

function SlidePropertiesPanel({
    slide,
    onChange,
}: {
    slide: SabshowSlideDoc | null;
    onChange: (patch: { title?: string; hidden?: boolean }) => void;
}) {
    if (!slide) {
        return (
            <p className="text-sm text-zoru-ink-muted">
                Select a slide or element.
            </p>
        );
    }
    return (
        <Card className="space-y-3 p-3">
            <div className="text-sm font-medium">Slide {slide.position + 1}</div>
            <Label>Title</Label>
            <Input
                defaultValue={slide.title ?? ''}
                onBlur={(e) => onChange({ title: e.target.value })}
            />
            <Label>Layout</Label>
            <div className="text-xs text-zoru-ink-muted">
                {slide.layoutKind ?? 'blank'}
            </div>
        </Card>
    );
}

function NotesDrawer({
    slide,
    onChange,
}: {
    slide: SabshowSlideDoc | null;
    onChange: (notes: string) => void | Promise<void>;
}) {
    return (
        <div className="border-t bg-zoru-surface-2/40 px-3 py-2">
            <Label className="mb-1 block text-xs uppercase">Speaker notes</Label>
            <Textarea
                key={slide?._id ?? 'none'}
                rows={3}
                defaultValue={slide?.notes ?? ''}
                placeholder={slide ? 'Notes for this slide…' : 'Select a slide'}
                disabled={!slide}
                onBlur={(e) => onChange(e.target.value)}
            />
        </div>
    );
}
