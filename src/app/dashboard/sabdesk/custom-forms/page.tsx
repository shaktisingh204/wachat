"use client";

import React, { useState } from "react";
import {
  Layout,
  Type,
  AlignLeft,
  CheckSquare,
  List as ListIcon,
  Calendar,
  UploadCloud,
  GripVertical,
  Settings,
  Plus,
  Trash2,
  Copy,
  Save,
  Eye,
  Smartphone,
  Monitor,
  Hash,
  Mail,
  Phone,
  ToggleLeft,
  FormInput,
} from "lucide-react";
import {
  Button,
  IconButton,
  Badge,
  Card,
  Field,
  Input,
  Textarea,
  Switch,
  Checkbox,
  Radio,
  SegmentedControl,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabFilePickerButton } from "@/components/sabfiles";

// Custom Forms drag-and-drop builder simulator.
const toolBoxItems = [
  { id: "text", label: "Short Text", icon: Type },
  { id: "textarea", label: "Long Text", icon: AlignLeft },
  { id: "number", label: "Number", icon: Hash },
  { id: "email", label: "Email", icon: Mail },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "select", label: "Dropdown", icon: ListIcon },
  { id: "checkbox", label: "Checkboxes", icon: CheckSquare },
  { id: "radio", label: "Radio Buttons", icon: CheckSquare },
  { id: "date", label: "Date Picker", icon: Calendar },
  { id: "file", label: "File Upload", icon: UploadCloud },
  { id: "toggle", label: "Toggle Switch", icon: ToggleLeft },
  { id: "heading", label: "Section Heading", icon: Layout },
];

interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

export default function CustomFormsPage() {
  const { toast } = useToast();
  const [fields, setFields] = useState<FormField[]>([
    { id: "f1", type: "heading", label: "Customer Details", required: false },
    {
      id: "f2",
      type: "text",
      label: "Full Name",
      placeholder: "Jane Cooper",
      required: true,
    },
    {
      id: "f3",
      type: "email",
      label: "Email Address",
      placeholder: "jane@example.com",
      required: true,
    },
    {
      id: "f4",
      type: "select",
      label: "Issue Category",
      options: ["Billing", "Technical", "Sales", "Other"],
      required: true,
    },
    {
      id: "f5",
      type: "textarea",
      label: "Describe your issue",
      placeholder: "Please provide details...",
      required: true,
    },
  ]);

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>("f2");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | null>(
    null,
  );

  const addField = (type: string) => {
    const newField: FormField = {
      id: `f_${Date.now()}`,
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      required: false,
      ...(type === "select" || type === "radio" || type === "checkbox"
        ? { options: ["Option 1", "Option 2"] }
        : {}),
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    toast.success("Field removed");
  };

  const duplicateField = (id: string) => {
    const source = fields.find((f) => f.id === id);
    if (!source) return;
    const copy: FormField = {
      ...source,
      id: `f_${Date.now()}`,
      label: `${source.label} copy`,
      options: source.options ? [...source.options] : undefined,
    };
    const idx = fields.findIndex((f) => f.id === id);
    const next = [...fields];
    next.splice(idx + 1, 0, copy);
    setFields(next);
    setSelectedFieldId(copy.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Render a non-interactive preview of a field based on its type.
  const renderFieldMock = (field: FormField) => {
    switch (field.type) {
      case "heading":
        return (
          <h3 className="text-xl font-bold text-[var(--st-text)] mt-4 border-b border-[var(--st-border)] pb-2">
            {field.label}
          </h3>
        );
      case "textarea":
        return (
          <Textarea
            className="mt-1"
            placeholder={field.placeholder}
            rows={3}
            readOnly
            aria-label={field.label}
          />
        );
      case "select":
        return (
          <div className="mt-1">
            <Select>
              <SelectTrigger aria-label={field.label}>
                <SelectValue placeholder="Select an option..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt, i) => (
                  <SelectItem key={i} value={`opt-${i}`}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "checkbox":
        return (
          <div className="space-y-2 mt-2">
            {field.options?.map((opt, i) => (
              <Checkbox key={i} label={opt} readOnly />
            ))}
          </div>
        );
      case "radio":
        return (
          <div className="space-y-2 mt-2">
            {field.options?.map((opt, i) => (
              <Radio key={i} value={`opt-${i}`} name={field.id} label={opt} />
            ))}
          </div>
        );
      case "file":
        return (
          <div className="mt-1 border-2 border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] p-6 flex flex-col items-center justify-center text-[var(--st-text-tertiary)] bg-[var(--st-bg-secondary)] gap-2">
            <UploadCloud className="w-6 h-6" aria-hidden="true" />
            <span className="text-sm text-[var(--st-text-secondary)]">
              Pick a file from your library or upload a new one.
            </span>
            <SabFilePickerButton onPick={() => {}}>
              Choose file
            </SabFilePickerButton>
          </div>
        );
      case "toggle":
        return (
          <div className="mt-2">
            <Switch label="Off / On" aria-label={field.label} />
          </div>
        );
      default:
        return (
          <Input
            className="mt-1"
            type="text"
            placeholder={field.placeholder}
            readOnly
            aria-label={field.label}
          />
        );
    }
  };

  return (
    <div className="ui20 dark h-screen flex flex-col bg-[var(--st-bg)] text-[var(--st-text)] font-sans overflow-hidden">
      {/* Top bar */}
      <header className="h-16 flex-none bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)] flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-accent-soft)]">
            <FormInput
              className="w-5 h-5 text-[var(--st-accent)]"
              aria-hidden="true"
            />
          </div>
          <h1 className="font-bold text-[var(--st-text)] flex items-center gap-2">
            Support Ticket Form
            <Badge tone="neutral">Draft</Badge>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <SegmentedControl
            value={previewMode ? "preview" : "builder"}
            onChange={(v) =>
              setPreviewMode(v === "preview" ? "desktop" : null)
            }
            items={[
              { value: "builder", label: "Builder" },
              { value: "preview", label: "Preview", icon: Eye },
            ]}
            aria-label="Editor mode"
          />
          <Button variant="ghost" onClick={() => toast.message("Changes discarded")}>
            Discard
          </Button>
          <Button
            variant="primary"
            iconLeft={Save}
            onClick={() => toast.success("Form saved and published")}
          >
            Save &amp; Publish
          </Button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Toolbox (hidden in preview) */}
        {!previewMode && (
          <div className="w-72 flex-none bg-[var(--st-bg-secondary)] border-r border-[var(--st-border)] flex flex-col">
            <div className="p-4 border-b border-[var(--st-border)]">
              <h2 className="font-semibold text-[var(--st-text)]">
                Form Elements
              </h2>
              <p className="text-xs text-[var(--st-text-tertiary)] mt-1">
                Click to add to your form.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                {toolBoxItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant="outline"
                      onClick={() => addField(item.id)}
                      className="flex-col h-auto py-3 gap-2"
                    >
                      <Icon className="w-6 h-6" aria-hidden="true" />
                      <span className="text-xs font-medium text-center">
                        {item.label}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          className={`flex-1 overflow-y-auto bg-[var(--st-bg-subtle)] p-8 ${previewMode === "mobile" ? "flex justify-center" : ""}`}
        >
          <div
            className={`mx-auto bg-[var(--st-bg-secondary)] rounded-2xl shadow-2xl border border-[var(--st-border)] min-h-[600px] flex flex-col transition-all duration-300 ${previewMode === "mobile" ? "w-[375px] h-[812px] rounded-[3rem] border-8 overflow-y-auto" : "max-w-3xl w-full"}`}
          >
            {/* Form header */}
            <div className="p-8 border-b border-[var(--st-border)] rounded-t-2xl">
              <h1
                className="text-3xl font-bold text-[var(--st-text)] mb-2 outline-none focus:bg-[var(--st-bg)] p-2 -ml-2 rounded-[var(--st-radius)]"
                contentEditable={!previewMode}
                suppressContentEditableWarning
              >
                Submit a Request
              </h1>
              <p
                className="text-[var(--st-text-secondary)] outline-none focus:bg-[var(--st-bg)] p-2 -ml-2 rounded-[var(--st-radius)]"
                contentEditable={!previewMode}
                suppressContentEditableWarning
              >
                Fill out the form below and our team will get back to you
                shortly.
              </p>
            </div>

            {/* Fields canvas */}
            <div className="p-8 space-y-2 flex-1">
              {fields.length === 0 ? (
                <EmptyState
                  icon={Layout}
                  title="Your form is empty"
                  description="Add fields from the elements panel on the left to start building."
                />
              ) : (
                fields.map((field) => (
                  <div
                    key={field.id}
                    onClick={() =>
                      !previewMode && setSelectedFieldId(field.id)
                    }
                    className={`relative p-4 rounded-xl transition-all border ${!previewMode && selectedFieldId === field.id ? "bg-[var(--st-accent-soft)] border-[var(--st-accent)]" : !previewMode ? "border-transparent hover:bg-[var(--st-bg)] hover:border-[var(--st-border)]" : "border-transparent"}`}
                  >
                    {!previewMode && selectedFieldId === field.id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 p-1 bg-[var(--st-bg)] border border-[var(--st-border)] text-[var(--st-text-tertiary)] rounded-[var(--st-radius)] cursor-grab">
                        <GripVertical className="w-4 h-4" aria-hidden="true" />
                      </div>
                    )}

                    {field.type !== "heading" && (
                      <label className="block text-sm font-medium text-[var(--st-text)] mb-1">
                        {field.label}
                        {field.required && (
                          <span className="text-[var(--st-danger)]"> *</span>
                        )}
                      </label>
                    )}

                    {renderFieldMock(field)}

                    {field.helpText && (
                      <p className="text-xs text-[var(--st-text-tertiary)] mt-1.5">
                        {field.helpText}
                      </p>
                    )}

                    {!previewMode && selectedFieldId === field.id && (
                      <div className="absolute right-2 top-2 flex gap-1">
                        <IconButton
                          label="Duplicate field"
                          icon={Copy}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateField(field.id);
                          }}
                        />
                        <IconButton
                          label="Delete field"
                          icon={Trash2}
                          size="sm"
                          variant="danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(field.id);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Submit button preview */}
              <div className="pt-6 mt-4 border-t border-[var(--st-border)]">
                <Button variant="primary">Submit Request</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Field properties (hidden in preview) */}
        {!previewMode && (
          <div className="w-80 flex-none bg-[var(--st-bg-secondary)] border-l border-[var(--st-border)] flex flex-col">
            <div className="p-4 border-b border-[var(--st-border)] flex items-center gap-2">
              <Settings
                className="w-5 h-5 text-[var(--st-text-secondary)]"
                aria-hidden="true"
              />
              <h2 className="font-semibold text-[var(--st-text)]">
                Field Properties
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedField ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Field label="Field Label">
                      <Input
                        type="text"
                        value={selectedField.label}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            label: e.target.value,
                          })
                        }
                      />
                    </Field>

                    {selectedField.type !== "heading" && (
                      <Field label="Help Text">
                        <Input
                          type="text"
                          placeholder="Optional sub-label..."
                          value={selectedField.helpText || ""}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              helpText: e.target.value,
                            })
                          }
                        />
                      </Field>
                    )}

                    {["text", "textarea", "email", "phone", "number"].includes(
                      selectedField.type,
                    ) && (
                      <Field label="Placeholder">
                        <Input
                          type="text"
                          value={selectedField.placeholder || ""}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              placeholder: e.target.value,
                            })
                          }
                        />
                      </Field>
                    )}

                    {selectedField.type !== "heading" && (
                      <Card variant="outlined" padding="sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[var(--st-text)]">
                              Required Field
                            </p>
                            <p className="text-xs text-[var(--st-text-tertiary)]">
                              User must fill this out.
                            </p>
                          </div>
                          <Switch
                            checked={selectedField.required}
                            onCheckedChange={(next) =>
                              updateField(selectedField.id, { required: next })
                            }
                            aria-label="Required field"
                          />
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Choices for select / radio / checkbox */}
                  {["select", "radio", "checkbox"].includes(
                    selectedField.type,
                  ) && (
                    <div className="space-y-3 pt-4 border-t border-[var(--st-border)]">
                      <p className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                        Choices
                      </p>
                      {selectedField.options?.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <GripVertical
                            className="w-4 h-4 text-[var(--st-text-tertiary)] cursor-grab"
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <Input
                              inputSize="sm"
                              type="text"
                              value={opt}
                              aria-label={`Choice ${idx + 1}`}
                              onChange={(e) => {
                                const newOpts = [
                                  ...(selectedField.options || []),
                                ];
                                newOpts[idx] = e.target.value;
                                updateField(selectedField.id, {
                                  options: newOpts,
                                });
                              }}
                            />
                          </div>
                          <IconButton
                            label={`Remove choice ${idx + 1}`}
                            icon={Trash2}
                            size="sm"
                            onClick={() => {
                              const newOpts = selectedField.options?.filter(
                                (_, i) => i !== idx,
                              );
                              updateField(selectedField.id, {
                                options: newOpts,
                              });
                            }}
                          />
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Plus}
                        onClick={() => {
                          updateField(selectedField.id, {
                            options: [
                              ...(selectedField.options || []),
                              `Option ${(selectedField.options?.length || 0) + 1}`,
                            ],
                          });
                        }}
                      >
                        Add Option
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={Settings}
                  size="sm"
                  title="No field selected"
                  description="Select a field on the canvas to edit its properties."
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview device controls (only in preview mode) */}
      {previewMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 bg-[var(--st-bg-secondary)] p-1.5 rounded-full border border-[var(--st-border)] shadow-2xl">
          <IconButton
            label="Desktop preview"
            icon={Monitor}
            variant={previewMode === "desktop" ? "primary" : "ghost"}
            onClick={() => setPreviewMode("desktop")}
          />
          <IconButton
            label="Mobile preview"
            icon={Smartphone}
            variant={previewMode === "mobile" ? "primary" : "ghost"}
            onClick={() => setPreviewMode("mobile")}
          />
        </div>
      )}
    </div>
  );
}
