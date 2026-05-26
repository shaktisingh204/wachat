'use client';

import { useEffect, useState } from 'react';

export function ClientDate({ date }: { date: string | Date }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="opacity-0 text-transparent">...</span>;
  return <>{new Date(date).toLocaleString()}</>;
}
