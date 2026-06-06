import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from "@/components/sabcrm/20ui/zoru";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";

/**
 * KB article detail — `/dashboard/sabdesk/knowledge-base/[articleId]` (§1D.2).
 *
 * Server-rendered shell with 7 header actions (Edit · Publish/Unpublish ·
 * Duplicate · Share · Email · Archive · Activity) wired through
 * `<KbDetailActions>`. The body renders with `whitespace-pre-wrap` so
 * Markdown content keeps its formatting until we wire a real renderer.
 *
 * Side rail includes the "Was this helpful?" widget that increments
 * helpful counters server-side.
 */

import { EntityDetailShell } from "@/components/crm/entity-detail-shell";
import { EntityPickerChip } from "@/components/crm/entity-picker";
import { StatusPill, statusToTone } from "@/components/crm/status-pill";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from "@/app/actions/user.actions";

import {
  KbDetailActions,
  KbHelpfulWidget,
} from "../_components/kb-detail-actions";

export const dynamic = "force-dynamic";

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

const VISIBILITY_VARIANTS: Record<
  string,
  React.ComponentProps<typeof ZoruBadge>["variant"]
> = {
  public: "success",
  portal: "warning",
  internal: "ghost",
};

export default async function KbArticleDetailPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  if (!ObjectId.isValid(articleId)) {
    redirect("/dashboard/sabdesk/knowledge-base");
  }

  const session = await getSession();
  if (!session?.user?._id) {
    redirect("/dashboard/sabdesk/knowledge-base");
  }

  const { db } = await connectToDatabase();
  const doc = await db.collection("crm_kb_articles").findOne({
    _id: new ObjectId(articleId),
    userId: new ObjectId(session.user._id),
  } as any);

  if (!doc) {
    redirect("/dashboard/sabdesk/knowledge-base");
  }

  const article = JSON.parse(JSON.stringify(doc)) as Record<string, any>;
  const title: string = article.title || "Untitled article";
  const tags: string[] = Array.isArray(article.tags) ? article.tags : [];
  const status = String(article.status ?? "").toLowerCase();
  const visibility = String(article.visibility ?? "").toLowerCase();

  return (
    <EntityDetailShell
      eyebrow="KNOWLEDGE BASE"
      title={title}
      back={{
        href: "/dashboard/sabdesk/knowledge-base",
        label: "Knowledge Base",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {status ? (
            <StatusPill label={status} tone={statusToTone(status)} />
          ) : null}
          {visibility ? (
            <Badge variant={VISIBILITY_VARIANTS[visibility] ?? "ghost"}>
              {visibility}
            </Badge>
          ) : null}
        </div>
        <KbDetailActions articleId={articleId} article={article} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
              Content
            </h2>
            {article.body ? (
              <div className="prose-zoru whitespace-pre-wrap rounded-lg bg-[var(--st-bg-muted)] p-4 text-[14px] leading-relaxed text-[var(--st-text)]">
                {article.body}
              </div>
            ) : (
              <div className="rounded-lg bg-[var(--st-bg-muted)] p-4 text-[13px] text-[var(--st-text-secondary)]">
                No content yet.
              </div>
            )}
          </Card>

          {article.seoTitle || article.seoDescription ? (
            <Card className="p-6">
              <h2 className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                SEO meta
              </h2>
              <div className="grid gap-3 text-[13px]">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                    SEO title
                  </div>
                  <div className="text-[var(--st-text)]">{article.seoTitle || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                    SEO description
                  </div>
                  <div className="text-[var(--st-text)]">
                    {article.seoDescription || "—"}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Article details</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3 text-[13px]">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                  Slug
                </div>
                <div className="font-mono text-[var(--st-text)]">
                  {article.slug || "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                  Category
                </div>
                <div className="text-[var(--st-text)]">
                  {article.category ? (
                    <EntityPickerChip
                      entity="category"
                      id={article.category}
                      fallback={article.category}
                    />
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {tags.length === 0 ? (
                    <span className="text-[var(--st-text-secondary)]">—</span>
                  ) : (
                    tags.map((t) => (
                      <Badge key={t} variant="ghost">
                        {t}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                  Views
                </div>
                <div className="text-[var(--st-text)]">{article.viewCount ?? 0}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                  Created
                </div>
                <div className="text-[var(--st-text)]">
                  {fmtDate(article.createdAt)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                  Updated
                </div>
                <div className="text-[var(--st-text)]">
                  {fmtDate(article.updatedAt)}
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <KbHelpfulWidget
            articleId={articleId}
            helpfulYes={Number(article.helpfulYes ?? 0)}
            helpfulNo={Number(article.helpfulNo ?? 0)}
          />
        </aside>
      </div>
    </EntityDetailShell>
  );
}
