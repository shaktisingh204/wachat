"use client";

import React, { useState } from "react";
import {
  Settings,
  User,
  Shield,
  Bell,
  Key,
  CreditCard,
  Palette,
  Globe,
  Zap,
  Database,
  Smartphone,
  Webhook,
  Save,
  ChevronRight,
  ToggleRight,
  ToggleLeft,
  AlertTriangle,
  Lock,
  HardDrive,
  RefreshCw,
} from "lucide-react";

// Massive Configuration Data Structure
const settingsStructure = [
  {
    id: "general",
    title: "General Settings",
    icon: Settings,
    sections: [
      {
        title: "Workspace Identity",
        description: "Manage your company brand and fundamental details.",
        fields: [
          {
            id: "ws_name",
            type: "text",
            label: "Workspace Name",
            value: "SabDesk Global Inc.",
          },
          {
            id: "ws_url",
            type: "text",
            label: "Workspace URL",
            value: "global.sabdesk.com",
            disabled: true,
          },
          { id: "ws_logo", type: "file", label: "Company Logo" },
          {
            id: "ws_timezone",
            type: "select",
            label: "Default Timezone",
            value: "UTC-5 (Eastern Time)",
            options: ["UTC", "UTC-5", "UTC+1", "UTC+5:30"],
          },
        ],
      },
      {
        title: "Localization",
        description: "Language and regional formatting.",
        fields: [
          {
            id: "loc_lang",
            type: "select",
            label: "Primary Language",
            value: "English (US)",
            options: ["English (US)", "Spanish", "French", "German"],
          },
          {
            id: "loc_date",
            type: "select",
            label: "Date Format",
            value: "MM/DD/YYYY",
            options: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
          },
          {
            id: "loc_time",
            type: "select",
            label: "Time Format",
            value: "12-hour (AM/PM)",
            options: ["12-hour (AM/PM)", "24-hour"],
          },
        ],
      },
    ],
  },
  {
    id: "security",
    title: "Security & Privacy",
    icon: Shield,
    sections: [
      {
        title: "Authentication",
        description: "Configure how users log into the system.",
        fields: [
          {
            id: "sec_2fa",
            type: "toggle",
            label: "Require Two-Factor Authentication (2FA) for all users",
            value: true,
          },
          {
            id: "sec_sso",
            type: "toggle",
            label: "Enable SAML Single Sign-On (SSO)",
            value: false,
          },
          {
            id: "sec_session",
            type: "select",
            label: "Session Timeout",
            value: "4 hours",
            options: ["1 hour", "4 hours", "12 hours", "24 hours", "Never"],
          },
        ],
      },
      {
        title: "Password Policy",
        description: "Enforce strict rules for user passwords.",
        fields: [
          {
            id: "pass_length",
            type: "number",
            label: "Minimum Password Length",
            value: "12",
          },
          {
            id: "pass_complex",
            type: "toggle",
            label: "Require Special Characters & Numbers",
            value: true,
          },
          {
            id: "pass_expiry",
            type: "select",
            label: "Password Expiration",
            value: "90 days",
            options: ["30 days", "60 days", "90 days", "Never"],
          },
        ],
      },
      {
        title: "IP Restrictions",
        description: "Limit access to specific IP ranges.",
        fields: [
          {
            id: "ip_restrict",
            type: "toggle",
            label: "Enable IP Allowlisting",
            value: false,
          },
          {
            id: "ip_list",
            type: "textarea",
            label: "Allowed IP Addresses (CIDR format)",
            value: "192.168.1.0/24\n10.0.0.0/8",
          },
        ],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    sections: [
      {
        title: "Email Alerts",
        description: "Control which events trigger email notifications.",
        fields: [
          {
            id: "notif_new_ticket",
            type: "toggle",
            label: "New Ticket Created",
            value: true,
          },
          {
            id: "notif_ticket_assigned",
            type: "toggle",
            label: "Ticket Assigned to Me",
            value: true,
          },
          {
            id: "notif_sla_breach",
            type: "toggle",
            label: "SLA Breach Warnings",
            value: true,
          },
          {
            id: "notif_mention",
            type: "toggle",
            label: "When mentioned in a note",
            value: true,
          },
          {
            id: "notif_digest",
            type: "select",
            label: "Daily Digest",
            value: "Morning",
            options: ["Morning", "Evening", "Disabled"],
          },
        ],
      },
      {
        title: "Push & Desktop",
        description: "In-app and browser notification preferences.",
        fields: [
          {
            id: "push_sound",
            type: "toggle",
            label: "Play sound on new message",
            value: true,
          },
          {
            id: "push_desktop",
            type: "toggle",
            label: "Enable Browser Push Notifications",
            value: false,
          },
        ],
      },
    ],
  },
  {
    id: "api",
    title: "API & Webhooks",
    icon: Webhook,
    sections: [
      {
        title: "API Keys",
        description: "Manage programmatic access to your workspace.",
        fields: [
          {
            id: "api_key_v1",
            type: "readonly",
            label: "Production API Key",
            value: "sk_live_9x8c7v6b5n4m3m2l1k",
          },
          {
            id: "api_key_test",
            type: "readonly",
            label: "Test API Key",
            value: "sk_test_1q2w3e4r5t6y7u8i9o",
          },
        ],
      },
      {
        title: "Rate Limiting",
        description: "API usage constraints.",
        fields: [
          {
            id: "api_limit",
            type: "select",
            label: "Max Requests / Minute",
            value: "1000",
            options: ["100", "500", "1000", "5000"],
          },
        ],
      },
    ],
  },
  {
    id: "appearance",
    title: "Appearance",
    icon: Palette,
    sections: [
      {
        title: "Theme Preferences",
        description: "Customize the look and feel of the agent dashboard.",
        fields: [
          {
            id: "theme_mode",
            type: "select",
            label: "Color Theme",
            value: "Dark (System Default)",
            options: ["Light", "Dark", "System Match"],
          },
          {
            id: "theme_accent",
            type: "select",
            label: "Accent Color",
            value: "Blue",
            options: ["Blue", "Purple", "Green", "Orange"],
          },
          {
            id: "theme_compact",
            type: "toggle",
            label: "Compact Table View",
            value: false,
          },
        ],
      },
    ],
  },
  {
    id: "data",
    title: "Data Management",
    icon: Database,
    sections: [
      {
        title: "Data Retention & Deletion",
        description: "Control how long data is stored on our servers.",
        fields: [
          {
            id: "data_ticket_retention",
            type: "select",
            label: "Ticket History Retention",
            value: "Forever",
            options: ["30 Days", "1 Year", "3 Years", "Forever"],
          },
          {
            id: "data_attachment_retention",
            type: "select",
            label: "Attachment Retention",
            value: "1 Year",
            options: ["30 Days", "6 Months", "1 Year", "Forever"],
          },
          {
            id: "data_auto_delete",
            type: "toggle",
            label: "Automatically delete closed spam tickets",
            value: true,
          },
        ],
      },
      {
        title: "Export & Backup",
        description: "Download copies of your workspace data.",
        fields: [
          {
            id: "data_export_freq",
            type: "select",
            label: "Automated Backup Frequency",
            value: "Weekly",
            options: ["Daily", "Weekly", "Monthly", "Disabled"],
          },
        ],
      },
    ],
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize state
  React.useEffect(() => {
    const initialState: Record<string, any> = {};
    settingsStructure.forEach((tab) => {
      tab.sections.forEach((sec) => {
        sec.fields.forEach((f) => {
          initialState[f.id] = f.value;
        });
      });
    });
    setFormState(initialState);
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      // In a real app, show a toast here
    }, 1000);
  };

  const activeCategory = settingsStructure.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 font-sans p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Workspace Settings
            </h1>
            <p className="text-neutral-400">
              Manage your account, security, preferences, and integrations.
            </p>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${isSaving ? "bg-neutral-800 text-neutral-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"}`}
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Navigation Sidebar */}
          <aside className="w-full lg:w-64 flex-none space-y-1">
            {settingsStructure.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200 border border-transparent"}`}
              >
                <tab.icon
                  className={`w-5 h-5 ${activeTab === tab.id ? "text-blue-400" : "text-neutral-500"}`}
                />
                {tab.title}
              </button>
            ))}

            <div className="mt-8 pt-6 border-t border-neutral-800 px-4">
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 mb-2" />
                <h4 className="text-sm font-medium text-amber-500 mb-1">
                  Enterprise Plan
                </h4>
                <p className="text-xs text-amber-500/70 mb-3">
                  You are using 85% of your API quota.
                </p>
                <button className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-3 py-1.5 rounded-lg transition-colors w-full font-medium">
                  Upgrade Plan
                </button>
              </div>
            </div>
          </aside>

          {/* Main Settings Area */}
          <main className="flex-1 min-w-0">
            {activeCategory && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <activeCategory.icon className="w-6 h-6 text-neutral-500" />{" "}
                    {activeCategory.title}
                  </h2>
                </div>

                <div className="space-y-6">
                  {activeCategory.sections.map((section, idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl"
                    >
                      <div className="px-6 py-5 border-b border-neutral-800 bg-neutral-900/80">
                        <h3 className="text-lg font-semibold text-neutral-200">
                          {section.title}
                        </h3>
                        <p className="text-sm text-neutral-500 mt-1">
                          {section.description}
                        </p>
                      </div>

                      <div className="p-6 space-y-6">
                        {section.fields.map((field) => (
                          <div
                            key={field.id}
                            className={`${field.type === "toggle" ? "flex items-center justify-between" : "space-y-2"}`}
                          >
                            {field.type !== "toggle" && (
                              <label className="block text-sm font-medium text-neutral-300">
                                {field.label}
                              </label>
                            )}

                            {field.type === "text" && (
                              <input
                                type="text"
                                value={formState[field.id] || ""}
                                onChange={(e) =>
                                  setFormState({
                                    ...formState,
                                    [field.id]: e.target.value,
                                  })
                                }
                                disabled={field.disabled}
                                className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              />
                            )}

                            {field.type === "number" && (
                              <input
                                type="number"
                                value={formState[field.id] || ""}
                                onChange={(e) =>
                                  setFormState({
                                    ...formState,
                                    [field.id]: e.target.value,
                                  })
                                }
                                className="w-full max-w-xs bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                              />
                            )}

                            {field.type === "select" && (
                              <div className="relative max-w-md">
                                <select
                                  value={formState[field.id] || ""}
                                  onChange={(e) =>
                                    setFormState({
                                      ...formState,
                                      [field.id]: e.target.value,
                                    })
                                  }
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 appearance-none transition-all"
                                >
                                  {field.options?.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 rotate-90" />
                              </div>
                            )}

                            {field.type === "textarea" && (
                              <textarea
                                value={formState[field.id] || ""}
                                onChange={(e) =>
                                  setFormState({
                                    ...formState,
                                    [field.id]: e.target.value,
                                  })
                                }
                                rows={4}
                                className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition-all"
                              />
                            )}

                            {field.type === "toggle" && (
                              <>
                                <div>
                                  <h4 className="text-sm font-medium text-neutral-200">
                                    {field.label}
                                  </h4>
                                </div>
                                <button
                                  onClick={() =>
                                    setFormState({
                                      ...formState,
                                      [field.id]: !formState[field.id],
                                    })
                                  }
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none ${formState[field.id] ? "bg-blue-600" : "bg-neutral-700"}`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${formState[field.id] ? "translate-x-2.5" : "-translate-x-2.5"}`}
                                  />
                                </button>
                              </>
                            )}

                            {field.type === "readonly" && (
                              <div className="flex items-center gap-2 max-w-xl">
                                <input
                                  type="text"
                                  value={formState[field.id] || ""}
                                  readOnly
                                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-neutral-400 font-mono"
                                />
                                <button className="p-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-300 transition-colors">
                                  Copy
                                </button>
                              </div>
                            )}

                            {field.type === "file" && (
                              <div className="max-w-xl border-2 border-dashed border-neutral-800 bg-neutral-950/50 rounded-lg p-6 flex flex-col items-center justify-center text-neutral-500 hover:border-neutral-600 transition-colors cursor-pointer">
                                <Palette className="w-8 h-8 mb-2 text-neutral-600" />
                                <span className="text-sm font-medium text-neutral-300">
                                  Click to upload logo
                                </span>
                                <span className="text-xs mt-1">
                                  SVG, PNG, JPG (max 2MB)
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Danger Zone specific to Data tab */}
                  {activeTab === "data" && (
                    <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6 mt-8">
                      <h3 className="text-lg font-semibold text-red-500 mb-2">
                        Danger Zone
                      </h3>
                      <p className="text-sm text-red-400/70 mb-6">
                        Irreversible destructive actions for your workspace.
                      </p>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-neutral-950/50 border border-red-900/30 rounded-xl">
                          <div>
                            <h4 className="font-medium text-neutral-200">
                              Purge All Historical Data
                            </h4>
                            <p className="text-xs text-neutral-500 mt-1">
                              Permanently delete tickets older than 3 years.
                            </p>
                          </div>
                          <button className="px-4 py-2 bg-neutral-900 text-red-500 border border-red-900/50 hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors">
                            Purge Data
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-neutral-950/50 border border-red-900/30 rounded-xl">
                          <div>
                            <h4 className="font-medium text-neutral-200">
                              Delete Workspace
                            </h4>
                            <p className="text-xs text-neutral-500 mt-1">
                              Permanently delete this workspace and all
                              associated data.
                            </p>
                          </div>
                          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                            Delete Workspace
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
