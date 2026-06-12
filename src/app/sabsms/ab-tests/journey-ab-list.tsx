"use client";

/**
 * Journey A/B steps — section on `/sabsms/ab-tests` (V2.9).
 *
 * One card per A/B send step across all journeys: per-variant
 * sent/delivered/replied/clicked + rates, the sample-gate progress, the
 * winner badge once promoted, and a manual "promote now" escape hatch.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, Trophy } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  useToast,
} from "@/components/sabcrm/20ui";

import { promoteJourneyWinnerAction, type JourneyAbRow } from "./actions";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function JourneyAbList({ rows }: { rows: JourneyAbRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Card className="border-dashed shadow-none">
        <CardBody className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
          No journey A/B tests yet — add variants to a send step in the{" "}
          <Link href="/sabsms/drips" className="underline">
            drip builder
          </Link>
          .
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const key = `${row.journeyId}:${row.stepId}`;
        const minSent = Math.min(...row.variants.map((v) => v.sent));
        return (
          <Card key={key} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FlaskConical className="h-4 w-4" />
                <Link href={`/sabsms/drips/${row.journeyId}`} className="hover:underline">
                  {row.journeyName}
                </Link>
                <span className="text-xs font-normal text-[var(--st-text-secondary)]">
                  · step {row.stepIndex + 1}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {row.journeyStatus}
                </Badge>
              </CardTitle>
              {row.winner ? (
                <Badge className="text-[10px]">
                  <Trophy className="mr-1 h-3 w-3" />
                  Winner: {row.winner.templateName} ({row.winner.metric} {pct(row.winner.rate)})
                </Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--st-text-secondary)]">
                    {minSent.toLocaleString()} / {row.sampleThreshold.toLocaleString()} per arm
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyKey === key}
                    onClick={async () => {
                      setBusyKey(key);
                      const res = await promoteJourneyWinnerAction(
                        row.journeyId,
                        row.stepId,
                        true,
                      );
                      setBusyKey(null);
                      if (res.ok) {
                        toast({ title: "Winner promoted" });
                        router.refresh();
                      } else {
                        toast({
                          title: "Could not promote",
                          description: res.error,
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Promote now
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardBody className="p-0">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="px-4 py-2 font-medium">Variant</th>
                    <th className="px-4 py-2 text-right font-medium">Weight</th>
                    <th className="px-4 py-2 text-right font-medium">Sent</th>
                    <th className="px-4 py-2 text-right font-medium">Delivered</th>
                    <th className="px-4 py-2 text-right font-medium">Replied</th>
                    <th className="px-4 py-2 text-right font-medium">Clicked</th>
                    <th className="px-4 py-2 text-right font-medium">Reply rate</th>
                    <th className="px-4 py-2 text-right font-medium">Click rate</th>
                  </tr>
                </thead>
                <tbody>
                  {row.variants.map((v) => (
                    <tr
                      key={v.templateId}
                      className="border-b border-[var(--st-border)]/60 last:border-0"
                    >
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--st-text)]">
                          {v.templateName}
                          {v.isWinner && (
                            <Badge className="text-[9px]">
                              <Trophy className="mr-0.5 h-2.5 w-2.5" /> Winner
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{v.weight}</td>
                      <td className="px-4 py-2 text-right font-mono">{v.sent.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {v.delivered.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {v.replied.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {v.clicked.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{pct(v.replyRate)}</td>
                      <td className="px-4 py-2 text-right font-mono">{pct(v.clickRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {row.winner && (
                <p className="border-t border-[var(--st-border)]/60 px-4 py-2 text-[11px] text-[var(--st-text-secondary)]">
                  {row.winner.note} · decided {new Date(row.winner.decidedAtIso).toLocaleString()}
                </p>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
