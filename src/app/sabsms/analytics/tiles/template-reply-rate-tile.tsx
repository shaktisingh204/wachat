import Link from "next/link";

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/sabcrm/20ui/zoru";

import { TileActions } from "./tile-actions";
import type { SabsmsTemplateReplyRow } from "../aggregations";

export interface TemplateReplyRateTileProps {
  rows: SabsmsTemplateReplyRow[];
  drilldownHref: string;
  queryString: string;
}

/**
 * Reply-rate by template. Also reused for the conversions table and the
 * CTR table — pass `variant` to swap titles & columns.
 */
export function TemplateReplyRateTile({
  rows,
  drilldownHref,
  queryString,
}: TemplateReplyRateTileProps) {
  return (
    <Card>
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <ZoruCardTitle>Reply-rate by template</ZoruCardTitle>
          <ZoruCardDescription>
            How often each template drives a reply.
          </ZoruCardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={drilldownHref}
            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            Open in logs
          </Link>
          <TileActions
            metric="template-reply-rate"
            tileId="template-reply-rate"
            queryString={queryString}
          />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
            No template sends in this window.
          </p>
        ) : (
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Template</ZoruTableHead>
                <ZoruTableHead className="text-right">Sent</ZoruTableHead>
                <ZoruTableHead className="text-right">Replies</ZoruTableHead>
                <ZoruTableHead className="text-right">Rate</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.slice(0, 50).map((r) => (
                <ZoruTableRow key={r.templateId}>
                  <ZoruTableCell className="font-mono text-xs">
                    {r.templateId}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs">
                    {r.sent.toLocaleString()}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs">
                    {r.replies.toLocaleString()}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs">
                    {r.rate}%
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        )}
      </ZoruCardContent>
    </Card>
  );
}
