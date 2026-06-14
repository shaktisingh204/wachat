import { redirect } from "next/navigation";

import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/sabcrm/20ui";

import { getSabAdminContext } from "@/lib/sabadmin/tenant";
import { listSabAdminAudit } from "@/lib/sabadmin/audit";

export const dynamic = "force-dynamic";

export default async function SabAdminAuditPage() {
  const ctx = await getSabAdminContext();
  if (!ctx.ok) redirect("/dashboard");

  const entries = await listSabAdminAudit(ctx.ctx.ownerUserId, 200);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-[var(--zoru-text-secondary,#666)]">
        Every onboarding, access change and offboarding — who did what, when.
      </p>

      <Card className="mt-6">
        <CardBody className="p-0">
          {entries.length === 0 ? (
            <div className="p-8">
              <EmptyState title="No activity yet" description="Lifecycle actions will show up here." />
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Actor</Th>
                  <Th>Subject</Th>
                  <Th>Summary</Th>
                </Tr>
              </THead>
              <TBody>
                {entries.map((e, i) => (
                  <Tr key={`${e.ts}-${i}`}>
                    <Td className="whitespace-nowrap text-sm text-[var(--zoru-text-secondary,#666)]">
                      {new Date(e.ts).toLocaleString()}
                    </Td>
                    <Td>
                      <Badge variant="outline">{e.action}</Badge>
                    </Td>
                    <Td className="text-sm">{e.actorEmail || e.actorUserId}</Td>
                    <Td className="font-mono text-xs">{e.subjectUpn ?? "—"}</Td>
                    <Td className="text-sm">{e.summary}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
