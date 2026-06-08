"use client";

/**
 * <KbWorkspaceClient> - three-pane Knowledge Base management view.
 *
 *   - LEFT: category tree (nested via `parentId`) + "New category" button.
 *   - CENTER: article list filtered by selected category, with a markdown
 *     editor for the active article (title / slug / body / category /
 *     visibility).
 *
 * Save / delete / category mutations route through `helpdesk.actions.ts`.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderPlus,
  Globe2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/sabcrm/20ui";

import {
  saveKbArticle,
  deleteKbArticle,
  setKbArticleStatus,
} from "@/app/actions/crm-knowledge-base.actions";
import {
  saveKbCategory,
  deleteKbCategory,
  type KbCategoryRow,
} from "@/app/actions/crm-kb-categories.actions";

type ArticleDoc = {
  _id: string;
  title?: string;
  slug?: string;
  body?: string;
  category?: string;
  visibility?: string;
  status?: string;
  updatedAt?: string;
};

type Props = {
  initialArticles: ArticleDoc[];
  initialCategories: KbCategoryRow[];
  initialError?: string;
};

type TreeNode = KbCategoryRow & { children: TreeNode[] };

function buildTree(rows: KbCategoryRow[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  rows.forEach((r) => byId.set(r._id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function visibilityBadge(v?: string): React.ReactNode {
  if (v === "public")
    return (
      <Badge tone="success" className="gap-1">
        <Globe2 className="h-3 w-3" aria-hidden="true" /> Public
      </Badge>
    );
  if (v === "portal")
    return (
      <Badge tone="info" className="gap-1">
        <Eye className="h-3 w-3" aria-hidden="true" /> Portal
      </Badge>
    );
  return (
    <Badge tone="neutral" className="gap-1">
      <EyeOff className="h-3 w-3" aria-hidden="true" /> Internal
    </Badge>
  );
}

export function KbWorkspaceClient(props: Props): React.JSX.Element {
  const { toast } = useToast();
  const router = useRouter();

  const [articles, setArticles] = React.useState<ArticleDoc[]>(
    props.initialArticles,
  );
  const [categories, setCategories] = React.useState<KbCategoryRow[]>(
    props.initialCategories,
  );
  const [activeCategory, setActiveCategory] = React.useState<string | "all">(
    "all",
  );
  const [selectedArticleId, setSelectedArticleId] = React.useState<
    string | null
  >(props.initialArticles[0]?._id ?? null);
  const [draft, setDraft] = React.useState<{
    _id?: string;
    title: string;
    slug: string;
    body: string;
    category: string;
    visibility: "public" | "portal" | "internal";
    status: "draft" | "published" | "archived";
  }>({
    title: "",
    slug: "",
    body: "",
    category: "",
    visibility: "portal",
    status: "draft",
  });
  const [showNewCategory, setShowNewCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryParent, setNewCategoryParent] =
    React.useState<string>("root");
  const [newCategoryVisibility, setNewCategoryVisibility] = React.useState<
    "public" | "portal" | "internal"
  >("portal");
  const [isPending, startTransition] = React.useTransition();

  const tree = React.useMemo(() => buildTree(categories), [categories]);

  const filteredArticles = React.useMemo(() => {
    if (activeCategory === "all") return articles;
    return articles.filter((a) => a.category === activeCategory);
  }, [articles, activeCategory]);

  // Load draft when selection changes
  React.useEffect(() => {
    if (!selectedArticleId) {
      setDraft({
        title: "",
        slug: "",
        body: "",
        category: activeCategory === "all" ? "" : activeCategory,
        visibility: "portal",
        status: "draft",
      });
      return;
    }
    const a = articles.find((x) => x._id === selectedArticleId);
    if (a) {
      setDraft({
        _id: a._id,
        title: a.title ?? "",
        slug: a.slug ?? "",
        body: a.body ?? "",
        category: a.category ?? "",
        visibility:
          (a.visibility as "public" | "portal" | "internal") ?? "portal",
        status: (a.status as "draft" | "published" | "archived") ?? "draft",
      });
    }
  }, [selectedArticleId, articles, activeCategory]);

  /* ── Save article ─────────────────────────────────────────── */

  const handleSave = () => {
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!draft.body.trim()) {
      toast.error("Body is required");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      if (draft._id) fd.set("_id", draft._id);
      fd.set("title", draft.title);
      if (draft.slug) fd.set("slug", draft.slug);
      fd.set("body", draft.body);
      if (draft.category) fd.set("category", draft.category);
      fd.set("visibility", draft.visibility);
      fd.set("status", draft.status);

      const res = await saveKbArticle(null, fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(draft._id ? "Article updated" : "Article created");
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!draft._id) return;
    startTransition(async () => {
      const res = await deleteKbArticle(draft._id!);
      if ((res as { error?: string }).error) {
        toast.error((res as { error?: string }).error ?? "Failed");
        return;
      }
      setArticles((rows) => rows.filter((r) => r._id !== draft._id));
      setSelectedArticleId(null);
      toast.success("Article archived");
      router.refresh();
    });
  };

  const togglePublish = () => {
    if (!draft._id) return;
    const next = draft.status === "published" ? "draft" : "published";
    setDraft((d) => ({ ...d, status: next }));
    startTransition(async () => {
      await setKbArticleStatus(draft._id!, next);
      router.refresh();
    });
  };

  /* ── Categories ───────────────────────────────────────────── */

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", newCategoryName);
      fd.set("parentId", newCategoryParent);
      fd.set("visibility", newCategoryVisibility);
      const res = await saveKbCategory(null, fd);
      if (res.success) {
        toast.success("Category created");
        setShowNewCategory(false);
        setNewCategoryName("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  const handleDeleteCategory = (id: string) => {
    startTransition(async () => {
      const res = await deleteKbCategory(id);
      if (res.success) {
        setCategories((rows) => rows.filter((r) => r._id !== id));
        if (activeCategory === id) setActiveCategory("all");
        toast.success("Category archived");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  /* ── Render ───────────────────────────────────────────────── */

  const renderTreeNode = (node: TreeNode, depth = 0): React.ReactNode => (
    <div key={node._id}>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveCategory(node._id)}
          className={`min-w-0 flex-1 justify-between !px-2 text-left text-[13px] ${
            activeCategory === node._id
              ? "bg-[var(--st-bg-muted)] font-medium"
              : ""
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[var(--st-text)]">
            <Folder
              className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]"
              aria-hidden="true"
            />
            <span className="truncate">{node.name}</span>
          </span>
          <Badge tone="neutral">{node.articleCount ?? 0}</Badge>
        </Button>
        <IconButton
          label={`Delete ${node.name}`}
          icon={Trash2}
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm(`Archive category "${node.name}"?`))
              handleDeleteCategory(node._id);
          }}
        />
      </div>
      {node.children.length > 0 ? (
        <div>{node.children.map((c) => renderTreeNode(c, depth + 1))}</div>
      ) : null}
    </div>
  );

  return (
    <div className="20ui flex h-full min-h-0 flex-1 gap-0 overflow-hidden border-t border-[var(--st-border)]">
      {/* LEFT: categories */}
      <aside className="flex h-full w-[280px] min-w-[240px] shrink-0 flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-3 py-3">
          <span className="text-sm font-semibold text-[var(--st-text)]">
            Categories
          </span>
          <Button
            size="sm"
            variant="outline"
            iconLeft={FolderPlus}
            onClick={() => setShowNewCategory(true)}
          >
            New
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveCategory("all")}
              className={`w-full justify-between !px-2 text-left text-[13px] ${
                activeCategory === "all"
                  ? "bg-[var(--st-bg-muted)] font-medium"
                  : ""
              }`}
            >
              <span className="flex items-center gap-1.5 text-[var(--st-text)]">
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                All articles
              </span>
              <Badge tone="neutral">{articles.length}</Badge>
            </Button>
            {tree.length === 0 ? (
              <p className="px-2 py-3 text-[12px] text-[var(--st-text-secondary)]">
                No categories yet.
              </p>
            ) : (
              tree.map((n) => renderTreeNode(n))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* CENTER: article list + editor */}
      <section className="flex h-full min-w-0 flex-1 flex-col bg-[var(--st-bg-secondary)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] px-5 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--st-text)]">
              Knowledge Base
            </h2>
            <p className="text-[12px] text-[var(--st-text-secondary)]">
              {filteredArticles.length} article
              {filteredArticles.length === 1 ? "" : "s"}
              {activeCategory !== "all" ? " in selected category" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={Plus}
              onClick={() => {
                setSelectedArticleId(null);
                setDraft({
                  title: "",
                  slug: "",
                  body: "",
                  category: activeCategory === "all" ? "" : activeCategory,
                  visibility: "portal",
                  status: "draft",
                });
              }}
            >
              New article
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push("/dashboard/sabdesk/knowledge-base")
              }
            >
              Open full list
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* article list rail */}
          <ScrollArea className="w-[280px] shrink-0 border-r border-[var(--st-border)]">
            {props.initialError ? (
              <div className="p-4 text-[13px] text-[var(--st-danger)]">
                {props.initialError}
              </div>
            ) : filteredArticles.length === 0 ? (
              <EmptyState
                icon={FileText}
                size="sm"
                title="No articles here yet"
                description="Create your first article to populate this list."
                className="m-4"
              />
            ) : (
              <ul className="divide-y divide-[var(--st-border)]">
                {filteredArticles.map((a) => {
                  const active = selectedArticleId === a._id;
                  return (
                    <li key={a._id}>
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedArticleId(a._id)}
                        className={`flex w-full flex-col items-start gap-1 !px-3 !py-3 text-left ${
                          active ? "bg-[var(--st-bg-muted)]" : ""
                        }`}
                      >
                        <span className="line-clamp-2 text-[13px] font-medium text-[var(--st-text)]">
                          {a.title ?? "Untitled"}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {visibilityBadge(a.visibility)}
                          <Badge
                            tone={
                              a.status === "published" ? "success" : "neutral"
                            }
                          >
                            {a.status ?? "draft"}
                          </Badge>
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>

          {/* editor */}
          <ScrollArea className="min-w-0 flex-1">
            <Card className="m-5">
              <CardBody className="space-y-4 p-5">
                <Field label="Title">
                  <Input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, title: e.target.value }))
                    }
                    placeholder="e.g. How to reset your password"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Slug">
                    <Input
                      value={draft.slug}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, slug: e.target.value }))
                      }
                      placeholder="auto from title"
                    />
                  </Field>
                  <Field label="Category">
                    <Select
                      value={draft.category || "none"}
                      onValueChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          category: v === "none" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Category">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Visibility">
                    <Select
                      value={draft.visibility}
                      onValueChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          visibility: v as "public" | "portal" | "internal",
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">
                          Internal (staff only)
                        </SelectItem>
                        <SelectItem value="portal">
                          Portal (customers)
                        </SelectItem>
                        <SelectItem value="public">Public (web)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Separator />

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label htmlFor="kb-article-body">Body (Markdown)</Label>
                    <span className="text-[11px] text-[var(--st-text-secondary)]">
                      Markdown is rendered in the customer portal.
                    </span>
                  </div>
                  <Textarea
                    id="kb-article-body"
                    value={draft.body}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, body: e.target.value }))
                    }
                    rows={14}
                    className="font-mono text-[13px]"
                    placeholder={`# Heading\n\nWrite your article in **markdown**...`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        draft.status === "published" ? "success" : "neutral"
                      }
                    >
                      {draft.status}
                    </Badge>
                    {draft._id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={togglePublish}
                        disabled={isPending}
                      >
                        {draft.status === "published"
                          ? "Move to draft"
                          : "Publish"}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {draft._id ? (
                      <Button
                        variant="danger"
                        size="sm"
                        iconLeft={Trash2}
                        onClick={handleDelete}
                        disabled={isPending}
                      >
                        Archive
                      </Button>
                    ) : null}
                    <Button
                      variant="primary"
                      iconLeft={Save}
                      onClick={handleSave}
                      disabled={isPending}
                    >
                      {draft._id ? "Save changes" : "Create article"}
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </ScrollArea>
        </div>
      </section>

      {/* New category dialog */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New KB category</DialogTitle>
            <DialogDescription>
              Group related articles for portal and public help-center browsing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Billing"
              />
            </Field>
            <Field label="Parent">
              <Select
                value={newCategoryParent}
                onValueChange={setNewCategoryParent}
              >
                <SelectTrigger aria-label="Parent category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Top level</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Visibility">
              <Select
                value={newCategoryVisibility}
                onValueChange={(v) =>
                  setNewCategoryVisibility(
                    v as "public" | "portal" | "internal",
                  )
                }
              >
                <SelectTrigger aria-label="Visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="portal">Portal</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategory(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateCategory}
              disabled={isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
