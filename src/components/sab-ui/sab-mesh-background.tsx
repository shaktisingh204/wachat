'use client';

/**
 * SabMeshBackground — reusable gradient-mesh backdrop.
 *
 * Renders two absolutely-positioned layers:
 *   1. A radial-gradient mesh driven by the `--sab-mesh-light` token
 *   2. A subtle SVG grain overlay driven by `--sab-grain`
 *
 * Both are fixed at `z-0` inside a `position: relative` parent, so the
 * parent needs to be a stacking context. Typically you don't use this
 * directly — wrap your page in `SabPageShell` which renders this and
 * the entrance cascade in one go.
 *
 * Props:
 *   - `animate` — if true, the mesh layer slowly drifts (24s loop).
 *     Reads nicer but costs 1 GPU composite layer. Default false.
 *   - `fade` — 0..1 opacity multiplier. Default 1.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SabMeshBackgroundProps {
  animate?: boolean;
  fade?: number;
  className?: string;
}

export function SabMeshBackground({
  animate = true,
  fade = 1,
  className,
}: SabMeshBackgroundProps) {
  return (
    <>
      {/* Mesh gradient layer */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 -z-10',
          animate && 'sab-mesh-drift',
          className,
        )}
        style={{
          background: 'var(--sab-mesh-light)',
          opacity: fade,
        }}
      />
      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: 'var(--sab-grain)',
          backgroundRepeat: 'repeat',
          mixBlendMode: 'multiply',
          opacity: 0.9,
        }}
      />
    </>
  );
}
