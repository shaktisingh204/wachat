"use client";

import React from "react";
import Link from "next/link";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Button,
  Badge,
  Progress,
  Switch,
  Label,
  Avatar,
  ZoruAvatarImage,
  ZoruAvatarFallback,
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
  ZoruStatCard,
} from "@/components/zoruui";
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
        <ZoruStatCard
          title="EU Consent Coverage"
          value="89%"
          description="+2% from last month"
        />
        <ZoruStatCard
          title="CASL Consent Coverage"
          value="92%"
          description="Stable"
        />
        <ZoruStatCard
          title="TRAI Adherence"
          value="99.9%"
          description="Within SLA"
        />
        <ZoruStatCard
          title="Suppression Coverage"
          value="98.5%"
          description="+0.5% from last month"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Regional Registry Status</ZoruCardTitle>
            <ZoruCardDescription>10DLC and DLT registrations</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-md bg-white">
              <div>
                <p className="font-medium text-slate-900">US 10DLC</p>
                <p className="text-sm text-slate-500">
                  Brand: Approved, 2 Active Campaigns
                </p>
              </div>
              <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
                Compliant
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-md bg-white">
              <div>
                <p className="font-medium text-slate-900">India DLT</p>
                <p className="text-sm text-slate-500">
                  PEID: Active, 4 Headers, 12 Templates
                </p>
              </div>
              <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
                Compliant
              </Badge>
            </div>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Operational Risk</ZoruCardTitle>
            <ZoruCardDescription>Violations & Backlogs</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-md bg-amber-50/50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <p className="font-medium text-slate-900">TCPA Category Mismatches</p>
              </div>
              <span className="text-lg font-bold text-amber-600">3</span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-md bg-slate-50">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-indigo-500" />
                <p className="font-medium text-slate-900">SAR / Erasure Backlog</p>
              </div>
              <span className="text-lg font-bold text-slate-700">5 Pending</span>
            </div>
          </ZoruCardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Keyword & Policy</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-5">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1.5">
                STOP / HELP Config
              </p>
              <div className="bg-slate-50 p-3 text-xs rounded-md border font-mono text-slate-600">
                STOP: "You have been unsubscribed."
                <br />
                HELP: "Reply with your issue..."
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1.5">
                Footer Policy Preview
              </p>
              <div className="bg-slate-50 p-3 text-xs rounded-md border text-slate-500 italic">
                "Reply STOP to opt out. Msg&Data rates may apply."
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <Label htmlFor="auto-reply" className="text-sm font-medium text-slate-700">Auto-reply STOP config</Label>
              <Switch id="auto-reply" defaultChecked />
            </div>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Consent Freshness</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-700">&lt; 3 Months</span>
                  <span className="text-slate-500 font-medium">65%</span>
                </div>
                <Progress value={65} className="h-2 bg-slate-100" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-700">3 - 6 Months</span>
                  <span className="text-slate-500 font-medium">20%</span>
                </div>
                <Progress value={20} className="h-2 bg-slate-100" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-700">&gt; 6 Months</span>
                  <span className="text-slate-500 font-medium">15%</span>
                </div>
                <Progress value={15} className="h-2 bg-slate-100" />
              </div>
            </div>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Governance</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-5">
            <div className="flex items-center gap-3 border p-3 rounded-md bg-white">
              <Avatar>
                <ZoruAvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
                <ZoruAvatarFallback>AL</ZoruAvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-slate-900">Compliance Officer</p>
                <p className="text-xs text-slate-500">Alice Liddell</p>
              </div>
            </div>
            <div className="pt-1">
              <p className="text-sm font-medium text-slate-700 mb-2">
                Webhook Publisher
              </p>
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] w-full justify-start truncate py-1.5 px-2 bg-slate-50"
                >
                  https://api.acme.corp/webhooks/compliance
                </Badge>
              </div>
            </div>
          </ZoruCardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Recent Rejected Templates</ZoruCardTitle>
            <ZoruCardDescription>Flagged by carrier filters</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Template</ZoruTableHead>
                  <ZoruTableHead>Reason</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell className="font-medium text-sm">Crypto Promo A</ZoruTableCell>
                  <ZoruTableCell className="text-sm text-red-500">SHAFT Violation</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-medium text-sm">Loan Offer Update</ZoruTableCell>
                  <ZoruTableCell className="text-sm text-red-500">High Risk Category</ZoruTableCell>
                </ZoruTableRow>
              </ZoruTableBody>
            </Table>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Recent Unsubscribes (24h)</ZoruCardTitle>
            <ZoruCardDescription>Timeline of STOP events</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="space-y-4 mt-2">
              <div className="flex gap-4">
                <div className="w-16 text-xs text-slate-500 text-right pt-1">
                  10:42 AM
                </div>
                <div className="flex-1 border-l-2 border-slate-100 pl-5 pb-4 relative">
                  <div className="absolute w-2.5 h-2.5 bg-red-500 rounded-full -left-[6px] top-1.5 shadow-sm" />
                  <p className="text-sm font-medium text-slate-900">+1 (555) 019-2834</p>
                  <p className="text-xs text-slate-500 mt-0.5">Campaign: Summer Sale</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-16 text-xs text-slate-500 text-right pt-1">
                  09:15 AM
                </div>
                <div className="flex-1 border-l-2 border-slate-100 pl-5 pb-2 relative">
                  <div className="absolute w-2.5 h-2.5 bg-red-500 rounded-full -left-[6px] top-1.5 shadow-sm" />
                  <p className="text-sm font-medium text-slate-900">+44 7700 900077</p>
                  <p className="text-xs text-slate-500 mt-0.5">Keyword: STOP</p>
                </div>
              </div>
            </div>
          </ZoruCardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Per-Country Quiet Hours</ZoruCardTitle>
            <ZoruCardDescription>Active time restrictions</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
              <div className="bg-white p-2 rounded-full shadow-sm border border-slate-100">
                <Map className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">India (TRAI)</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  21:00 - 09:00 IST blocked for Promotional traffic
                </p>
              </div>
            </div>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Attestations & Resources</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-5">
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-3">
              <span className="font-medium text-slate-700">Required Attestation Matrix</span>
              <Button variant="ghost" size="sm" className="h-8">
                View Matrix
              </Button>
            </div>
            <div className="flex justify-between items-center text-sm pt-1">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-700">Compliance Roadmap</span>
              </div>
              <Link
                href="/sabsms/roadmap#phase8"
                className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium text-xs"
              >
                View Phase 8 Plan
              </Link>
            </div>
          </ZoruCardContent>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
