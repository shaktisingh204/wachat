/**
 * Knowledge Base workspace — `/dashboard/sabdesk/kb`.
 *
 * Companion to the standalone list at `/knowledge-base`. This page is
 * the Zoho-Desk-style management surface: category tree on the left,
 * article list + markdown editor on the right, with public/internal
 * visibility toggling per article.
 */

export const dynamic = "force-dynamic";

import { listKbArticles } from "@/app/actions/crm-knowledge-base.actions";
import { listKbCategories } from "@/app/actions/crm-kb-categories.actions";

import { KbWorkspaceClient } from "./_components/kb-workspace-client";

export default async function KbWorkspacePage() {
  const [{ articles, error }, { categories, error: catError }] =
    await Promise.all([
      listKbArticles(200),
      listKbCategories({ includeArchived: false }),
    ]);

  return (
    <div className="flex h-[calc(100vh-4.5rem)] w-full flex-col">
      <KbWorkspaceClient
        initialArticles={articles}
        initialCategories={categories}
        initialError={error ?? catError}
      />
    </div>
  );
}
