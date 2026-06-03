"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  UserMinus,
  Shield,
  ShieldAlert,
  Award,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Search,
  Filter,
  MoreHorizontal,
  ChevronDown,
  CheckSquare,
  Square,
  Check,
  X,
  Edit3,
  Trash,
  Activity,
  Clock,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  Star,
} from "lucide-react";

// Massive Mock Data for Teams
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

  return Array.from({ length: count }).map((_, i) => ({
    id: `usr_${Math.random().toString(36).substr(2, 9)}`,
    name: `User ${i + 1} ${Math.random().toString(36).substr(2, 4)}`,
    email: `user${i + 1}@sabdesk.example.com`,
    role: roles[Math.floor(Math.random() * roles.length)],
    department: departments[Math.floor(Math.random() * departments.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    ticketsHandled: Math.floor(Math.random() * 5000),
    csat: (Math.random() * 2 + 3).toFixed(1), // 3.0 to 5.0
    joinDate: new Date(Date.now() - Math.random() * 100000000000)
      .toISOString()
      .split("T")[0],
    avatar: `https://i.pravatar.cc/150?u=${i}`,
    skills: skills
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 4) + 1),
    selected: false,
  }));
};

const initialUsers = generateUsers(250); // Massive list

export default function TeamsPage() {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectAll, setSelectAll] = useState(false);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-gray-500";
      case "busy":
        return "bg-red-500";
      case "away":
        return "bg-amber-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 p-6 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Team Management
              </h1>
            </div>
            <p className="text-neutral-400">
              Manage agents, roles, permissions, and department routing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm font-medium transition-all">
              <Briefcase className="w-4 h-4" /> Roles & Permissions
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all">
              <UserPlus className="w-4 h-4" /> Invite Team Member
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              label: "Total Members",
              value: users.length,
              icon: Users,
              color: "text-blue-400",
            },
            {
              label: "Online Now",
              value: users.filter((u) => u.status === "online").length,
              icon: Activity,
              color: "text-green-400",
            },
            {
              label: "Admins",
              value: users.filter((u) => u.role === "Admin").length,
              icon: ShieldAlert,
              color: "text-purple-400",
            },
            {
              label: "Avg CSAT",
              value: "4.8",
              icon: Star,
              color: "text-yellow-400",
            },
            {
              label: "Depts",
              value: departments.length - 1,
              icon: LayoutGrid,
              color: "text-pink-400",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between group hover:border-neutral-700 transition-colors"
            >
              <div>
                <p className="text-neutral-400 text-sm font-medium mb-1">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
              <div
                className={`p-3 rounded-lg bg-neutral-950 border border-neutral-800 ${stat.color} group-hover:scale-110 transition-transform`}
              >
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-col lg:flex-row justify-between gap-4 items-center bg-neutral-900 border border-neutral-800 p-3 rounded-xl">
          <div className="flex items-center gap-3 w-full lg:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by name, email or skill..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="h-8 w-px bg-neutral-800 mx-2 hidden sm:block"></div>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {departments.slice(0, 4).map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${selectedDept === dept ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}`}
                >
                  {dept}
                </button>
              ))}
              {departments.length > 4 && (
                <button className="px-3 py-1.5 rounded-md text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 flex items-center gap-1">
                  More <ChevronDown className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 mr-2 animate-in fade-in zoom-in duration-200">
                <span className="text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                  {selectedCount} selected
                </span>
                <button
                  className="p-2 hover:bg-neutral-800 text-neutral-400 rounded-lg"
                  title="Edit selected"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg"
                  title="Delete selected"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm hover:bg-neutral-800 transition-colors">
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </button>
          </div>
        </div>

        {/* Massive Table View */}
        {viewMode === "table" ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-950/50 border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="p-4 w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="text-neutral-400 hover:text-white"
                      >
                        {selectAll ? (
                          <CheckSquare className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-4 font-medium">Team Member</th>
                    <th className="p-4 font-medium">Role & Dept</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Skills</th>
                    <th className="p-4 font-medium">Performance</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className={`hover:bg-neutral-800/30 transition-colors ${user.selected ? "bg-blue-500/5" : ""}`}
                    >
                      <td className="p-4">
                        <button
                          onClick={() => toggleSelect(user.id)}
                          className="text-neutral-500 hover:text-white"
                        >
                          {user.selected ? (
                            <CheckSquare className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-10 h-10 rounded-full border border-neutral-700 object-cover"
                            />
                            <div
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 ${getStatusColor(user.status)}`}
                            ></div>
                          </div>
                          <div>
                            <p className="font-medium text-neutral-200">
                              {user.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-xs font-medium border ${
                              user.role === "Admin"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : user.role === "Manager"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  : "bg-neutral-800 text-neutral-300 border-neutral-700"
                            }`}
                          >
                            {user.role === "Admin" && (
                              <Shield className="w-3 h-3 mr-1" />
                            )}
                            {user.role}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {user.department}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="capitalize text-xs font-medium text-neutral-400 flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${getStatusColor(user.status)}`}
                          ></span>
                          {user.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {user.skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 bg-neutral-950 border border-neutral-800 rounded text-neutral-400"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs text-neutral-400">
                            <Activity className="w-3 h-3 text-neutral-500" />{" "}
                            {user.ticketsHandled.toLocaleString()} tickets
                          </div>
                          <div className="flex items-center gap-2 text-xs text-neutral-400">
                            <Star className="w-3 h-3 text-yellow-500" />{" "}
                            {user.csat} CSAT
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-neutral-500">
                  No team members found matching your criteria.
                </div>
              )}
            </div>

            {/* Pagination Mock */}
            <div className="p-4 border-t border-neutral-800 flex items-center justify-between text-sm text-neutral-400 bg-neutral-900/50">
              <div>
                Showing 1 to {Math.min(filteredUsers.length, 50)} of{" "}
                {filteredUsers.length} entries
              </div>
              <div className="flex gap-1">
                <button
                  className="px-3 py-1 border border-neutral-800 rounded bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50"
                  disabled
                >
                  Prev
                </button>
                <button className="px-3 py-1 border border-blue-500/50 rounded bg-blue-500/10 text-blue-400">
                  1
                </button>
                <button className="px-3 py-1 border border-neutral-800 rounded bg-neutral-950 hover:bg-neutral-800">
                  2
                </button>
                <button className="px-3 py-1 border border-neutral-800 rounded bg-neutral-950 hover:bg-neutral-800">
                  3
                </button>
                <span className="px-2 py-1">...</span>
                <button className="px-3 py-1 border border-neutral-800 rounded bg-neutral-950 hover:bg-neutral-800">
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Grid View Mock */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredUsers.slice(0, 48).map((user) => (
              <div
                key={user.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-all relative group"
              >
                {user.selected && (
                  <div className="absolute inset-0 border-2 border-blue-500 rounded-xl pointer-events-none z-10" />
                )}

                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => toggleSelect(user.id)}
                    className={`p-1 rounded ${user.selected ? "text-blue-500 bg-blue-500/10" : "text-neutral-600 hover:text-neutral-400"}`}
                  >
                    {user.selected ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-20 h-20 rounded-full border-4 border-neutral-950 object-cover shadow-lg"
                    />
                    <div
                      className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-neutral-900 ${getStatusColor(user.status)}`}
                    ></div>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-1">
                    {user.name}
                  </h3>
                  <p className="text-sm text-neutral-500 mb-3">{user.email}</p>

                  <div className="flex gap-2 mb-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${user.role === "Admin" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-neutral-800 text-neutral-300 border-neutral-700"}`}
                    >
                      {user.role}
                    </span>
                    <span className="px-2 py-1 rounded text-xs text-neutral-400 bg-neutral-950 border border-neutral-800">
                      {user.department}
                    </span>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2 border-t border-neutral-800 pt-4 mt-2">
                    <div className="text-center">
                      <p className="text-xs text-neutral-500 mb-1">Tickets</p>
                      <p className="font-mono text-sm text-neutral-200">
                        {user.ticketsHandled}
                      </p>
                    </div>
                    <div className="text-center border-l border-neutral-800">
                      <p className="text-xs text-neutral-500 mb-1">CSAT</p>
                      <p className="font-mono text-sm text-yellow-400 flex items-center justify-center gap-1">
                        <Star className="w-3 h-3" /> {user.csat}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
