import React from 'react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zoru-line"></div>
      <p className="text-zoru-ink">Loading performance reviews...</p>
    </div>
  );
}
