"use client";

import React, { useState, useEffect, useTransition } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Globe,
  GripVertical,
  Link as LinkIcon,
  RefreshCcw,
  Trash
} from "lucide-react";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsRefreshButton,
} from "@/components/sabsms/page-toolkit";

import {
  Button,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Field,
  Input,
  SegmentedControl,
  Alert,
  EmptyState,
  toast,
} from "@/components/sabcrm/20ui";

import {
  loadScheduledSends,
  loadUnscheduledTray,
  rescheduleSend,
  cancelScheduledSend,
  bulkRescheduleByWindow,
  setRecurringCron,
  exportIcal,
  mintIcalSubscription,
  saveNotificationRule,
  loadAuditLog,
  getHolidayCalendar,
  detectQuietHourConflictsAsync,
  detectCrossCampaignConflictsAsync,
  buildMonthGridAsync,
  type ScheduledSend,
  type HolidayEntry
} from "./actions";

export function ScheduledSendsClient({ workspaceId }: { workspaceId: string }) {
  const [sends, setSends] = useState<ScheduledSend[]>([]);
  const [unscheduled, setUnscheduled] = useState<ScheduledSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthCursor, setMonthCursor] = useState(new Date());

  // Views
  const [viewType, setViewType] = useState<"calendar" | "list">("calendar");
  const [calView, setCalView] = useState<"month" | "week" | "day">("month");

  // State
  const [selectedSend, setSelectedSend] = useState<ScheduledSend | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [now, setNow] = useState(new Date());


  // Conflicts
  const [quietConflicts, setQuietConflicts] = useState<Set<string>>(new Set());
  const [campaignConflicts, setCampaignConflicts] = useState<Set<string>>(new Set());

  // Grid
  const [gridCells, setGridCells] = useState<any[]>([]);

  // Dialogs
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftMins, setShiftMins] = useState(60);

  const [icalDialogOpen, setIcalDialogOpen] = useState(false);
  const [icalUrl, setIcalUrl] = useState("");

  const [isPending, startTransition] = useTransition();

  const reload = async () => {
    setLoading(true);
    try {
      const from = startOfMonth(subMonths(monthCursor, 1));
      const to = endOfMonth(addMonths(monthCursor, 1));

      const [fetchedSends, fetchedTray] = await Promise.all([
        loadScheduledSends(workspaceId, { from, to }),
        loadUnscheduledTray(workspaceId)
      ]);

      const realCells = await buildMonthGridAsync(monthCursor.getFullYear(), monthCursor.getMonth(), fetchedSends);

      setSends(fetchedSends);
      setUnscheduled(fetchedTray);
      setGridCells(realCells);

      const qConf = await detectQuietHourConflictsAsync(fetchedSends);
      setQuietConflicts(new Set(qConf.map(q => q.sendId)));

      const cConf = await detectCrossCampaignConflictsAsync(fetchedSends);
      setCampaignConflicts(new Set(cConf.flatMap(c => [c.a, c.b])));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, monthCursor]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const futureSends = sends.filter(s => new Date(s.sendAt) > now).sort((a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime());
  const nextSend = futureSends[0];

  const getCountdownString = (target: Date) => {
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return "Sending now...";
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return `${d > 0 ? d + "d " : ""}${h}h ${m}m ${s}s`;
  };


  const handleDragStart = (e: React.DragEvent, sendId: string) => {
    e.dataTransfer.setData("sendId", sendId);
  };

  const handleDrop = async (e: React.DragEvent, dateIso: string) => {
    e.preventDefault();
    const sendId = e.dataTransfer.getData("sendId");
    if (!sendId) return;

    // Feature 19: Optimistic UI
    const dt = new Date(dateIso);
    dt.setHours(9, 0, 0, 0); // default hour on drop to day cell
    const isoString = dt.toISOString();

    setSends(prev => prev.map(s => s.id === sendId ? { ...s, sendAt: isoString } : s));

    startTransition(async () => {
      await rescheduleSend(sendId, isoString);
      await reload();
    });
  };

  const openDrawer = async (s: ScheduledSend) => {
    setSelectedSend(s);
    setDrawerOpen(true);
    const logs = await loadAuditLog(workspaceId, s.id);
    setAuditLogs(logs);
  };

  const handleCancelSend = async () => {
    if (!selectedSend) return;
    await cancelScheduledSend(selectedSend.id);
    setDrawerOpen(false);
    reload();
  };

  const doExportIcal = async () => {
    const from = startOfMonth(monthCursor).toISOString();
    const to = endOfMonth(monthCursor).toISOString();
    const res = await exportIcal(from, to);
    if (res.ok) {
      const blob = new Blob([res.ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
    }
  };

  const doSubscribeIcal = async () => {
    const res = await mintIcalSubscription();
    if (res.ok) {
      setIcalUrl(window.location.origin + res.url);
      setIcalDialogOpen(true);
    }
  };

  const doBulkShift = async () => {
    const ids = sends.map(s => s.id);
    await bulkRescheduleByWindow(ids, shiftMins);
    setShiftDialogOpen(false);
    reload();
  };

  const saveCron = async (cron: string) => {
    if (selectedSend) {
      await setRecurringCron(selectedSend.id, cron);
      reload();
    }
  };

  return (
    <SabsmsPageShell
      title="Scheduled Sends"
      eyebrow="Outbound"
      description="Feature 15: Manage, reschedule, and monitor future outbound capacity."
      breadcrumbs={[
        { label: "SabSMS", href: "/sabsms" },
        { label: "Outbound" },
        { label: "Scheduled Sends" }
      ]}
      primaryAction={{ label: "Bulk Reschedule", onClick: () => setShiftDialogOpen(true) }}
      secondaryActions={[
        { label: "Export iCal", onSelectAction: doExportIcal, icon: <Download className="w-4 h-4 mr-2" aria-hidden="true" /> },
        { label: "Subscribe to Calendar", onSelectAction: doSubscribeIcal, icon: <LinkIcon className="w-4 h-4 mr-2" aria-hidden="true" /> }
      ]}
      toolbar={
        <div className="flex items-center justify-between w-full">
          <SabsmsFilterBar
            searchPlaceholder="Search scheduled sends..."
            facets={[
              { key: "status", label: "Status", options: [{label: "Scheduled", value: "scheduled"}] }
            ]}
          />
          <div className="flex space-x-2 items-center">
            <SegmentedControl
              aria-label="Switch view"
              value={viewType}
              onChange={(v) => setViewType(v as "calendar" | "list")}
              items={[
                { value: "calendar", label: "Calendar" },
                { value: "list", label: "List" },
              ]}
            />
            <SabsmsRefreshButton onRefresh={reload} />
          </div>
        </div>
      }
    >
      {nextSend && (
        <Card className="mb-6 bg-gradient-to-r from-[var(--st-bg-muted)] to-[var(--st-bg-muted)] border-[var(--st-border)]">
          <CardBody className="p-4 flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-[var(--st-text)] mr-3" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--st-text)]">Next Scheduled Send: {nextSend.name}</h3>
                <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                  Scheduled for {format(new Date(nextSend.sendAt), "PPP p")} Local ({new Date(nextSend.sendAt).toISOString().substring(11, 16)} UTC)
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[var(--st-text)] tabular-nums">{getCountdownString(new Date(nextSend.sendAt))}</div>
              <div className="text-xs text-[var(--st-text-secondary)] uppercase tracking-wider">Countdown</div>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex space-x-6">
        {/* Main Area */}
        <div className="flex-1">
          {viewType === "calendar" ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm" iconLeft={ChevronLeft} aria-label="Previous month" onClick={() => setMonthCursor(subMonths(monthCursor, 1))} />
                  <CardTitle>{format(monthCursor, "MMMM yyyy")}</CardTitle>
                  <Button variant="outline" size="sm" iconLeft={ChevronRight} aria-label="Next month" onClick={() => setMonthCursor(addMonths(monthCursor, 1))} />
                </div>
                <SegmentedControl
                  size="sm"
                  aria-label="Calendar granularity"
                  value={calView}
                  onChange={(v) => setCalView(v as "month" | "week" | "day")}
                  items={[
                    { value: "month", label: "Month" },
                    { value: "week", label: "Week" },
                    { value: "day", label: "Day" },
                  ]}
                />
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-7 gap-px bg-[var(--st-bg-muted)] border border-[var(--st-border)]">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                    <div key={d} className="bg-[var(--st-bg-muted)] p-2 text-xs font-medium text-[var(--st-text-secondary)] text-center">{d}</div>
                  ))}
                  {gridCells.map((c, i) => {
                    const d = parseISO(c.iso);
                    const isToday = isSameDay(d, new Date());
                    return (
                      <div
                        key={i}
                        className={`bg-[var(--st-bg)] min-h-[120px] p-2 relative ${!c.inMonth ? "opacity-50 bg-[var(--st-bg-muted)]" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, c.iso)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-sm font-medium ${isToday ? "bg-[var(--st-accent)] text-[var(--st-text-inverted)] rounded-full w-6 h-6 flex items-center justify-center" : "text-[var(--st-text)]"}`}>
                            {format(d, "d")}
                          </span>
                          {c.holiday && (
                            <span className="text-[10px] text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] px-1 rounded truncate max-w-[80px]">
                              {c.holiday.name}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 mt-2">
                          {c.sends?.map((s: ScheduledSend) => (
                            <div
                              key={s.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, s.id)}
                              onClick={() => openDrawer(s)}
                              className="text-xs p-1.5 rounded bg-[var(--st-bg-muted)] border border-[var(--st-border)] text-[var(--st-text)] cursor-pointer hover:bg-[var(--st-bg-muted)] flex items-start shadow-sm"
                            >
                              <GripVertical className="w-3 h-3 mr-1 opacity-50 flex-shrink-0 mt-0.5" aria-hidden="true" />
                              <div className="truncate flex-1 flex flex-col">
                                <span className="font-medium truncate">{format(new Date(s.sendAt), "HH:mm")} {s.name}</span>
                                <span className="text-[10px] text-[var(--st-text-tertiary)] truncate">{new Date(s.sendAt).toISOString().substring(11, 16)} UTC</span>
                              </div>
                              {quietConflicts.has(s.id) && <AlertCircle className="w-3 h-3 text-[var(--st-warn)] ml-1 flex-shrink-0 mt-0.5" aria-label="Quiet-hours conflict" />}
                              {campaignConflicts.has(s.id) && <AlertCircle className="w-3 h-3 text-[var(--st-danger)] ml-1 flex-shrink-0 mt-0.5" aria-label="Campaign overlap" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="p-0">
                <SabsmsDataTable
                  rows={sends}
                  rowKey={r => r.id}
                  onRowClick={openDrawer}
                  columns={[
                    { id: "time", header: "Send At", render: r => {
                      const dt = new Date(r.sendAt);
                      return (
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--st-text)]">{format(dt, "MMM d, HH:mm")} (Local)</span>
                          <span className="text-[10px] text-[var(--st-text-secondary)]">{dt.toISOString().substring(11, 16)} (UTC)</span>
                        </div>
                      );
                    } },
                    { id: "name", header: "Name", render: r => <div className="font-medium text-[var(--st-text)]">{r.name}</div> },
                    { id: "sender", header: "Sender", render: r => <Badge variant="outline">{r.senderId}</Badge> },
                    { id: "count", header: "Recipients", render: r => r.recipientCount.toLocaleString() },
                    { id: "status", header: "Status", render: r => <Badge>{r.status}</Badge> }
                  ]}
                />
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar tray for unscheduled */}
        <div className="w-72 space-y-4 hidden lg:block">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Unscheduled Tray</span>
                <Badge variant="secondary">{unscheduled.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-xs text-[var(--st-text-secondary)] mb-3">Drag drafts onto the calendar to schedule them.</p>
              <div className="space-y-2">
                {unscheduled.map(u => (
                  <div
                    key={u.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, u.id)}
                    className="p-2 border border-[var(--st-border)] rounded text-sm bg-[var(--st-bg)] cursor-grab hover:border-[var(--st-accent)] flex items-center"
                  >
                    <GripVertical className="w-4 h-4 mr-2 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    <div className="flex-1 truncate">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-[var(--st-text-secondary)]">{u.recipientCount} recipients</div>
                    </div>
                  </div>
                ))}
                {unscheduled.length === 0 && (
                  <EmptyState
                    size="sm"
                    icon={Clock}
                    title="No drafts available"
                    description="New drafts appear here, ready to drag onto the calendar."
                  />
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Detail Drawer */}
      <SabsmsDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selectedSend?.name || "Send Details"}
        description="Manage this scheduled send"
      >
        {selectedSend && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-[var(--st-text-secondary)]">Scheduled For</span>
                <div className="font-medium">{format(new Date(selectedSend.sendAt), "PPP p")} (Local)</div>
                <div className="text-xs text-[var(--st-text-secondary)]">{new Date(selectedSend.sendAt).toISOString().substring(0, 16).replace("T", " ")} (UTC)</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-[var(--st-text-secondary)]">Recipient TZ</span>
                <div className="font-medium flex items-center">
                  <Globe className="w-4 h-4 mr-1 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  {selectedSend.recipientTz || "UTC"}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-[var(--st-text-secondary)]">Sender</span>
                <div><Badge variant="outline">{selectedSend.senderId}</Badge></div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-[var(--st-text-secondary)]">Recipients</span>
                <div className="font-medium">{selectedSend.recipientCount.toLocaleString()}</div>
              </div>
            </div>

            {selectedSend.cron && (
              <div className="p-3 bg-[var(--st-bg-muted)] rounded border border-[var(--st-border)] text-sm">
                <div className="flex items-center text-[var(--st-text)] font-medium mb-1">
                  <RefreshCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Recurring Schedule
                </div>
                <code>{selectedSend.cron}</code>
              </div>
            )}

            {quietConflicts.has(selectedSend.id) && (
              <Alert tone="warning" title="Quiet hours conflict">
                This send conflicts with configured quiet hours for some recipients.
              </Alert>
            )}

            {campaignConflicts.has(selectedSend.id) && (
              <Alert tone="danger" title="Capacity overlap">
                Sender capacity overlap detected with another campaign.
              </Alert>
            )}

            <div className="pt-4 border-t border-[var(--st-border)] space-y-4">
              <h4 className="text-sm font-semibold">Actions</h4>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" iconLeft={RefreshCcw} onClick={() => saveCron("0 9 * * 1")}>
                  Make Weekly
                </Button>
                <Button variant="outline" size="sm" iconLeft={Clock} onClick={() => toast.success("Notification rule saved.")}>
                  Add 1h Alert
                </Button>
                <Button variant="danger" size="sm" iconLeft={Trash} onClick={handleCancelSend}>
                  Cancel Send
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--st-border)]">
              <h4 className="text-sm font-semibold mb-3">Audit Log</h4>
              <div className="space-y-3">
                {auditLogs.map(log => (
                  <div key={log.id} className="text-sm flex gap-3">
                    <span className="text-[var(--st-text-secondary)] w-16 flex-shrink-0">{format(new Date(log.at), "HH:mm")}</span>
                    <div>
                      <span className="font-medium">{log.action}</span>
                      {log.meta && <span className="text-[var(--st-text-secondary)] ml-2">{JSON.stringify(log.meta)}</span>}
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && <span className="text-[var(--st-text-secondary)] text-sm">No recent activity.</span>}
              </div>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* Shift Dialog */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Reschedule</DialogTitle>
            <DialogDescription>Shift all currently visible sends forward or backward.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Field label="Shift by (minutes)">
              <Input type="number" value={shiftMins} onChange={e => setShiftMins(parseInt(e.target.value))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={doBulkShift}>Apply Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* iCal Subscribe Dialog */}
      <Dialog open={icalDialogOpen} onOpenChange={setIcalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscribe to Calendar</DialogTitle>
            <DialogDescription>Add this URL to Google Calendar, Outlook, or Apple Calendar.</DialogDescription>
          </DialogHeader>
          <div className="py-4 flex gap-2">
            <Field label="Subscription URL" className="flex-1">
              <Input readOnly value={icalUrl} />
            </Field>
            <Button variant="secondary" className="self-end" onClick={() => navigator.clipboard.writeText(icalUrl)}>Copy</Button>
          </div>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
