'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  X,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="Leave Types"
      subtitle="Define leave categories with annual quota, color, monthly cap, and paid status."
      primaryAction={
        <ZoruButton onClick={openNew}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Leave Type
        </ZoruButton>
      }
    >

      <ZoruCard className="p-6">
        {isLoadingList && types.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">Loading…</div>
        ) : types.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
            No leave types yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line">
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Type</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Per Year</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Monthly Cap</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Unit</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Paid</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t._id} className="border-b border-zoru-line last:border-0">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 rounded-full border border-zoru-line"
                          style={{ backgroundColor: t.color || '#94A3B8' }}
                        />
                        <span className="font-medium text-zoru-ink">{t.type_name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zoru-ink">{t.no_of_leaves}</td>
                    <td className="px-4 py-3 text-zoru-ink">{t.monthly_limit}</td>
                    <td className="px-4 py-3 text-zoru-ink capitalize">{t.leave_unit}</td>
                    <td className="px-4 py-3">
                      <ZoruBadge variant={t.paid ? 'success' : 'warning'}>
                        {t.paid ? 'Paid' : 'Unpaid'}
                      </ZoruBadge>
                    </td>
                    <td className="px-4 py-3">
                      <ZoruBadge variant={t.status === 'active' ? 'success' : 'warning'}>
                        {t.status}
                      </ZoruBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <ZoruButton
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Edit
                        </ZoruButton>
                        <ZoruButton
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(t._id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} />
                          Delete
                        </ZoruButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ZoruCard>

      {/* Add / Edit dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <ZoruCard className="w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] text-zoru-ink">
                {editing ? 'Edit Leave Type' : 'Add Leave Type'}
              </h2>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
                Close
              </ZoruButton>
            </div>

            <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
              {/* hidden _id for edits */}
              {editing && (
                <input type="hidden" name="_id" value={editing._id} />
              )}

              {/* type_name — full width */}
              <div className="md:col-span-2">
                <ZoruLabel className="text-zoru-ink">Type Name *</ZoruLabel>
                <ZoruInput
                  name="type_name"
                  required
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              {/* no_of_leaves */}
              <div>
                <ZoruLabel className="text-zoru-ink">Leaves Per Year</ZoruLabel>
                <ZoruInput
                  name="no_of_leaves"
                  type="number"
                  min="0"
                  value={noOfLeaves}
                  onChange={(e) => setNoOfLeaves(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              {/* monthly_limit */}
              <div>
                <ZoruLabel className="text-zoru-ink">Monthly Limit</ZoruLabel>
                <ZoruInput
                  name="monthly_limit"
                  type="number"
                  min="0"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              {/* color */}
              <div>
                <ZoruLabel className="text-zoru-ink">Color</ZoruLabel>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    name="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-zoru-line bg-zoru-bg p-1"
                  />
                  <span className="text-[13px] text-zoru-ink-muted">{color}</span>
                </div>
              </div>

              {/* leave_unit */}
              <div>
                <ZoruLabel className="text-zoru-ink">Leave Unit</ZoruLabel>
                <ZoruSelect
                  value={leaveUnit}
                  onValueChange={(v) => setLeaveUnit(v as typeof leaveUnit)}
                  name="leave_unit"
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="days">Days</ZoruSelectItem>
                    <ZoruSelectItem value="hours">Hours</ZoruSelectItem>
                    <ZoruSelectItem value="half-days">Half Days</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                {/* hidden input because shadcn Select doesn't submit via form */}
                <input type="hidden" name="leave_unit" value={leaveUnit} />
              </div>

              {/* paid */}
              <div>
                <ZoruLabel className="text-zoru-ink">Paid</ZoruLabel>
                <ZoruSelect value={paid} onValueChange={setPaid} name="paid">
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                    <ZoruSelectItem value="false">No</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="paid" value={paid} />
              </div>

              {/* status */}
              <div>
                <ZoruLabel className="text-zoru-ink">Status</ZoruLabel>
                <ZoruSelect
                  value={status}
                  onValueChange={(v) => setStatus(v as typeof status)}
                  name="status"
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="status" value={status} />
              </div>

              <div className="flex justify-end gap-2 md:col-span-2">
                <ZoruButton
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </ZoruButton>
                <ZoruButton
                  type="submit"
                  disabled={isPending}
                >
                  {isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : null}
                  {editing ? 'Update' : 'Create'}
                </ZoruButton>
              </div>
            </form>
          </ZoruCard>
        </div>
      )}
    </EntityListShell>
  );
}
