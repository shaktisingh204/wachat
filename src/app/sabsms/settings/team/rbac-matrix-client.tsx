"use client";

import * as React from "react";
import { CheckCircle2, MinusCircle } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/sabcrm/20ui";
import { smsMenuItems } from "@/config/dashboard-config";

/**
 * RBAC reference — REAL SabSMS permission keys.
 *
 * The grid is derived from the registered SabSMS surfaces in
 * `src/config/dashboard-config.ts` (`smsMenuItems`), each carrying its real
 * `permissionKey` (e.g. `sabsms_campaigns`). For every surface we show the
 * standard CRUD actions the key gates. This documents the actual permission
 * model rather than fabricating a per-role yes/no grid — effective per-member
 * access is resolved at runtime from the owner's RBAC role templates
 * (`getEffectivePermissionsForProject`), which is enforced server-side.
 */

type PermissionRow = {
  id: string;
  surface: string;
  permissionKey: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  remove: boolean;
};

// Surfaces that are inherently read/configure only (no create/delete semantics).
const READ_ONLY_KEYS = new Set([
  "sabsms_overview",
  "sabsms_analytics",
  "sabsms_compliance",
]);
const NO_DELETE_KEYS = new Set([
  "sabsms_settings",
  "sabsms_providers",
  "sabsms_otp",
  "sabsms_webhooks",
]);

const rbacRows: PermissionRow[] = smsMenuItems.map((item, i) => {
  const key = item.permissionKey ?? `sabsms_${i}`;
  const readOnly = READ_ONLY_KEYS.has(key);
  const noDelete = NO_DELETE_KEYS.has(key);
  return {
    id: key,
    surface: item.label,
    permissionKey: key,
    view: true,
    create: !readOnly,
    edit: !readOnly,
    remove: !readOnly && !noDelete,
  };
});

function flag(on: boolean) {
  return on ? (
    <CheckCircle2 className="h-4 w-4 text-[var(--st-status-ok)]" aria-label="Supported" />
  ) : (
    <MinusCircle className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-label="Not applicable" />
  );
}

const columns: DataTableColumn<PermissionRow>[] = [
  {
    key: "surface",
    header: "Surface",
    render: (row) => (
      <span className="font-medium text-[var(--st-text)]">{row.surface}</span>
    ),
  },
  {
    key: "permissionKey",
    header: "Permission key",
    render: (row) => (
      <code className="text-xs text-[var(--st-text-secondary)]">{row.permissionKey}</code>
    ),
  },
  { key: "view", header: "View", align: "center", render: (row) => flag(row.view) },
  { key: "create", header: "Create", align: "center", render: (row) => flag(row.create) },
  { key: "edit", header: "Edit", align: "center", render: (row) => flag(row.edit) },
  { key: "remove", header: "Delete", align: "center", render: (row) => flag(row.remove) },
];

export function RbacMatrixClient() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-[var(--st-text)] tracking-tight">
          SabSMS permission keys
        </h3>
        <p className="text-sm text-[var(--st-text-secondary)]">
          The real access keys that gate each SabSMS surface and the CRUD actions
          they cover. Which roles hold each key is configured in your workspace
          RBAC role templates and enforced server-side.
        </p>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--st-border)]">
        <DataTable
          columns={columns}
          rows={rbacRows}
          getRowId={(row) => row.id}
        />
      </div>
    </div>
  );
}
