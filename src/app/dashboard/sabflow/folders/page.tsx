"use client";

import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Activity,
  Clock,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Card,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Badge,
  Button,
  IconButton,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from "@/components/sabcrm/20ui";

type FolderNode = {
  id: string;
  name: string;
  color: string;
  flowsCount: number;
  lastUpdated: string;
  children?: FolderNode[];
};

const mockFolders: FolderNode[] = [
  {
    id: "f1",
    name: "Customer Onboarding",
    color: "#f59e0b",
    flowsCount: 12,
    lastUpdated: "2 hours ago",
    children: [
      {
        id: "f1-1",
        name: "Welcome Emails",
        color: "#f59e0b",
        flowsCount: 3,
        lastUpdated: "1 day ago",
      },
      {
        id: "f1-2",
        name: "Trial Conversion",
        color: "#f59e0b",
        flowsCount: 5,
        lastUpdated: "3 hours ago",
      },
    ],
  },
  {
    id: "f2",
    name: "Internal Operations",
    color: "#3b82f6",
    flowsCount: 8,
    lastUpdated: "5 hours ago",
    children: [
      {
        id: "f2-1",
        name: "HR Automations",
        color: "#3b82f6",
        flowsCount: 4,
        lastUpdated: "2 days ago",
        children: [
          {
            id: "f2-1-1",
            name: "PTO Approvals",
            color: "#3b82f6",
            flowsCount: 2,
            lastUpdated: "4 days ago",
          },
        ],
      },
      {
        id: "f2-2",
        name: "IT Tickets",
        color: "#3b82f6",
        flowsCount: 4,
        lastUpdated: "5 hours ago",
      },
    ],
  },
  {
    id: "f3",
    name: "Marketing Campaigns",
    color: "#10b981",
    flowsCount: 24,
    lastUpdated: "1 hour ago",
  },
  {
    id: "f4",
    name: "E-commerce Sync",
    color: "#8b5cf6",
    flowsCount: 7,
    lastUpdated: "12 mins ago",
  },
];

export default function FoldersPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    f1: true,
    f2: true,
    "f2-1": false,
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderFolderRows = (nodes: FolderNode[], level = 0): React.ReactNode[] => {
    let rows: React.ReactNode[] = [];

    nodes.forEach((node) => {
      const isExpanded = expanded[node.id];
      const hasChildren = node.children && node.children.length > 0;

      rows.push(
        <Tr key={node.id} className="group">
          <Td className="w-[300px]">
            <div
              className="flex items-center gap-2"
              style={{ paddingLeft: `${level * 24}px` }}
            >
              <IconButton
                label={isExpanded ? "Collapse folder" : "Expand folder"}
                icon={isExpanded ? ChevronDown : ChevronRight}
                size="sm"
                onClick={() => toggleExpand(node.id)}
                className={cn(!hasChildren && "invisible")}
              />

              <div
                className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] shrink-0"
                style={{ backgroundColor: `${node.color}1a`, color: node.color }}
                aria-hidden="true"
              >
                {isExpanded && hasChildren ? (
                  <FolderOpen className="h-4 w-4" />
                ) : (
                  <Folder className="h-4 w-4" />
                )}
              </div>
              <span className="font-medium truncate text-[14px] text-[var(--st-text)]">
                {node.name}
              </span>
            </div>
          </Td>
          <Td>
            <Badge variant="secondary" className="font-normal text-[12px]">
              {node.flowsCount} {node.flowsCount === 1 ? "flow" : "flows"}
            </Badge>
          </Td>
          <Td className="text-[var(--st-text-secondary)] text-[13px]">
            {node.lastUpdated}
          </Td>
          <Td align="right">
            <IconButton label="Folder settings" icon={Settings} size="sm" />
          </Td>
        </Tr>,
      );

      if (isExpanded && hasChildren) {
        rows = rows.concat(renderFolderRows(node.children!, level + 1));
      }
    });

    return rows;
  };

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full h-full">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Folders and Organization</PageTitle>
          <PageDescription>
            Manage your SabFlow automations with nested folders and tags.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={FolderOpen}>
            Expand All
          </Button>
          <Button variant="primary" iconLeft={Plus}>
            New Folder
          </Button>
        </PageActions>
      </PageHeader>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Folders"
          value="14"
          icon={Folder}
          delta={{ value: "+2 from last month", tone: "up" }}
        />
        <StatCard
          label="Active Flows"
          value="51"
          icon={Activity}
          delta={{ value: "Across 4 root folders", tone: "neutral" }}
        />
        <StatCard
          label="Storage Used"
          value="1.2 GB"
          icon={HardDrive}
          delta={{ value: "Of 10 GB limit", tone: "neutral" }}
        />
        <StatCard
          label="Recent Activity"
          value="12 mins"
          icon={Clock}
          delta={{ value: "Last flow update", tone: "neutral" }}
        />
      </div>

      {/* Main Data Section */}
      <Card padding="none" className="flex flex-col">
        <div className="p-4 border-b border-[var(--st-border)] flex flex-col sm:flex-row justify-between items-center gap-4 bg-[var(--st-bg-muted)]">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search folders..."
              aria-label="Search folders"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              iconLeft={Search}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 text-xs">
              Sort by: Last Updated
            </Badge>
          </div>
        </div>

        <Table>
          <THead>
            <Tr>
              <Th width={300}>Folder Name</Th>
              <Th>Contents</Th>
              <Th>Last Updated</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>{renderFolderRows(mockFolders)}</TBody>
        </Table>
      </Card>
    </div>
  );
}
