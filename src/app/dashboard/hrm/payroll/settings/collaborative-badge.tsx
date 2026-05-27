'use client';

import { useEffect, useState } from 'react';

export function CollaborativeBadge() {
  const [usersCount, setUsersCount] = useState(1);

  // Simulating WebSocket real-time updates for collaborative editing
  useEffect(() => {
    // In a real application, this would connect to a WebSocket server
    const interval = setInterval(() => {
      // Randomly simulate 1-3 users viewing the settings
      setUsersCount(Math.floor(Math.random() * 3) + 1);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  if (usersCount <= 1) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-zoru-line bg-zoru-surface-2 px-3 py-1 text-xs font-medium text-zoru-ink">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zoru-surface-2 opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-zoru-ink"></span>
      </span>
      {usersCount} people viewing
    </div>
  );
}
