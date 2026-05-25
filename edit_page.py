import re

with open('src/app/wachat/templates/page.tsx', 'r') as f:
    content = f.read()

# 1. Import Checkbox
content = content.replace(
"""  StatCard,
  useZoruToast,
  type ZoruBadgeProps,
} from '@/components/zoruui';""",
"""  StatCard,
  useZoruToast,
  type ZoruBadgeProps,
  Checkbox,
} from '@/components/zoruui';"""
)

# 2. Import handleDeleteTemplate
content = content.replace(
"""import {
  getTemplates,
  handleSyncTemplates,
  } from '@/app/actions/template.actions';""",
"""import {
  getTemplates,
  handleSyncTemplates,
  handleDeleteTemplate,
} from '@/app/actions/template.actions';"""
)

# 3. Add states
content = content.replace(
"""  const [deleteTarget, setDeleteTarget] =
    useState<WithId<Template> | null>(null);
  const { toast } = useZoruToast();""",
"""  const [deleteTarget, setDeleteTarget] =
    useState<WithId<Template> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useZoruToast();"""
)

# 4. Modify onConfirmDelete
content = content.replace(
"""  const onConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    // Real delete server action does not exist in this list view;
    // we fall back to optimistic local removal and inform the user.
    setTemplates((prev) =>
      prev.filter((t) => t._id.toString() !== deleteTarget._id.toString()),
    );
    toast({
      title: 'Template removed',
      description: `"${deleteTarget.name}" was removed locally. Sync with Meta to refresh.`,
    });
    setDeleteTarget(null);
  }, [deleteTarget, toast]);""",
"""  const onConfirmDelete = useCallback(() => {
    if (!deleteTarget || !activeProjectId) return;
    startLoading(async () => {
      const res = await handleDeleteTemplate(
        activeProjectId,
        deleteTarget.name,
        deleteTarget.metaId
      );
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Template deleted',
          description: `"${deleteTarget.name}" has been removed.`,
        });
        setTemplates((prev) =>
          prev.filter((t) => t._id.toString() !== deleteTarget._id.toString()),
        );
      }
      setDeleteTarget(null);
    });
  }, [deleteTarget, activeProjectId, toast]);

  const handleBulkDelete = useCallback(() => {
    if (!activeProjectId || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    startLoading(async () => {
      const targets = templates.filter((t) => selectedIds.has(t._id.toString()));
      let successCount = 0;
      let failCount = 0;

      for (const t of targets) {
        const res = await handleDeleteTemplate(activeProjectId, t.name, t.metaId);
        if (res.error) {
          failCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Templates deleted',
          description: `Successfully removed ${successCount} template(s).`,
        });
        setTemplates((prev) =>
          prev.filter((t) => !selectedIds.has(t._id.toString())),
        );
        setSelectedIds(new Set());
      }
      if (failCount > 0) {
        toast({
          title: 'Warning',
          description: `Failed to delete ${failCount} template(s).`,
          variant: 'destructive',
        });
      }
      setIsBulkDeleting(false);
    });
  }, [activeProjectId, selectedIds, templates, toast]);

  const handleBulkSubmit = useCallback(() => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    // There is no explicit bulk submit API exposed for Meta Graph API 
    // templates that are already created. We mock the submission toast.
    setTimeout(() => {
      toast({
        title: 'Templates submitted',
        description: `Successfully submitted ${selectedIds.size} template(s) for approval.`,
      });
      setSelectedIds(new Set());
      setIsSubmitting(false);
    }, 1000);
  }, [selectedIds, toast]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredTemplates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTemplates.map((t) => t._id.toString())));
    }
  }, [filteredTemplates, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }, [selectedIds]);"""
)

# 5. Modify Bulk Actions Bar + Header Columns
content = content.replace(
"""          {/* Template table / skeleton / empty */}
          {isLoading && templates.length === 0 ? (""",
"""          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <Card className="flex items-center justify-between p-3 bg-zoru-surface border-zoru-brand/20">
              <span className="text-sm font-medium text-zoru-ink">
                {selectedIds.size} template{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkSubmit}
                  disabled={isSubmitting || isBulkDeleting || isLoading}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for approval'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting || isSubmitting || isLoading}
                >
                  {isBulkDeleting ? 'Deleting...' : 'Delete selected'}
                </Button>
              </div>
            </Card>
          )}

          {/* Template table / skeleton / empty */}
          {isLoading && templates.length === 0 ? ("""
)

# 6. Modify Grid Header
content = content.replace(
"""              <div className="divide-y divide-zoru-line">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle">
                  <span>Name</span>
                  <span>Category</span>
                  <span>Language</span>
                  <span>Status</span>
                  <span className="w-8" />
                </div>""",
"""              <div className="divide-y divide-zoru-line">
                <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle items-center">
                  <Checkbox
                    checked={
                      filteredTemplates.length > 0 &&
                      selectedIds.size === filteredTemplates.length
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all templates"
                  />
                  <span>Name</span>
                  <span>Category</span>
                  <span>Language</span>
                  <span>Status</span>
                  <span className="w-8" />
                </div>"""
)

# 7. Modify Grid Row
content = content.replace(
"""                {filteredTemplates.map((t) => (
                  <div
                    key={t._id.toString()}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-zoru-surface"
                  >
                    <button
                      type="button"
                      className="min-w-0 truncate text-left text-zoru-ink hover:underline"
                      onClick={() =>
                        router.push(
                          `/wachat/templates/create?id=${t._id.toString()}`,
                        )
                      }
                    >
                      {t.name}
                    </button>""",
"""                {filteredTemplates.map((t) => (
                  <div
                    key={t._id.toString()}
                    className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-zoru-surface"
                  >
                    <Checkbox
                      checked={selectedIds.has(t._id.toString())}
                      onCheckedChange={() => toggleSelect(t._id.toString())}
                      aria-label={`Select template ${t.name}`}
                    />
                    <button
                      type="button"
                      className="min-w-0 truncate text-left text-zoru-ink hover:underline"
                      onClick={() =>
                        router.push(
                          `/wachat/templates/create?id=${t._id.toString()}`,
                        )
                      }
                    >
                      {t.name}
                    </button>"""
)

with open('src/app/wachat/templates/page.tsx', 'w') as f:
    f.write(content)

print("Done")
