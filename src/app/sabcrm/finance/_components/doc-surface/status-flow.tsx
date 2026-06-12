'use client';

/**
 * doc-surface — StatusFlow.
 *
 * The detail header's workflow rail: the entity's happy path rendered
 * as connected pills (done → current → upcoming). Statuses that sit
 * OUTSIDE the happy path (cancelled, overdue, …) render as a single
 * highlighted pill in front of the dimmed path, so the rail always
 * tells the truth without pretending exceptional states are steps.
 */

import * as React from 'react';
import { Badge } from '@/components/sabcrm/20ui';
import type { DocStatusDef } from './types';

export interface StatusFlowProps {
  /** Ordered happy path (status values), e.g. draft → sent → paid. */
  flow: string[];
  /** Full vocabulary (labels + tones). */
  statuses: DocStatusDef[];
  /** Current status value. */
  current: string;
  className?: string;
}

export function StatusFlow({
  flow,
  statuses,
  current,
  className,
}: StatusFlowProps): React.JSX.Element {
  const byValue = React.useMemo(
    () => new Map(statuses.map((s) => [s.value, s])),
    [statuses],
  );
  const currentIdx = flow.indexOf(current);
  const offPath = currentIdx === -1;
  const currentDef = byValue.get(current);

  return (
    <div
      className={className}
      role="group"
      aria-label={`Status: ${currentDef?.label ?? current}`}
    >
      <ol className="fdoc-flow">
        {offPath && currentDef ? (
          <>
            <li>
              <Badge tone={currentDef.tone} dot>
                {currentDef.label}
              </Badge>
            </li>
            <li aria-hidden="true" className="fdoc-flow__link" />
          </>
        ) : null}
        {flow.map((value, i) => {
          const def = byValue.get(value);
          const state = offPath
            ? 'upcoming'
            : i < currentIdx
              ? 'done'
              : i === currentIdx
                ? 'current'
                : 'upcoming';
          return (
            <React.Fragment key={value}>
              {i > 0 ? (
                <li aria-hidden="true" className="fdoc-flow__link" />
              ) : null}
              <li
                className={[
                  'fdoc-flow__step',
                  state === 'done' && 'fdoc-flow__step--done',
                  state === 'current' && 'fdoc-flow__step--current',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="fdoc-flow__dot" aria-hidden="true" />
                {def?.label ?? value}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}
