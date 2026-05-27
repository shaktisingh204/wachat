"use client";

import * as React from "react";
import { DataTable } from "@/components/zoruui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, XCircle } from "lucide-react";

export type PermissionRow = {
  id: string;
  module: string;
  permission: string;
  admin: boolean;
  marketer: boolean;
  agent: boolean;
  developer: boolean;
};

const rbacData: PermissionRow[] = [
  { id: "1", module: "Campaigns", permission: "Create & Send SMS", admin: true, marketer: true, agent: false, developer: true },
  { id: "2", module: "Campaigns", permission: "View Campaigns", admin: true, marketer: true, agent: true, developer: true },
  { id: "3", module: "Inbox", permission: "Reply to Customers", admin: true, marketer: false, agent: true, developer: true },
  { id: "4", module: "Contacts", permission: "Import CSV", admin: true, marketer: true, agent: false, developer: true },
  { id: "5", module: "Settings", permission: "Manage Team", admin: true, marketer: false, agent: false, developer: false },
  { id: "6", module: "Settings", permission: "Manage API Keys", admin: true, marketer: false, agent: false, developer: true },
  { id: "7", module: "Billing", permission: "View Invoices", admin: true, marketer: false, agent: false, developer: false },
  { id: "8", module: "Automations", permission: "Create Flow", admin: true, marketer: true, agent: false, developer: true },
];

const columns: ColumnDef<PermissionRow>[] = [
  {
    accessorKey: "module",
    header: "Module",
    cell: ({ row }) => <span className="font-semibold text-zoru-ink">{row.original.module}</span>,
  },
  {
    accessorKey: "permission",
    header: "Permission",
    cell: ({ row }) => <span className="text-zoru-ink">{row.original.permission}</span>,
  },
  {
    accessorKey: "admin",
    header: "Admin",
    cell: ({ row }) => row.original.admin ? <CheckCircle2 className="w-5 h-5 text-zoru-ink" /> : <XCircle className="w-5 h-5 text-white" />,
  },
  {
    accessorKey: "marketer",
    header: "Marketer",
    cell: ({ row }) => row.original.marketer ? <CheckCircle2 className="w-5 h-5 text-zoru-ink" /> : <XCircle className="w-5 h-5 text-white" />,
  },
  {
    accessorKey: "agent",
    header: "Agent",
    cell: ({ row }) => row.original.agent ? <CheckCircle2 className="w-5 h-5 text-zoru-ink" /> : <XCircle className="w-5 h-5 text-white" />,
  },
  {
    accessorKey: "developer",
    header: "Developer",
    cell: ({ row }) => row.original.developer ? <CheckCircle2 className="w-5 h-5 text-zoru-ink" /> : <XCircle className="w-5 h-5 text-white" />,
  },
];

export function RbacMatrixClient() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-zoru-ink tracking-tight">Role-Based Access Control</h3>
        <p className="text-sm text-zoru-ink">Overview of permissions assigned to each role.</p>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-zoru-line">
        <DataTable
          columns={columns}
          data={rbacData}
          pageSize={10}
          showColumnMenu={false}
          filterColumn="module"
          filterPlaceholder="Search by module..."
        />
      </div>
    </div>
  );
}
