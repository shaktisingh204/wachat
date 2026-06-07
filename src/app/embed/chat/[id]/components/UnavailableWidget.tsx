import { MessageSquareOff } from 'lucide-react';

import { EmptyState } from '@/components/sabcrm/20ui';

export function UnavailableWidget() {
  return (
    <main className="ui20 flex h-screen items-center justify-center bg-[var(--st-bg)] p-6 text-center text-[var(--st-text)]">
      <EmptyState
        icon={MessageSquareOff}
        title="Chat unavailable"
        description="This widget is not currently enabled or does not exist."
      />
    </main>
  );
}
