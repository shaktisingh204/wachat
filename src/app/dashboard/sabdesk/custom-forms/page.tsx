"use client";

import React, { useState } from "react";
import {
  Layout,
  Type,
  AlignLeft,
  CheckSquare,
  List as ListIcon,
  Calendar,
  Image as ImageIcon,
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
  ChevronDown,
  Hash,
  Mail,
  Phone,
  ToggleLeft,
  FormInput,
} from "lucide-react";

// Massive Custom Forms Drag and Drop Mock Simulator
const toolBoxItems = [
  { id: "text", label: "Short Text", icon: Type },
  { id: "textarea", label: "Long Text", icon: AlignLeft },
  { id: "number", label: "Number", icon: Hash },
  { id: "email", label: "Email", icon: Mail },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "select", label: "Dropdown", icon: ListIcon },
  { id: "checkbox", label: "Checkboxes", icon: CheckSquare },
  { id: "radio", label: "Radio Buttons", icon: CheckSquare }, // Reusing icon for mock
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
  const [fields, setFields] = useState<FormField[]>([
    { id: "f1", type: "heading", label: "Customer Details", required: false },
    {
      id: "f2",
      type: "text",
      label: "Full Name",
      placeholder: "John Doe",
      required: true,
    },
    {
      id: "f3",
      type: "email",
      label: "Email Address",
      placeholder: "john@example.com",
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
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Render Field Input Mock based on type
  const renderFieldMock = (field: FormField) => {
    const baseInputClass =
      "w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-300 mt-1 focus:outline-none focus:border-blue-500 cursor-default";

    switch (field.type) {
      case "heading":
        return (
          <h3 className="text-xl font-bold text-white mt-4 border-b border-neutral-800 pb-2">
            {field.label}
          </h3>
        );
      case "textarea":
        return (
          <textarea
            className={baseInputClass}
            placeholder={field.placeholder}
            rows={3}
            readOnly
          />
        );
      case "select":
        return (
          <div className="relative">
            <select className={`${baseInputClass} appearance-none`} readOnly>
              <option>Select an option...</option>
              {field.options?.map((opt, i) => (
                <option key={i}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          </div>
        );
      case "checkbox":
      case "radio":
        return (
          <div className="space-y-2 mt-2">
            {field.options?.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={field.type}
                  className="w-4 h-4 accent-blue-500 bg-neutral-900 border-neutral-700"
                  readOnly
                />
                <span className="text-sm text-neutral-300">{opt}</span>
              </div>
            ))}
          </div>
        );
      case "file":
        return (
          <div className="mt-1 border-2 border-dashed border-neutral-700 rounded-lg p-6 flex flex-col items-center justify-center text-neutral-500 bg-neutral-950">
            <UploadCloud className="w-6 h-6 mb-2" />
            <span className="text-sm">
              Click or drag file to this area to upload
            </span>
          </div>
        );
      case "toggle":
        return (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-10 h-5 bg-neutral-700 rounded-full relative">
              <div className="w-4 h-4 bg-neutral-400 rounded-full absolute left-0.5 top-0.5"></div>
            </div>
            <span className="text-sm text-neutral-400">Off / On</span>
          </div>
        );
      default:
        return (
          <input
            type="text"
            className={baseInputClass}
            placeholder={field.placeholder}
            readOnly
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-neutral-200 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="h-16 flex-none bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg border border-indigo-500/20">
            <FormInput className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-white flex items-center gap-2">
              Support Ticket Form{" "}
              <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                Draft
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1 mr-4">
            <button
              onClick={() => setPreviewMode(null)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!previewMode ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"}`}
            >
              Builder
            </button>
            <button
              onClick={() => setPreviewMode("desktop")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${previewMode ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"}`}
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>
          <button className="text-sm font-medium text-neutral-400 hover:text-white px-3 py-2 transition-colors">
            Discard
          </button>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all">
            <Save className="w-4 h-4" /> Save & Publish
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Toolbox (Hidden in preview) */}
        {!previewMode && (
          <div className="w-72 flex-none bg-neutral-950 border-r border-neutral-800 flex flex-col">
            <div className="p-4 border-b border-neutral-800">
              <h2 className="font-semibold text-neutral-200">Form Elements</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Click to add to your form.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-2">
                {toolBoxItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addField(item.id)}
                    className="flex flex-col items-center justify-center p-3 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-blue-500 hover:bg-blue-500/5 transition-all group"
                  >
                    <item.icon className="w-6 h-6 text-neutral-400 group-hover:text-blue-400 mb-2 transition-colors" />
                    <span className="text-xs text-neutral-300 font-medium text-center">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Center - Canvas */}
        <div
          className={`flex-1 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-neutral-900/50 p-8 custom-scrollbar ${previewMode === "mobile" ? "flex justify-center" : ""}`}
        >
          <div
            className={`mx-auto bg-neutral-950 rounded-2xl shadow-2xl border border-neutral-800 min-h-[600px] flex flex-col transition-all duration-300 ${previewMode === "mobile" ? "w-[375px] h-[812px] rounded-[3rem] border-8 border-neutral-900 overflow-y-auto" : "max-w-3xl w-full"}`}
          >
            {/* Form Header */}
            <div className="p-8 border-b border-neutral-800 bg-neutral-900/30 rounded-t-2xl">
              <h1
                className="text-3xl font-bold text-white mb-2 outline-none focus:bg-neutral-800/50 p-2 -ml-2 rounded"
                contentEditable={!previewMode}
                suppressContentEditableWarning
              >
                Submit a Request
              </h1>
              <p
                className="text-neutral-400 outline-none focus:bg-neutral-800/50 p-2 -ml-2 rounded"
                contentEditable={!previewMode}
                suppressContentEditableWarning
              >
                Fill out the form below and our team will get back to you
                shortly.
              </p>
            </div>

            {/* Form Fields Canvas */}
            <div className="p-8 space-y-2 flex-1">
              {fields.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 border-2 border-dashed border-neutral-800 rounded-xl p-12 bg-neutral-900/20">
                  <Layout className="w-12 h-12 mb-4 text-neutral-600" />
                  <p className="text-lg font-medium">Your form is empty</p>
                  <p className="text-sm mt-1 text-center">
                    Add fields from the elements panel on the left to start
                    building.
                  </p>
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    key={field.id}
                    onClick={() => !previewMode && setSelectedFieldId(field.id)}
                    className={`relative p-4 rounded-xl transition-all border ${!previewMode && selectedFieldId === field.id ? "bg-blue-500/5 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,1)]" : !previewMode ? "border-transparent hover:bg-neutral-900 hover:border-neutral-800" : "border-transparent"}`}
                  >
                    {!previewMode && (
                      <div
                        className={`absolute left-0 top-1/2 -translate-y-1/2 -ml-3 p-1 bg-neutral-800 text-neutral-400 rounded cursor-grab opacity-0 transition-opacity ${selectedFieldId === field.id ? "opacity-100" : "group-hover:opacity-100"}`}
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}

                    {field.type !== "heading" && (
                      <label className="block text-sm font-medium text-neutral-200 mb-1">
                        {field.label}{" "}
                        {field.required && (
                          <span className="text-red-400">*</span>
                        )}
                      </label>
                    )}

                    {renderFieldMock(field)}

                    {field.helpText && (
                      <p className="text-xs text-neutral-500 mt-1.5">
                        {field.helpText}
                      </p>
                    )}

                    {!previewMode && selectedFieldId === field.id && (
                      <div className="absolute right-2 top-2 flex bg-neutral-800 border border-neutral-700 rounded-md overflow-hidden shadow-lg">
                        <button
                          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(field.id);
                          }}
                          className="p-1.5 text-red-400 hover:text-white hover:bg-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Submit Button Mock */}
              <div className="pt-6 mt-4 border-t border-neutral-800">
                <button className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium w-full sm:w-auto">
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Field Properties (Hidden in preview) */}
        {!previewMode && (
          <div className="w-80 flex-none bg-neutral-950 border-l border-neutral-800 flex flex-col">
            <div className="p-4 border-b border-neutral-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-neutral-400" />
              <h2 className="font-semibold text-neutral-200">
                Field Properties
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {selectedField ? (
                <div className="space-y-6">
                  {/* Common Properties */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                        Field Label
                      </label>
                      <input
                        type="text"
                        value={selectedField.label}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            label: e.target.value,
                          })
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    {selectedField.type !== "heading" && (
                      <div>
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                          Help Text
                        </label>
                        <input
                          type="text"
                          placeholder="Optional sub-label..."
                          value={selectedField.helpText || ""}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              helpText: e.target.value,
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {["text", "textarea", "email", "phone", "number"].includes(
                      selectedField.type,
                    ) && (
                      <div>
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                          Placeholder
                        </label>
                        <input
                          type="text"
                          value={selectedField.placeholder || ""}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              placeholder: e.target.value,
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {selectedField.type !== "heading" && (
                      <div className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-neutral-200">
                            Required Field
                          </p>
                          <p className="text-xs text-neutral-500">
                            User must fill this out
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            updateField(selectedField.id, {
                              required: !selectedField.required,
                            })
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none ${selectedField.required ? "bg-blue-600" : "bg-neutral-700"}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${selectedField.required ? "translate-x-2" : "-translate-x-2"}`}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options for Select/Radio/Checkbox */}
                  {["select", "radio", "checkbox"].includes(
                    selectedField.type,
                  ) && (
                    <div className="space-y-3 pt-4 border-t border-neutral-800">
                      <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                        Choices
                      </label>
                      {selectedField.options?.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-neutral-600 cursor-grab" />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [
                                ...(selectedField.options || []),
                              ];
                              newOpts[idx] = e.target.value;
                              updateField(selectedField.id, {
                                options: newOpts,
                              });
                            }
                            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              const newOpts = selectedField.options?.filter(
                                (_, i) => i !== idx,
                              );
                              updateField(selectedField.id, {
                                options: newOpts,
                              });
                            }
                            className="text-neutral-500 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          updateField(selectedField.id, {
                            options: [
                              ...(selectedField.options || []),
                              `Option ${(selectedField.options?.length || 0) + 1}`,
                            ],
                          });
                        }
                        className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-2"
                      >
                        <Plus className="w-4 h-4" /> Add Option
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500 opacity-50">
                  <Settings className="w-12 h-12 mb-4" />
                  <p className="text-center text-sm">
                    Select a field on the canvas to edit its properties.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview Device Controls (Only visible in preview mode) */}
      {previewMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex bg-neutral-800 p-1.5 rounded-full border border-neutral-700 shadow-2xl">
          <button
            onClick={() => setPreviewMode("desktop")}
            className={`p-2 rounded-full transition-colors ${previewMode === "desktop" ? "bg-neutral-700 text-white shadow" : "text-neutral-400 hover:text-white"}`}
          >
            <Monitor className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPreviewMode("mobile")}
            className={`p-2 rounded-full transition-colors ${previewMode === "mobile" ? "bg-neutral-700 text-white shadow" : "text-neutral-400 hover:text-white"}`}
          >
            <Smartphone className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// Helper icon component since X was missing from imports
const X = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
