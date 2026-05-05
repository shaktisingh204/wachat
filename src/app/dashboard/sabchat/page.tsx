'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { ZoruEmptyState } from '@/components/zoruui';

export default function SabChatRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/sabchat/inbox');
  }, [router]);
  return (
    <ZoruEmptyState
      icon={<Loader2 className="h-6 w-6 animate-spin" />}
      title="Redirecting…"
      description="Taking you to your SabChat inbox."
    />
  );
}
