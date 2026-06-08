"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Briefcase,
  Search,
  MoreHorizontal,
  Edit3,
  Trash,
  Activity,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  Star,
} from "lucide-react";
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  StatCard,
  Card,
  Field,
  Input,
  SegmentedControl,
  Checkbox,
  Badge,
  Dot,
  Avatar,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  Pagination,
  type BadgeTone,
} from "@/components/sabcrm/20ui";

// Realistic mock data for Teams.
const FIRST_NAMES = [
  "Ava",
  "Liam",
  "Noah",
  "Mia",
  "Ethan",
  "Sofia",
  "Lucas",
  "Isla",
  "Aiden",
  "Maya",
  "Leo",
  "Zara",
  "Owen",
  "Nora",
  "Kai",
  "Priya",
];
const LAST_NAMES = [
  "Carter",
  "Nguyen",
  "Patel",
  "Reyes",
  "Khan",
  "Okafor",
  "Silva",
  "Hughes",
  "Mensah",
  "Lopez",
  "Walsh",
  "Tanaka",
];

const generateUsers = (count: number) => {
  const roles = ["Admin", "Manager", "Agent", "Observer"];
  const departments = [
    "Customer Support",
    "Sales",
    "Technical Support",
    "Billing",
    "Onboarding",
    "Success",
  ];
  const statuses = ["online", "offline", "busy", "away"];
  const skills = [
    "React",
    "Python",
    "Node.js",
    "Billing",
    "Escalation",
    "Spanish",
    "French",
    "German",
  ];

  return Array.from({ length: count }).map((_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    return {
      id: `usr_${(i + 1).toString(36).padStart(6, "0")}`,
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@sabdesk.example.com`,
      role: roles[i % roles.length],
      department: departments[i % departments.length],
      status: statuses[i % statuses.length],
      ticketsHandled: 120 + ((i * 137) % 4800),
      csat: (3 + ((i * 7) % 20) / 10).toFixed(1), // 3.0 to 5.0
      joinDate: new Date(2023, i % 12, ((i * 3) % 27) + 1)
        .toISOString()
        .split("T")[0],
      avatar: `https://i.pravatar.cc/150?u=${i}`,
      skills: skills.slice(i % 5, (i % 5) + ((i % 3) + 1)),
      selected: false,
    };
  });
};

const initialUsers = generateUsers(250); // Massive list

// Map a presence status to a 20ui tone so colour only ever carries meaning.
const STATUS_TONE: Record<string, BadgeTone> = {
  online: "success",
  offline: "neutral",
  busy: "danger",
  away: "warning",
};

const roleTone = (role: string): BadgeTone =>
  role === "Admin" ? "accent" : role === "Manager" ? "info" : "neutral";

export default function TeamsPage() {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectAll, setSelectAll] = useState(false);
  const [page, setPage] = useState(1);

  const departments = [
    "All",
    ...Array.from(new Set(users.map((u) => u.department))),
  ];

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (selectedDept !== "All" && u.department !== selectedDept) return false;
      if (
        searchTerm &&
        !u.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !u.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      return true;
    });
  }, [users, searchTerm, selectedDept]);

  const toggleSelect = (id: string) => {
    setUsers(
      users.map((u) => (u.id === id ? { ...u, selected: !u.selected } : u)),
    );
  };

  const toggleSelectAll = () => {
    const newState = !selectAll;
    setSelectAll(newState);
    setUsers(users.map((u) => ({ ...u, selected: newState })));
  };

  const selectedCount = users.filter((u) => u.selected).length;

  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const firstShown = filteredUsers.length === 0 ? 0 : 1;
  const lastShown = Math.min(filteredUsers.length, PAGE_SIZE);

  // Department filter is a small set of mutually-exclusive options.
  const deptItems = departments.slice(0, 4).map((d) => ({ value: d, label: d }));

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <PageHeader>
          <PageHeaderHeading>
            <div className="flex items-center gap-3 mb-1">
              <span
                className="inline-flex p-2 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                aria-hidden="true"
              >
                <Users className="w-6 h-6" />
              </span>
              <PageTitle>Team Management</PageTitle>
            </div>
            <PageDescription>
              Manage agents, roles, permissions, and department routing.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="secondary" iconLeft={Briefcase}>
              Roles &amp; Permissions
            </Button>
            <Button variant="primary" iconLeft={UserPlus}>
              Invite Team Member
            </Button>
          </PageActions>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Members" value={users.length} icon={Users} />
          <StatCard
            label="Online Now"
            value={users.filter((u) => u.status === "online").length}
            icon={Activity}
          />
          <StatCard
            label="Admins"
            value={users.filter((u) => u.role === "Admin").length}
            icon={ShieldAlert}
          />
          <StatCard label="Avg CSAT" value="4.8" icon={Star} />
          <StatCard
            label="Depts"
            value={departments.length - 1}
            icon={LayoutGrid}
          />
        </div>

        {/* Filters & Actions */}
        <Card variant="outlined" padding="sm">
          <div className="flex flex-col lg:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full lg:w-auto flex-1">
              <div className="flex-1 max-w-md">
                <Field label="Search team members" className="[&_.u-field__label]:sr-only">
                  <Input
                    type="text"
                    placeholder="Search by name, email or skill..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    iconLeft={Search}
                  />
                </Field>
              </div>
              <div className="h-8 w-px bg-[var(--st-border)] mx-2 hidden sm:block" />
              <SegmentedControl
                items={deptItems}
                value={
                  deptItems.some((d) => d.value === selectedDept)
                    ? selectedDept
                    : deptItems[0].value
                }
                onChange={setSelectedDept}
                size="sm"
                aria-label="Filter by department"
              />
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              {selectedCount > 0 && (
                <div className="flex items-center gap-2 mr-2">
                  <Badge tone="info">{selectedCount} selected</Badge>
                  <IconButton
                    label="Edit selected"
                    icon={Edit3}
                    variant="ghost"
                    size="sm"
                  />
                  <IconButton
                    label="Delete selected"
                    icon={Trash}
                    variant="danger"
                    size="sm"
                  />
                </div>
              )}
              <SegmentedControl
                items={[
                  { value: "table", label: "", icon: ListIcon },
                  { value: "grid", label: "", icon: LayoutGrid },
                ]}
                value={viewMode}
                onChange={(v) => setViewMode(v as "table" | "grid")}
                size="sm"
                aria-label="Toggle view mode"
              />
              <Button variant="secondary" size="sm" iconLeft={SlidersHorizontal}>
                Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Massive Table View */}
        {viewMode === "table" ? (
          <Card variant="outlined" padding="none">
            <div className="overflow-x-auto">
              <Table hover>
                <THead>
                  <Tr>
                    <Th width={48} align="center">
                      <Checkbox
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        aria-label="Select all team members"
                      />
                    </Th>
                    <Th>Team Member</Th>
                    <Th>Role &amp; Dept</Th>
                    <Th>Status</Th>
                    <Th>Skills</Th>
                    <Th>Performance</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filteredUsers.slice(0, PAGE_SIZE).map((user) => (
                    <Tr key={user.id} selected={user.selected}>
                      <Td align="center">
                        <Checkbox
                          checked={user.selected}
                          onChange={() => toggleSelect(user.id)}
                          aria-label={`Select ${user.name}`}
                        />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar name={user.name} src={user.avatar} size="md" />
                            <Dot
                              tone={STATUS_TONE[user.status] ?? "neutral"}
                              className="absolute bottom-0 right-0 ring-2 ring-[var(--st-bg-secondary)]"
                              aria-label={`Status: ${user.status}`}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-[var(--st-text)]">
                              {user.name}
                            </p>
                            <p className="text-xs text-[var(--st-text-tertiary)]">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1 items-start">
                          <Badge tone={roleTone(user.role)} dot={false}>
                            {user.role === "Admin" && (
                              <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                            )}
                            {user.role}
                          </Badge>
                          <span className="text-xs text-[var(--st-text-tertiary)]">
                            {user.department}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className="capitalize text-xs font-medium text-[var(--st-text-secondary)] inline-flex items-center gap-1.5">
                          <Dot tone={STATUS_TONE[user.status] ?? "neutral"} />
                          {user.status}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {user.skills.map((skill, idx) => (
                            <Badge key={idx} tone="neutral" kind="outline">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                            <Activity
                              className="w-3 h-3 text-[var(--st-text-tertiary)]"
                              aria-hidden="true"
                            />{" "}
                            {user.ticketsHandled.toLocaleString()} tickets
                          </span>
                          <span className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                            <Star
                              className="w-3 h-3 text-[var(--st-warn)]"
                              aria-hidden="true"
                            />{" "}
                            {user.csat} CSAT
                          </span>
                        </div>
                      </Td>
                      <Td align="right">
                        <IconButton
                          label={`More actions for ${user.name}`}
                          icon={MoreHorizontal}
                          variant="ghost"
                          size="sm"
                        />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
              {filteredUsers.length === 0 && (
                <EmptyState
                  icon={Users}
                  title="No team members found"
                  description="No team members match your current search and filters."
                />
              )}
            </div>

            {/* Pagination */}
            {filteredUsers.length > 0 && (
              <div className="p-4 border-t border-[var(--st-border)] flex items-center justify-between gap-4 text-sm text-[var(--st-text-secondary)]">
                <span>
                  Showing {firstShown} to {lastShown} of {filteredUsers.length}{" "}
                  entries
                </span>
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  size="compact"
                />
              </div>
            )}
          </Card>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredUsers.slice(0, 48).map((user) => (
              <Card
                key={user.id}
                variant={user.selected ? "interactive" : "outlined"}
                padding="lg"
                className="relative"
              >
                <div className="absolute top-4 right-4">
                  <Checkbox
                    checked={user.selected}
                    onChange={() => toggleSelect(user.id)}
                    aria-label={`Select ${user.name}`}
                  />
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <Avatar name={user.name} src={user.avatar} size="lg" />
                    <Dot
                      tone={STATUS_TONE[user.status] ?? "neutral"}
                      className="absolute bottom-1 right-1 ring-2 ring-[var(--st-bg-secondary)]"
                      aria-label={`Status: ${user.status}`}
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-[var(--st-text)] mb-1">
                    {user.name}
                  </h3>
                  <p className="text-sm text-[var(--st-text-tertiary)] mb-3">
                    {user.email}
                  </p>

                  <div className="flex gap-2 mb-4">
                    <Badge tone={roleTone(user.role)}>{user.role}</Badge>
                    <Badge tone="neutral" kind="outline">
                      {user.department}
                    </Badge>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2 border-t border-[var(--st-border)] pt-4 mt-2">
                    <div className="text-center">
                      <p className="text-xs text-[var(--st-text-tertiary)] mb-1">
                        Tickets
                      </p>
                      <p className="font-mono text-sm text-[var(--st-text)]">
                        {user.ticketsHandled}
                      </p>
                    </div>
                    <div className="text-center border-l border-[var(--st-border)]">
                      <p className="text-xs text-[var(--st-text-tertiary)] mb-1">
                        CSAT
                      </p>
                      <p className="font-mono text-sm text-[var(--st-warn)] flex items-center justify-center gap-1">
                        <Star className="w-3 h-3" aria-hidden="true" /> {user.csat}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
