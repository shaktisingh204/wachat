'use client';

/**
 * Navigational "Edit" action for the pipeline detail header.
 *
 * A pure 20ui <Button> (the canonical pressable) that routes to the edit page.
 * Lives in its own client island so the detail page can stay a server
 * component while still using a real button (not an <a> styled as a button).
 */

import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

export function PipelineEditButton({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Button variant="primary" iconLeft={Pencil} onClick={() => router.push(href)}>
      Edit
    </Button>
  );
}
