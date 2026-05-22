'use client';

import { Button, Checkbox, Input, Label, cn, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Eraser,
  FileSignature,
  PenLine,
  Type,
  Upload } from 'lucide-react';

/**
 * <SignatureCapture> — client island for the public `/sign/...`
 * route. Three modes:
 *
 *   • Typed     — text input rendered in a cursive preview.
 *   • Drawn     — HTML5 canvas with pointer-event capture.
 *   • Uploaded  — SabFile picker (must come from SabFiles per policy).
 *
 * On submit, POSTs `{ mode, signatureData }` to
 * `/api/sign/[contractId]/[signerToken]` and navigates to the
 * confirmation page on success.
 */

import * as React from 'react';

import {
    SabFilePickerButton,
    type SabFilePick,
} from '@/components/sabfiles';

type Mode = 'typed' | 'drawn' | 'uploaded';

interface SignatureCaptureProps {
    contractId: string;
    signerToken: string;
    signerName?: string;
}

const MODE_TABS: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'typed', label: 'Type', icon: <Type className="h-3.5 w-3.5" /> },
    { id: 'drawn', label: 'Draw', icon: <PenLine className="h-3.5 w-3.5" /> },
    { id: 'uploaded', label: 'Upload', icon: <Upload className="h-3.5 w-3.5" /> },
];

export function SignatureCapture({
    contractId,
    signerToken,
    signerName,
}: SignatureCaptureProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [mode, setMode] = React.useState<Mode>('typed');
    const [typed, setTyped] = React.useState(signerName || '');
    const [drawnDataUrl, setDrawnDataUrl] = React.useState<string>('');
    const [uploaded, setUploaded] = React.useState<SabFilePick | null>(null);
    const [agreed, setAgreed] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);

    const submit = async () => {
        if (!agreed) {
            toast({
                title: 'Acceptance required',
                description: 'Please confirm the agreement before signing.',
                variant: 'destructive',
            });
            return;
        }
        let signatureData = '';
        if (mode === 'typed') {
            signatureData = typed.trim();
            if (!signatureData) {
                toast({ title: 'Signature required', description: 'Type your name.', variant: 'destructive' });
                return;
            }
        } else if (mode === 'drawn') {
            signatureData = drawnDataUrl;
            if (!signatureData) {
                toast({ title: 'Signature required', description: 'Draw your signature.', variant: 'destructive' });
                return;
            }
        } else if (mode === 'uploaded') {
            if (!uploaded?.id) {
                toast({ title: 'Signature required', description: 'Pick a signature file.', variant: 'destructive' });
                return;
            }
            signatureData = uploaded.id;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/sign/${encodeURIComponent(contractId)}/${encodeURIComponent(signerToken)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, signatureData }),
            });
            const json = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                error?: string;
            };
            if (!res.ok || !json.ok) {
                toast({
                    title: 'Could not sign',
                    description: json.error || 'Please try again or contact the sender.',
                    variant: 'destructive',
                });
                setSubmitting(false);
                return;
            }
            router.replace(`/sign/${encodeURIComponent(contractId)}/${encodeURIComponent(signerToken)}/done`);
        } catch (e: any) {
            toast({
                title: 'Network error',
                description: e?.message || 'Please try again.',
                variant: 'destructive',
            });
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Mode tabs */}
            <div role="tablist" aria-label="Signature mode" className="flex flex-wrap gap-1.5">
                {MODE_TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={mode === t.id}
                        onClick={() => setMode(t.id)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                            mode === t.id
                                ? 'border-zoru-ink bg-zoru-ink text-zoru-bg'
                                : 'border-zoru-line bg-zoru-surface text-zoru-ink-muted hover:border-zoru-line-strong hover:text-zoru-ink',
                        )}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Mode panes */}
            {mode === 'typed' && <TypedPane value={typed} onChange={setTyped} />}
            {mode === 'drawn' && <DrawnPane onChange={setDrawnDataUrl} />}
            {mode === 'uploaded' && <UploadedPane value={uploaded} onChange={setUploaded} />}

            {/* Consent + submit */}
            <div className="space-y-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
                <label className="flex items-start gap-3 text-sm leading-6 text-zoru-ink">
                    <Checkbox
                        checked={agreed}
                        onCheckedChange={(c) => setAgreed(c === true)}
                        className="mt-0.5"
                    />
                    <span>
                        By clicking <strong>Sign</strong>, I agree that the signature above is
                        the electronic representation of my handwritten signature for the
                        purposes of executing this contract, and that I have read and
                        understood its terms.
                    </span>
                </label>
                <Button onClick={submit} disabled={submitting} block>
                    <FileSignature />
                    {submitting ? 'Signing…' : 'Sign'}
                </Button>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Typed pane
// ──────────────────────────────────────────────────────────────────

function TypedPane({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor="signature-typed">Type your full name</Label>
            <Input
                id="signature-typed"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
            />
            <div className="flex min-h-[6rem] items-center justify-center rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-4 py-3">
                <span
                    className="text-3xl text-zoru-ink"
                    style={{
                        fontFamily:
                            '"Caveat", "Pacifico", "Brush Script MT", cursive',
                    }}
                >
                    {value.trim() || 'Preview'}
                </span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Drawn pane — HTML5 canvas with pointer events
// ──────────────────────────────────────────────────────────────────

function DrawnPane({ onChange }: { onChange: (dataUrl: string) => void }) {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const drawingRef = React.useRef(false);
    const lastRef = React.useRef<{ x: number; y: number } | null>(null);
    const dirtyRef = React.useRef(false);

    // Set up high-DPI canvas
    const setupCanvas = React.useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
    }, []);

    React.useEffect(() => {
        setupCanvas();
        const handleResize = () => setupCanvas();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setupCanvas]);

    const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(e.pointerId);
        drawingRef.current = true;
        lastRef.current = pointFromEvent(e);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const p = pointFromEvent(e);
        const last = lastRef.current;
        if (last) {
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
        lastRef.current = p;
        dirtyRef.current = true;
    };

    const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        lastRef.current = null;
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            canvas.releasePointerCapture(e.pointerId);
        } catch {
            // pointer may have ended outside — ignore
        }
        if (dirtyRef.current) {
            onChange(canvas.toDataURL('image/png'));
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        dirtyRef.current = false;
        onChange('');
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>Draw your signature</Label>
                <Button type="button" size="sm" variant="ghost" onClick={clear}>
                    <Eraser className="h-3.5 w-3.5" /> Clear
                </Button>
            </div>
            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-white p-1">
                <canvas
                    ref={canvasRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="h-40 w-full touch-none rounded-[var(--zoru-radius)] bg-white"
                />
            </div>
            <p className="text-xs leading-5 text-zoru-ink-muted">
                Sign with your mouse, trackpad, or finger. Tap <em>Clear</em> to start over.
            </p>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Uploaded pane — SabFile picker (per project policy, files come from
// SabFiles only; never a free-text URL paste).
// ──────────────────────────────────────────────────────────────────

function UploadedPane({
    value,
    onChange,
}: {
    value: SabFilePick | null;
    onChange: (v: SabFilePick | null) => void;
}) {
    return (
        <div className="space-y-2">
            <Label>Upload a signature image</Label>
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface p-4">
                {value ? (
                    <>
                        {value.url ? (
                            <img
                                src={value.url}
                                alt={value.name || 'Signature'}
                                className="h-20 w-40 rounded-[var(--zoru-radius)] border border-zoru-line bg-white object-contain"
                            />
                        ) : null}
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-zoru-ink">
                                {value.name || 'Signature image'}
                            </div>
                            <div className="text-xs text-zoru-ink-muted">From SabFiles</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
                            Remove
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm text-zoru-ink">No file selected</div>
                            <div className="text-xs text-zoru-ink-muted">
                                Choose an image of your signature from SabFiles or upload a new one.
                            </div>
                        </div>
                        <SabFilePickerButton
                            accept="image"
                            title="Choose signature image"
                            onPick={(p) => onChange(p)}
                        >
                            <Upload /> Choose image
                        </SabFilePickerButton>
                    </>
                )}
            </div>
        </div>
    );
}
