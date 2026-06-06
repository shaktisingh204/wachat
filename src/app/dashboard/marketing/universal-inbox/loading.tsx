import React from 'react';
import { WaterLoaderScreen } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="ui20 h-[calc(100vh-8rem)] w-full">
      <WaterLoaderScreen
        inline
        caption="Loading Universal Inbox"
        label="Loading Universal Inbox"
      />
    </div>
  );
}
