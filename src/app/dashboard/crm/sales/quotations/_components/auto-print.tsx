'use client';

import { useEffect } from 'react';

export function AutoPrint() {
  useEffect(() => {
    // Wait a brief moment for fonts/images to load, then trigger print dialog
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
