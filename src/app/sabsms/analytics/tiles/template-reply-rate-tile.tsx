import Link from "next/link";

import { Card, CardBody, CardDescription, CardHeader, CardTitle, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';

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
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Reply-rate by template</CardTitle>
          <CardDescription>
            How often each template drives a reply.
          </CardDescription>
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
      </CardHeader>
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
            No template sends in this window.
          </p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Template</Th>
                <Th className="text-right">Sent</Th>
                <Th className="text-right">Replies</Th>
                <Th className="text-right">Rate</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.slice(0, 50).map((r) => (
                <Tr key={r.templateId}>
                  <Td className="font-mono text-xs">
                    {r.templateId}
                  </Td>
                  <Td className="text-right text-xs">
                    {r.sent.toLocaleString()}
                  </Td>
                  <Td className="text-right text-xs">
                    {r.replies.toLocaleString()}
                  </Td>
                  <Td className="text-right text-xs">
                    {r.rate}%
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
