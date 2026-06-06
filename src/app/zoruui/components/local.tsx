"use client";

import React from "react";
import { Label, Card, CardHeader, CardTitle, CardBody, DatePicker, DateRangePicker } from '@/components/sabcrm/20ui/compat';

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
      <CardHeader>
        <CardTitle>Date picker</CardTitle>
      </CardHeader>
      <CardBody>
        <DatePicker value={date} onChange={setDate} />
      </CardBody>
    </Card>
  );
}

export function DemoDateRange() {
  const [range, setRange] = React.useState<
    import("react-day-picker").DateRange | undefined
  >();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Date range picker</CardTitle>
      </CardHeader>
      <CardBody>
        <DateRangePicker value={range} onChange={setRange} numberOfMonths={1} />
      </CardBody>
    </Card>
  );
}

import { Button, Kbd, zoruToast, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from '@/components/sabcrm/20ui/compat';
import { Search, Check, Inbox, Settings, User } from "lucide-react";

export function CommandAndToastDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Search /> Open command palette
        <Kbd>⌘K</Kbd>
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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick actions">
            <CommandItem>
              <Inbox />
              Open inbox
              <CommandShortcut>⌘I</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Settings />
              Open settings
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <User />
              Switch workspace
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
