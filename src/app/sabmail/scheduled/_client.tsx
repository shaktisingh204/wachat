"use client";

import * as React from "react";
import { Clock3, X } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
  type BadgeVariant,
} from "@/components/sabcrm/20ui";

import {
  cancelSabmailScheduled,
  type SabmailScheduledRow,
  type SabmailScheduledStatus,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

const STATUS_VARIANT: Record<SabmailScheduledStatus, BadgeVariant> = {
  pending: "info",
  sent: "success",
  failed: "destructive",
  cancelled: "outline",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SabmailScheduledClient({
  initialScheduled,
}: {
  initialScheduled: SabmailScheduledRow[];
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SabmailScheduledRow[]>(initialScheduled);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  const cancel = React.useCallback(
    async (id: string) => {
      setCancellingId(id);
      const res = await cancelSabmailScheduled(id);
      if (!res.ok) {
        toast({ title: "Could not cancel", description: res.error, variant: "destructive" });
        setCancellingId(null);
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)),
      );
      setCancellingId(null);
      toast({ title: "Scheduled send cancelled" });
    },
    [toast],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Send later</PageTitle>
          <PageDescription>
            Messages queued to go out at a future time. They send automatically
            — cancel any pending send before it leaves.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Scheduled sends</CardTitle>
            <CardDescription>{rows.length} total</CardDescription>
          </CardHeader>
          <CardBody>
            {rows.length === 0 ? (
              <EmptyState
                icon={<Clock3 aria-hidden />}
                title="No scheduled sends"
                description="Use “Send later” from the composer to queue a message for a future time — it will appear here."
              />
            ) : (
              <div className="sabmail-motion overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>To</Th>
                      <Th>Subject</Th>
                      <Th>Send at</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {rows.map((r, idx) => {
                      const recipients = r.to.join(", ") || "—";
                      return (
                        <Tr
                          key={r.id}
                          className="sabmail-stagger-item"
                          style={{ ["--i" as string]: idx } as React.CSSProperties}
                        >
                          <Td>
                            <span
                              className="block max-w-[220px] truncate text-sm text-[var(--st-text)]"
                              title={recipients}
                            >
                              {recipients}
                            </span>
                          </Td>
                          <Td>
                            <span
                              className="block max-w-[260px] truncate text-sm text-[var(--st-text)]"
                              title={r.subject}
                            >
                              {r.subject}
                            </span>
                          </Td>
                          <Td>
                            <span className="whitespace-nowrap text-sm text-[var(--st-text-secondary)]">
                              {formatWhen(r.sendAt)}
                            </span>
                          </Td>
                          <Td>
                            <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                              {r.status}
                            </Badge>
                          </Td>
                          <Td className="text-right">
                            {r.status === "pending" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={X}
                                loading={cancellingId === r.id}
                                disabled={cancellingId === r.id}
                                onClick={() => void cancel(r.id)}
                              >
                                Cancel
                              </Button>
                            ) : (
                              <span className="text-xs text-[var(--st-text-secondary)]">—</span>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
