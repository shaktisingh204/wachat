import Link from "next/link";

import { Card, CardBody, CardDescription, CardHeader, CardTitle, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';

import { TileActions } from "./tile-actions";
import type { SabsmsTopContact } from "../aggregations";

export interface TopContactsTileProps {
  rows: SabsmsTopContact[];
  drilldownHref: string;
  queryString: string;
}

export function TopContactsTile({
  rows,
  drilldownHref,
  queryString,
}: TopContactsTileProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Top contacts by engagement</CardTitle>
          <CardDescription>
            Contacts who replied to your messages, most replies first.
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
            metric="top-contacts"
            tileId="top-contacts"
            queryString={queryString}
          />
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
            No inbound traffic yet.
          </p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Contact</Th>
                <Th className="text-right">Replies</Th>
                <Th className="text-right">Clicks</Th>
                <Th>Last seen</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.slice(0, 50).map((r) => (
                <Tr key={r.contact}>
                  <Td className="font-mono text-xs">
                    {r.contact}
                  </Td>
                  <Td className="text-right text-xs">
                    {r.replies.toLocaleString()}
                  </Td>
                  <Td className="text-right text-xs">
                    {r.clicks.toLocaleString()}
                  </Td>
                  <Td className="text-xs text-[var(--st-text-secondary)]">
                    {r.lastSeen
                      ? new Date(r.lastSeen).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
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
