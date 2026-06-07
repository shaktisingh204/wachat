"use client";

import React, { useState } from "react";
import {
  Settings,
  Shield,
  Bell,
  Palette,
  Database,
  Webhook,
  Save,
  AlertTriangle,
  Copy,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  Input,
  Textarea,
  Switch,
  Alert,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabFilePickerButton } from "@/components/sabfiles";

type SettingsField = {
  id: string;
  type:
    | "text"
    | "number"
    | "select"
    | "textarea"
    | "toggle"
    | "readonly"
    | "file";
  label: string;
  value?: string | boolean;
  disabled?: boolean;
  options?: string[];
};

type SettingsSection = {
  title: string;
  description: string;
  fields: SettingsField[];
};

type SettingsCategory = {
  id: string;
  title: string;
  icon: LucideIcon;
  sections: SettingsSection[];
};

// Massive Configuration Data Structure
const settingsStructure: SettingsCategory[] = [
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
  const { toast } = useToast();
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

  const setValue = (id: string, value: any) =>
    setFormState((prev) => ({ ...prev, [id]: value }));

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Settings saved");
    }, 1000);
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const activeCategory = settingsStructure.find((t) => t.id === activeTab);

  return (
    <div className="ui20 dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Workspace Settings</PageTitle>
            <PageDescription>
              Manage your account, security, preferences, and integrations.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button
              variant="primary"
              iconLeft={Save}
              loading={isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </PageActions>
        </PageHeader>

        <div className="flex flex-col lg:flex-row gap-8 mt-8">
          {/* Navigation Sidebar */}
          <aside className="w-full lg:w-64 flex-none space-y-1">
            {settingsStructure.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "primary" : "ghost"}
                block
                iconLeft={tab.icon}
                onClick={() => setActiveTab(tab.id)}
                className="justify-start"
              >
                {tab.title}
              </Button>
            ))}

            <div className="mt-8 pt-6 border-t border-[var(--st-border)]">
              <Alert
                tone="warning"
                icon={AlertTriangle}
                title="Enterprise Plan"
              >
                <p className="mb-3">You are using 85% of your API quota.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  block
                  onClick={() => toast.info("Opening upgrade options")}
                >
                  Upgrade Plan
                </Button>
              </Alert>
            </div>
          </aside>

          {/* Main Settings Area */}
          <main className="flex-1 min-w-0">
            {activeCategory && (
              <div className="space-y-8">
                <div className="flex items-center gap-2">
                  <activeCategory.icon
                    className="w-6 h-6 text-[var(--st-text-secondary)]"
                    aria-hidden="true"
                  />
                  <h2 className="text-2xl font-bold text-[var(--st-text)]">
                    {activeCategory.title}
                  </h2>
                </div>

                <div className="space-y-6">
                  {activeCategory.sections.map((section, idx) => (
                    <Card key={idx} variant="outlined" padding="none">
                      <CardHeader>
                        <CardTitle>{section.title}</CardTitle>
                        <CardDescription>{section.description}</CardDescription>
                      </CardHeader>

                      <CardBody className="space-y-6">
                        {section.fields.map((field) => {
                          if (field.type === "toggle") {
                            return (
                              <div
                                key={field.id}
                                className="flex items-center justify-between gap-4"
                              >
                                <span className="text-sm font-medium text-[var(--st-text)]">
                                  {field.label}
                                </span>
                                <Switch
                                  checked={Boolean(formState[field.id])}
                                  onCheckedChange={(next) =>
                                    setValue(field.id, next)
                                  }
                                  aria-label={field.label}
                                />
                              </div>
                            );
                          }

                          if (field.type === "text") {
                            return (
                              <Field
                                key={field.id}
                                label={field.label}
                                className="max-w-xl"
                              >
                                <Input
                                  type="text"
                                  value={formState[field.id] ?? ""}
                                  disabled={field.disabled}
                                  onChange={(e) =>
                                    setValue(field.id, e.target.value)
                                  }
                                />
                              </Field>
                            );
                          }

                          if (field.type === "number") {
                            return (
                              <Field
                                key={field.id}
                                label={field.label}
                                className="max-w-xs"
                              >
                                <Input
                                  type="number"
                                  value={formState[field.id] ?? ""}
                                  onChange={(e) =>
                                    setValue(field.id, e.target.value)
                                  }
                                />
                              </Field>
                            );
                          }

                          if (field.type === "select") {
                            return (
                              <Field
                                key={field.id}
                                label={field.label}
                                className="max-w-md"
                              >
                                <Select
                                  value={formState[field.id] ?? ""}
                                  onValueChange={(next) =>
                                    setValue(field.id, next)
                                  }
                                >
                                  <SelectTrigger aria-label={field.label}>
                                    <SelectValue placeholder="Select an option" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {field.options?.map((opt) => (
                                      <SelectItem key={opt} value={opt}>
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                            );
                          }

                          if (field.type === "textarea") {
                            return (
                              <Field
                                key={field.id}
                                label={field.label}
                                className="max-w-xl"
                              >
                                <Textarea
                                  value={formState[field.id] ?? ""}
                                  rows={4}
                                  className="font-mono"
                                  onChange={(e) =>
                                    setValue(field.id, e.target.value)
                                  }
                                />
                              </Field>
                            );
                          }

                          if (field.type === "readonly") {
                            return (
                              <Field
                                key={field.id}
                                label={field.label}
                                className="max-w-xl"
                              >
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    value={formState[field.id] ?? ""}
                                    readOnly
                                    className="flex-1 font-mono"
                                  />
                                  <IconButton
                                    icon={Copy}
                                    label={`Copy ${field.label}`}
                                    variant="outline"
                                    onClick={() =>
                                      handleCopy(
                                        String(formState[field.id] ?? ""),
                                        field.label,
                                      )
                                    }
                                  />
                                </div>
                              </Field>
                            );
                          }

                          if (field.type === "file") {
                            return (
                              <Field key={field.id} label={field.label}>
                                <div className="flex flex-col gap-2">
                                  <SabFilePickerButton
                                    accept="image"
                                    variant="outline"
                                    onPick={(pick) => {
                                      setValue(field.id, pick.url);
                                      toast.success("Logo updated");
                                    }}
                                  >
                                    <UploadCloud aria-hidden="true" />
                                    {formState[field.id]
                                      ? "Replace logo"
                                      : "Upload logo"}
                                  </SabFilePickerButton>
                                  <span className="text-xs text-[var(--st-text-tertiary)]">
                                    SVG, PNG, JPG (max 2MB)
                                  </span>
                                </div>
                              </Field>
                            );
                          }

                          return null;
                        })}
                      </CardBody>
                    </Card>
                  ))}

                  {/* Danger Zone specific to Data tab */}
                  {activeTab === "data" && (
                    <Card
                      variant="outlined"
                      padding="lg"
                      className="border-[var(--st-danger)] bg-[var(--st-danger-soft,transparent)]"
                    >
                      <h3 className="text-lg font-semibold text-[var(--st-danger)] mb-2">
                        Danger Zone
                      </h3>
                      <p className="text-sm text-[var(--st-text-secondary)] mb-6">
                        Irreversible destructive actions for your workspace.
                      </p>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4 p-4 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                          <div>
                            <h4 className="font-medium text-[var(--st-text)]">
                              Purge All Historical Data
                            </h4>
                            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                              Permanently delete tickets older than 3 years.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() =>
                              toast.warning("Confirm before purging data")
                            }
                          >
                            Purge Data
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-4 p-4 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                          <div>
                            <h4 className="font-medium text-[var(--st-text)]">
                              Delete Workspace
                            </h4>
                            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                              Permanently delete this workspace and all
                              associated data.
                            </p>
                          </div>
                          <Button
                            variant="danger"
                            onClick={() =>
                              toast.error("Workspace deletion requires confirmation")
                            }
                          >
                            Delete Workspace
                          </Button>
                        </div>
                      </div>
                    </Card>
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
