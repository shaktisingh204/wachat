import os
import sys

folders = [
    "src/app/wachat/message-tags",
    "src/app/wachat/message-templates-library",
    "src/app/wachat/numbers",
    "src/app/wachat/opt-out",
    "src/app/wachat/overview",
    "src/app/wachat/phone-number-settings",
    "src/app/wachat/post-generator",
    "src/app/wachat/qr-codes",
    "src/app/wachat/quick-reply-categories",
    "src/app/wachat/response-time-tracker",
    "src/app/wachat/saved-replies",
    "src/app/wachat/scheduled-messages",
    "src/app/wachat/settings/agents",
    "src/app/wachat/settings/attributes",
    "src/app/wachat/settings/canned",
    "src/app/wachat/settings/general",
    "src/app/wachat/team-performance",
    "src/app/wachat/template-analytics",
    "src/app/wachat/template-builder",
    "src/app/wachat/templates/create",
    "src/app/wachat/templates/library",
    "src/app/wachat/two-line",
    "src/app/wachat/webhook-logs",
    "src/app/wachat/webhooks",
    "src/app/wachat/whatsapp-ads",
    "src/app/wachat/whatsapp-ads/roadmap",
    "src/app/wachat/whatsapp-ads/setup",
    "src/app/wachat/whatsapp-link-generator",
    "src/app/wachat/whatsapp-pay",
    "src/app/wachat/whatsapp-pay/settings",
    "src/app/web/[slug]/[pageSlug]",
    "src/app/web/[slug]",
    "src/app/zoruui"
]

LOADING_CONTENT = """import { Skeleton } from '@/components/zoruui';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-9 w-64 mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}
"""

ERROR_CONTENT = """'use client';

import { EmptyState, Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[80vh] items-center justify-center p-6">
      <EmptyState
        icon={<AlertCircle className="h-10 w-10 text-zoru-danger" />}
        title="Something went wrong"
        description={error.message || 'An unexpected error occurred while loading this module.'}
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </div>
  );
}
"""

base_dir = "/Users/harshkhandelwal/Downloads/sabnode"

for f in folders:
    target_dir = os.path.join(base_dir, f)
    if os.path.isdir(target_dir):
        loading_path = os.path.join(target_dir, "loading.tsx")
        error_path = os.path.join(target_dir, "error.tsx")
        
        if not os.path.exists(loading_path):
            with open(loading_path, "w") as lf:
                lf.write(LOADING_CONTENT)
                
        if not os.path.exists(error_path):
            with open(error_path, "w") as ef:
                ef.write(ERROR_CONTENT)
        
        print(f"Added loading.tsx and error.tsx to {f}")
    else:
        print(f"Directory not found: {f}")

print("Done!")
