function CreateListDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
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
    if (!open) {
      setName("");
      setDescription("");
      setKind("static");
      setPredicate(emptyGroup("and"));
      setTagsRaw("");
      setExpiresAt("");
      setError(null);
      setEstimate(null);
    }
  }, [open]);

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
    setBusy(true);
    setError(null);
    try {
      const result = await createList({
        name,
        description: description || undefined,
        kind,
        predicate: kind === "dynamic" ? predicate : undefined,
        tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
        expiresAt: expiresAt || undefined,
      });
      if (result.ok) {
        zoruSonnerToast.success(`Created list "${name}".`);
        onOpenChange(false);
        onCreated();
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Create list</ZoruDialogTitle>
          <ZoruDialogDescription>
            Lists can be static (manual contacts) or dynamic (filtered automatically).
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VIP customers"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "static" | "dynamic")}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                <PredicateCanvas predicate={predicate} onChange={setPredicate} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="vip, q1-promo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auto-expire (optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <ZoruAlertTitle>Could not create list</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          )}
        </div>

        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create list"}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
