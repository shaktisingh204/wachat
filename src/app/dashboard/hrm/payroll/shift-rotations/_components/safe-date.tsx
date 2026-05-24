'use client';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export function SafeDate({ dateString, formatStr = 'MMM dd, yyyy' }: { dateString: string | Date, formatStr?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="opacity-0">Loading...</span>;
  }

  return <span>{format(new Date(dateString), formatStr)}</span>;
}
