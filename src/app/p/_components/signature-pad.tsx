'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface SignaturePadHandle {
  toDataUrl(): string | null;
  clear(): void;
  hasDrawn(): boolean;
}

interface SignaturePadProps {
  height?: number;
}

/**
 * Canvas-based signature pad used across the public portal (proposal,
 * estimate, contract). The parent obtains a ref and calls `toDataUrl`
 * at submit-time.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ height = 180 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const hasDrawnRef = useRef(false);
    const lastPtRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width));
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = '#1a1a1a';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
        hasDrawnRef.current = false;
      };
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, [height]);

    const getPoint = (
      canvas: HTMLCanvasElement,
      e: React.PointerEvent<HTMLCanvasElement>,
    ) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * canvas.width) / rect.width,
        y: ((e.clientY - rect.top) * canvas.height) / rect.height,
      };
    };

    const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastPtRef.current = getPoint(canvas, e);
    };
    const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pt = getPoint(canvas, e);
      const last = lastPtRef.current;
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      lastPtRef.current = pt;
      hasDrawnRef.current = true;
    };
    const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      drawingRef.current = false;
      lastPtRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        toDataUrl() {
          const c = canvasRef.current;
          if (!c || !hasDrawnRef.current) return null;
          return c.toDataURL('image/png');
        },
        clear() {
          const c = canvasRef.current;
          if (!c) return;
          const ctx = c.getContext('2d');
          if (!ctx) return;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          hasDrawnRef.current = false;
        },
        hasDrawn() {
          return hasDrawnRef.current;
        },
      }),
      [],
    );

    return (
      <div className="rounded-lg border border-border bg-white p-2">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none rounded-lg bg-white"
          style={{ height }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        />
      </div>
    );
  },
);
