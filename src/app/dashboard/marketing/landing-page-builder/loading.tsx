import React from 'react';

import { WaterLoaderScreen } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="relative h-[400px] w-full">
      <WaterLoaderScreen
        inline
        caption="Loading campaign data..."
        label="Loading campaign data"
      />
    </div>
  );
}
