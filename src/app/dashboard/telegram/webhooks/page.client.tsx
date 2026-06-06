"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  EmptyState,
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  ScrollArea,
  StatCard,
  useToast,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  SegmentedControl,
  Switch,
} from "@/components/sabcrm/20ui";
import {
  AlertCircle,
  Inbox,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Webhook,
  XCircle,
} from "lucide-react";

import * as React from "react";

import { useProject } from "@/context/project-context";
import {
  deleteTelegramWebhookDlqAction,
  deleteTelegramWebhookSubscriptionAction,
  getTelegramWebhookAnalyticsAction,
  getTelegramWebhookDeliveryAction,
  listTelegramWebhookDeliveriesAction,
  listTelegramWebhookDlqAction,
  listTelegramWebhookSubscriptionsAction,
  putTelegramWebhookSubscriptionAction,
  replayTelegramWebhookDeliveryAction,
  resolveTelegramWebhookDlqAction,
  retryTelegramWebhookDlqAction,
  rotateTelegramWebhookSecretAction,
  testTelegramWebhookSubscriptionAction,
} from "@/app/actions/telegram-webhooks.actions";
import type {
  AnalyticsResp,
  ListDeliveriesResp,
  ListDlqResp,
  ListSubscriptionsResp,
  WebhookDeliveryRow,
  WebhookDlqRow,
  WebhookSubscriptionRow,
} from "@/lib/rust-client/telegram-webhooks";
import { TELEGRAM_ALLOWED_UPDATES } from "@/lib/rust-client/telegram-webhooks-shared";

import { AnalyticsSection } from "./_components/analytics-section";
import { DeliveriesSection } from "./_components/deliveries-section";
import { DlqSection } from "./_components/dlq-section";
import { SubscriptionsSection } from "./_components/subscriptions-section";
import { SubscriptionDrawer } from "./_components/subscription-drawer";
import { ACCENT, fmtDate, fmtNumber } from "./_components/utils";

const SECTIONS = ["subscriptions", "deliveries", "dlq", "analytics"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_ITEMS = SECTIONS.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));

export default function TelegramWebhooksPage() {
  const { activeProjectId } = useProject();
  const { toast } = useToast();
  const [section, setSection] = React.useState<Section>("subscriptions");
  const [autoRefresh, setAutoRefresh] = React.useState(false);

  // ---------- Subscriptions state ----------
  const [subs, setSubs] = React.useState<WebhookSubscriptionRow[]>([]);
  const [subsLoading, setSubsLoading] = React.useState(false);
  const [subsError, setSubsError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<WebhookSubscriptionRow | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] =
    React.useState<WebhookSubscriptionRow | null>(null);
  const [confirmRotateAll, setConfirmRotateAll] = React.useState(false);

  // ---------- Deliveries state ----------
  const [deliveries, setDeliveries] = React.useState<WebhookDeliveryRow[]>([]);
  const [delivLoading, setDelivLoading] = React.useState(false);
  const [delivCursor, setDelivCursor] = React.useState<string | null>(null);
  const [delivHasMore, setDelivHasMore] = React.useState(false);
  const [delivBot, setDelivBot] = React.useState<string>("all");
  const [delivEvent, setDelivEvent] = React.useState<string>("all");
  const [delivStatus, setDelivStatus] = React.useState<string>("all");
  const [delivSearch, setDelivSearch] = React.useState("");
  const [delivRange, setDelivRange] = React.useState<{
    from?: Date;
    to?: Date;
  }>({});
  const [drawerDelivery, setDrawerDelivery] =
    React.useState<WebhookDeliveryRow | null>(null);

  // ---------- DLQ state ----------
  const [dlq, setDlq] = React.useState<WebhookDlqRow[]>([]);
  const [dlqLoading, setDlqLoading] = React.useState(false);
  const [dlqStatus, setDlqStatus] = React.useState<string>("all");
  const [dlqBot, setDlqBot] = React.useState<string>("all");
  const [confirmDlqDelete, setConfirmDlqDelete] =
    React.useState<WebhookDlqRow | null>(null);

  // ---------- Analytics state ----------
  const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = React.useState(false);

  const botOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of subs) {
      seen.set(s.botId, s.botUsername ?? s.botId);
    }
    return [
      { value: "all", label: "All bots" },
      ...Array.from(seen).map(([v, l]) => ({ value: v, label: l })),
    ];
  }, [subs]);

  // -- Loaders --------------------------------------------------------

  const loadSubs = React.useCallback(
    async (silent = false) => {
      if (!activeProjectId) return;
      if (!silent) setSubsLoading(true);
      try {
        const res: ListSubscriptionsResp =
          await listTelegramWebhookSubscriptionsAction(activeProjectId);
        setSubs(res.subscriptions ?? []);
        setSubsError(res.error ?? null);
        if (res.error && !silent)
          toast({
            title: "Error loading subscriptions",
            description: res.error,
            variant: "destructive",
          });
      } finally {
        if (!silent) setSubsLoading(false);
      }
    },
    [activeProjectId, toast],
  );

  const loadDeliveries = React.useCallback(
    async (append: boolean, silent = false) => {
      if (!activeProjectId) return;
      if (!silent) setDelivLoading(true);
      try {
        const res: ListDeliveriesResp =
          await listTelegramWebhookDeliveriesAction({
            projectId: activeProjectId,
            botId: delivBot !== "all" ? delivBot : undefined,
            eventType: delivEvent !== "all" ? delivEvent : undefined,
            status:
              delivStatus !== "all"
                ? (delivStatus as "received" | "processed" | "failed")
                : undefined,
            search: delivSearch || undefined,
            from: delivRange.from?.toISOString(),
            to: delivRange.to?.toISOString(),
            cursor: append ? (delivCursor ?? undefined) : undefined,
            limit: 50,
          });
        if (res.error && !silent) {
          toast({
            title: "Error loading deliveries",
            description: res.error,
            variant: "destructive",
          });
        }
        setDeliveries((prev) =>
          append
            ? [...prev, ...(res.deliveries ?? [])]
            : (res.deliveries ?? []),
        );
        setDelivCursor(res.nextCursor);
        setDelivHasMore(Boolean(res.nextCursor));
      } finally {
        if (!silent) setDelivLoading(false);
      }
    },
    [
      activeProjectId,
      delivBot,
      delivEvent,
      delivStatus,
      delivSearch,
      delivRange,
      delivCursor,
      toast,
    ],
  );

  const loadDlq = React.useCallback(
    async (silent = false) => {
      if (!activeProjectId) return;
      if (!silent) setDlqLoading(true);
      try {
        const res: ListDlqResp = await listTelegramWebhookDlqAction({
          projectId: activeProjectId,
          botId: dlqBot !== "all" ? dlqBot : undefined,
          status:
            dlqStatus !== "all"
              ? (dlqStatus as
                  | "pending"
                  | "retrying"
                  | "failed_permanent"
                  | "resolved")
              : undefined,
          limit: 100,
        });
        if (res.error && !silent) {
          toast({
            title: "Error loading DLQ",
            description: res.error,
            variant: "destructive",
          });
        }
        setDlq(res.items ?? []);
      } finally {
        if (!silent) setDlqLoading(false);
      }
    },
    [activeProjectId, dlqBot, dlqStatus, toast],
  );

  const loadAnalytics = React.useCallback(
    async (silent = false) => {
      if (!activeProjectId) return;
      if (!silent) setAnalyticsLoading(true);
      try {
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 7);
        const res = await getTelegramWebhookAnalyticsAction({
          projectId: activeProjectId,
          from: from.toISOString(),
          to: now.toISOString(),
        });
        if (res.error && !silent) {
          toast({
            title: "Error loading analytics",
            description: res.error,
            variant: "destructive",
          });
        }
        setAnalytics(res);
      } finally {
        if (!silent) setAnalyticsLoading(false);
      }
    },
    [activeProjectId, toast],
  );

  React.useEffect(() => {
    if (!activeProjectId) return;
    loadSubs();
    loadAnalytics();
  }, [activeProjectId, loadSubs, loadAnalytics]);

  React.useEffect(() => {
    if (section === "deliveries") void loadDeliveries(false);
    if (section === "dlq") void loadDlq();
    if (section === "analytics") void loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // Auto-refresh interval (Real-time updates)
  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (section === "subscriptions") void loadSubs(true);
      if (section === "deliveries") void loadDeliveries(false, true);
      if (section === "dlq") void loadDlq(true);
      if (section === "analytics") void loadAnalytics(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, section, loadSubs, loadDeliveries, loadDlq, loadAnalytics]);

  // -- Subscription actions ------------------------------------------

  async function handleTest(s: WebhookSubscriptionRow) {
    if (!activeProjectId) return;
    const res = await testTelegramWebhookSubscriptionAction(
      s.botId,
      activeProjectId,
    );
    if (res.success) {
      toast({
        title: "Webhook OK",
        description: `Pending updates: ${res.webhookInfo?.pending_update_count ?? 0}`,
      });
      await loadSubs();
    } else {
      toast({
        title: "Webhook test failed",
        description: res.error ?? "unknown",
        variant: "destructive",
      });
    }
  }

  async function handleRotate(s: WebhookSubscriptionRow) {
    if (!activeProjectId) return;
    const res = await rotateTelegramWebhookSecretAction(
      s.botId,
      activeProjectId,
    );
    if (res.success) {
      toast({ title: "Secret rotated" });
      await loadSubs();
    } else {
      toast({
        title: "Rotate failed",
        description: res.error ?? "unknown",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteSub() {
    if (!activeProjectId || !confirmDelete) return;
    const res = await deleteTelegramWebhookSubscriptionAction(
      confirmDelete.botId,
      {
        projectId: activeProjectId,
        dropPendingUpdates: false,
      },
    );
    if (res.success) {
      toast({ title: "Webhook deleted" });
      setConfirmDelete(null);
      await loadSubs();
    } else {
      toast({
        title: "Delete failed",
        description: res.error ?? "unknown",
        variant: "destructive",
      });
    }
  }

  async function handleRotateAll() {
    if (!activeProjectId) return;
    setConfirmRotateAll(false);
    let ok = 0;
    let fail = 0;
    for (const s of subs) {
      const res = await rotateTelegramWebhookSecretAction(
        s.botId,
        activeProjectId,
      );
      if (res.success) ok += 1;
      else fail += 1;
    }
    toast({
      title: "Bulk rotation complete",
      description: `Rotated ${ok}, failed ${fail}.`,
      variant: fail ? "destructive" : "default",
    });
    await loadSubs();
  }

  // -- Deliveries actions --------------------------------------------

  async function handleReplay(d: WebhookDeliveryRow) {
    if (!activeProjectId) return;
    const res = await replayTelegramWebhookDeliveryAction(
      d._id,
      activeProjectId,
    );
    if (res.success) {
      toast({
        title: "Replayed",
        description: `New delivery: ${res.deliveryId ?? ""}`,
      });
      await loadDeliveries(false);
    } else {
      toast({
        title: "Replay failed",
        description: res.error ?? "unknown",
        variant: "destructive",
      });
    }
  }

  async function openDeliveryDrawer(d: WebhookDeliveryRow) {
    if (!activeProjectId) return;
    const res = await getTelegramWebhookDeliveryAction(d._id, activeProjectId);
    if (res.delivery) {
      setDrawerDelivery(res.delivery);
    } else if (res.error) {
      toast({
        title: "Failed to load payload",
        description: res.error,
        variant: "destructive",
      });
    }
  }

  // -- DLQ actions ---------------------------------------------------

  async function handleDlqRetry(d: WebhookDlqRow) {
    if (!activeProjectId) return;
    const res = await retryTelegramWebhookDlqAction(d._id, activeProjectId);
    if (res.success) {
      toast({ title: "Retry queued" });
      await loadDlq();
    } else {
      toast({
        title: "Retry failed",
        description: res.error ?? "unknown",
        variant: "destructive",
      });
    }
  }

  async function handleDlqResolve(d: WebhookDlqRow) {
    if (!activeProjectId) return;
    const res = await resolveTelegramWebhookDlqAction(d._id, activeProjectId);
    if (res.success) {
      toast({ title: "Marked resolved" });
      await loadDlq();
    } else {
      toast({
        title: "Failed",
        description: res.error ?? "unknown",
        variant: "destructive",
      });
    }
  }

  async function handleDlqDelete() {
    if (!activeProjectId || !confirmDlqDelete) return;
    const res = await deleteTelegramWebhookDlqAction(
      confirmDlqDelete._id,
      activeProjectId,
    );
    if (res.success) {
      toast({ title: "DLQ item deleted" });
      setConfirmDlqDelete(null);
      await loadDlq();
    } else {
      toast({
        title: "Failed",
        description: res.error ?? "unknown",
        variant: "destructive",
      });
    }
  }

  if (!activeProjectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Webhook}
          title="Pick a project"
          description="Telegram webhooks are scoped to a project. Choose one to continue."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Telegram</PageEyebrow>
          <PageTitle className="flex items-center gap-2">
            <Webhook
              className="h-6 w-6 text-[var(--st-accent)]"
              aria-hidden="true"
            />
            Telegram Webhooks
          </PageTitle>
          <PageDescription>
            Subscriptions, delivery log, dead-letter queue, and replay for every
            bot in this project.
          </PageDescription>
        </PageHeading>
        <div className="flex flex-wrap items-center gap-4">
          <Switch
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
            id="auto-refresh"
            label="Auto-refresh (5s)"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              iconLeft={RefreshCw}
              onClick={() => {
                loadSubs();
                loadAnalytics();
              }}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              iconLeft={ShieldCheck}
              onClick={() => setConfirmRotateAll(true)}
              disabled={subs.length === 0}
            >
              Rotate all secrets
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Deliveries (7 d)"
          value={
            analyticsLoading ? "..." : fmtNumber(analytics?.totalReceived ?? 0)
          }
          icon={Inbox}
          accent={ACCENT}
        />
        <StatCard
          label="Failed (7 d)"
          value={
            analyticsLoading ? "..." : fmtNumber(analytics?.totalFailed ?? 0)
          }
          icon={XCircle}
        />
        <StatCard
          label="DLQ size"
          value={analyticsLoading ? "..." : fmtNumber(analytics?.dlqCount ?? 0)}
          icon={AlertCircle}
        />
        <StatCard
          label="Avg processing ms"
          value={
            analyticsLoading
              ? "..."
              : Math.round(analytics?.avgProcessingMs ?? 0).toString()
          }
          icon={Settings2}
        />
      </div>

      {/* Segmented control */}
      <SegmentedControl
        items={SECTION_ITEMS}
        value={section}
        onChange={(v) => setSection(v as Section)}
        fullWidth
        aria-label="Webhook section"
      />

      {section === "subscriptions" && (
        <SubscriptionsSection
          loading={subsLoading}
          error={subsError}
          subs={subs}
          onEdit={(s) => setEditing(s)}
          onTest={handleTest}
          onRotate={handleRotate}
          onDelete={(s) => setConfirmDelete(s)}
          onAddNew={() =>
            setEditing({
              _id: "",
              projectId: activeProjectId,
              botId: "",
              url: "",
              allowedUpdates: [...TELEGRAM_ALLOWED_UPDATES.slice(0, 9)],
              maxConnections: 40,
              dropPendingUpdates: false,
              createdAt: "",
              updatedAt: "",
            })
          }
        />
      )}

      {section === "deliveries" && (
        <DeliveriesSection
          loading={delivLoading}
          deliveries={deliveries}
          hasMore={delivHasMore}
          botOptions={botOptions}
          bot={delivBot}
          event={delivEvent}
          status={delivStatus}
          search={delivSearch}
          range={delivRange}
          onBot={(v) => setDelivBot(v)}
          onEvent={(v) => setDelivEvent(v)}
          onStatus={(v) => setDelivStatus(v)}
          onSearch={(v) => setDelivSearch(v)}
          onRange={setDelivRange}
          onApply={() => loadDeliveries(false)}
          onMore={() => loadDeliveries(true)}
          onView={(d) => void openDeliveryDrawer(d)}
          onReplay={handleReplay}
        />
      )}

      {section === "dlq" && (
        <DlqSection
          loading={dlqLoading}
          items={dlq}
          botOptions={botOptions}
          bot={dlqBot}
          status={dlqStatus}
          onBot={(v) => setDlqBot(v)}
          onStatus={(v) => setDlqStatus(v)}
          onApply={() => loadDlq(false)}
          onRetry={handleDlqRetry}
          onResolve={handleDlqResolve}
          onDelete={(d) => setConfirmDlqDelete(d)}
        />
      )}

      {section === "analytics" && (
        <AnalyticsSection loading={analyticsLoading} analytics={analytics} />
      )}

      <SubscriptionDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        projectId={activeProjectId}
        subs={subs}
        editing={editing}
        onSaved={async () => {
          setEditing(null);
          await loadSubs();
          toast({ title: "Webhook saved" });
        }}
        onError={(msg) =>
          toast({
            title: "Save failed",
            description: msg,
            variant: "destructive",
          })
        }
      />

      <Drawer
        open={drawerDelivery !== null}
        onOpenChange={(o) => !o && setDrawerDelivery(null)}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delivery payload</DrawerTitle>
            <DrawerDescription>
              Update ID {drawerDelivery?.updateId ?? "n/a"} ·{" "}
              {drawerDelivery?.eventType ?? "n/a"} ·{" "}
              {fmtDate(drawerDelivery?.receivedAt)}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <ScrollArea className="max-h-[60vh] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
              <pre className="text-xs leading-relaxed text-[var(--st-text)]">
                {drawerDelivery
                  ? JSON.stringify(drawerDelivery.payload ?? {}, null, 2)
                  : ""}
              </pre>
            </ScrollArea>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Telegram webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              The webhook will be deleted on Telegram and the local subscription
              row removed. Delivery log entries are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSub}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRotateAll} onOpenChange={setConfirmRotateAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate every webhook secret?</AlertDialogTitle>
            <AlertDialogDescription>
              This calls Telegram setWebhook with a fresh secret for every bot
              in this project. Deliveries-in-flight may briefly 401.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRotateAll}>
              Rotate all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDlqDelete !== null}
        onOpenChange={(o) => !o && setConfirmDlqDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete DLQ item?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the queued payload. Retry won&apos;t be
              possible afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDlqDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
