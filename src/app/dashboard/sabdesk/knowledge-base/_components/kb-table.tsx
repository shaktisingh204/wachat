"use client";

import {
  Badge,
  type BadgeProps,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";
import { formatDistanceToNow } from "date-fns";
import {
  BookOpen,
  ChevronRight,
  Edit,
  Eye,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

/**
 * <KbTable> - 10-column dense table for the KB list (section 1D.1).
 *
 * select, Title (chip), Category, Status, Visibility, Tags,
 * Views, Helpful %, Updated, Actions.
 */

import * as React from "react";
import Link from "next/link";

import { EntityPickerChip } from "@/components/crm/entity-picker";
import { EntityRowLink } from "@/components/crm/entity-row-link";
import { StatusPill, statusToTone } from "@/components/crm/status-pill";
import type { KbArticleDoc } from "@/app/actions/crm-knowledge-base.actions.types";

const VISIBILITY_VARIANTS: Record<string, BadgeProps["variant"]> = {
  public: "success",
  portal: "warning",
  internal: "outline",
};

const EMPTY = "-";

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
  if (total === 0) return EMPTY;
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
    <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
      <Table>
        <THead>
          <Tr className="border-[var(--st-border)] hover:bg-transparent">
            <Th className="w-[36px]">
              <Checkbox
                aria-label="Select all articles"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </Th>
            <Th>Title</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Visibility</Th>
            <Th>Tags</Th>
            <Th align="right">Views</Th>
            <Th align="right">Helpful %</Th>
            <Th>Updated</Th>
            <Th align="right">Actions</Th>
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
                  selected={isSel}
                  className="border-[var(--st-border)] transition-colors"
                >
                  <Td>
                    <Checkbox
                      aria-label={`Select article ${a.title || id}`}
                      checked={isSel}
                      onChange={() => onToggleOne(id)}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
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
                      EMPTY
                    )}
                  </Td>
                  <Td>
                    {a.status ? (
                      <StatusPill
                        label={a.status}
                        tone={statusToTone(a.status)}
                      />
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {EMPTY}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {visibility ? (
                      <Badge
                        variant={VISIBILITY_VARIANTS[visibility] ?? "secondary"}
                      >
                        {visibility}
                      </Badge>
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {EMPTY}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {tags.length === 0 ? (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {EMPTY}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary">
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
                  <Td
                    align="right"
                    className="text-[12.5px] text-[var(--st-text-secondary)]"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      {a.viewCount ?? 0}
                    </span>
                  </Td>
                  <Td
                    align="right"
                    className="text-[12.5px] text-[var(--st-text-secondary)]"
                  >
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
                      : EMPTY}
                  </Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          label={`Actions for ${a.title || id}`}
                          icon={MoreHorizontal}
                          variant="ghost"
                          size="sm"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/sabdesk/knowledge-base/${id}`}
                          >
                            <ChevronRight
                              className="u-dropdown__item-icon"
                              aria-hidden="true"
                            />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/sabdesk/knowledge-base/${id}/edit`}
                          >
                            <Edit
                              className="u-dropdown__item-icon"
                              aria-hidden="true"
                            />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="danger"
                          iconLeft={Trash2}
                          onClick={() => onDelete(id)}
                        >
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
