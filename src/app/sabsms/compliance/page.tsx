"use client";

import React from "react";
import Link from "next/link";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { Card, CardHeader, CardTitle, CardDescription, CardBody, Button, Badge, Progress, Switch, Label, Avatar, AvatarImage, AvatarFallback, Table, THead, TBody, Tr, Th, Td, StatCard } from '@/components/sabcrm/20ui';
import {
  Download,
  Shield,
  AlertTriangle,
  Map,
  Link as LinkIcon,
} from "lucide-react";

export default function ComplianceDashboardPage() {
  const secondaryActions = [
    {
      label: "Export Audit (PDF)",
      icon: <Download className="h-4 w-4" />,
      onSelectAction: () => console.log("Exporting PDF"),
    },
    {
      label: "Export Audit (CSV)",
      icon: <Download className="h-4 w-4" />,
      onSelectAction: () => console.log("Exporting CSV"),
    },
  ];

  return (
    <SabsmsPageShell
      title="Compliance Dashboard"
      eyebrow="Workspace Governance"
      description="Manage global regulations, consent status, and audit logs."
      secondaryActions={secondaryActions}
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="EU Consent Coverage"
          value="89%"
          description="+2% from last month"
        />
        <StatCard
          title="CASL Consent Coverage"
          value="92%"
          description="Stable"
        />
        <StatCard
          title="TRAI Adherence"
          value="99.9%"
          description="Within SLA"
        />
        <StatCard
          title="Suppression Coverage"
          value="98.5%"
          description="+0.5% from last month"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Regional Registry Status</CardTitle>
            <CardDescription>10DLC and DLT registrations</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-md bg-white">
              <div>
                <p className="font-medium text-[var(--st-text)]">US 10DLC</p>
                <p className="text-sm text-[var(--st-text)]">
                  Brand: Approved, 2 Active Campaigns
                </p>
              </div>
              <Badge variant="default" className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white border-0">
                Compliant
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-md bg-white">
              <div>
                <p className="font-medium text-[var(--st-text)]">India DLT</p>
                <p className="text-sm text-[var(--st-text)]">
                  PEID: Active, 4 Headers, 12 Templates
                </p>
              </div>
              <Badge variant="default" className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white border-0">
                Compliant
              </Badge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Risk</CardTitle>
            <CardDescription>Violations & Backlogs</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-md bg-[var(--st-bg-muted)]/50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-[var(--st-text)]" />
                <p className="font-medium text-[var(--st-text)]">TCPA Category Mismatches</p>
              </div>
              <span className="text-lg font-bold text-[var(--st-text)]">3</span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-md bg-[var(--st-bg-muted)]">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-[var(--st-text)]" />
                <p className="font-medium text-[var(--st-text)]">SAR / Erasure Backlog</p>
              </div>
              <span className="text-lg font-bold text-[var(--st-text)]">5 Pending</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Keyword & Policy</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <div>
              <p className="text-sm font-medium text-[var(--st-text)] mb-1.5">
                STOP / HELP Config
              </p>
              <div className="bg-[var(--st-bg-muted)] p-3 text-xs rounded-md border font-mono text-[var(--st-text)]">
                STOP: "You have been unsubscribed."
                <br />
                HELP: "Reply with your issue..."
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--st-text)] mb-1.5">
                Footer Policy Preview
              </p>
              <div className="bg-[var(--st-bg-muted)] p-3 text-xs rounded-md border text-[var(--st-text)] italic">
                "Reply STOP to opt out. Msg&Data rates may apply."
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <Label htmlFor="auto-reply" className="text-sm font-medium text-[var(--st-text)]">Auto-reply STOP config</Label>
              <Switch id="auto-reply" defaultChecked />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consent Freshness</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-[var(--st-text)]">&lt; 3 Months</span>
                  <span className="text-[var(--st-text)] font-medium">65%</span>
                </div>
                <Progress value={65} className="h-2 bg-[var(--st-bg-muted)]" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-[var(--st-text)]">3 - 6 Months</span>
                  <span className="text-[var(--st-text)] font-medium">20%</span>
                </div>
                <Progress value={20} className="h-2 bg-[var(--st-bg-muted)]" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-[var(--st-text)]">&gt; 6 Months</span>
                  <span className="text-[var(--st-text)] font-medium">15%</span>
                </div>
                <Progress value={15} className="h-2 bg-[var(--st-bg-muted)]" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Governance</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="flex items-center gap-3 border p-3 rounded-md bg-white">
              <Avatar>
                <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
                <AvatarFallback>AL</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">Compliance Officer</p>
                <p className="text-xs text-[var(--st-text)]">Alice Liddell</p>
              </div>
            </div>
            <div className="pt-1">
              <p className="text-sm font-medium text-[var(--st-text)] mb-2">
                Webhook Publisher
              </p>
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] w-full justify-start truncate py-1.5 px-2 bg-[var(--st-bg-muted)]"
                >
                  https://api.acme.corp/webhooks/compliance
                </Badge>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Rejected Templates</CardTitle>
            <CardDescription>Flagged by carrier filters</CardDescription>
          </CardHeader>
          <CardBody>
            <Table>
              <THead>
                <Tr>
                  <Th>Template</Th>
                  <Th>Reason</Th>
                </Tr>
              </THead>
              <TBody>
                <Tr>
                  <Td className="font-medium text-sm">Crypto Promo A</Td>
                  <Td className="text-sm text-[var(--st-text)]">SHAFT Violation</Td>
                </Tr>
                <Tr>
                  <Td className="font-medium text-sm">Loan Offer Update</Td>
                  <Td className="text-sm text-[var(--st-text)]">High Risk Category</Td>
                </Tr>
              </TBody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Unsubscribes (24h)</CardTitle>
            <CardDescription>Timeline of STOP events</CardDescription>
          </CardHeader>
          <CardBody>
            <div className="space-y-4 mt-2">
              <div className="flex gap-4">
                <div className="w-16 text-xs text-[var(--st-text)] text-right pt-1">
                  10:42 AM
                </div>
                <div className="flex-1 border-l-2 border-[var(--st-border)] pl-5 pb-4 relative">
                  <div className="absolute w-2.5 h-2.5 bg-[var(--st-text)] rounded-full -left-[6px] top-1.5 shadow-sm" />
                  <p className="text-sm font-medium text-[var(--st-text)]">+1 (555) 019-2834</p>
                  <p className="text-xs text-[var(--st-text)] mt-0.5">Campaign: Summer Sale</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-16 text-xs text-[var(--st-text)] text-right pt-1">
                  09:15 AM
                </div>
                <div className="flex-1 border-l-2 border-[var(--st-border)] pl-5 pb-2 relative">
                  <div className="absolute w-2.5 h-2.5 bg-[var(--st-text)] rounded-full -left-[6px] top-1.5 shadow-sm" />
                  <p className="text-sm font-medium text-[var(--st-text)]">+44 7700 900077</p>
                  <p className="text-xs text-[var(--st-text)] mt-0.5">Keyword: STOP</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Per-Country Quiet Hours</CardTitle>
            <CardDescription>Active time restrictions</CardDescription>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-4 bg-[var(--st-bg-muted)] p-4 rounded-md border border-[var(--st-border)]">
              <div className="bg-white p-2 rounded-full shadow-sm border border-[var(--st-border)]">
                <Map className="h-5 w-5 text-[var(--st-text)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">India (TRAI)</p>
                <p className="text-xs text-[var(--st-text)] mt-0.5">
                  21:00 - 09:00 IST blocked for Promotional traffic
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attestations & Resources</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="flex justify-between items-center text-sm border-b border-[var(--st-border)] pb-3">
              <span className="font-medium text-[var(--st-text)]">Required Attestation Matrix</span>
              <Button variant="ghost" size="sm" className="h-8">
                View Matrix
              </Button>
            </div>
            <div className="flex justify-between items-center text-sm pt-1">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-[var(--st-text-secondary)]" />
                <span className="font-medium text-[var(--st-text)]">Compliance Roadmap</span>
              </div>
              <Link
                href="/sabsms/roadmap#phase8"
                className="text-[var(--st-text)] hover:text-[var(--st-text)] hover:underline font-medium text-xs"
              >
                View Phase 8 Plan
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
