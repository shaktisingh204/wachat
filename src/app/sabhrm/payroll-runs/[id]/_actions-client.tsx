"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Banknote, Calculator } from "lucide-react";

import { Button, useToast } from "@/components/sabcrm/20ui";
import {
  approvePayrollRun,
  computePayrollRun,
  disbursePayrollRun,
} from "@/app/actions/sabhrm/payroll.actions";
import type { PayrollStatus } from "@/lib/sabhrm/types";

export function PayrollRunActions({
  runId,
  status,
}: {
  runId: string;
  status: PayrollStatus;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState<"compute" | "approve" | "disburse" | null>(null);

  const run = React.useCallback(
    async (
      kind: "compute" | "approve" | "disburse",
      fn: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>,
      okTitle: string,
    ) => {
      setBusy(kind);
      const res = await fn(runId);
      setBusy(null);
      if (!res.ok) {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: okTitle });
      router.refresh();
    },
    [runId, router, toast],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={status === "draft" ? "primary" : "outline"}
        size="sm"
        iconLeft={Calculator}
        loading={busy === "compute"}
        disabled={busy !== null || status === "approved" || status === "paid"}
        onClick={() => void run("compute", computePayrollRun, "Payroll computed")}
      >
        {status === "computed" ? "Recompute" : "Compute"}
      </Button>
      <Button
        variant={status === "computed" ? "primary" : "outline"}
        size="sm"
        iconLeft={BadgeCheck}
        loading={busy === "approve"}
        disabled={busy !== null || status !== "computed"}
        onClick={() => void run("approve", approvePayrollRun, "Payroll approved")}
      >
        Approve
      </Button>
      <Button
        variant={status === "approved" ? "primary" : "outline"}
        size="sm"
        iconLeft={Banknote}
        loading={busy === "disburse"}
        disabled={busy !== null || status !== "approved"}
        onClick={() => void run("disburse", disbursePayrollRun, "Payroll disbursed")}
      >
        Disburse
      </Button>
    </div>
  );
}
