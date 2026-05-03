'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  X,
} from 'lucide-react';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getLeaveTypes,
  saveLeaveType,
  deleteLeaveType,
} from '@/app/actions/worksuite/leave.actions';
import type { WsLeaveType } from '@/lib/worksuite/leave-types';

const EMPTY: Partial<WsLeaveType> = {
  type_name: '',
  no_of_leaves: 0,
  color: '#EAB308',
  monthly_limit: 0,
  paid: true,
  leave_unit: 'days',
  status: 'active',
};

export default function LeaveTypesPage() {
  const { toast } = useToast();
  const [types, setTypes] = useState<(WsLeaveType & { _id: string })[]>([]);
  const [isLoadingList, startLoadList] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  // dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(WsLeaveType & { _id: string }) | null>(null);

  // controlled form fields
  const [typeName, setTypeName] = useState('');
  const [noOfLeaves, setNoOfLeaves] = useState('0');
  const [color, setColor] = useState('#EAB308');
  const [monthlyLimit, setMonthlyLimit] = useState('0');
  const [paid, setPaid] = useState('true');
  const [leaveUnit, setLeaveUnit] = useState<'days' | 'hours' | 'half-days'>('days');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const formRef = useRef<HTMLFormElement>(null);

  const [actionState, formAction, isPending] = useActionState(saveLeaveType, undefined);

  const loadTypes = () => {
    startLoadList(async () => {
      const ts = await getLeaveTypes();
      setTypes(ts as (WsLeaveType & { _id: string })[]);
    });
  };

  useEffect(() => { loadTypes(); }, []);

  // react to saveLeaveType result
  useEffect(() => {
    if (!actionState) return;
    if (actionState.error) {
      toast({ title: 'Error', description: actionState.error, variant: 'destructive' });
    } else if (actionState.message) {
      toast({ title: 'Saved', description: actionState.message });
      setOpen(false);
      loadTypes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionState]);

  const openNew = () => {
    setEditing(null);
    setTypeName('');
    setNoOfLeaves('0');
    setColor('#EAB308');
    setMonthlyLimit('0');
    setPaid('true');
    setLeaveUnit('days');
    setStatus('active');
    setOpen(true);
  };

  const openEdit = (t: WsLeaveType & { _id: string }) => {
    setEditing(t);
    setTypeName(t.type_name);
    setNoOfLeaves(String(t.no_of_leaves));
    setColor(t.color || '#EAB308');
    setMonthlyLimit(String(t.monthly_limit));
    setPaid(t.paid ? 'true' : 'false');
    setLeaveUnit(t.leave_unit);
    setStatus(t.status);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this leave type?')) return;
    startDelete(async () => {
      const r = await deleteLeaveType(id);
      if (r.success) {
        toast({ title: 'Deleted' });
        loadTypes();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Types"
        subtitle="Define leave categories with annual quota, color, monthly cap, and paid status."
        icon={Tags}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={openNew}
          >
            Add Leave Type
          </ClayButton>
        }
      />

      <ClayCard>
        {isLoadingList && types.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : types.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground">
            No leave types yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Per Year</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Monthly Cap</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Unit</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Paid</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 rounded-full border border-border"
                          style={{ backgroundColor: t.color || '#94A3B8' }}
                        />
                        <span className="font-medium text-foreground">{t.type_name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{t.no_of_leaves}</td>
                    <td className="px-4 py-3 text-foreground">{t.monthly_limit}</td>
                    <td className="px-4 py-3 text-foreground capitalize">{t.leave_unit}</td>
                    <td className="px-4 py-3">
                      <ClayBadge tone={t.paid ? 'green' : 'amber'}>
                        {t.paid ? 'Paid' : 'Unpaid'}
                      </ClayBadge>
                    </td>
                    <td className="px-4 py-3">
                      <ClayBadge tone={t.status === 'active' ? 'green' : 'amber'}>
                        {t.status}
                      </ClayBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <ClayButton
                          variant="pill"
                          onClick={() => openEdit(t)}
                          leading={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        >
                          Edit
                        </ClayButton>
                        <ClayButton
                          variant="pill"
                          onClick={() => handleDelete(t._id)}
                          disabled={isDeleting}
                          leading={<Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} />}
                        >
                          Delete
                        </ClayButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClayCard>

      {/* Add / Edit dialog — using a ClayCard overlay rather than shadcn Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <ClayCard className="w-full max-w-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">
                {editing ? 'Edit Leave Type' : 'Add Leave Type'}
              </h2>
              <ClayButton
                variant="pill"
                onClick={() => setOpen(false)}
                leading={<X className="h-4 w-4" strokeWidth={1.75} />}
              >
                Close
              </ClayButton>
            </div>

            <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
              {/* hidden _id for edits */}
              {editing && (
                <input type="hidden" name="_id" value={editing._id} />
              )}

              {/* type_name — full width */}
              <div className="md:col-span-2">
                <Label className="text-foreground">Type Name *</Label>
                <Input
                  name="type_name"
                  required
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>

              {/* no_of_leaves */}
              <div>
                <Label className="text-foreground">Leaves Per Year</Label>
                <Input
                  name="no_of_leaves"
                  type="number"
                  min="0"
                  value={noOfLeaves}
                  onChange={(e) => setNoOfLeaves(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>

              {/* monthly_limit */}
              <div>
                <Label className="text-foreground">Monthly Limit</Label>
                <Input
                  name="monthly_limit"
                  type="number"
                  min="0"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>

              {/* color */}
              <div>
                <Label className="text-foreground">Color</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    name="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-card p-1"
                  />
                  <span className="text-[13px] text-muted-foreground">{color}</span>
                </div>
              </div>

              {/* leave_unit */}
              <div>
                <Label className="text-foreground">Leave Unit</Label>
                <Select
                  value={leaveUnit}
                  onValueChange={(v) => setLeaveUnit(v as typeof leaveUnit)}
                  name="leave_unit"
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="half-days">Half Days</SelectItem>
                  </SelectContent>
                </Select>
                {/* hidden input because shadcn Select doesn't submit via form */}
                <input type="hidden" name="leave_unit" value={leaveUnit} />
              </div>

              {/* paid */}
              <div>
                <Label className="text-foreground">Paid</Label>
                <Select value={paid} onValueChange={setPaid} name="paid">
                  <SelectTrigger className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="paid" value={paid} />
              </div>

              {/* status */}
              <div>
                <Label className="text-foreground">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as typeof status)}
                  name="status"
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="status" value={status} />
              </div>

              <div className="flex justify-end gap-2 md:col-span-2">
                <ClayButton
                  type="button"
                  variant="pill"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </ClayButton>
                <ClayButton
                  type="submit"
                  variant="obsidian"
                  disabled={isPending}
                  leading={
                    isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    ) : null
                  }
                >
                  {editing ? 'Update' : 'Create'}
                </ClayButton>
              </div>
            </form>
          </ClayCard>
        </div>
      )}
    </div>
  );
}
