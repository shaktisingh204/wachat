"use client";

import { Button, Card, useZoruToast } from "@/components/sabcrm/20ui/zoru";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  CheckCircle2,
  Copy,
  Mail,
  Pencil,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from "lucide-react";

/**
 * <KbDetailActions> — header action group + "Was this helpful?" widget
 * for the KB detail page (§1D.2 — 7 actions).
 *
 * Edit · Publish/Unpublish · Duplicate · Share public link · Email ·
 * Archive · Activity.
 */

import * as React from "react";
import Link from "next/link";

import {
  recordKbHelpfulVote,
  saveKbArticle,
  setKbArticleStatus,
} from "@/app/actions/crm-knowledge-base.actions";

interface KbDetailActionsProps {
  articleId: string;
  article: Record<string, unknown>;
}

export function KbDetailActions({ articleId, article }: KbDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [pending, startTransition] = React.useTransition();

  const status = String(article.status ?? "").toLowerCase();
  const isPublished = status === "published";
  const isArchived = status === "archived";
  const visibility = String(article.visibility ?? "").toLowerCase();
  const slug = String(article.slug ?? "");

  const togglePublish = () =>
    startTransition(async () => {
      const next = isPublished ? "draft" : "published";
      const res = await setKbArticleStatus(articleId, next);
      if (res.success) {
        toast({ title: isPublished ? "Unpublished" : "Published" });
        router.refresh();
      } else {
        toast({
          title: "Update failed",
          description: res.error,
          variant: "destructive",
        });
      }
    });

  const archive = () =>
    startTransition(async () => {
      const next = isArchived ? "draft" : "archived";
      const res = await setKbArticleStatus(articleId, next);
      if (res.success) {
        toast({ title: isArchived ? "Restored" : "Archived" });
        router.refresh();
      } else {
        toast({
          title: "Archive failed",
          description: res.error,
          variant: "destructive",
        });
      }
    });

  const duplicate = () =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set("title", `Copy of ${String(article.title ?? "Untitled")}`);
      fd.set("body", String(article.body ?? ""));
      if (article.category) fd.set("category", String(article.category));
      if (article.tags && Array.isArray(article.tags)) {
        fd.set("tags", (article.tags as unknown[]).join(", "));
      }
      fd.set("visibility", String(article.visibility ?? "internal"));
      fd.set("status", "draft");
      if (article.seoTitle) fd.set("seoTitle", String(article.seoTitle));
      if (article.seoDescription)
        fd.set("seoDescription", String(article.seoDescription));
      const res = await saveKbArticle(undefined, fd);
      if (res.message && res.id) {
        toast({ title: "Duplicated", description: "Edit the copy below." });
        router.push(`/dashboard/sabdesk/knowledge-base/${res.id}/edit`);
      } else {
        toast({
          title: "Duplicate failed",
          description: res.error,
          variant: "destructive",
        });
      }
    });

  const sharePublic = () => {
    if (visibility !== "public") {
      toast({
        title: "Article is not public",
        description: "Set visibility to Public to share a link.",
        variant: "destructive",
      });
      return;
    }
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/help/${slug || articleId}`
        : `/help/${slug || articleId}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      toast({ title: "Public link copied", description: url });
    } else {
      toast({ title: "Public link", description: url });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/sabdesk/knowledge-base/${articleId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>
      <Button
        size="sm"
        variant={isPublished ? "outline" : "default"}
        onClick={togglePublish}
        disabled={pending}
      >
        {isPublished ? (
          <>
            <Undo2 className="h-3.5 w-3.5" /> Unpublish
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" /> Publish
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={duplicate}
        disabled={pending}
      >
        <Copy className="h-3.5 w-3.5" /> Duplicate
      </Button>
      <Button variant="outline" size="sm" onClick={sharePublic}>
        <Share2 className="h-3.5 w-3.5" /> Share
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link
          href={`mailto:?subject=${encodeURIComponent(
            String(article.title ?? "Knowledge base article"),
          )}&body=${encodeURIComponent(String(article.body ?? "").slice(0, 800))}`}
        >
          <Mail className="h-3.5 w-3.5" /> Email
        </Link>
      </Button>
      <Button variant="outline" size="sm" onClick={archive} disabled={pending}>
        <Archive className="h-3.5 w-3.5" /> {isArchived ? "Restore" : "Archive"}
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/sabdesk/knowledge-base/${articleId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>
    </div>
  );
}

/* ─── Was this helpful? ──────────────────────────────────────────────── */

interface KbHelpfulWidgetProps {
  articleId: string;
  helpfulYes: number;
  helpfulNo: number;
}

export function KbHelpfulWidget({
  articleId,
  helpfulYes,
  helpfulNo,
}: KbHelpfulWidgetProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [voted, setVoted] = React.useState<"yes" | "no" | null>(null);
  const [pending, startTransition] = React.useTransition();

  const total = helpfulYes + helpfulNo;
  const pct = total > 0 ? Math.round((helpfulYes / total) * 100) : null;

  const vote = (helpful: boolean) =>
    startTransition(async () => {
      const res = await recordKbHelpfulVote(articleId, helpful);
      if (res.success) {
        setVoted(helpful ? "yes" : "no");
        toast({ title: "Thanks for your feedback!" });
        router.refresh();
      } else {
        toast({
          title: "Could not record vote",
          description: res.error,
          variant: "destructive",
        });
      }
    });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        Was this helpful?
      </h3>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={voted === "yes" ? "default" : "outline"}
          disabled={pending || voted !== null}
          onClick={() => vote(true)}
        >
          <ThumbsUp className="h-3.5 w-3.5" /> Yes
        </Button>
        <Button
          size="sm"
          variant={voted === "no" ? "default" : "outline"}
          disabled={pending || voted !== null}
          onClick={() => vote(false)}
        >
          <ThumbsDown className="h-3.5 w-3.5" /> No
        </Button>
      </div>
      <p className="text-[11.5px] text-[var(--st-text-secondary)]">
        {total > 0
          ? `${pct}% of ${total} reader${total === 1 ? "" : "s"} found this helpful`
          : "Be the first to vote"}
      </p>
    </Card>
  );
}

export default KbDetailActions;
