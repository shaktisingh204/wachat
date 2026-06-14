"use client";

import * as React from "react";
import { CalendarDays, Check, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  SelectField,
  Switch,
  TabsBar,
  TabPanel,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell, statusTone } from "@/components/sabhrm/page-toolkit";
import {
  createLeaveRequest,
  createLeaveType,
  deleteLeaveRequest,
  deleteLeaveType,
  listLeaveRequests,
  listLeaveTypes,
  setLeaveStatus,
  updateLeaveType,
  type CreateLeaveRequestValues,
  type LeavePickerOptions,
  type LeaveTypeFormValues,
} from "@/app/actions/sabhrm/leave.actions";
import type {
  LeaveRequestRow,
  LeaveStatus,
  LeaveTypeRow,
  Paginated,
} from "@/lib/sabhrm/types";

const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const EMPTY_REQUEST: CreateLeaveRequestValues = {
  employeeId: "",
  leaveTypeId: "",
  from: "",
  to: "",
  reason: "",
};

const EMPTY_TYPE: LeaveTypeFormValues = {
  name: "",
  code: "",
  annualQuota: 0,
  paid: true,
  carryForward: false,
  color: "",
};

export function LeaveClient({
  initialRequests,
  initialTypes,
  options,
  loadError,
}: {
  initialRequests: Paginated<LeaveRequestRow>;
  initialTypes: LeaveTypeRow[];
  options: LeavePickerOptions;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState("requests");

  /* ── requests state ─────────────────────────────────────────────── */
  const [requests, setRequests] = React.useState<LeaveRequestRow[]>(initialRequests.rows);
  const [reqOpen, setReqOpen] = React.useState(false);
  const [reqForm, setReqForm] = React.useState<CreateLeaveRequestValues>(EMPTY_REQUEST);
  const [reqSaving, setReqSaving] = React.useState(false);
  const [reqErr, setReqErr] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  /* ── leave types state ──────────────────────────────────────────── */
  const [types, setTypes] = React.useState<LeaveTypeRow[]>(initialTypes);
  const [typeOpen, setTypeOpen] = React.useState(false);
  const [editingType, setEditingType] = React.useState<LeaveTypeRow | null>(null);
  const [typeForm, setTypeForm] = React.useState<LeaveTypeFormValues>(EMPTY_TYPE);
  const [typeSaving, setTypeSaving] = React.useState(false);
  const [typeErr, setTypeErr] = React.useState<string | null>(null);

  const employeeOptions: SelectOption[] = options.employees;
  // Always reflect the latest leave types in the picker (after add/edit/delete).
  const leaveTypeOptions: SelectOption[] = React.useMemo(
    () => types.map((t) => ({ value: t.id, label: t.name })),
    [types],
  );

  /* ── requests handlers ──────────────────────────────────────────── */

  const patchReq = (p: Partial<CreateLeaveRequestValues>) => setReqForm((f) => ({ ...f, ...p }));

  const submitRequest = React.useCallback(async () => {
    setReqErr(null);
    setReqSaving(true);
    const res = await createLeaveRequest(reqForm);
    setReqSaving(false);
    if (!res.ok) {
      setReqErr(res.error);
      return;
    }
    toast({ title: "Leave applied", description: `${res.data.days}-day request submitted for ${res.data.employeeName}.` });
    setReqOpen(false);
    setReqForm(EMPTY_REQUEST);
    setRequests((r) => [res.data, ...r]);
  }, [reqForm, toast]);

  const changeStatus = React.useCallback(
    async (row: LeaveRequestRow, status: "approved" | "rejected" | "cancelled") => {
      setBusyId(row.id);
      const res = await setLeaveStatus(row.id, status);
      setBusyId(null);
      if (!res.ok) {
        toast({ title: "Couldn't update", description: res.error, variant: "destructive" });
        return;
      }
      setRequests((r) => r.map((x) => (x.id === row.id ? res.data : x)));
      toast({ title: `Leave ${LEAVE_STATUS_LABELS[res.data.status].toLowerCase()}` });
    },
    [toast],
  );

  const removeRequest = React.useCallback(
    async (row: LeaveRequestRow) => {
      if (!window.confirm(`Delete ${row.employeeName}'s ${row.leaveTypeName} request?`)) return;
      const res = await deleteLeaveRequest(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRequests((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Leave request deleted" });
    },
    [toast],
  );

  // Reload requests if a type changes name (keeps stored names fresh on next view).
  const refreshRequests = React.useCallback(async () => {
    const res = await listLeaveRequests({ pageSize: 50 });
    if (res.ok) setRequests(res.data.rows);
  }, []);

  /* ── type handlers ──────────────────────────────────────────────── */

  const patchType = (p: Partial<LeaveTypeFormValues>) => setTypeForm((f) => ({ ...f, ...p }));

  const openAddType = () => {
    setEditingType(null);
    setTypeForm(EMPTY_TYPE);
    setTypeErr(null);
    setTypeOpen(true);
  };

  const openEditType = (row: LeaveTypeRow) => {
    setEditingType(row);
    setTypeForm({
      name: row.name,
      code: row.code,
      annualQuota: row.annualQuota,
      paid: row.paid,
      carryForward: row.carryForward,
      color: row.color ?? "",
    });
    setTypeErr(null);
    setTypeOpen(true);
  };

  const submitType = React.useCallback(async () => {
    setTypeErr(null);
    setTypeSaving(true);
    const res = editingType
      ? await updateLeaveType(editingType.id, typeForm)
      : await createLeaveType(typeForm);
    setTypeSaving(false);
    if (!res.ok) {
      setTypeErr(res.error);
      return;
    }
    if (editingType) {
      setTypes((t) => t.map((x) => (x.id === res.data.id ? res.data : x)));
      void refreshRequests();
      toast({ title: "Leave type updated" });
    } else {
      setTypes((t) => [...t, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      toast({ title: "Leave type added" });
    }
    setTypeOpen(false);
    setTypeForm(EMPTY_TYPE);
    setEditingType(null);
  }, [editingType, typeForm, toast, refreshRequests]);

  const removeType = React.useCallback(
    async (row: LeaveTypeRow) => {
      if (!window.confirm(`Delete the "${row.name}" leave type?`)) return;
      const res = await deleteLeaveType(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setTypes((t) => t.filter((x) => x.id !== row.id));
      toast({ title: "Leave type deleted" });
    },
    [toast],
  );

  /* ── columns ────────────────────────────────────────────────────── */

  const requestColumns: DataTableColumn<LeaveRequestRow>[] = [
    {
      key: "employeeName",
      header: "Employee",
      render: (r) => <span className="text-sm font-medium text-[var(--st-text)]">{r.employeeName}</span>,
    },
    { key: "leaveTypeName", header: "Type", render: (r) => r.leaveTypeName },
    { key: "from", header: "From", render: (r) => <span className="tabular-nums">{r.from}</span> },
    { key: "to", header: "To", render: (r) => <span className="tabular-nums">{r.to}</span> },
    {
      key: "days",
      header: "Days",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.days}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge variant={TONE_BADGE[statusTone(r.status)]}>{LEAVE_STATUS_LABELS[r.status]}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.status === "pending" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                iconLeft={Check}
                disabled={busyId === r.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void changeStatus(r, "approved");
                }}
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={X}
                disabled={busyId === r.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void changeStatus(r, "rejected");
                }}
              >
                Reject
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            aria-label={`Delete ${r.employeeName}'s request`}
            onClick={(e) => {
              e.stopPropagation();
              void removeRequest(r);
            }}
          />
        </div>
      ),
    },
  ];

  const typeColumns: DataTableColumn<LeaveTypeRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <span className="flex items-center gap-2">
          {r.color ? (
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: r.color }}
              aria-hidden
            />
          ) : null}
          <span className="text-sm font-medium text-[var(--st-text)]">{r.name}</span>
        </span>
      ),
    },
    {
      key: "code",
      header: "Code",
      render: (r) => <span className="text-sm tabular-nums uppercase">{r.code}</span>,
    },
    {
      key: "annualQuota",
      header: "Quota",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.annualQuota}</span>,
    },
    {
      key: "paid",
      header: "Paid",
      render: (r) =>
        r.paid ? <Badge variant="success">Paid</Badge> : <Badge variant="outline">Unpaid</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Pencil}
            aria-label={`Edit ${r.name}`}
            onClick={(e) => {
              e.stopPropagation();
              openEditType(r);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            aria-label={`Delete ${r.name}`}
            onClick={(e) => {
              e.stopPropagation();
              void removeType(r);
            }}
          />
        </div>
      ),
    },
  ];

  const reqValid =
    !!reqForm.employeeId && !!reqForm.leaveTypeId && !!reqForm.from && !!reqForm.to;
  const typeValid = !!typeForm.name.trim() && !!typeForm.code.trim();

  return (
    <SabHrmPageShell
      title="Leave"
      description="Apply for leave, approve or reject requests, and manage the leave types your team can take."
      actions={
        tab === "requests" ? (
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => {
              setReqForm(EMPTY_REQUEST);
              setReqErr(null);
              setReqOpen(true);
            }}
          >
            Apply leave
          </Button>
        ) : (
          <Button variant="primary" size="sm" iconLeft={Plus} onClick={openAddType}>
            Add leave type
          </Button>
        )
      }
    >
      <TabsBar
        value={tab}
        onChange={setTab}
        items={[
          { value: "requests", label: "Requests", badge: requests.length || undefined },
          { value: "types", label: "Leave types", badge: types.length || undefined },
        ]}
      >
        <TabPanel value="requests" className="pt-4">
          {requests.length === 0 ? (
            <Card className="p-10">
              <EmptyState
                icon={<CalendarDays aria-hidden />}
                title={loadError ? "Couldn't load leave requests" : "No leave requests yet"}
                description={
                  loadError ?? "Apply for leave on behalf of an employee to get started."
                }
                action={
                  !loadError ? (
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={Plus}
                      onClick={() => setReqOpen(true)}
                    >
                      Apply leave
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <DataTable columns={requestColumns} rows={requests} getRowId={(r) => r.id} hover />
            </Card>
          )}
        </TabPanel>

        <TabPanel value="types" className="pt-4">
          {types.length === 0 ? (
            <Card className="p-10">
              <EmptyState
                icon={<CalendarDays aria-hidden />}
                title="No leave types yet"
                description="Define the kinds of leave your team can take (e.g. Annual, Sick, Casual)."
                action={
                  <Button variant="primary" size="sm" iconLeft={Plus} onClick={openAddType}>
                    Add leave type
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <DataTable columns={typeColumns} rows={types} getRowId={(r) => r.id} hover />
            </Card>
          )}
        </TabPanel>
      </TabsBar>

      {/* Apply-leave dialog */}
      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply leave</DialogTitle>
            <DialogDescription>
              Submit a leave request for an employee. Days are counted inclusively
              across the selected range.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employee" className="sm:col-span-2">
              <SelectField
                value={reqForm.employeeId}
                options={[{ value: "", label: "Select an employee" }, ...employeeOptions]}
                onChange={(v) => patchReq({ employeeId: String(v) })}
              />
            </Field>
            <Field label="Leave type" className="sm:col-span-2">
              <SelectField
                value={reqForm.leaveTypeId}
                options={[{ value: "", label: "Select a leave type" }, ...leaveTypeOptions]}
                onChange={(v) => patchReq({ leaveTypeId: String(v) })}
              />
            </Field>
            <Field label="From">
              <Input
                type="date"
                value={reqForm.from}
                onChange={(e) => patchReq({ from: e.target.value })}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={reqForm.to}
                onChange={(e) => patchReq({ to: e.target.value })}
              />
            </Field>
            <Field label="Reason" className="sm:col-span-2">
              <Input
                value={reqForm.reason ?? ""}
                onChange={(e) => patchReq({ reason: e.target.value })}
                placeholder="Optional"
              />
            </Field>
          </div>

          {reqErr ? <p className="mt-1 text-sm text-[var(--st-status-bad,#dc2626)]">{reqErr}</p> : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReqOpen(false)} disabled={reqSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={reqSaving}
              disabled={reqSaving || !reqValid}
              onClick={() => void submitRequest()}
            >
              Apply leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / edit leave-type dialog */}
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit leave type" : "Add leave type"}</DialogTitle>
            <DialogDescription>
              Leave types appear in the apply-leave picker. The code is a short
              uppercase identifier (e.g. AL, SL, CL).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={typeForm.name}
                onChange={(e) => patchType({ name: e.target.value })}
                placeholder="Annual leave"
                autoFocus
              />
            </Field>
            <Field label="Code">
              <Input
                value={typeForm.code}
                onChange={(e) => patchType({ code: e.target.value.toUpperCase() })}
                placeholder="AL"
              />
            </Field>
            <Field label="Annual quota (days)">
              <Input
                type="number"
                value={String(typeForm.annualQuota)}
                onChange={(e) => patchType({ annualQuota: e.target.value ? Number(e.target.value) : 0 })}
                placeholder="0"
              />
            </Field>
            <Field label="Color">
              <Input
                type="color"
                value={typeForm.color || "#6366f1"}
                onChange={(e) => patchType({ color: e.target.value })}
              />
            </Field>
            <Field label="Paid leave">
              <Switch
                checked={typeForm.paid}
                onCheckedChange={(v) => patchType({ paid: v })}
                label={typeForm.paid ? "Paid" : "Unpaid"}
              />
            </Field>
            <Field label="Carry forward">
              <Switch
                checked={typeForm.carryForward}
                onCheckedChange={(v) => patchType({ carryForward: v })}
                label={typeForm.carryForward ? "Yes" : "No"}
              />
            </Field>
          </div>

          {typeErr ? <p className="mt-1 text-sm text-[var(--st-status-bad,#dc2626)]">{typeErr}</p> : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTypeOpen(false)} disabled={typeSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={editingType ? Pencil : Plus}
              loading={typeSaving}
              disabled={typeSaving || !typeValid}
              onClick={() => void submitType()}
            >
              {editingType ? "Save changes" : "Add leave type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
