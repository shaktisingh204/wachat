import re

with open('src/app/sabsms/lists/lists-table.tsx', 'r') as f:
    content = f.read()

edit_dialog_component = """      <EditListDialog
        open={dialog === "edit"}
        list={activeList}
        onOpenChange={(o) => !o && setDialog(null)}
        onUpdated={handleRefresh}
      />"""
content = content.replace('<CreateListDialog', edit_dialog_component + '\n      <CreateListDialog')

edit_dialog_fn = """
function EditListDialog({
  open,
  list,
  onOpenChange,
  onUpdated,
}: {
  open: boolean;
  list: ListRecord | null;
  onOpenChange: (o: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<"static" | "dynamic">("static");
  const [predicate, setPredicate] = React.useState<SegmentNode>(emptyGroup("and"));
  const [tagsRaw, setTagsRaw] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [estimate, setEstimate] = React.useState<{ matched: number; scanned: number } | null>(null);
  const [estimating, setEstimating] = React.useState(false);

  React.useEffect(() => {
    if (open && list) {
      setName(list.name);
      setDescription(list.description || "");
      setKind(list.kind || "static");
      setPredicate(list.predicate || emptyGroup("and"));
      setTagsRaw((list.tags || []).join(", "));
      setExpiresAt(list.expiresAt ? list.expiresAt.split("T")[0] : "");
      setError(null);
      setEstimate(null);
    }
  }, [open, list]);

  React.useEffect(() => {
    if (kind !== "dynamic" || !open) return;
    const t = setTimeout(() => {
      setEstimating(true);
      estimateDynamicListSize(predicate).then((res) => {
        if (res.ok) setEstimate({ matched: res.matched, scanned: res.scanned });
        setEstimating(false);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [predicate, kind, open]);

  async function handleSubmit() {
    if (!list) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateList({
        listId: list.id,
        name,
        description: description || undefined,
        kind,
        predicate: kind === "dynamic" ? predicate : undefined,
        tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
        expiresAt: expiresAt || undefined,
      });
      if (result.ok) {
        zoruSonnerToast.success(`Updated list "${name}".`);
        onOpenChange(false);
        onUpdated();
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  const locked = list?.isLocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Edit list</ZoruDialogTitle>
          <ZoruDialogDescription>
            {locked ? "This list is locked. Unlock it to make changes." : "Update configuration or filters."}
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={locked}
                placeholder="VIP customers"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "static" | "dynamic")}
                disabled={locked}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="static">Static (manual members)</option>
                <option value="dynamic">Dynamic (filters)</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={locked}
              placeholder="What this list represents."
              rows={2}
            />
          </div>

          {kind === "dynamic" && (
            <div className="space-y-3 rounded-md border border-slate-200 p-4 bg-slate-50">
              <div className="flex justify-between items-center mb-2">
                <Label className="block">Dynamic Filters</Label>
                <div className="text-xs font-medium text-slate-500">
                  {estimating ? (
                    "Estimating..."
                  ) : estimate ? (
                    `Matches ${estimate.matched.toLocaleString()} of ${estimate.scanned.toLocaleString()} contacts`
                  ) : (
                    ""
                  )}
                </div>
              </div>
              <div className="bg-white rounded-md border border-slate-200 p-3">
                {locked ? (
                  <div className="p-4 text-center text-sm text-slate-500">Filters are locked</div>
                ) : (
                  <PredicateCanvas predicate={predicate} onChange={setPredicate} />
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                disabled={locked}
                placeholder="vip, q1-promo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auto-expire (optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={locked}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <ZoruAlertTitle>Could not update list</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          )}
        </div>

        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!locked && (
            <Button onClick={handleSubmit} disabled={busy || !name.trim()}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          )}
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
"""

content += edit_dialog_fn

with open('src/app/sabsms/lists/lists-table.tsx', 'w') as f:
    f.write(content)

