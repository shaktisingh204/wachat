"use client";

import * as React from "react";
import Papa from "papaparse";
import { Plus, Trash2, Upload, Users } from "lucide-react";

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
  TBody,
  Table,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabFilePickerButton, type SabFilePick } from "@/components/sabfiles";
import { CreatingOverlay } from "@/components/sabmail/motion";

import {
  createSabmailContact,
  deleteSabmailContact,
  importSabmailContacts,
  type SabmailContactRow,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

interface ParsedRow {
  email: string;
  name?: string;
}

/** Parse the textarea blob: one email per line OR comma-separated. */
function parsePastedEmails(blob: string): ParsedRow[] {
  return blob
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

/** Map loose papaparse rows → {email, name} using header heuristics. */
function rowsFromCsvObjects(records: Record<string, unknown>[]): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const rec of records) {
    if (!rec || typeof rec !== "object") continue;
    let email = "";
    let name = "";
    for (const [key, value] of Object.entries(rec)) {
      const k = key.trim().toLowerCase();
      const v = String(value ?? "").trim();
      if (!v) continue;
      if (!email && (k === "email" || k === "e-mail" || k.includes("email"))) email = v;
      else if (!name && (k === "name" || k === "full name" || k === "fullname" || k.includes("name"))) name = v;
    }
    // Fallback: first cell that looks like an email.
    if (!email) {
      for (const value of Object.values(rec)) {
        const v = String(value ?? "").trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          email = v;
          break;
        }
      }
    }
    if (email) out.push(name ? { email, name } : { email });
  }
  return out;
}

export function SabmailContactsClient({
  initialContacts,
}: {
  initialContacts: SabmailContactRow[];
}) {
  const { toast } = useToast();
  const [contacts, setContacts] = React.useState<SabmailContactRow[]>(initialContacts);

  // Add-contact dialog state.
  const [addOpen, setAddOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [tagsText, setTagsText] = React.useState("");
  const [addErr, setAddErr] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  // Import dialog state.
  const [importOpen, setImportOpen] = React.useState(false);
  const [pasted, setPasted] = React.useState("");
  const [importErr, setImportErr] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [picked, setPicked] = React.useState<SabFilePick | null>(null);
  const [pickedRows, setPickedRows] = React.useState<ParsedRow[] | null>(null);
  const [parsingFile, setParsingFile] = React.useState(false);

  const resetAdd = React.useCallback(() => {
    setEmail("");
    setName("");
    setTagsText("");
    setAddErr(null);
  }, []);

  const resetImport = React.useCallback(() => {
    setPasted("");
    setImportErr(null);
    setPicked(null);
    setPickedRows(null);
  }, []);

  const handleAdd = React.useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setAddErr("Email is required.");
      return;
    }
    setAdding(true);
    setAddErr(null);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await createSabmailContact({
      email: trimmed,
      name: name.trim() || undefined,
      tags: tags.length ? tags : undefined,
    });
    if (!res.ok) {
      setAddErr(res.error);
      setAdding(false);
      return;
    }
    setContacts((prev) => {
      const without = prev.filter((c) => c.id !== res.contact.id && c.email !== res.contact.email);
      return [res.contact, ...without];
    });
    toast({ title: "Contact saved" });
    setAdding(false);
    setAddOpen(false);
    resetAdd();
  }, [email, name, tagsText, toast, resetAdd]);

  // Pull the picked CSV file's text client-side and parse with papaparse.
  const handlePick = React.useCallback(
    async (pick: SabFilePick) => {
      setPicked(pick);
      setPickedRows(null);
      setImportErr(null);
      setParsingFile(true);
      try {
        const resp = await fetch(pick.url);
        if (!resp.ok) throw new Error(`Could not read the file (HTTP ${resp.status}).`);
        const text = await resp.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true }) as unknown as {
          data: Record<string, unknown>[];
        };
        const rows = rowsFromCsvObjects(result.data ?? []);
        if (rows.length === 0) {
          setImportErr("No email column found in that file. Use a CSV with an 'email' header.");
          setPickedRows([]);
        } else {
          setPickedRows(rows);
        }
      } catch (err) {
        setImportErr(err instanceof Error ? err.message : "Could not parse the file.");
        setPickedRows([]);
      } finally {
        setParsingFile(false);
      }
    },
    [],
  );

  const handleImport = React.useCallback(async () => {
    const rows = [...parsePastedEmails(pasted), ...(pickedRows ?? [])];
    if (rows.length === 0) {
      setImportErr("Paste some emails or pick a CSV file first.");
      return;
    }
    setImporting(true);
    setImportErr(null);
    const res = await importSabmailContacts(rows);
    if (!res.ok) {
      setImportErr(res.error);
      setImporting(false);
      return;
    }
    toast({
      title: `Imported ${res.imported} contact${res.imported === 1 ? "" : "s"}`,
      description: res.skipped ? `${res.skipped} row${res.skipped === 1 ? "" : "s"} skipped (invalid email).` : undefined,
    });
    setImporting(false);
    setImportOpen(false);
    resetImport();
    // Refetch is heavier than needed — fold the new rows in optimistically by
    // merging on email (server is the source of truth on next load).
    setContacts((prev) => {
      const seen = new Set(prev.map((c) => c.email));
      const now = new Date().toISOString();
      const added: SabmailContactRow[] = [];
      for (const r of rows) {
        const e = r.email.trim().toLowerCase();
        if (!e || seen.has(e) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) continue;
        seen.add(e);
        added.push({
          id: `tmp-${e}`,
          email: e,
          name: r.name?.trim() ? r.name.trim() : null,
          tags: [],
          createdAt: now,
        });
      }
      return [...added, ...prev];
    });
  }, [pasted, pickedRows, toast, resetImport]);

  const removeContact = React.useCallback(
    async (id: string) => {
      // Optimistic-temp rows (from a fresh import) have no real id yet.
      if (id.startsWith("tmp-")) {
        setContacts((prev) => prev.filter((c) => c.id !== id));
        return;
      }
      const res = await deleteSabmailContact(id);
      if (!res.ok) {
        toast({ title: "Could not remove contact", description: res.error, variant: "destructive" });
        return;
      }
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Contact removed" });
    },
    [toast],
  );

  const previewCount = parsePastedEmails(pasted).length + (pickedRows?.length ?? 0);

  return (
    <div className="sabmail-canvas relative min-h-full p-4 sm:p-6">
      <CreatingOverlay
        show={importing}
        variant="process"
        title="Importing contacts…"
        subtitle="Adding them to this workspace"
      />

      <div className="mx-auto w-full max-w-4xl">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Contacts</PageTitle>
          <PageDescription>
            Your SabMail address book for this workspace. Add people one at a
            time or import a list — they power campaigns, journeys, and quick
            sends.
          </PageDescription>
        </PageHeaderHeading>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={Upload}
            onClick={() => {
              resetImport();
              setImportOpen(true);
            }}
          >
            Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => {
              resetAdd();
              setAddOpen(true);
            }}
          >
            Add contact
          </Button>
        </div>
      </PageHeader>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>All contacts</CardTitle>
            <CardDescription>{contacts.length} total</CardDescription>
          </CardHeader>
          <CardBody>
            {contacts.length === 0 ? (
              <EmptyState
                icon={<Users aria-hidden />}
                title="No contacts yet"
                description="Add your first contact or import a CSV to build your audience."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => {
                      resetAdd();
                      setAddOpen(true);
                    }}
                  >
                    Add contact
                  </Button>
                }
              />
            ) : (
              <div className="sabmail-motion">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Email</Th>
                      <Th>Name</Th>
                      <Th>Tags</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {contacts.map((c, idx) => (
                      <Tr
                        key={c.id}
                        className="sabmail-stagger-item"
                        style={{ ["--i" as string]: idx } as React.CSSProperties}
                      >
                        <Td>
                          <span className="text-sm font-medium text-[var(--st-text)]">{c.email}</span>
                        </Td>
                        <Td>
                          <span className="text-sm text-[var(--st-text-secondary)]">{c.name ?? "—"}</span>
                        </Td>
                        <Td>
                          {c.tags.length ? (
                            <span className="flex flex-wrap gap-1">
                              {c.tags.map((t) => (
                                <Badge key={t} variant="outline">
                                  {t}
                                </Badge>
                              ))}
                            </span>
                          ) : (
                            <span className="text-sm text-[var(--st-text-secondary)]">—</span>
                          )}
                        </Td>
                        <Td align="right">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={Trash2}
                            onClick={() => void removeContact(c.id)}
                          >
                            Remove
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
      </div>

      {/* Add contact */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
            <DialogDescription>Add a single person to your address book.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field label="Email" error={addErr ?? undefined}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="person@example.com"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !adding) {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
            </Field>
            <Field label="Name (optional)">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </Field>
            <Field label="Tags (optional, comma-separated)">
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="vip, newsletter"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={adding}
              disabled={adding || !email.trim()}
              onClick={() => void handleAdd()}
            >
              Save contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import contacts</DialogTitle>
            <DialogDescription>
              Paste emails (one per line or comma-separated), pick a CSV from
              SabFiles, or both. Existing contacts are matched by email and
              updated — never duplicated.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field label="Paste emails" error={importErr ?? undefined}>
              <Textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={"jane@example.com\njohn@example.com, sam@example.com"}
                rows={5}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[var(--st-text-secondary)]">
                Or pick a CSV (needs an &ldquo;email&rdquo; column)
              </span>
              <div className="flex items-center gap-2">
                <SabFilePickerButton
                  accept="document"
                  variant="outline"
                  onPick={(pick) => void handlePick(pick)}
                >
                  Choose CSV
                </SabFilePickerButton>
                {parsingFile ? (
                  <span className="text-xs text-[var(--st-text-secondary)]">Reading file…</span>
                ) : picked ? (
                  <span className="truncate text-xs text-[var(--st-text-secondary)]">
                    {picked.name}
                    {pickedRows && pickedRows.length > 0
                      ? ` · ${pickedRows.length} row${pickedRows.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                ) : null}
              </div>
            </div>

            {previewCount > 0 ? (
              <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-xs text-[var(--st-text-secondary)]">
                Ready to import about {previewCount} contact{previewCount === 1 ? "" : "s"}.
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Upload}
              loading={importing}
              disabled={importing || parsingFile || previewCount === 0}
              onClick={() => void handleImport()}
            >
              Import {previewCount > 0 ? `(${previewCount})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
