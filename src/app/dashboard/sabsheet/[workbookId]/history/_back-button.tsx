'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

export function BackToEditorButton({ workbookId }: { workbookId: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      iconLeft={ArrowLeft}
      onClick={() => router.push(`/dashboard/sabsheet/${workbookId}`)}
    >
      Back to editor
    </Button>
  );
}
