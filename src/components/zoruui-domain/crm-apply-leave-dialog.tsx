'use client';

import {
  Button,
  DatePicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Send } from 'lucide-react';
import { applyForCrmLeave } from '@/app/actions/crm-hr.actions';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
  const { toast } = useZoruToast();
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
      <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="startDate" value={startDate?.toISOString()} />
          <input type="hidden" name="endDate" value={endDate?.toISOString()} />
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle className="text-zoru-ink">Apply for Leave</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="leaveType" className="text-zoru-ink">Leave Type *</Label>
                <Select name="leaveType" required>
                  <ZoruSelectTrigger id="leaveType"><ZoruSelectValue placeholder="Select type..." /></ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="Paid Leave">Paid Leave</ZoruSelectItem>
                    <ZoruSelectItem value="Sick Leave">Sick Leave</ZoruSelectItem>
                    <ZoruSelectItem value="Unpaid Leave">Unpaid Leave</ZoruSelectItem>
                    <ZoruSelectItem value="Other">Other</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zoru-ink">Start Date *</Label>
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div className="space-y-2">
                  <Label className="text-zoru-ink">End Date *</Label>
                  <DatePicker value={endDate} onChange={setEndDate} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-zoru-ink">Reason *</Label>
                <Textarea id="reason" name="reason" required placeholder="Enter reason for leave..." />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
