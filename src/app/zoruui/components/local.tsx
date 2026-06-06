"use client";

import React from "react";
import { Label, Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, DatePicker, ZoruDateRangePicker } from "@/components/sabcrm/20ui/zoru";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function DemoDatePicker() {
  const [date, setDate] = React.useState<Date | undefined>();
  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Date picker</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <DatePicker value={date} onChange={setDate} />
      </ZoruCardContent>
    </Card>
  );
}

export function DemoDateRange() {
  const [range, setRange] = React.useState<
    import("react-day-picker").DateRange | undefined
  >();
  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Date range picker</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <ZoruDateRangePicker value={range} onChange={setRange} numberOfMonths={1} />
      </ZoruCardContent>
    </Card>
  );
}

import {
  Button,
  ZoruKbd,
  zoruToast,
  ZoruCommandDialog,
  ZoruCommandInput,
  ZoruCommandList,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandItem,
  ZoruCommandShortcut
} from "@/components/sabcrm/20ui/zoru";
import { Search, Check, Inbox, Settings, User } from "lucide-react";

export function CommandAndToastDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Search /> Open command palette
        <ZoruKbd>⌘K</ZoruKbd>
      </Button>
      <Button
        onClick={() =>
          zoruToast({
            title: "Saved",
            description: "Your changes are live.",
          })
        }
      >
        <Check /> Toast (default)
      </Button>
      <Button
        variant="destructive"
        onClick={() =>
          zoruToast({
            variant: "destructive",
            title: "Failed to publish",
            description: "Check the workspace status and try again.",
          })
        }
      >
        Toast (destructive)
      </Button>

      <ZoruCommandDialog open={open} onOpenChange={setOpen}>
        <ZoruCommandInput placeholder="Type a command or search…" />
        <ZoruCommandList>
          <ZoruCommandEmpty>No results found.</ZoruCommandEmpty>
          <ZoruCommandGroup heading="Quick actions">
            <ZoruCommandItem>
              <Inbox />
              Open inbox
              <ZoruCommandShortcut>⌘I</ZoruCommandShortcut>
            </ZoruCommandItem>
            <ZoruCommandItem>
              <Settings />
              Open settings
              <ZoruCommandShortcut>⌘,</ZoruCommandShortcut>
            </ZoruCommandItem>
            <ZoruCommandItem>
              <User />
              Switch workspace
            </ZoruCommandItem>
          </ZoruCommandGroup>
        </ZoruCommandList>
      </ZoruCommandDialog>
    </div>
  );
}
