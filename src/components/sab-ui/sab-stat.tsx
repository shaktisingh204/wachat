'use client';

/**
 * SabStat — numeric KPI tile with the Aurora aesthetic.
 *
 * Two visual levels:
 *   - default (14px label, 32px value) — for compact KPI rows
 *   - hero (15px label, 40px gradient value, gradient icon badge,
 *     subtle colored glow, and a taller sparkline) — for the top of
 *     dashboards where tiles need to feel like hero moments
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sparkline } from './sab-sparkline';

export type SabStatDelta = {
  direction: 'up' | 'down' | 'flat';
  label: string;
};

export type SabStatTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface SabStatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  trend?: number[];
  delta?: SabStatDelta;
  tone?: SabStatTone;
  loading?: boolean;
  /** Hero mode: larger, gradient value, colored glow. */
  hero?: boolean;
  className?: string;
}

function toneColor(tone: SabStatTone): string {
  const map: Record<SabStatTone, string> = {
    neutral: 'hsl(var(--sab-fg-muted))',
    primary: 'hsl(var(--sab-primary))',
    success: 'hsl(var(--sab-success))',
    warning: 'hsl(var(--sab-warning))',
    danger: 'hsl(var(--sab-danger))',
    info: 'hsl(var(--sab-info))',
  };
  return map[tone];
}

function toneGradient(tone: SabStatTone): string {
  const map: Record<SabStatTone, string> = {
    neutral: 'linear-gradient(135deg, hsl(var(--sab-fg-muted)), hsl(var(--sab-fg-subtle)))',
    primary: 'var(--sab-gradient-primary)',
    success: 'var(--sab-gradient-success)',
    warning: 'var(--sab-gradient-warning)',
    danger: 'var(--sab-gradient-danger)',
    info: 'var(--sab-gradient-info)',
  };
  return map[tone];
}

function toneSoft(tone: SabStatTone): string {
  const map: Record<SabStatTone, string> = {
    neutral: 'hsl(var(--sab-bg-subtle))',
    primary: 'hsl(var(--sab-primary-soft))',
    success: 'hsl(var(--sab-success-soft))',
    warning: 'hsl(var(--sab-warning-soft))',
    danger: 'hsl(var(--sab-danger-soft))',
    info: 'hsl(var(--sab-info-soft))',
  };
  return map[tone];
}

function toneGlow(tone: SabStatTone): string | undefined {
  const map: Record<SabStatTone, string | undefined> = {
    neutral: undefined,
    primary: 'var(--sab-glow-primary)',
    success: 'var(--sab-glow-success)',
    warning: undefined,
    danger: 'var(--sab-glow-danger)',
    info: 'var(--sab-glow-info)',
  };
  return map[tone];
}

export function SabStat({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  delta,
  tone = 'neutral',
  loading,
  hero,
  className,
}: SabStatProps) {
  const accentColor = toneColor(tone);
  const accentSoft = toneSoft(tone);
  const accentGradient = toneGradient(tone);
  const glow = hero ? toneGlow(tone) : undefined;

  return (
    <div
      className={cn(
        'sab-stat group relative flex flex-col overflow-hidden transition-all duration-200',
        hero ? 'gap-5 p-6' : 'gap-4 p-5',
        className,
      )}
      style={{
        backgroundColor: 'hsl(var(--sab-surface))',
        border: '1px solid hsl(var(--sab-border))',
        borderRadius: hero ? 'var(--sab-radius-xl)' : 'var(--sab-radius-lg)',
        boxShadow: glow ? `var(--sab-shadow-sm), ${glow}` : 'var(--sab-shadow-xs)',
      }}
    >
      {/* Decorative gradient corner in hero mode — tiny tinted wash at top-right */}
      {hero ? (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-32 w-32 opacity-[0.18]"
          style={{
            background: `radial-gradient(circle at 100% 0%, ${accentColor}, transparent 60%)`,
          }}
        />
      ) : null}

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <span
              className={cn(
                'flex items-center justify-center',
                hero ? 'h-10 w-10 rounded-[12px]' : 'h-8 w-8 rounded-[8px]',
              )}
              style={{
                background: hero ? accentGradient : accentSoft,
                color: hero ? '#fff' : accentColor,
                boxShadow: hero
                  ? `0 6px 14px -4px ${accentColor}30, 0 2px 4px -2px ${accentColor}20`
                  : undefined,
              }}
            >
              <Icon className={hero ? 'h-[18px] w-[18px]' : 'h-4 w-4'} strokeWidth={2.25} />
            </span>
          ) : null}
          <span
            className={cn('font-medium', hero ? 'text-[13px]' : 'text-[12.5px]')}
            style={{ color: 'hsl(var(--sab-fg-muted))' }}
          >
            {label}
          </span>
        </div>
        {delta && !loading ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums',
              hero ? 'text-[11.5px]' : 'text-[11px]',
            )}
            style={{
              background:
                delta.direction === 'up'
                  ? 'hsl(var(--sab-success-soft))'
                  : delta.direction === 'down'
                    ? 'hsl(var(--sab-danger-soft))'
                    : 'hsl(var(--sab-bg-subtle))',
              color:
                delta.direction === 'up'
                  ? 'hsl(var(--sab-success))'
                  : delta.direction === 'down'
                    ? 'hsl(var(--sab-danger))'
                    : 'hsl(var(--sab-fg-muted))',
            }}
          >
            {delta.direction === 'up' ? (
              <ArrowUp className="h-3 w-3" />
            ) : delta.direction === 'down' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {delta.label}
          </span>
        ) : null}
      </div>

      <div className="relative flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              'font-semibold leading-none tracking-[-0.02em] tabular-nums',
              hero ? 'text-[40px]' : 'text-[32px]',
              hero && tone !== 'neutral' && 'sab-gradient-text',
            )}
            style={{
              background: hero && tone !== 'neutral' ? accentGradient : undefined,
              WebkitBackgroundClip: hero && tone !== 'neutral' ? 'text' : undefined,
              backgroundClip: hero && tone !== 'neutral' ? 'text' : undefined,
              WebkitTextFillColor: hero && tone !== 'neutral' ? 'transparent' : undefined,
              color: hero && tone !== 'neutral' ? undefined : 'hsl(var(--sab-fg))',
            }}
          >
            {loading ? (
              <span
                className={cn(
                  'inline-block animate-pulse rounded-md',
                  hero ? 'h-9 w-24' : 'h-7 w-20',
                )}
                style={{ background: 'hsl(var(--sab-bg-subtle))' }}
              />
            ) : (
              value
            )}
          </span>
          {hint ? (
            <span
              className="text-[12px] leading-tight"
              style={{ color: 'hsl(var(--sab-fg-subtle))' }}
            >
              {hint}
            </span>
          ) : null}
        </div>
        {trend && trend.length > 0 ? (
          <div style={{ color: accentColor }}>
            <Sparkline
              data={trend}
              width={hero ? 110 : 88}
              height={hero ? 40 : 32}
              strokeWidth={hero ? 2 : 1.75}
              fillOpacity={0.18}
              ariaLabel={`${label} trend`}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
