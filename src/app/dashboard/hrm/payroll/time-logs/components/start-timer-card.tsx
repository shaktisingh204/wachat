import { Play, Timer } from 'lucide-react';
import { Button, Card, Input } from '@/components/sabcrm/20ui/compat';

interface StartTimerCardProps {
  memo: string;
  setMemo: (val: string) => void;
  isPending: boolean;
  onStartTimer: () => void;
}

export function StartTimerCard({ memo, setMemo, isPending, onStartTimer }: StartTimerCardProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Timer className="h-5 w-5 shrink-0 text-zoru-ink-muted" strokeWidth={1.75} />
        <Input
          placeholder="What are you working on? (optional memo)"
          className="h-9 min-w-[220px] flex-1 rounded-lg border-zoru-line bg-zoru-bg text-[13px] placeholder:text-zoru-ink-muted focus-visible:ring-primary"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onStartTimer();
          }}
        />
        <Button disabled={isPending} onClick={onStartTimer}>
          <Play className="h-4 w-4 fill-current mr-1.5" strokeWidth={1.75} />
          Start Timer
        </Button>
      </div>
    </Card>
  );
}
