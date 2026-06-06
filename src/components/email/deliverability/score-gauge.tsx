'use client';

/**
 * Circular score gauge for deliverability (0..100). Pure SVG — we don't
 * use Progress here because the zoruui progress primitive is linear-only.
 */
import { cn } from '@/components/sabcrm/20ui';

interface ScoreGaugeProps {
  /** 0..100 */
  score: number;
  size?: number;
  grade?: string;
  label?: string;
  className?: string;
}

function scoreTone(score: number): { ring: string; label: string } {
  if (score >= 85) return { ring: 'stroke-[var(--st-status-ok)]', label: 'Excellent' };
  if (score >= 70) return { ring: 'stroke-[var(--st-text-secondary)]', label: 'Good' };
  if (score >= 50) return { ring: 'stroke-[var(--st-warn)]', label: 'Fair' };
  return { ring: 'stroke-[var(--st-danger)]', label: 'At risk' };
}

export function ScoreGauge({
  score,
  size = 168,
  grade,
  label,
  className,
}: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const tone = scoreTone(clamped);
  const description = label ?? tone.label;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Deliverability score ${clamped} out of 100, ${description}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="fill-none stroke-[var(--st-border)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('fill-none transition-[stroke-dashoffset] duration-700', tone.ring)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tracking-tight text-[var(--st-text)]">
          {clamped}
        </span>
        <span className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
          {grade ?? description}
        </span>
      </div>
    </div>
  );
}
