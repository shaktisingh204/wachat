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
} from "@/components/zoruui";

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
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <ZoruCardTitle>Top contacts by engagement</ZoruCardTitle>
          <ZoruCardDescription>
            Contacts who replied to your messages, most replies first.
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
            metric="top-contacts"
            tileId="top-contacts"
            queryString={queryString}
          />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
            No inbound traffic yet.
          </p>
        ) : (
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Contact</ZoruTableHead>
                <ZoruTableHead className="text-right">Replies</ZoruTableHead>
                <ZoruTableHead className="text-right">Clicks</ZoruTableHead>
                <ZoruTableHead>Last seen</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.slice(0, 50).map((r) => (
                <ZoruTableRow key={r.contact}>
                  <ZoruTableCell className="font-mono text-xs">
                    {r.contact}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs">
                    {r.replies.toLocaleString()}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-xs">
                    {r.clicks.toLocaleString()}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-xs text-[var(--st-text-secondary)]">
                    {r.lastSeen
                      ? new Date(r.lastSeen).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
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
