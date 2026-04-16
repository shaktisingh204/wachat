'use client';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  isExpanded?: boolean;
  isVisible?: boolean;
  className?: string;
};

export const PlaceholderNode = forwardRef<HTMLDivElement, Props>(
  ({ isExpanded, isVisible, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mx-2 rounded-lg transition-all duration-150 bg-[var(--gray-3)]',
          isExpanded ? 'h-[36px] my-1.5' : 'h-[6px] my-0.5',
          isVisible ? 'opacity-100' : 'opacity-0',
          className,
        )}
      />
    );
  },
);

PlaceholderNode.displayName = 'PlaceholderNode';
