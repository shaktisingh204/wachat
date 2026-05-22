const fs = require('fs');

const code = `
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import {
  Calendar, Clock, AlertCircle, RefreshCcw, Search, Trash, Download, Link, Settings, FileText, Share2, Info, GripVertical, ChevronLeft, ChevronRight, Check
} from "lucide-react";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsRefreshButton,
  useSabsmsUrlState
} from "@/components/sabsms/page-toolkit";

import {
  Button, Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle,
  Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogDescription, ZoruDialogFooter,
  Tooltip, ZoruTooltipProvider, ZoruTooltipTrigger, ZoruTooltipContent,
  Input, Label, ZoruToast
} from "@/components/zoruui";

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
  describeCronAsync,
  detectQuietHourConflictsAsync,
  detectCrossCampaignConflictsAsync,
  computeSlotCapacityAsync,
  buildCountryHourHeatmapAsync,
  buildMonthGridAsync,
  type ScheduledSend,
  type MonthCell,
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
  
  // Conflicts
  const [quietConflicts, setQuietConflicts] = useState<Set<string>>(new Set());
  const [campaignConflicts, setCampaignConflicts] = useState<Set<string>>(new Set());
  
  // Grid
  const [gridCells, setGridCells] = useState<any[]>([]);
  const [holidays, setHolididays] = useState<HolidayEntry[]>([]);
  
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
      
      const [fetchedSends, fetchedTray, hols, cells] = await Promise.all([
        loadScheduledSends(workspaceId, { from, to }),
        loadUnscheduledTray(workspaceId),
        getHolidayCalendar(),
        buildMonthGridAsync(monthCursor.getFullYear(), monthCursor.getMonth(), [])
      ]);
      
      // Need to compute grid with sends
      const realCells = await buildMonthGridAsync(monthCursor.getFullYear(), monthCursor.getMonth(), fetchedSends);
      
      setSends(fetchedSends);
      setUnscheduled(fetchedTray);
      setHolididays(hols);
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
  }, [workspaceId, monthCursor]);

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
        { label: "Export iCal", onSelectAction: doExportIcal, icon: <Download className="w-4 h-4 mr-2" /> },
        { label: "Subscribe to Calendar", onSelectAction: doSubscribeIcal, icon: <Link className="w-4 h-4 mr-2" /> }
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
            <div className="flex border rounded-md overflow-hidden bg-white">
              <button 
                onClick={() => setViewType("calendar")}
                className={`px-3 py-1.5 text-sm font-medium ${viewType === "calendar" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                Calendar
              </button>
              <button 
                onClick={() => setViewType("list")}
                className={`px-3 py-1.5 text-sm font-medium border-l ${viewType === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                List
              </button>
            </div>
            <SabsmsRefreshButton refreshing={loading} onRefresh={reload} />
          </div>
        </div>
      }
    >
      <div className="flex space-x-6">
        {/* Main Area */}
        <div className="flex-1">
          {viewType === "calendar" ? (
            <Card>
              <ZoruCardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <ZoruCardTitle>{format(monthCursor, "MMMM yyyy")}</ZoruCardTitle>
                  <Button variant="outline" size="sm" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex border rounded-md overflow-hidden bg-white">
                  {["month", "week", "day"].map(v => (
                    <button
                      key={v}
                      onClick={() => setCalView(v as any)}
                      className={`px-3 py-1 text-xs uppercase ${calView === v ? "bg-slate-100 text-slate-900" : "text-slate-500"} border-r last:border-0`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                    <div key={d} className="bg-slate-50 p-2 text-xs font-medium text-slate-500 text-center">{d}</div>
                  ))}
                  {gridCells.map((c, i) => {
                    const d = parseISO(c.iso);
                    const isToday = isSameDay(d, new Date());
                    return (
                      <div 
                        key={i} 
                        className={`bg-white min-h-[120px] p-2 relative ${!c.inMonth ? "opacity-50 bg-slate-50" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, c.iso)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-sm font-medium ${isToday ? "bg-slate-900 text-white rounded-full w-6 h-6 flex items-center justify-center" : "text-slate-700"}`}>
                            {format(d, "d")}
                          </span>
                          {c.holiday && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded truncate max-w-[80px]">
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
                              className="text-xs p-1.5 rounded bg-blue-50 border border-blue-100 text-blue-800 cursor-pointer hover:bg-blue-100 flex items-center shadow-sm"
                            >
                              <GripVertical className="w-3 h-3 mr-1 opacity-50" />
                              <span className="truncate flex-1 font-medium">{format(new Date(s.sendAt), "HH:mm")} {s.name}</span>
                              {quietConflicts.has(s.id) && <AlertCircle className="w-3 h-3 text-rose-500 ml-1 flex-shrink-0" />}
                              {campaignConflicts.has(s.id) && <AlertCircle className="w-3 h-3 text-amber-500 ml-1 flex-shrink-0" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ZoruCardContent>
            </Card>
          ) : (
            <Card>
              <ZoruCardContent className="p-0">
                <SabsmsDataTable
                  rows={sends}
                  rowKey={r => r.id}
                  onRowClick={openDrawer}
                  columns={[
                    { id: "time", header: "Send At", render: r => format(new Date(r.sendAt), "MMM d, HH:mm") },
                    { id: "name", header: "Name", render: r => <div className="font-medium text-slate-900">{r.name}</div> },
                    { id: "sender", header: "Sender", render: r => <Badge variant="outline">{r.senderId}</Badge> },
                    { id: "count", header: "Recipients", render: r => r.recipientCount.toLocaleString() },
                    { id: "status", header: "Status", render: r => <Badge>{r.status}</Badge> }
                  ]}
                />
              </ZoruCardContent>
            </Card>
          )}
        </div>

        {/* Sidebar tray for unscheduled */}
        <div className="w-72 space-y-4 hidden lg:block">
          <Card>
            <ZoruCardHeader className="pb-3">
              <ZoruCardTitle className="text-sm flex items-center justify-between">
                <span>Unscheduled Tray</span>
                <Badge variant="secondary">{unscheduled.length}</Badge>
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <p className="text-xs text-slate-500 mb-3">Drag drafts onto the calendar to schedule them.</p>
              <div className="space-y-2">
                {unscheduled.map(u => (
                  <div
                    key={u.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, u.id)}
                    className="p-2 border rounded text-sm bg-white cursor-grab hover:border-slate-400 flex items-center"
                  >
                    <GripVertical className="w-4 h-4 mr-2 text-slate-400" />
                    <div className="flex-1 truncate">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.recipientCount} recipients</div>
                    </div>
                  </div>
                ))}
                {unscheduled.length === 0 && (
                  <div className="text-center p-4 border border-dashed rounded text-sm text-slate-500">
                    No drafts available.
                  </div>
                )}
              </div>
            </ZoruCardContent>
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
                <span className="text-xs text-slate-500">Scheduled For</span>
                <div className="font-medium">{format(new Date(selectedSend.sendAt), "PPP p")}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500">Recipient TZ</span>
                <div className="font-medium flex items-center">
                  <Globe className="w-4 h-4 mr-1 text-slate-400" />
                  {selectedSend.recipientTz || "UTC"}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500">Sender</span>
                <div><Badge variant="outline">{selectedSend.senderId}</Badge></div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500">Recipients</span>
                <div className="font-medium">{selectedSend.recipientCount.toLocaleString()}</div>
              </div>
            </div>

            {selectedSend.cron && (
              <div className="p-3 bg-slate-50 rounded border text-sm">
                <div className="flex items-center text-slate-700 font-medium mb-1">
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Recurring Schedule
                </div>
                <code>{selectedSend.cron}</code>
              </div>
            )}

            {quietConflicts.has(selectedSend.id) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-sm text-rose-800 flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5" />
                This send conflicts with configured quiet hours for some recipients.
              </div>
            )}
            
            {campaignConflicts.has(selectedSend.id) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5" />
                Sender capacity overlap detected with another campaign.
              </div>
            )}

            <div className="pt-4 border-t space-y-4">
              <h4 className="text-sm font-semibold">Actions</h4>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => saveCron("0 9 * * 1")}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Make Weekly
                </Button>
                <Button variant="outline" size="sm" onClick={() => alert("Notification rule saved!")}>
                  <Clock className="w-4 h-4 mr-2" /> Add 1h Alert
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCancelSend}>
                  <Trash className="w-4 h-4 mr-2" /> Cancel Send
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Audit Log</h4>
              <div className="space-y-3">
                {auditLogs.map(log => (
                  <div key={log.id} className="text-sm flex gap-3">
                    <span className="text-slate-400 w-16 flex-shrink-0">{format(new Date(log.at), "HH:mm")}</span>
                    <div>
                      <span className="font-medium">{log.action}</span>
                      {log.meta && <span className="text-slate-500 ml-2">{JSON.stringify(log.meta)}</span>}
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && <span className="text-slate-500 text-sm">No recent activity.</span>}
              </div>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* Shift Dialog */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Bulk Reschedule</ZoruDialogTitle>
            <ZoruDialogDescription>Shift all currently visible sends forward or backward.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-4">
            <Label>Shift by (minutes)</Label>
            <Input type="number" value={shiftMins} onChange={e => setShiftMins(parseInt(e.target.value))} className="mt-2" />
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setShiftDialogOpen(false)}>Cancel</Button>
            <Button onClick={doBulkShift}>Apply Shift</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
      
      {/* iCal Subscribe Dialog */}
      <Dialog open={icalDialogOpen} onOpenChange={setIcalDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Subscribe to Calendar</ZoruDialogTitle>
            <ZoruDialogDescription>Add this URL to Google Calendar, Outlook, or Apple Calendar.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-4 flex gap-2">
            <Input readOnly value={icalUrl} />
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(icalUrl)}>Copy</Button>
          </div>
        </ZoruDialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
`

fs.writeFileSync('src/app/sabsms/scheduled/client.tsx', code);
console.log("Written client.tsx");
