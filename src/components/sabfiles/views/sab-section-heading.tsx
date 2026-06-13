'use client';

/**
 * A lightweight section header ("Folders" / "Files") with an optional count
 * pill and a trailing action slot (e.g. the grid/list view toggle), matching
 * the reference layout.
 */
import * as React from 'react';

export interface SabSectionHeadingProps {
    title: string;
    count?: number;
    action?: React.ReactNode;
    className?: string;
}

export function SabSectionHeading({
    title,
    count,
    action,
    className,
}: SabSectionHeadingProps): React.JSX.Element {
    return (
        <div
            className={['flex items-center justify-between gap-3', className]
                .filter(Boolean)
                .join(' ')}
        >
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--st-text)]">
                {title}
                {typeof count === 'number' ? (
                    <span className="text-sm font-normal text-[var(--st-text-tertiary)]">
                        {count}
                    </span>
                ) : null}
            </h2>
            {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
    );
}
