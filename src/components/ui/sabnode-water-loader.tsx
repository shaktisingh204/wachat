"use client";

/**
 * SabNode water-wave loader.
 *
 * The word "SabNode" is rendered twice on top of the same SVG:
 *  1) An outline layer (drawn by the text glyph stroke + a soft fill) is
 *     the "empty" state — what the text looks like when the water is gone.
 *  2) A filled layer is clipped against an SVG `<clipPath>` whose shape is
 *     a wave path that animates up and down (filling and emptying) plus
 *     two horizontal sine-wave paths that scroll sideways at different
 *     speeds for the actual ripple.
 *
 * Pure SVG + CSS — no JS animation loop, no canvas, GPU-accelerated.
 */

import { cn } from "@/lib/utils";

interface SabNodeWaterLoaderProps {
  className?: string;
  /** Pixel width of the loader. Height auto-derives from a 4:1 aspect ratio. */
  width?: number;
  /** Optional caption rendered under the text. */
  caption?: string;
  /** Hide the gradient halo behind the text. */
  flat?: boolean;
}

export function SabNodeWaterLoader({
  className,
  width = 360,
  caption = "Loading…",
  flat = false,
}: SabNodeWaterLoaderProps) {
  const height = Math.round(width * 0.32);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="SabNode is loading"
      className={cn(
        "relative inline-flex flex-col items-center justify-center gap-3 select-none",
        className,
      )}
      style={{ width }}
    >
      {/* Soft Prism halo behind the text */}
      {!flat && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-10 -top-6 -bottom-2 -z-10 blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(50% 70% at 25% 50%, rgba(99,102,241,0.45), transparent 70%)," +   // indigo
              "radial-gradient(50% 70% at 50% 50%, rgba(168,85,247,0.40), transparent 70%)," +   // violet
              "radial-gradient(50% 70% at 75% 50%, rgba(236,72,153,0.40), transparent 70%)," +   // pink
              "radial-gradient(50% 70% at 95% 50%, rgba(6,182,212,0.35), transparent 70%)",      // cyan
          }}
        />
      )}

      <svg
        viewBox="0 0 400 128"
        width={width}
        height={height}
        className="block"
        aria-hidden
      >
        <defs>
          {/* Gradient that fills the "water" — Prism multicolour */}
          <linearGradient id="sabnode-water-fill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#6366F1" />{/* indigo */}
            <stop offset="35%"  stopColor="#A855F7" />{/* violet */}
            <stop offset="70%"  stopColor="#EC4899" />{/* pink */}
            <stop offset="100%" stopColor="#06B6D4" />{/* cyan */}
          </linearGradient>

          {/* Subtle gradient for the empty/outline text */}
          <linearGradient id="sabnode-water-empty" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e4e4e7" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </linearGradient>

          {/*
            The clipPath is a wide rectangle shaped along its TOP edge by
            two overlapping sine waves. The whole rect translates up (-y)
            via the .water-rise animation to "fill" the text; once full it
            slides back down to "empty" and repeats.
          */}
          <clipPath id="sabnode-water-clip">
            <g className="water-rise">
              <path
                className="water-wave water-wave-back"
                d="
                  M -200 80
                  Q -150 60, -100 80 T 0 80 T 100 80 T 200 80 T 300 80 T 400 80 T 500 80 T 600 80
                  V 200 H -200 Z
                "
              />
              <path
                className="water-wave water-wave-front"
                d="
                  M -200 80
                  Q -150 100, -100 80 T 0 80 T 100 80 T 200 80 T 300 80 T 400 80 T 500 80 T 600 80
                  V 200 H -200 Z
                "
                opacity="0.85"
              />
            </g>
          </clipPath>

          {/* Reusable text node — defined once, instanced twice */}
          <text
            id="sabnode-water-text"
            x="200"
            y="86"
            textAnchor="middle"
            fontSize="78"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Inter, sans-serif"
            letterSpacing="-2"
          >
            SabNode
          </text>
        </defs>

        {/* Empty/outline layer — visible where the water hasn't reached. */}
        <use
          href="#sabnode-water-text"
          fill="url(#sabnode-water-empty)"
          stroke="rgba(82,82,91,0.25)"
          strokeWidth="1"
        />

        {/* Filled layer — clipped to the rising/falling water shape. */}
        <g clipPath="url(#sabnode-water-clip)">
          <use
            href="#sabnode-water-text"
            fill="url(#sabnode-water-fill)"
          />
          {/* Specular highlight on the wave surface */}
          <path
            className="water-wave water-wave-front"
            d="
              M -200 80
              Q -150 100, -100 80 T 0 80 T 100 80 T 200 80 T 300 80 T 400 80 T 500 80 T 600 80
            "
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            transform="translate(0, 0)"
          />
        </g>
      </svg>

      {caption && (
        <span className="text-[12px] tracking-[0.18em] uppercase font-bold text-zinc-500">
          {caption}
        </span>
      )}

      <span className="sr-only">SabNode is loading. Please wait.</span>

      {/*
        Scoped styles so the loader is fully self-contained — no global CSS
        edits required. styled-jsx keeps the keyframe names from leaking.
      */}
      <style jsx>{`
        :global(.water-rise) {
          animation: sabnode-water-rise 4.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
          transform-box: fill-box;
        }
        :global(.water-wave) {
          animation-name: sabnode-water-drift;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }
        :global(.water-wave-back) {
          animation-duration: 4.2s;
          fill: rgba(99, 102, 241, 0.55);   /* indigo */
        }
        :global(.water-wave-front) {
          animation-duration: 2.8s;
          animation-direction: reverse;
          fill: rgba(168, 85, 247, 0.85);   /* violet */
        }

        @keyframes sabnode-water-rise {
          0%   { transform: translateY(0); }
          45%  { transform: translateY(-95px); }
          55%  { transform: translateY(-95px); }
          100% { transform: translateY(0); }
        }
        @keyframes sabnode-water-drift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-200px); }
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.water-rise),
          :global(.water-wave) {
            animation-duration: 0s !important;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Full-screen variant for use in App Router `loading.tsx` files.
 */
export function SabNodeWaterLoaderScreen({ caption }: { caption?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-50">
      <SabNodeWaterLoader caption={caption ?? "Loading…"} />
    </div>
  );
}
