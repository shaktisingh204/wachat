"use client";

import React, { useState } from "react";
import {
  Layout,
  Plus,
  Save,
  Play,
  Settings,
  Database,
  Filter,
  Grid,
  List as ListIcon,
  Share2,
  Lock,
  Unlock,
  Copy,
  Trash2,
  AlignLeft,
} from "lucide-react";
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Badge,
  Field,
  Input,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from "@/components/sabcrm/20ui";

// --- Types ---
interface ViewConfig {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdBy: string;
  count: number;
  conditions: FilterCondition[];
}

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

const FIELDS = [
  "Status",
  "Priority",
  "Assignee",
  "Requester",
  "Tags",
  "Created Date",
  "Organization",
];
const OPERATORS = [
  "is",
  "is not",
  "contains",
  "does not contain",
  "greater than",
  "less than",
  "is empty",
  "is not empty",
];

// --- Mock Data ---
const INITIAL_VIEWS: ViewConfig[] = [
  {
    id: "v1",
    name: "All Open Tickets",
    description: "Everything not resolved",
    isPublic: true,
    createdBy: "System",
    count: 1245,
    conditions: [
      { id: "c1", field: "Status", operator: "is not", value: "Closed" },
    ],
  },
  {
    id: "v2",
    name: "My Urgent Escalations",
    description: "High priority assigned to me",
    isPublic: false,
    createdBy: "Me",
    count: 12,
    conditions: [
      { id: "c1", field: "Priority", operator: "is", value: "Urgent" },
      { id: "c2", field: "Assignee", operator: "is", value: "Me" },
    ],
  },
  {
    id: "v3",
    name: "VIP Customers (SLA Warning)",
    description: "Premium tier customers nearing SLA",
    isPublic: true,
    createdBy: "Sarah K.",
    count: 4,
    conditions: [
      { id: "c1", field: "Tags", operator: "contains", value: "VIP" },
    ],
  },
  {
    id: "v4",
    name: "Unassigned Bugs",
    description: "Bug reports waiting for triage",
    isPublic: true,
    createdBy: "Dev Team",
    count: 89,
    conditions: [
      { id: "c1", field: "Assignee", operator: "is empty", value: "" },
      { id: "c2", field: "Tags", operator: "contains", value: "Bug" },
    ],
  },
];

export default function ViewsBuilderPage() {
  const { toast } = useToast();
  const [savedViews, setSavedViews] = useState<ViewConfig[]>(INITIAL_VIEWS);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Builder State
  const [isBuilding, setIsBuilding] = useState(false);
  const [builderName, setBuilderName] = useState("");
  const [builderDesc, setBuilderDesc] = useState("");
  const [builderPublic, setBuilderPublic] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: "c_init", field: "Status", operator: "is", value: "" },
  ]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: `c_${Date.now()}`, field: "Status", operator: "is", value: "" },
    ]);
  };

  const updateCondition = (
    id: string,
    key: keyof FilterCondition,
    val: string,
  ) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, [key]: val } : c)),
    );
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((c) => c.id !== id));
    }
  };

  const handleSaveView = () => {
    const newView: ViewConfig = {
      id: `v_${Date.now()}`,
      name: builderName || "Untitled View",
      description: builderDesc,
      isPublic: builderPublic,
      createdBy: "Me",
      count: Math.floor(Math.random() * 500), // mocked result count
      conditions: [...conditions],
    };
    setSavedViews([...savedViews, newView]);
    setIsBuilding(false);
    setActiveViewId(newView.id);
    toast.success(`View "${newView.name}" saved`);
  };

  const startNewBuild = () => {
    setBuilderName("");
    setBuilderDesc("");
    setBuilderPublic(false);
    setConditions([
      { id: `c_${Date.now()}`, field: "Status", operator: "is", value: "" },
    ]);
    setIsBuilding(true);
    setActiveViewId(null);
  };

  const activeView = activeViewId
    ? savedViews.find((v) => v.id === activeViewId)
    : undefined;

  const renderViewButton = (view: ViewConfig, LeadIcon: typeof AlignLeft) => {
    const isActive = activeViewId === view.id && !isBuilding;
    return (
      <Button
        key={view.id}
        variant="ghost"
        block
        onClick={() => {
          setActiveViewId(view.id);
          setIsBuilding(false);
        }}
        aria-current={isActive ? "true" : undefined}
        className={`!justify-between text-left ${
          isActive ? "bg-[var(--st-accent-soft)] text-[var(--st-accent)]" : ""
        }`}
      >
        <span className="flex items-center gap-2 truncate min-w-0">
          <LeadIcon
            className="w-4 h-4 opacity-50 shrink-0"
            aria-hidden="true"
          />
          <span className="text-sm truncate">{view.name}</span>
        </span>
        <Badge tone={isActive ? "accent" : "neutral"} kind="soft">
          {view.count}
        </Badge>
      </Button>
    );
  };

  return (
    <div className="ui20 min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] flex flex-col">
      {/* Header */}
      <PageHeader className="sticky top-0 z-20 px-6 bg-[var(--st-bg-secondary)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span
            className="p-2.5 bg-[var(--st-accent-soft)] text-[var(--st-accent)] rounded-[var(--st-radius)] border border-[var(--st-border)]"
            aria-hidden="true"
          >
            <Layout className="w-6 h-6" />
          </span>
          <PageHeaderHeading>
            <PageTitle>Custom Views</PageTitle>
            <PageDescription>
              Build, save, and share powerful custom queries
            </PageDescription>
          </PageHeaderHeading>
        </div>

        {!isBuilding && (
          <PageActions>
            <Button variant="primary" iconLeft={Plus} onClick={startNewBuild}>
              Create New View
            </Button>
          </PageActions>
        )}
      </PageHeader>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Saved Views List */}
        <div className="w-64 border-r border-[var(--st-border)] bg-[var(--st-bg)] flex flex-col shrink-0">
          <div className="p-4 border-b border-[var(--st-border)] font-medium text-sm text-[var(--st-text)] flex items-center gap-2">
            <Database
              className="w-4 h-4 text-[var(--st-text-tertiary)]"
              aria-hidden="true"
            />
            Saved Views Library
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <p className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 mt-2 px-2">
              Your Views
            </p>
            {savedViews
              .filter((v) => v.createdBy === "Me")
              .map((view) => renderViewButton(view, AlignLeft))}

            <p className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 mt-6 px-2">
              Shared Views
            </p>
            {savedViews
              .filter((v) => v.createdBy !== "Me")
              .map((view) => renderViewButton(view, Share2))}
          </div>
        </div>

        {/* Main Area: Builder or Viewer */}
        <div className="flex-1 bg-[var(--st-bg)] flex flex-col relative overflow-hidden">
          {isBuilding ? (
            // --- BUILDER MODE ---
            <div className="flex-1 flex flex-col h-full overflow-y-auto">
              <div className="max-w-4xl w-full mx-auto p-8 flex flex-col gap-8">
                {/* Meta details */}
                <Card variant="outlined" padding="lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings
                        className="w-5 h-5 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      View Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4 max-w-xl">
                      <Field label="View Name">
                        <Input
                          value={builderName}
                          onChange={(e) => setBuilderName(e.target.value)}
                          placeholder="e.g., Unassigned High Priority Bugs"
                        />
                      </Field>
                      <Field label="Description (Optional)">
                        <Input
                          value={builderDesc}
                          onChange={(e) => setBuilderDesc(e.target.value)}
                          placeholder="What does this view filter?"
                        />
                      </Field>
                      <Switch
                        checked={builderPublic}
                        onCheckedChange={setBuilderPublic}
                        label={
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-[var(--st-text)]">
                              Public View
                            </span>
                            <span className="text-xs text-[var(--st-text-tertiary)]">
                              Allow other agents to see and use this view
                            </span>
                          </span>
                        }
                      />
                    </div>
                  </CardBody>
                </Card>

                {/* Query Builder */}
                <Card variant="outlined" padding="lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Filter
                        className="w-5 h-5 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      Query Conditions
                    </CardTitle>
                    <CardDescription>
                      Define the rules that tickets must match to appear in this
                      view. Tickets must match ALL conditions.
                    </CardDescription>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-3 mb-6 bg-[var(--st-bg)] p-4 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                      {conditions.map((cond, index) => (
                        <div
                          key={cond.id}
                          className="flex flex-col sm:flex-row gap-3 items-center group relative"
                        >
                          {index > 0 && (
                            <span className="text-xs font-bold text-[var(--st-text-tertiary)] uppercase absolute -left-10 top-3">
                              AND
                            </span>
                          )}

                          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Select
                              value={cond.field}
                              onValueChange={(val) =>
                                updateCondition(cond.id, "field", val)
                              }
                            >
                              <SelectTrigger aria-label="Field">
                                <SelectValue placeholder="Field" />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELDS.map((f) => (
                                  <SelectItem key={f} value={f}>
                                    {f}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={cond.operator}
                              onValueChange={(val) =>
                                updateCondition(cond.id, "operator", val)
                              }
                            >
                              <SelectTrigger aria-label="Operator">
                                <SelectValue placeholder="Operator" />
                              </SelectTrigger>
                              <SelectContent>
                                {OPERATORS.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Input
                              aria-label="Value"
                              value={cond.value}
                              onChange={(e) =>
                                updateCondition(
                                  cond.id,
                                  "value",
                                  e.target.value,
                                )
                              }
                              placeholder="Value..."
                              disabled={cond.operator.includes("empty")}
                            />
                          </div>

                          <IconButton
                            label="Remove condition"
                            icon={Trash2}
                            variant="ghost"
                            onClick={() => removeCondition(cond.id)}
                            disabled={conditions.length === 1}
                          />
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="secondary"
                      iconLeft={Plus}
                      onClick={addCondition}
                    >
                      Add Condition
                    </Button>
                  </CardBody>
                </Card>

                {/* Action Bar */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--st-border)]">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsBuilding(false);
                      if (savedViews.length > 0)
                        setActiveViewId(savedViews[0].id);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="secondary" iconLeft={Play}>
                    Preview Results
                  </Button>
                  <Button
                    variant="primary"
                    iconLeft={Save}
                    onClick={handleSaveView}
                  >
                    Save View
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // --- VIEWER MODE ---
            <div className="flex-1 flex flex-col h-full bg-[var(--st-bg-secondary)]">
              {activeView ? (
                <>
                  <div className="p-6 border-b border-[var(--st-border)] bg-[var(--st-bg)] flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-semibold text-[var(--st-text)]">
                          {activeView.name}
                        </h2>
                        {activeView.isPublic ? (
                          <Badge tone="neutral" kind="outline">
                            <Unlock
                              className="w-3 h-3"
                              aria-hidden="true"
                            />{" "}
                            Public
                          </Badge>
                        ) : (
                          <Badge tone="accent" kind="soft">
                            <Lock className="w-3 h-3" aria-hidden="true" />{" "}
                            Private
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-[var(--st-text-secondary)] mb-4">
                        {activeView.description}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {activeView.conditions.map((c) => (
                          <span
                            key={c.id}
                            className="flex items-center text-xs bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden"
                          >
                            <span className="px-2 py-1 text-[var(--st-text-secondary)] border-r border-[var(--st-border)]">
                              {c.field}
                            </span>
                            <span className="px-2 py-1 text-[var(--st-text-tertiary)] bg-[var(--st-bg-secondary)] font-mono">
                              {c.operator}
                            </span>
                            {c.value && (
                              <span className="px-2 py-1 text-[var(--st-accent)] font-medium bg-[var(--st-accent-soft)]">
                                {c.value}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <IconButton
                        label="Duplicate view"
                        icon={Copy}
                        variant="outline"
                      />
                      <IconButton
                        label="View settings"
                        icon={Settings}
                        variant="outline"
                      />
                    </div>
                  </div>

                  {/* Mock Table Results */}
                  <div className="flex-1 overflow-auto p-6">
                    <Card variant="outlined" padding="none">
                      <div className="px-4 py-3 border-b border-[var(--st-border)] flex items-center justify-between bg-[var(--st-bg-secondary)]">
                        <span className="text-sm font-medium text-[var(--st-text)]">
                          {activeView.count} matching results
                        </span>
                        <div className="flex gap-2">
                          <IconButton
                            label="List view"
                            icon={ListIcon}
                            variant="ghost"
                            size="sm"
                          />
                          <IconButton
                            label="Grid view"
                            icon={Grid}
                            variant="ghost"
                            size="sm"
                          />
                        </div>
                      </div>
                      <Table hover>
                        <THead>
                          <Tr>
                            <Th>ID</Th>
                            <Th>Subject</Th>
                            <Th>Status</Th>
                            <Th>Priority</Th>
                            <Th>Assignee</Th>
                          </Tr>
                        </THead>
                        <TBody>
                          {Array.from({ length: 15 }).map((_, i) => (
                            <Tr key={i}>
                              <Td>
                                <span className="font-mono text-[var(--st-text-tertiary)]">
                                  TIC-{3000 + i}
                                </span>
                              </Td>
                              <Td>Placeholder matched ticket title {i}</Td>
                              <Td>
                                <Badge tone="info" kind="soft">
                                  Open
                                </Badge>
                              </Td>
                              <Td>
                                <span className="text-[var(--st-text-secondary)]">
                                  Normal
                                </span>
                              </Td>
                              <Td>
                                <span className="text-[var(--st-text-secondary)]">
                                  System
                                </span>
                              </Td>
                            </Tr>
                          ))}
                        </TBody>
                      </Table>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState
                    icon={Database}
                    title="Select a View"
                    description="Choose a saved view from the sidebar or create a new one."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
