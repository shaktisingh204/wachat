'use client';

/**
 * 20ui · charts — KpiCard.
 *
 * A compact metric tile: label (with optional leading icon), a big value, an
 * optional delta line (arrow + tone) and an optional inline sparkline. Pure
 * presentation — the caller formats the value/delta strings.
 */

import * as React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { renderIcon, type IconProp } from '../../_icon';
import { Sparkline } from './sparkline';

import './charts.css';

export type KpiDeltaTone = 'up' | 'down' | 'neutral';

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Small secondary heading above the value. */
  label: React.ReactNode;
  /** The metric itself, pre-formatted ("$1.2M", "42"). */
  value: React.ReactNode;
  /** Optional leading glyph next to the label. */
  icon?: IconProp;
  /** Optional context / change line under the value. */
  delta?: React.ReactNode;
  /** Colors the delta + picks the arrow. Defaults to neutral (no arrow). */
  deltaTone?: KpiDeltaTone;
  /** Optional trend series rendered as an inline sparkline beside the value. */
  sparkline?: ReadonlyArray<number>;
}

/** A Linear-grade KPI tile: label, value, delta arrow + tone, sparkline. */
export function KpiCard({
  label,
  value,
  icon,
  delta,
  deltaTone = 'neutral',
  sparkline,
  className,
  ...rest
}: KpiCardProps): React.JSX.Element {
  const deltaClass = [
    'u-chx-kpi__delta',
    deltaTone === 'up' && 'u-chx-kpi__delta--up',
    deltaTone === 'down' && 'u-chx-kpi__delta--down',
  ]
    .filter(Boolean)
    .join(' ');

  const DeltaArrow =
    deltaTone === 'up' ? ArrowUpRight : deltaTone === 'down' ? ArrowDownRight : null;

  return (
    <div className={['u-chx-kpi', className].filter(Boolean).join(' ')} {...rest}>
      <span className="u-chx-kpi__head">
        {icon ? (
          <span className="u-chx-kpi__icon" aria-hidden="true">
            {renderIcon(icon, { size: 14 })}
          </span>
        ) : null}
        <span className="u-chx-kpi__label">{label}</span>
      </span>
      <div className="u-chx-kpi__row">
        <span className="u-chx-kpi__value">{value}</span>
        {sparkline && sparkline.length > 1 ? (
          <span className="u-chx-kpi__spark">
            <Sparkline data={sparkline} stroke="currentColor" />
          </span>
        ) : null}
      </div>
      {delta ? (
        <span className={deltaClass}>
          {DeltaArrow ? (
            <span className="u-chx-kpi__delta-icon" aria-hidden="true">
              <DeltaArrow size={12} />
            </span>
          ) : null}
          {delta}
        </span>
      ) : null}
    </div>
  );
}
