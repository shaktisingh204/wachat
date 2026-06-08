"use client";

import React, { useMemo, useState } from "react";
import {
  Building2,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  FileText,
  Percent,
  Search,
  Settings2,
} from "lucide-react";
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  IconButton,
  Input,
  Label,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";

const COMPANIES: Array<{
  id: string;
  name: string;
  tier: string;
  status: "Approved" | "Pending";
  netTerms: string;
  creditLimit: string;
}> = [
  { id: "COMP-001", name: "Northwind Trading", tier: "Gold partner", status: "Approved", netTerms: "Net 30", creditLimit: "₹50,00,000" },
  { id: "COMP-002", name: "Atlas Robotics", tier: "Silver partner", status: "Pending", netTerms: "None", creditLimit: "₹0" },
  { id: "COMP-003", name: "Lumen Retail", tier: "Standard", status: "Approved", netTerms: "Net 15", creditLimit: "₹10,00,000" },
];

const PRICE_LISTS: Array<{
  name: string;
  discount: string;
  companiesCount: number;
  lastUpdated: string;
}> = [
  { name: "Wholesale tier 1", discount: "20% off retail", companiesCount: 45, lastUpdated: "2 days ago" },
  { name: "Distributor premium", discount: "Custom fixed prices", companiesCount: 12, lastUpdated: "1 week ago" },
  { name: "Volume movers", discount: "Tiered by quantity", companiesCount: 8, lastUpdated: "1 month ago" },
];

function statusTone(status: string): BadgeTone {
  return status === "Approved" ? "success" : "warning";
}

export default function B2BPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      COMPANIES.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>B2B wholesale</PageTitle>
          <PageDescription>
            Manage company accounts, custom price lists, and net payment terms.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Download}>
            Export
          </Button>
          <Button variant="primary" iconLeft={Building2}>
            Invite company
          </Button>
        </PageActions>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Company accounts
            </CardTitle>
            <CardDescription>Review and approve incoming wholesale applications.</CardDescription>
          </div>
          <Field label="Search companies" className="w-full sm:w-64">
            <Input
              iconLeft={Search}
              placeholder="Search companies"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
        </CardHeader>
        <CardBody>
          <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <Table hover>
              <THead>
                <Tr>
                  <Th>Company</Th>
                  <Th>Tier</Th>
                  <Th>Status</Th>
                  <Th>Net terms</Th>
                  <Th align="right">Credit limit</Th>
                  <Th width={96}>
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <div className="font-medium text-[var(--st-text)]">{c.name}</div>
                      <div className="text-xs tabular-nums text-[var(--st-text-tertiary)]">{c.id}</div>
                    </Td>
                    <Td>
                      <Badge tone="accent" kind="outline">{c.tier}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={statusTone(c.status)} dot>
                        {c.status === "Approved" ? (
                          <CheckCircle className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Clock className="h-3 w-3" aria-hidden="true" />
                        )}
                        {c.status === "Approved" ? "Approved" : "Pending review"}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">{c.netTerms}</Td>
                    <Td align="right" className="font-medium tabular-nums">{c.creditLimit}</Td>
                    <Td align="right">
                      <Button variant="ghost" size="sm">Manage</Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                Price lists
              </CardTitle>
              <CardDescription>Custom pricing rules assigned to specific buyer groups.</CardDescription>
            </div>
            <Button variant="outline" size="sm">Create new</Button>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {PRICE_LISTS.map((pl) => (
                <li
                  key={pl.name}
                  className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4 transition-colors hover:bg-[var(--st-hover)]"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                      aria-hidden="true"
                    >
                      <Percent className="h-5 w-5" />
                    </span>
                    <div>
                      <h4 className="font-medium text-[var(--st-text)]">{pl.name}</h4>
                      <p className="text-sm text-[var(--st-text-secondary)]">
                        {pl.discount} &middot; <span className="tabular-nums">{pl.companiesCount}</span> companies
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="hidden text-xs text-[var(--st-text-secondary)] sm:inline-block">
                      Updated {pl.lastUpdated}
                    </span>
                    <IconButton label={`Configure ${pl.name}`} icon={Settings2} variant="ghost" size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Global settings
            </CardTitle>
            <CardDescription>Store-wide B2B preferences.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm">Enable net terms</Label>
                <p className="text-xs text-[var(--st-text-secondary)]">Allow delayed payments</p>
              </div>
              <Switch defaultChecked aria-label="Enable net terms" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm">Auto-approve accounts</Label>
                <p className="text-xs text-[var(--st-text-secondary)]">Skip manual review</p>
              </div>
              <Switch aria-label="Auto-approve accounts" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm">Tax exemption</Label>
                <p className="text-xs text-[var(--st-text-secondary)]">Allow tax ID uploads</p>
              </div>
              <Switch defaultChecked aria-label="Tax exemption" />
            </div>
            <Separator />
            <Field label="Default price list for new accounts">
              <Select defaultValue="standard">
                <SelectTrigger aria-label="Default price list">
                  <SelectValue placeholder="Select price list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard retail (no discount)</SelectItem>
                  <SelectItem value="tier1">Wholesale tier 1</SelectItem>
                  <SelectItem value="distributor">Distributor premium</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
