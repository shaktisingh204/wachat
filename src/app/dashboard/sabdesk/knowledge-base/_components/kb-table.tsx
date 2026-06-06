"use client";

import { Badge, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Skeleton, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { formatDistanceToNow } from "date-fns";
import {
  BookOpen,
  ChevronDown,
  Edit,
  Eye,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

/**
 * <KbTable> — 10-column dense table for the KB list (§1D.1).
 *
 * select · Title (chip) · Category · Status · Visibility · Tags ·
 * Views · Helpful % · Updated · Actions.
 */

import * as React from "react";
import Link from "next/link";

import { EntityPickerChip } from "@/components/crm/entity-picker";
import { EntityRowLink } from "@/components/crm/entity-row-link";
import { StatusPill, statusToTone } from "@/components/crm/status-pill";
import type { KbArticleDoc } from "@/app/actions/crm-knowledge-base.actions.types";
const VISIBILITY_VARIANTS: Record<
  string,
  React.ComponentProps<typeof ZoruBadge>["variant"]
> = {
  public: "success",
  portal: "warning",
  internal: "ghost",
};

interface KbTableProps {
  articles: KbArticleDoc[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  onDelete: (id: string) => void;
}

function helpfulPct(a: KbArticleDoc): string {
  const yes = a.helpfulYes ?? 0;
  const no = a.helpfulNo ?? 0;
  const total = yes + no;
  if (total === 0) return "—";
  return `${Math.round((yes / total) * 100)}%`;
}

export function KbTable({
  articles,
  loading,
  selectedIds,
  onToggleOne,
  onToggleAll,
  onDelete,
}: KbTableProps) {
  const allSelected =
    articles.length > 0 &&
    articles.every((a) => selectedIds.has(String(a._id)));
  const someSelected =
    !allSelected && articles.some((a) => selectedIds.has(String(a._id)));

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
      <Table>
        <THead>
          <Tr className="border-[var(--st-border)] hover:bg-transparent">
            <Th className="w-[36px]">
              <Checkbox
                aria-label="Select all articles"
                checked={
                  allSelected ? true : someSelected ? "indeterminate" : false
                }
                onCheckedChange={(c) => onToggleAll(c === true)}
              />
            </Th>
            <Th>Title</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Visibility</Th>
            <Th>Tags</Th>
            <Th className="text-right">Views</Th>
            <Th className="text-right">Helpful %</Th>
            <Th>Updated</Th>
            <Th className="text-right">Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Tr key={i} className="border-[var(--st-border)]">
                <Td colSpan={10}>
                  <Skeleton className="h-10 w-full" />
                </Td>
              </Tr>
            ))
          ) : articles.length === 0 ? (
            <Tr className="border-[var(--st-border)]">
              <Td
                colSpan={10}
                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
              >
                No articles match the current filters.
              </Td>
            </Tr>
          ) : (
            articles.map((a) => {
              const id = String(a._id);
              const isSel = selectedIds.has(id);
              const visibility = String(a.visibility ?? "").toLowerCase();
              const tags = Array.isArray(a.tags) ? a.tags : [];
              return (
                <Tr
                  key={id}
                  className={[
                    "border-[var(--st-border)] transition-colors",
                    isSel ? "bg-[var(--st-bg-muted)]/70" : "",
                  ].join(" ")}
                >
                  <Td>
                    <Checkbox
                      aria-label={`Select article ${a.title || id}`}
                      checked={isSel}
                      onCheckedChange={() => onToggleOne(id)}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        <BookOpen className="h-3.5 w-3.5" />
                      </span>
                      <EntityRowLink
                        href={`/dashboard/sabdesk/knowledge-base/${id}`}
                        label={
                          <span className="block max-w-[320px] truncate text-[13px]">
                            {a.title || "Untitled"}
                          </span>
                        }
                        subtitle={
                          a.slug ? (
                            <span className="block max-w-[320px] truncate font-mono text-[11px]">
                              /{a.slug}
                            </span>
                          ) : undefined
                        }
                      />
                    </div>
                  </Td>
                  <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {a.category ? (
                      <EntityPickerChip
                        entity="category"
                        id={a.category}
                        fallback={a.category}
                      />
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {a.status ? (
                      <StatusPill
                        label={a.status}
                        tone={statusToTone(a.status)}
                      />
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                    )}
                  </Td>
                  <Td>
                    {visibility ? (
                      <Badge
                        variant={VISIBILITY_VARIANTS[visibility] ?? "ghost"}
                      >
                        {visibility}
                      </Badge>
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                    )}
                  </Td>
                  <Td>
                    {tags.length === 0 ? (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="ghost">
                            {t}
                          </Badge>
                        ))}
                        {tags.length > 3 ? (
                          <span className="text-[11px] text-[var(--st-text-secondary)]">
                            +{tags.length - 3}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </Td>
                  <Td className="text-right text-[12.5px] text-[var(--st-text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {a.viewCount ?? 0}
                    </span>
                  </Td>
                  <Td className="text-right text-[12.5px] text-[var(--st-text-secondary)]">
                    {helpfulPct(a)}
                  </Td>
                  <Td
                    className="text-[12.5px] text-[var(--st-text-secondary)]"
                    title={
                      a.updatedAt ? new Date(a.updatedAt).toLocaleString() : ""
                    }
                  >
                    {a.updatedAt
                      ? formatDistanceToNow(new Date(a.updatedAt), {
                          addSuffix: true,
                        })
                      : "—"}
                  </Td>
                  <Td className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${a.title || id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/sabdesk/knowledge-base/${id}`}
                          >
                            <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-[-90deg]" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/sabdesk/knowledge-base/${id}/edit`}
                          >
                            <Edit className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(id)}
                          className="text-[var(--st-danger)]"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}

export default KbTable;
