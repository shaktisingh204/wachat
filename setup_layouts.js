const fs = require('fs');
const path = require('path');

const dirs = [
  'flow-builder',
  'flows',
  'flows/create',
  'greeting-messages',
  'interactive-messages',
  'link-tracking',
  'message-statistics',
  'integrations',
  'integrations/razorpay',
  'integrations/whatsapp-link-generator',
  'integrations/whatsapp-widget-generator',
  'media-library',
  'health'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, 'src/app/wachat', dir);
  if (!fs.existsSync(fullPath)) return;
  
  const compName = dir.replace(/[^a-zA-Z0-9]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  
  const errorCode = `'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/zoruui';
import { TriangleAlert } from 'lucide-react';

export default function ${compName}Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error in ${compName}:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center">
      <EmptyState
        icon={<TriangleAlert className="h-10 w-10 text-zoru-danger" />}
        title="Something went wrong"
        description="We couldn't load this page. Please try again."
        action={
          <Button onClick={reset} variant="outline" className="mt-4">
            Try again
          </Button>
        }
      />
    </div>
  );
}`;

  const loadingCode = `'use client';

import { Skeleton, Card } from '@/components/zoruui';

export default function ${compName}Loading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-1/4" />
      <Skeleton className="h-4 w-2/4" />
      <Card className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </Card>
    </div>
  );
}`;

  fs.writeFileSync(path.join(fullPath, 'error.tsx'), errorCode);
  fs.writeFileSync(path.join(fullPath, 'loading.tsx'), loadingCode);
});
console.log('Layouts generated.');
