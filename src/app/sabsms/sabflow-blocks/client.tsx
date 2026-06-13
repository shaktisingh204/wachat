"use client";

import * as React from "react";
import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsEmpty,
  type SabsmsColumn,
  type SabsmsFacet,
  useSabsmsUrlState,
} from "@/components/sabsms/page-toolkit";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Alert,
  Spinner,
} from "@/components/sabcrm/20ui";
import { Workflow, Blocks } from "lucide-react";

/** Per-action block view served by /api/sabsms/blocks (real forge registry). */
interface SabsmsBlock {
  id: string;
  blockId: string;
  actionId: string;
  name: string;
  description: string;
  type: "trigger" | "action";
  category: string;
  iconName?: string;
  fields: string[];
  outputs: string[];
}

export function SabflowBlocksClient({ workspaceId }: { workspaceId: string }) {
  void workspaceId; // block catalog is workspace-agnostic; kept for parity.
  const urlState = useSabsmsUrlState();

  const [blocks, setBlocks] = React.useState<SabsmsBlock[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = React.useState<SabsmsBlock | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/sabsms/blocks")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load blocks (${r.status})`);
        return r.json();
      })
      .then((data: { blocks?: SabsmsBlock[] }) => {
        if (!cancelled) setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load blocks");
          setBlocks([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const search = urlState.get("q")?.toLowerCase() ?? "";
  const typeFilters = urlState.getAll("type");

  const filteredBlocks = React.useMemo(() => {
    let result = blocks ?? [];
    if (search) {
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(search) ||
          b.description.toLowerCase().includes(search),
      );
    }
    if (typeFilters.length > 0) {
      result = result.filter((b) => typeFilters.includes(b.type));
    }
    return result;
  }, [blocks, search, typeFilters]);

  const columns: SabsmsColumn<SabsmsBlock>[] = [
    {
      id: "name",
      header: "Block",
      render: (b) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--st-text)]">{b.name}</span>
          <span className="text-xs text-[var(--st-text-secondary)]">{b.description}</span>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      render: (b) => (
        <Badge tone={b.type === "trigger" ? "info" : "neutral"} className="capitalize">
          {b.type}
        </Badge>
      ),
    },
    {
      id: "category",
      header: "Category",
      render: (b) => (
        <span className="text-sm text-[var(--st-text-secondary)]">{b.category}</span>
      ),
    },
    {
      id: "outputs",
      header: "Outputs",
      render: (b) => (
        <span className="text-sm text-[var(--st-text-secondary)]">
          {b.outputs.length > 0 ? b.outputs.join(", ") : "main"}
        </span>
      ),
    },
  ];

  const facets: SabsmsFacet[] = [
    {
      key: "type",
      label: "Type",
      multi: true,
      options: [
        { label: "Trigger", value: "trigger" },
        { label: "Action", value: "action" },
      ],
    },
  ];

  return (
    <SabsmsPageShell
      title="SabFlow Blocks"
      description="The SabSMS triggers and actions available in the SabFlow visual builder. These are the live forge blocks the flow engine runs."
      breadcrumbs={[{ label: "Developer", href: "/sabsms/api-docs" }, { label: "SabFlow Blocks" }]}
      helpTitle="What are SabFlow blocks?"
      helpBody="Blocks are the atomic units of SabFlow. Triggers start or branch a flow; actions perform tasks like sending an SMS or waiting for a reply. Add them to a flow from the SabFlow editor's app catalog."
      toolbar={
        <SabsmsFilterBar searchKey="q" searchPlaceholder="Search blocks..." facets={facets} />
      }
    >
      <div className="space-y-8">
        {error && (
          <Alert tone="danger" title="Couldn't load blocks">
            {error}
          </Alert>
        )}

        {blocks === null && !error ? (
          <div className="flex items-center justify-center gap-2 p-12 text-[var(--st-text-secondary)]">
            <Spinner size="sm" /> Loading blocks…
          </div>
        ) : filteredBlocks.length === 0 ? (
          <SabsmsEmpty
            icon={<Blocks className="h-6 w-6" aria-hidden="true" />}
            title="No SabSMS blocks match"
            description={
              (blocks?.length ?? 0) === 0
                ? "No SabSMS forge blocks are registered yet."
                : "Try clearing the search or type filter."
            }
          />
        ) : (
          <SabsmsDataTable
            rows={filteredBlocks}
            columns={columns}
            rowKey={(b) => b.id}
            onRowClick={setSelectedBlock}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Use these in SabFlow</CardTitle>
            <CardDescription>
              Open the SabFlow editor and drop a SabSMS block onto the canvas to wire it into a flow.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Button asChild variant="outline" iconLeft={Workflow}>
              <a href="/sabflow">Open SabFlow editor</a>
            </Button>
          </CardBody>
        </Card>
      </div>

      <SabsmsDetailDrawer
        title={selectedBlock?.name ?? ""}
        description={selectedBlock ? `Block: ${selectedBlock.blockId} · Action: ${selectedBlock.actionId}` : undefined}
        open={!!selectedBlock}
        onOpenChange={(open) => !open && setSelectedBlock(null)}
      >
        {selectedBlock && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium mb-1 text-[var(--st-text)]">Description</h4>
              <p className="text-sm text-[var(--st-text-secondary)]">{selectedBlock.description}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 text-[var(--st-text)]">Inputs</h4>
              {selectedBlock.fields.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-[var(--st-text-secondary)]">
                  {selectedBlock.fields.map((f) => (
                    <li key={f}>
                      <code className="text-xs">{f}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-[var(--st-text-secondary)]">No configurable inputs.</span>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 text-[var(--st-text)]">Outputs</h4>
              <div className="flex flex-wrap gap-2">
                {(selectedBlock.outputs.length > 0 ? selectedBlock.outputs : ["main"]).map((o) => (
                  <Badge key={o} tone="neutral" className="text-xs">
                    {o}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>
    </SabsmsPageShell>
  );
}
