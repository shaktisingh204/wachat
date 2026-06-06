'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Button,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { saveTimeLog } from '@/app/actions/worksuite/time.actions';
import { wsFormatDuration } from '@/lib/worksuite/time-types';

export function ManualEntryDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useZoruToast();
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualMemo, setManualMemo] = useState('');
  const [isSavingManual, startManualSave] = useTransition();

  const handleManualSave = () => {
    if (!manualStart || !manualEnd) {
      toast({
        title: 'Validation error',
        description: 'Start time and end time are required.',
        variant: 'destructive',
      });
      return;
    }
    startManualSave(async () => {
      const fd = new FormData();
      fd.set('start_time', new Date(manualStart).toISOString());
      fd.set('end_time', new Date(manualEnd).toISOString());
      if (manualMemo.trim()) fd.set('memo', manualMemo.trim());
      
      const r = await saveTimeLog(null, fd);
      if (r.error) {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      } else {
        toast({ title: 'Entry saved', description: 'Manual time entry created.' });
        onOpenChange(false);
        setManualStart('');
        setManualEnd('');
        setManualMemo('');
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="bg-zoru-bg sm:max-w-[440px]">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="text-[16px] text-zoru-ink">
            Add Manual Entry
          </ZoruDialogTitle>
        </ZoruDialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-zoru-ink-muted">
              Start Time <span className="text-zoru-danger-ink">*</span>
            </label>
            <Input
              type="datetime-local"
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-zoru-ink-muted">
              End Time <span className="text-zoru-danger-ink">*</span>
            </label>
            <Input
              type="datetime-local"
              value={manualEnd}
              onChange={(e) => setManualEnd(e.target.value)}
              className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>

          {manualStart && manualEnd && new Date(manualEnd) > new Date(manualStart) && (
            <p className="text-[12px] text-zoru-ink-muted">
              Duration:{' '}
              <span className="font-mono font-medium text-zoru-ink">
                {wsFormatDuration(manualStart, manualEnd)}
              </span>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-zoru-ink-muted">
              Memo
            </label>
            <Input
              placeholder="What did you work on?"
              value={manualMemo}
              onChange={(e) => setManualMemo(e.target.value)}
              className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px] placeholder:text-zoru-ink-muted"
            />
          </div>
        </div>

        <ZoruDialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSavingManual}>
            Cancel
          </Button>
          <Button disabled={isSavingManual || !manualStart || !manualEnd} onClick={handleManualSave}>
            {isSavingManual ? 'Saving…' : 'Save Entry'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
