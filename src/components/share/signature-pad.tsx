'use client';

/**
 * SignaturePad — HTML5 canvas-based signature capture for public
 * accept/sign flows (estimate, proposal, contract).
 *
 * Notes:
 *  - No external library — uses raw canvas + pointer events so it
 *    works on touch and mouse without dragging in a dependency.
 *  - `onChange` fires with a base64 PNG data URL after each stroke
 *    ends. Parent decides when to submit.
 *  - Empty signatures emit `null` so callers can validate "user
 *    actually drew something" without parsing the data URL.
 */

import * as React from 'react';
import { Button } from '@/components/zoruui';

export type SignaturePadProps = {
  width?: number;
  height?: number;
  onChange?: (dataUrl: string | null) => void;
  /** Visual label rendered above the canvas. */
  label?: string;
  className?: string;
};

type Point = { x: number; y: number };

export function SignaturePad({
  width = 480,
  height = 160,
  onChange,
  label = 'Draw your signature',
  className,
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const lastPointRef = React.useRef<Point | null>(null);
  const hasInkRef = React.useRef(false);
  const [isEmpty, setIsEmpty] = React.useState(true);

  const getContext = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  // Set up the canvas with a white background once on mount. The
  // backing store has to be sized for devicePixelRatio so strokes
  // stay crisp on retina screens.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [width, height]);

  const pointFromEvent = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;
    drawingRef.current = true;
    const p = pointFromEvent(e);
    lastPointRef.current = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const p = pointFromEvent(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    if (!hasInkRef.current) {
      hasInkRef.current = true;
      setIsEmpty(false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    if (onChange && canvasRef.current && hasInkRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    hasInkRef.current = false;
    setIsEmpty(true);
    onChange?.(null);
  };

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-zoru-ink">{label}</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty}
        >
          Clear
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Signature canvas"
        className="touch-none rounded-md border border-zoru-line bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <p className="mt-1 text-xs text-zoru-ink">
        Sign inside the box using your mouse or finger.
      </p>
    </div>
  );
}
