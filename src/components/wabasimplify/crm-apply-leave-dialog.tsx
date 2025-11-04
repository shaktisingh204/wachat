
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { applyForCrmLeave } from '@/app/actions/crm-hr.actions';
import { DatePicker } from '../ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Submit Request
    </Button>
  );
}

interface ApplyForLeaveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ApplyForLeaveDialog({ isOpen, onOpenChange, onSuccess }: ApplyForLeaveDialogProps) {
  const [state, formAction] = useActionState(applyForCrmLeave, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      onSuccess();
      onOpenChange(false);
      formRef.current?.reset();
      setStartDate(undefined);
      setEndDate(undefined);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="startDate" value={startDate?.toISOString()} />
            <input type="hidden" name="endDate" value={endDate?.toISOString()} />
            <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="leaveType">Leave Type *</Label>
                    <Select name="leaveType" required>
                        <SelectTrigger id="leaveType"><SelectValue placeholder="Select type..."/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Paid Leave">Paid Leave</SelectItem>
                            <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                            <SelectItem value="Unpaid Leave">Unpaid Leave</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Start Date *</Label>
                        <DatePicker date={startDate} setDate={setStartDate} />
                    </div>
                    <div className="space-y-2">
                        <Label>End Date *</Label>
                        <DatePicker date={endDate} setDate={setEndDate} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reason">Reason *</Label>
                    <Textarea id="reason" name="reason" required placeholder="Enter reason for leave..." />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <SubmitButton />
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
