"use client";

import React, { useState } from "react";
import {
  Users,
  Filter,
  Plus,
  MoreHorizontal,
  Settings,
  Trash2,
  PenTool,
  Sparkles,
  Search,
  Activity,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
  Button,
  IconButton,
  Badge,
  Field,
  Input,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from "@/components/sabcrm/20ui";

const mockSegments = [
  {
    id: "seg_1",
    name: "High Spenders",
    description: "Customers who spent more than $1000 in the last 30 days",
    customerCount: 1245,
    status: "Active",
    lastUpdated: "2 hours ago",
    rules: 2,
  },
  {
    id: "seg_2",
    name: "Churn Risk",
    description: "No purchases in 90+ days, previously active",
    customerCount: 389,
    status: "Active",
    lastUpdated: "1 day ago",
    rules: 3,
  },
  {
    id: "seg_3",
    name: "VIP Members",
    description: "Gold tier loyalty members",
    customerCount: 150,
    status: "Active",
    lastUpdated: "5 mins ago",
    rules: 1,
  },
  {
    id: "seg_4",
    name: "Holiday Shoppers",
    description: "Purchased during Black Friday / Cyber Monday",
    customerCount: 5200,
    status: "Inactive",
    lastUpdated: "2 months ago",
    rules: 4,
  },
];

export default function CustomerSegmentsPage() {
  const [search, setSearch] = useState("");

  const filteredSegments = mockSegments.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <Filter className="w-6 h-6 text-[var(--st-accent)]" aria-hidden="true" />
            Customer Segments
          </PageTitle>
          <PageDescription>
            Build dynamic segments using powerful rule criteria to target specific audiences.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Sparkles}>
            AI Generator
          </Button>
          <Button variant="primary" iconLeft={Plus}>
            Create Segment
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={Users}
          label="Total Segmented"
          value="6,984"
          accent="var(--st-accent)"
        />
        <StatCard
          icon={Activity}
          label="Active Rules"
          value="24"
          accent="var(--st-status-ok)"
        />
        <StatCard
          icon={Settings}
          label="Dynamic Updates"
          value="Real-time"
          accent="var(--st-info)"
        />
      </div>

      <Card padding="none">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--st-border)] pb-4">
          <div>
            <CardTitle>All Segments</CardTitle>
            <CardDescription>Manage and track your customer segments.</CardDescription>
          </div>
          <Field className="w-full sm:w-72">
            <Input
              iconLeft={Search}
              placeholder="Search segments..."
              aria-label="Search segments"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </CardHeader>
        <CardBody className="p-0">
          {filteredSegments.length > 0 ? (
            <Table>
              <THead>
                <Tr>
                  <Th>Segment Name</Th>
                  <Th>Description</Th>
                  <Th>Rules</Th>
                  <Th>Customers</Th>
                  <Th>Status</Th>
                  <Th>Last Updated</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filteredSegments.map((segment) => (
                  <Tr key={segment.id}>
                    <Td className="font-medium text-[var(--st-text)]">{segment.name}</Td>
                    <Td className="text-[var(--st-text-secondary)]">{segment.description}</Td>
                    <Td>
                      <Badge tone="neutral" kind="outline" className="font-mono">
                        {segment.rules} Rules
                      </Badge>
                    </Td>
                    <Td>{segment.customerCount.toLocaleString()}</Td>
                    <Td>
                      <Badge tone={segment.status === "Active" ? "success" : "neutral"} dot>
                        {segment.status}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">{segment.lastUpdated}</Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          label={`Edit ${segment.name}`}
                          icon={PenTool}
                          size="sm"
                        />
                        <IconButton
                          label={`Delete ${segment.name}`}
                          icon={Trash2}
                          variant="danger"
                          size="sm"
                        />
                        <IconButton
                          label={`More actions for ${segment.name}`}
                          icon={MoreHorizontal}
                          size="sm"
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState
              icon={Filter}
              title="No segments found"
              description={
                search
                  ? `No segments match "${search}". Try a different search term.`
                  : "Create your first segment to start targeting audiences."
              }
              action={
                <Button variant="primary" iconLeft={Plus}>
                  Create Segment
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
