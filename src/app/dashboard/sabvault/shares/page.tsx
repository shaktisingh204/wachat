"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  IconButton,
  Badge,
  StatCard,
  EmptyState,
  Progress,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/sabcrm/20ui";
import { Plus, Share2, Eye, Clock, Ban, ShieldCheck, TimerReset, BarChart3 } from "lucide-react";
import type { BadgeTone } from "@/components/sabcrm/20ui";

/** StatCard accent chips need hex values, never token vars. */
const ACCENT = {
  brand: "#3b7af5",
  success: "#1f9d55",
  warn: "#d68a1e",
  violet: "#7c3aed",
} as const;

type ShareStatus = "Active" | "Expiring Soon" | "Expired";

interface Share {
  id: string;
  secretName: string;
  sharedWith: string;
  expiresAt: string;
  views: number;
  maxViews: number;
  status: ShareStatus;
}

const STATUS_TONE: Record<ShareStatus, BadgeTone> = {
  Active: "success",
  "Expiring Soon": "warning",
  Expired: "neutral",
};

export default function SabVaultSharesPage() {
  const shares: Share[] = [
    { id: "1", secretName: "Staging API Key", sharedWith: "priya.nair@acme.io", expiresAt: "2026-06-10", views: 2, maxViews: 5, status: "Active" },
    { id: "2", secretName: "Vendor Portal Login", sharedWith: "vendor-team@northwind.com", expiresAt: "2026-06-04", views: 1, maxViews: 1, status: "Expiring Soon" },
    { id: "3", secretName: "AWS Root Credentials", sharedWith: "marcus.lee@acme.io", expiresAt: "2026-06-01", views: 3, maxViews: 3, status: "Expired" },
  ];

  const activeCount = shares.filter((s) => s.status === "Active").length;
  const expiringCount = shares.filter((s) => s.status === "Expiring Soon").length;
  const totalViews = shares.reduce((sum, s) => sum + s.views, 0);

  return (
    <TooltipProvider>
      <main className="20ui mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>SabVault</PageEyebrow>
            <PageTitle>Shared secrets</PageTitle>
            <PageDescription>
              Track secrets shared with teammates and external contacts. Every link enforces an access window and a view cap.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="primary" iconLeft={Plus}>
              New share
            </Button>
          </PageActions>
        </PageHeader>

        <section
          aria-label="Sharing summary"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard label="Total shares" value={shares.length} icon={Share2} accent={ACCENT.brand} />
          <StatCard
            label="Active"
            value={activeCount}
            icon={ShieldCheck}
            accent={ACCENT.success}
          />
          <StatCard
            label="Expiring soon"
            value={expiringCount}
            icon={TimerReset}
            accent={ACCENT.warn}
            delta={expiringCount > 0 ? { value: "Review windows", tone: "down" } : undefined}
          />
          <StatCard label="Total views" value={totalViews} icon={BarChart3} accent={ACCENT.violet} />
        </section>

        <Card padding="none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
              Active shares
            </CardTitle>
            <CardDescription>
              Revoke any share to cut off access immediately.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {shares.length === 0 ? (
              <EmptyState
                icon={Share2}
                title="No shared secrets yet"
                description="When you share a secret with a teammate or external contact, it will appear here with its access window and view count."
                action={
                  <Button variant="primary" iconLeft={Plus}>
                    New share
                  </Button>
                }
              />
            ) : (
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Secret name</Th>
                    <Th>Shared with</Th>
                    <Th>Expires</Th>
                    <Th align="right">Views</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {shares.map((share) => (
                    <Tr key={share.id}>
                      <Td>
                        <span className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                          <Share2 className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                          {share.secretName}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[var(--st-text-secondary)]">{share.sharedWith}</span>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-1.5 text-[var(--st-text-secondary)]">
                          <Clock className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                          {share.expiresAt}
                        </span>
                      </Td>
                      <Td align="right">
                        <div className="ml-auto flex w-32 items-center gap-2">
                          <Progress
                            value={Math.round((share.views / Math.max(1, share.maxViews)) * 100)}
                            tone={share.views >= share.maxViews ? "danger" : "accent"}
                            size="sm"
                          />
                          <span className="w-10 text-right text-xs tabular-nums text-[var(--st-text-secondary)]">
                            {share.views}/{share.maxViews}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONE[share.status]} dot>
                          {share.status}
                        </Badge>
                      </Td>
                      <Td align="right">
                        <span className="inline-flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <IconButton label={`View access log for ${share.secretName}`} icon={Eye} />
                            </TooltipTrigger>
                            <TooltipContent>View access log</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <IconButton
                                label={`Revoke access to ${share.secretName}`}
                                icon={Ban}
                                variant="danger"
                              />
                            </TooltipTrigger>
                            <TooltipContent>Revoke access</TooltipContent>
                          </Tooltip>
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </main>
    </TooltipProvider>
  );
}
