"use client";

/**
 * <KbCategoryTree> — alternate view of the KB list grouped by category
 * (§1D.1 view switcher).
 *
 * Left sidebar lists every distinct category (plus "Uncategorised");
 * picking one filters the right pane to articles in that bucket. The
 * sidebar shows article counts so users can size the catalogue at a
 * glance.
 */

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, FolderOpen } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/sabcrm/20ui";
import type { BadgeTone } from "@/components/sabcrm/20ui";
import type { KbArticleDoc } from "@/app/actions/crm-knowledge-base.actions.types";

interface KbCategoryTreeProps {
  articles: KbArticleDoc[];
}

/** Map a raw KB article status string to a 20ui Badge tone. */
function statusTone(status: string | undefined): BadgeTone {
  const s = (status ?? "").toLowerCase();
  if (["active", "published", "approved", "open", "resolved"].includes(s)) {
    return "success";
  }
  if (["pending", "draft", "in_progress", "submitted", "review"].includes(s)) {
    return "warning";
  }
  if (["archived", "rejected", "deleted", "closed"].includes(s)) {
    return "danger";
  }
  if (["new"].includes(s)) {
    return "info";
  }
  return "neutral";
}

export function KbCategoryTree({ articles }: KbCategoryTreeProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, KbArticleDoc[]>();
    for (const a of articles) {
      const key = a.category ? a.category : "__uncategorised__";
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    // Sort entries: alphabetical, uncategorised last.
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "__uncategorised__") return 1;
      if (b === "__uncategorised__") return -1;
      return a.localeCompare(b);
    });
  }, [articles]);

  const [active, setActive] = React.useState<string>(() =>
    grouped.length > 0 ? grouped[0][0] : "",
  );

  React.useEffect(() => {
    if (grouped.length > 0 && !grouped.find(([k]) => k === active)) {
      setActive(grouped[0][0]);
    }
  }, [grouped, active]);

  const items = grouped.find(([k]) => k === active)?.[1] ?? [];

  if (grouped.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={BookOpen}
          title="No articles found"
          description="No articles match the current filters."
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
      <Card padding="sm">
        <ul className="flex flex-col gap-0.5">
          {grouped.map(([key, arr]) => {
            const label = key === "__uncategorised__" ? "Uncategorised" : key;
            const isActive = key === active;
            return (
              <li key={key}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  block
                  onClick={() => setActive(key)}
                  aria-pressed={isActive}
                  className="justify-between"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </span>
                  <Badge tone="neutral">{arr.length}</Badge>
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <Card padding="md">
            <EmptyState
              icon={BookOpen}
              size="sm"
              title="No articles in this category"
            />
          </Card>
        ) : (
          items.map((a) => {
            const id = String(a._id);
            return (
              <Card key={id} variant="interactive" padding="sm">
                <Link
                  href={`/dashboard/sabdesk/knowledge-base/${id}`}
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <BookOpen
                        className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      <span className="text-[14px] font-medium text-[var(--st-text)] hover:underline">
                        {a.title || "Untitled"}
                      </span>
                    </span>
                    {a.status ? (
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    ) : null}
                  </div>
                  {a.body ? (
                    <p className="line-clamp-2 text-[12.5px] text-[var(--st-text-secondary)]">
                      {a.body}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-3 text-[11.5px] text-[var(--st-text-secondary)]">
                    <span>Views: {a.viewCount ?? 0}</span>
                    {a.updatedAt ? (
                      <span>
                        Updated{" "}
                        {formatDistanceToNow(new Date(a.updatedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default KbCategoryTree;
