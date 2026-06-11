'use client';

import * as React from 'react';

import { Button } from '@/components/sabcrm/20ui';

export interface LoadMoreProps {
  hasMore: boolean;
  loading?: boolean;
  onClick: () => void;
}

/**
 * Centered "Load more" control for SabPay's cursor-paginated lists (every
 * list pages with a `before` cursor — never numbered pagination). Renders
 * nothing once the list is exhausted.
 */
export function LoadMore({ hasMore, loading = false, onClick }: LoadMoreProps): React.JSX.Element | null {
  if (!hasMore) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
      <Button variant="secondary" onClick={onClick} loading={loading}>
        Load more
      </Button>
    </div>
  );
}
