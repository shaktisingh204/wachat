"use client";

import * as React from "react";
import { Boxes, Check, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";

import type { GrantableAppOption, PackageRow } from "@/lib/sabadmin/dto";
import {
  createAccessPackage,
  updateAccessPackage,
  deleteAccessPackage,
} from "../actions/packages.actions";

function ChipPicker({
  options,
  selected,
  onToggle,
  emptyHint,
}: {
  options: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyHint?: string;
}) {
  if (options.length === 0)
    return <p className="text-sm text-[var(--zoru-text-secondary,#666)]">{emptyHint}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            aria-pressed={on}
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
              on
                ? "border-transparent bg-[var(--zoru-primary,#4f46e5)] text-white"
                : "border-[var(--zoru-border,#d4d4d8)] hover:bg-[var(--zoru-surface-2,#f4f4f5)]",
            ].join(" ")}
          >
            {on ? <Check className="h-3.5 w-3.5" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SabAdminAccessClient({
  initialPackages,
  grantableApps,
}: {
  initialPackages: PackageRow[];
  grantableApps: GrantableAppOption[];
}) {
  const { toast } = useToast();
  const [packages, setPackages] = React.useState<PackageRow[]>(initialPackages);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PackageRow | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [apps, setApps] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  const appOptions = grantableApps.map((a) => ({ id: a.appId, label: a.label }));

  const toggle = (id: string) =>
    setApps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setApps(new Set());
    setOpen(true);
  };
  const openEdit = (p: PackageRow) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description ?? "");
    setApps(new Set(p.apps));
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name the package", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing) {
      const res = await updateAccessPackage(editing.id, {
        name,
        description,
        appIds: Array.from(apps),
      });
      setSaving(false);
      if (!res.ok) {
        toast({ title: "Couldn’t save", description: res.error, variant: "destructive" });
        return;
      }
      setPackages((prev) =>
        prev.map((x) =>
          x.id === editing.id
            ? { ...x, name, description: description || null, apps: Array.from(apps) }
            : x,
        ),
      );
      toast({ title: "Package updated" });
    } else {
      const res = await createAccessPackage({ name, description, appIds: Array.from(apps) });
      setSaving(false);
      if (!res.ok) {
        toast({ title: "Couldn’t create", description: res.error, variant: "destructive" });
        return;
      }
      setPackages((prev) => [
        ...prev,
        {
          id: res.id,
          name,
          description: description || null,
          apps: Array.from(apps),
          permissions: {},
          createdAt: new Date().toISOString(),
        },
      ]);
      toast({ title: "Package created" });
    }
    setOpen(false);
  };

  const handleDelete = async (p: PackageRow) => {
    const res = await deleteAccessPackage(p.id);
    if (!res.ok) {
      toast({ title: "Couldn’t delete", description: res.error, variant: "destructive" });
      return;
    }
    setPackages((prev) => prev.filter((x) => x.id !== p.id));
    toast({ title: "Package deleted" });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Access Packages</h1>
          <p className="mt-1 text-sm text-[var(--zoru-text-secondary,#666)]">
            Reusable bundles of apps — like a license. Assigning one grants all
            its tools at once. Bounded by what you can access yourself.
          </p>
        </div>
        <Button iconLeft={Plus} onClick={openCreate}>
          New package
        </Button>
      </div>

      {packages.length === 0 ? (
        <Card className="mt-6">
          <CardBody className="p-8">
            <EmptyState
              title="No packages yet"
              description="Create a bundle like “Sales Kit” or “Support Kit” to onboard faster."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {packages.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <Boxes className="h-4 w-4" /> {p.name}
                  </CardTitle>
                  {p.description ? <CardDescription>{p.description}</CardDescription> : null}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" iconLeft={Pencil} onClick={() => openEdit(p)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" iconLeft={Trash2} onClick={() => handleDelete(p)}>
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-1">
                  {p.apps.length === 0 ? (
                    <span className="text-sm text-[var(--zoru-text-secondary,#666)]">No apps</span>
                  ) : (
                    p.apps.map((a) => (
                      <Badge key={a} variant="outline">
                        {a}
                      </Badge>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle>
            <DialogDescription>
              Pick the apps this package grants. Permissions are clamped to what
              you currently hold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Kit" autoFocus />
            </Field>
            <Field label="Description" help="Optional.">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this bundle is for"
                rows={2}
              />
            </Field>
            <div>
              <div className="mb-1.5 text-sm font-medium">Apps</div>
              <ChipPicker
                options={appOptions}
                selected={apps}
                onToggle={toggle}
                emptyHint="You don’t currently have any grantable apps."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
