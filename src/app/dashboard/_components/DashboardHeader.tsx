"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Download,
  ChevronDown,
  Filter,
  Send,
  Briefcase,
  Workflow,
  Bell,
  AlarmClock
} from "lucide-react";
import {
  Breadcrumb,
  ZoruBreadcrumbList,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbSeparator,
  ZoruBreadcrumbPage,
  Button,
  DropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
} from "@/components/zoruui";
import { greeting } from "./utils";

type DashboardHeaderProps = {
  userName: string;
  totalProjects: number;
  planName: string;
  onRefresh: () => void;
  onExport: () => void;
};

export function DashboardHeader({ userName, totalProjects, planName, onRefresh, onExport }: DashboardHeaderProps) {
  const router = useRouter();

  return (
    <>
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">Account</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Overview</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            {greeting()}, {userName}
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            {totalProjects} project{totalProjects !== 1 ? "s" : ""}{" "}
            · {format(new Date(), "EEEE, MMM d · HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/billing")}
          >
            {planName || "Free plan"}
            <ChevronDown className="opacity-60 h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4" /> Filter
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end" className="w-56">
              <ZoruDropdownMenuLabel>Filter by</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuItem onSelect={() => router.push("/wachat/analytics")}>
                <Send className="h-4 w-4" /> Messages &amp; delivery
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onSelect={() => router.push("/dashboard/crm/sales-crm/leads")}>
                <Briefcase className="h-4 w-4" /> CRM pipeline
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onSelect={() => router.push("/dashboard/sabflow/flow-builder")}>
                <Workflow className="h-4 w-4" /> Active flows
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onSelect={() => router.push("/dashboard/notifications")}>
                <Bell className="h-4 w-4" /> Unread notifications
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem onSelect={onRefresh}>
                <AlarmClock className="h-4 w-4" /> Refresh data
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
