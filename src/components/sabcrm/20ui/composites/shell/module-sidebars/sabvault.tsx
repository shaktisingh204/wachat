"use client";

import {
  Activity,
  KeyRound,
  LockKeyhole,
  ScrollText,
  Share2,
  ShieldAlert,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/**
 * SabVault (encrypted credentials vault) sidebar. `[secretId]` and
 * `share/[secretId]` detail pages are intentionally absent — they are
 * reached from the secret list.
 */
export const SABVAULT_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabvault",
  heading: "SabVault",
  caption: "Encrypted credentials",
  build: (p) => [
    {
      id: "sabvault-main",
      label: "Vault",
      items: [
        leaf("secrets", "All secrets", "/dashboard/sabvault", KeyRound, p, { exact: true }),
        leaf("unlock", "Unlock", "/dashboard/sabvault/unlock", LockKeyhole, p),
        leaf("shares", "Shares", "/dashboard/sabvault/shares", Share2, p),
        leaf("audit", "Audit log", "/dashboard/sabvault/audit", ScrollText, p),
        leaf("health", "Health", "/dashboard/sabvault/health", Activity, p),
        leaf("breach-alerts", "Breach alerts", "/dashboard/sabvault/breach-alerts", ShieldAlert, p),
      ],
    },
  ],
};
