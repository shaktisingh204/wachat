"use client";

import React from "react";
import {
  MonitorSmartphone,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
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
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";

const TERMINALS: Array<{
  id: string;
  name: string;
  status: "Online" | "Offline";
  location: string;
  lastSync: string;
}> = [
  { id: "T-1001", name: "Main register", status: "Online", location: "Koregaon Park store", lastSync: "2 minutes ago" },
  { id: "T-1002", name: "Apparel counter", status: "Offline", location: "Koregaon Park store", lastSync: "5 hours ago" },
  { id: "T-1003", name: "Pop-up kiosk", status: "Online", location: "Phoenix Mall", lastSync: "Just now" },
];

const STAFF: Array<{ name: string; role: string; terminal: string }> = [
  { name: "Aanya Sharma", role: "Manager", terminal: "All terminals" },
  { name: "Rohan Mehta", role: "Cashier", terminal: "Main register" },
  { name: "Diego Alvarez", role: "Cashier", terminal: "Apparel counter" },
];

function statusTone(status: string): BadgeTone {
  return status === "Online" ? "success" : "neutral";
}

export default function POSPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Point of sale</PageTitle>
          <PageDescription>
            Manage in-store terminals, staff access, and receipt settings.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={RefreshCw}>
            Sync data
          </Button>
          <Button variant="primary" iconLeft={Plus}>
            Add terminal
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Connected terminals
            </CardTitle>
            <CardDescription>Active POS devices across your locations.</CardDescription>
          </CardHeader>
          <CardBody>
            <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Terminal</Th>
                    <Th>Location</Th>
                    <Th>Status</Th>
                    <Th width={64}>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {TERMINALS.map((t) => (
                    <Tr key={t.id}>
                      <Td>
                        <div className="font-medium text-[var(--st-text)]">{t.name}</div>
                        <div className="font-mono text-xs tabular-nums text-[var(--st-text-tertiary)]">
                          {t.id}
                        </div>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{t.location}</Td>
                      <Td>
                        <Badge tone={statusTone(t.status)} dot>{t.status}</Badge>
                        <div className="mt-1 text-xs text-[var(--st-text-tertiary)]">
                          Synced {t.lastSync}
                        </div>
                      </Td>
                      <Td>
                        <IconButton
                          label={`Configure ${t.name}`}
                          icon={Settings}
                          variant="ghost"
                          size="sm"
                        />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Receipt settings
            </CardTitle>
            <CardDescription>Customise printed and digital receipts.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Header text">
              <Input defaultValue="Thank you for shopping with us" />
            </Field>
            <Field label="Footer text">
              <Input defaultValue="Follow us @sabshop" />
            </Field>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm">Digital receipts</Label>
                <p className="text-xs text-[var(--st-text-secondary)]">Email and SMS prompts</p>
              </div>
              <Switch defaultChecked aria-label="Digital receipts" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm">Print barcodes</Label>
                <p className="text-xs text-[var(--st-text-secondary)]">For easy returns</p>
              </div>
              <Switch defaultChecked aria-label="Print barcodes" />
            </div>
          </CardBody>
          <CardFooter>
            <Button variant="outline" block iconLeft={Printer}>
              Preview receipt
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                Staff access
              </CardTitle>
              <CardDescription>Control who can access terminals and their permissions.</CardDescription>
            </div>
            <Button variant="outline" size="sm" iconLeft={Plus}>
              Add staff
            </Button>
          </CardHeader>
          <CardBody>
            <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Staff member</Th>
                    <Th>Role</Th>
                    <Th>Assigned terminal</Th>
                    <Th>PIN</Th>
                    <Th width={64}>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {STAFF.map((s) => (
                    <Tr key={s.name}>
                      <Td className="font-medium">{s.name}</Td>
                      <Td>
                        <Badge tone="neutral" kind="outline">{s.role}</Badge>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{s.terminal}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-2 py-1 font-mono text-sm tabular-nums">
                            ••••
                          </span>
                          <Button variant="ghost" size="sm">Reset</Button>
                        </div>
                      </Td>
                      <Td>
                        <IconButton
                          label={`Remove ${s.name}`}
                          icon={Trash2}
                          variant="ghost"
                          size="sm"
                        />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
