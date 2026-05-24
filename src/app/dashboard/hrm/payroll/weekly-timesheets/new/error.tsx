'use client';
import { Button } from '@/components/zoruui';

export default function WeeklyTimesheetNewError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
      <h2 className="text-lg font-semibold">Something went wrong fetching employees!</h2>
      <p className="text-sm text-zoru-ink-muted">{error.message}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
