"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  MoreVertical,
  X,
  Check,
  AlertCircle,
  PenTool,
  Clock,
  User,
  Shield,
  MessageSquare,
  History,
  Info,
  Type,
  Image as ImageIcon,
  MousePointer2,
  Calendar,
  CheckSquare,
  AlignLeft,
  Search,
  Settings,
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  Layers,
  Eye,
  Menu,
  FileSignature
} from "lucide-react";

// Mock Data
const DOCUMENT_PAGES = [
  { id: 1, height: "800px", fields: [
    { id: "f1", type: "text", x: 15, y: 25, label: "Full Name", required: true, value: "" },
    { id: "f2", type: "date", x: 60, y: 25, label: "Date", required: true, value: "" },
    { id: "f3", type: "checkbox", x: 15, y: 35, label: "I agree to the terms", required: true, value: false },
  ]},
  { id: 2, height: "800px", fields: [
    { id: "f4", type: "signature", x: 20, y: 70, label: "Client Signature", required: true, value: null },
    { id: "f5", type: "signature", x: 60, y: 70, label: "Agent Signature", required: false, value: null },
  ]},
  { id: 3, height: "800px", fields: [
    { id: "f6", type: "text", x: 15, y: 15, label: "Company Name", required: false, value: "" },
    { id: "f7", type: "text", x: 15, y: 25, label: "Address", required: false, value: "" },
    { id: "f8", type: "initials", x: 80, y: 85, label: "Initials", required: true, value: null },
  ]}
];

const AUDIT_TRAIL = [
  { id: 1, action: "Document Created", user: "Alice Admin", time: "Oct 24, 2023, 09:00 AM", icon: <FileText className="w-4 h-4" /> },
  { id: 2, action: "Sent to Signers", user: "System", time: "Oct 24, 2023, 09:05 AM", icon: <Check className="w-4 h-4" /> },
  { id: 3, action: "Viewed by John Doe", user: "John Doe", time: "Oct 24, 2023, 10:15 AM", icon: <Eye className="w-4 h-4" /> },
];

export default function SignerPortalPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [activeSidebar, setActiveSidebar] = useState<"outline" | "comments" | "audit" | "details" | null>("outline");
  const [documentFields, setDocumentFields] = useState(DOCUMENT_PAGES);
  
  // Modals state
  const [showAdoptSignature, setShowAdoptSignature] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // Adopt Signature State
  const [signatureMode, setSignatureMode] = useState<"draw" | "type" | "upload">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [typedInitials, setTypedInitials] = useState("");
  const [selectedFont, setSelectedFont] = useState("font-serif");

  // Navigation
  const requiredFields = documentFields.flatMap(p => p.fields).filter(f => f.required && !f.value);
  const totalRequired = documentFields.flatMap(p => p.fields).filter(f => f.required).length;
  const completedRequired = totalRequired - requiredFields.length;
  const progress = (completedRequired / totalRequired) * 100;

  const handleNextRequired = () => {
    if (requiredFields.length > 0) {
      const nextField = requiredFields[0];
      const pageIndex = documentFields.findIndex(p => p.fields.some(f => f.id === nextField.id));
      if (pageIndex !== -1) {
        setCurrentPage(pageIndex + 1);
        // In a real app, we would scroll to the field
      }
    } else {
      setShowFinalize(true);
    }
  };

  const handleFieldClick = (fieldId: string, fieldType: string) => {
    if (fieldType === "signature" || fieldType === "initials") {
      setActiveFieldId(fieldId);
      setShowAdoptSignature(true);
    }
  };

  const updateFieldValue = (fieldId: string, value: any) => {
    setDocumentFields(prev => prev.map(page => ({
      ...page,
      fields: page.fields.map(f => f.id === fieldId ? { ...f, value } : f)
    })));
  };

  const applySignature = () => {
    if (activeFieldId) {
      updateFieldValue(activeFieldId, signatureMode === "type" ? typedSignature : "[Drawn Signature]");
    }
    setShowAdoptSignature(false);
    setActiveFieldId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-200 overflow-hidden font-sans">
      
      {/* Top Navigation Bar */}
      <header className="flex-none h-16 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md flex items-center justify-between px-6 z-20">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <FileSignature className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight leading-tight">Master Services Agreement 2024.pdf</h1>
            <div className="flex items-center text-xs text-neutral-400 space-x-2">
              <span className="flex items-center"><User className="w-3 h-3 mr-1"/> From: SabDesk Legal</span>
              <span>•</span>
              <span className="flex items-center text-amber-400"><Clock className="w-3 h-3 mr-1"/> Action Required</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 bg-neutral-800/50 rounded-lg p-1 border border-neutral-700/50">
            <button className="p-2 hover:bg-neutral-700 rounded-md transition-colors text-neutral-400 hover:text-white" onClick={() => setZoom(z => Math.max(50, z - 10))}>
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
            <button className="p-2 hover:bg-neutral-700 rounded-md transition-colors text-neutral-400 hover:text-white" onClick={() => setZoom(z => Math.min(200, z + 10))}>
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="flex space-x-3">
            <button className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white border border-transparent hover:border-neutral-700">
              <Download className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white border border-transparent hover:border-neutral-700">
              <Printer className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white border border-transparent hover:border-neutral-700">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          <div className="h-8 w-px bg-neutral-800"></div>

          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end">
              <div className="text-xs text-neutral-400 mb-1">{completedRequired} of {totalRequired} required fields</div>
              <div className="w-32 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: \`\${progress}%\` }}
                />
              </div>
            </div>
            
            {requiredFields.length > 0 ? (
              <button 
                onClick={handleNextRequired}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/25 transition-all flex items-center space-x-2"
              >
                <span>Next Required</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={() => setShowFinalize(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-emerald-500/25 transition-all flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Finish Signing</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Thumbnails) */}
        <aside className="w-64 flex-none border-r border-neutral-800 bg-neutral-900/30 flex flex-col hidden md:flex z-10">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-300">Pages</h3>
            <LayoutTemplate className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {DOCUMENT_PAGES.map((page, index) => (
              <div 
                key={page.id}
                onClick={() => setCurrentPage(index + 1)}
                className={\`relative cursor-pointer group \${currentPage === index + 1 ? 'ring-2 ring-indigo-500 rounded-lg' : ''}\`}
              >
                <div className="aspect-[1/1.4] bg-white rounded-lg shadow-sm overflow-hidden flex items-center justify-center p-2 transition-transform group-hover:scale-[1.02]">
                  <div className="w-full h-full border border-neutral-200 bg-neutral-50 flex flex-col relative">
                    {/* Mini skeleton for document content */}
                    <div className="p-2 space-y-1 opacity-20">
                      <div className="h-1 bg-black w-3/4 rounded"></div>
                      <div className="h-1 bg-black w-full rounded"></div>
                      <div className="h-1 bg-black w-5/6 rounded"></div>
                      <div className="h-1 bg-black w-full rounded"></div>
                    </div>
                    {/* Indicator for fields on this page */}
                    {page.fields.some(f => f.required && !f.value) && (
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
                    )}
                  </div>
                </div>
                <div className="text-center mt-2 text-xs text-neutral-500 font-medium">Page {index + 1}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center Document Viewer */}
        <main className="flex-1 overflow-auto bg-neutral-950 flex flex-col relative custom-scrollbar p-8">
          <div 
            className="mx-auto flex flex-col space-y-8"
            style={{ 
              transform: \`scale(\${zoom / 100})\`, 
              transformOrigin: "top center",
              transition: "transform 0.2s ease-out"
            }}
          >
            {documentFields.map((page, index) => (
              <div 
                key={page.id} 
                className="w-[800px] h-[1130px] bg-white shadow-2xl rounded-sm relative shrink-0"
                style={{
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                }}
              >
                {/* Mock Document Content Pattern */}
                <div className="absolute inset-0 p-16 pointer-events-none opacity-5">
                  <div className="h-8 bg-black w-1/2 mb-10"></div>
                  {Array.from({length: 30}).map((_, i) => (
                    <div key={i} className={\`h-3 bg-black mb-4 \${i % 4 === 0 ? 'w-5/6' : 'w-full'}\`}></div>
                  ))}
                </div>

                {/* Page Number */}
                <div className="absolute bottom-6 right-8 text-neutral-400 text-sm font-medium">
                  Page {index + 1} of {DOCUMENT_PAGES.length}
                </div>

                {/* Document Fields Overlay */}
                {page.fields.map(field => {
                  const isCompleted = field.value !== null && field.value !== "" && field.value !== false;
                  
                  return (
                    <div 
                      key={field.id}
                      className={\`absolute transition-all duration-200 cursor-pointer flex flex-col group \${
                        field.required && !isCompleted ? 'z-20' : 'z-10'
                      }\`}
                      style={{ 
                        left: \`\${field.x}%\`, 
                        top: \`\${field.y}%\`,
                      }}
                      onClick={() => handleFieldClick(field.id, field.type)}
                    >
                      {field.required && !isCompleted && (
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-full bg-amber-500 text-white text-xs px-2 py-1 rounded shadow flex items-center whitespace-nowrap animate-pulse">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Required
                          <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-amber-500"></div>
                        </div>
                      )}
                      
                      {field.type === "signature" || field.type === "initials" ? (
                        <div className={\`
                          border-2 rounded-md flex items-center justify-center relative min-w-[200px] min-h-[60px] p-2
                          \${isCompleted 
                            ? 'border-transparent bg-transparent text-black' 
                            : field.required 
                              ? 'border-amber-400 bg-amber-50/50 text-amber-700 hover:bg-amber-100' 
                              : 'border-neutral-300 bg-neutral-50/50 text-neutral-600 hover:bg-neutral-100'}
                        \`}>
                          {isCompleted ? (
                            <div className="flex flex-col items-center w-full">
                              <span className={\`text-3xl text-indigo-900 \${selectedFont}\`}>{field.value}</span>
                              <div className="text-[8px] text-neutral-400 mt-1 uppercase tracking-wider">DocuSigned by: {field.label}</div>
                              <div className="text-[6px] text-neutral-300">ID: {Math.random().toString(36).substring(7).toUpperCase()}</div>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              {field.type === "signature" ? <PenTool className="w-5 h-5 opacity-70" /> : <Type className="w-5 h-5 opacity-70" />}
                              <span className="font-semibold text-sm uppercase tracking-wider">{field.label}</span>
                            </div>
                          )}
                          {!isCompleted && field.required && (
                            <div className="absolute -top-2 -right-2 bg-amber-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shadow">!</div>
                          )}
                        </div>
                      ) : field.type === "text" || field.type === "date" ? (
                        <div className="relative">
                          <div className="text-xs text-neutral-400 absolute -top-4 left-0 font-medium">{field.label} {field.required && <span className="text-red-500">*</span>}</div>
                          <input 
                            type={field.type === "date" ? "date" : "text"}
                            className={\`
                              h-10 px-3 w-48 rounded text-sm text-black border-2 outline-none transition-colors
                              \${isCompleted
                                ? 'border-transparent bg-transparent border-b-neutral-300 rounded-none px-0'
                                : field.required
                                  ? 'border-amber-400 bg-amber-50/30 focus:border-indigo-500 focus:bg-indigo-50/30'
                                  : 'border-neutral-300 bg-neutral-50/30 focus:border-indigo-500 focus:bg-indigo-50/30'
                              }
                            \`}
                            placeholder={!isCompleted ? \`Enter \${field.label.toLowerCase()}\` : ""}
                            value={field.value as string}
                            onChange={(e) => updateFieldValue(field.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : field.type === "checkbox" ? (
                        <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-neutral-100/50" onClick={(e) => e.stopPropagation()}>
                          <div className={\`
                            w-6 h-6 rounded flex items-center justify-center border-2 transition-colors
                            \${field.value 
                              ? 'bg-indigo-600 border-indigo-600 text-white' 
                              : field.required 
                                ? 'border-amber-400 bg-amber-50' 
                                : 'border-neutral-300 bg-white'
                            }
                          \`}>
                            {field.value && <Check className="w-4 h-4" />}
                          </div>
                          <span className="text-sm font-medium text-neutral-700">{field.label}</span>
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </main>

        {/* Right Sidebar (Tools/Info) */}
        <aside className="w-80 flex-none border-l border-neutral-800 bg-neutral-900/30 flex flex-col z-10">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-neutral-800">
            {[
              { id: "details", icon: <Info className="w-4 h-4"/>, label: "Details" },
              { id: "comments", icon: <MessageSquare className="w-4 h-4"/>, label: "Comments" },
              { id: "audit", icon: <History className="w-4 h-4"/>, label: "Audit" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSidebar(tab.id as any)}
                className={\`flex-1 py-3 px-2 flex flex-col items-center justify-center gap-1 text-xs font-medium border-b-2 transition-colors \${
                  activeSidebar === tab.id 
                    ? 'border-indigo-500 text-indigo-400 bg-neutral-800/50' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/30'
                }\`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            {activeSidebar === "details" && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">Document Info</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Status</span>
                      <span className="text-amber-400 font-medium bg-amber-400/10 px-2 py-0.5 rounded">Action Required</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Sent Date</span>
                      <span className="text-neutral-300">Oct 24, 2023</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Expiration</span>
                      <span className="text-neutral-300">Nov 24, 2023</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Sender</span>
                      <span className="text-neutral-300">Legal Dept.</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-neutral-800"></div>

                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">Recipients</h4>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-500/50">JD</div>
                      <div>
                        <div className="text-sm font-medium text-white flex items-center gap-2">John Doe <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 rounded uppercase tracking-wider">Current</span></div>
                        <div className="text-xs text-neutral-500">Signer • john@example.com</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center font-bold text-xs">AS</div>
                      <div>
                        <div className="text-sm font-medium text-neutral-300">Alice Smith</div>
                        <div className="text-xs text-neutral-500">Approver • Waiting</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-neutral-800"></div>

                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">Security</h4>
                  <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800 flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-emerald-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-neutral-300">Bank-level Encryption</div>
                      <div className="text-xs text-neutral-500 mt-1">This document is secured with 256-bit encryption and complies with eSIGN and UETA standards.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSidebar === "audit" && (
              <div className="space-y-6">
                <h4 className="text-sm font-semibold text-white mb-4">Activity Log</h4>
                <div className="relative border-l border-neutral-800 ml-3 space-y-6 pb-4">
                  {AUDIT_TRAIL.map((event, i) => (
                    <div key={event.id} className="relative pl-6">
                      <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center text-neutral-400">
                        {event.icon}
                      </div>
                      <div className="text-sm font-medium text-neutral-200">{event.action}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{event.time}</div>
                      <div className="text-xs text-neutral-400 mt-1 flex items-center"><User className="w-3 h-3 mr-1"/> {event.user}</div>
                    </div>
                  ))}
                  <div className="relative pl-6">
                    <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-neutral-900 border border-indigo-500/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                    </div>
                    <div className="text-sm font-medium text-indigo-400">Waiting for your signature</div>
                  </div>
                </div>
              </div>
            )}

            {activeSidebar === "comments" && (
              <div className="flex flex-col h-full">
                <div className="flex-1 space-y-4">
                  <div className="bg-neutral-800/50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-indigo-400">Legal Dept.</span>
                      <span className="text-xs text-neutral-500">Oct 24</span>
                    </div>
                    <p className="text-neutral-300">Please review section 4 carefully before signing. We've updated the liability clauses.</p>
                  </div>
                </div>
                <div className="mt-4 relative">
                  <textarea 
                    placeholder="Add a comment..." 
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-24"
                  ></textarea>
                  <button className="absolute bottom-3 right-3 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Adopt Signature Modal */}
      {showAdoptSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Adopt Your Signature</h2>
              <button onClick={() => setShowAdoptSignature(false)} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex border-b border-neutral-800 bg-neutral-950/50">
              {[
                { id: "draw", label: "Draw", icon: <PenTool className="w-4 h-4"/> },
                { id: "type", label: "Type", icon: <Type className="w-4 h-4"/> },
                { id: "upload", label: "Upload", icon: <ImageIcon className="w-4 h-4"/> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSignatureMode(tab.id as any)}
                  className={\`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors border-b-2 \${
                    signatureMode === tab.id 
                      ? 'border-indigo-500 text-indigo-400 bg-neutral-900' 
                      : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                  }\`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 bg-neutral-900">
              {signatureMode === "draw" && (
                <div className="space-y-4">
                  <div className="text-sm text-neutral-400">Draw your signature in the box below using your mouse or touch screen.</div>
                  <div className="h-64 border-2 border-dashed border-neutral-700 bg-neutral-950 rounded-xl relative flex items-center justify-center group cursor-crosshair">
                    <span className="text-neutral-600 font-medium group-hover:opacity-0 transition-opacity flex flex-col items-center">
                      <PenTool className="w-8 h-8 mb-2 opacity-50" />
                      Sign Here
                    </span>
                    <div className="absolute bottom-4 left-4 right-4 h-px bg-neutral-800"></div>
                    <div className="absolute bottom-0 right-4 translate-y-1/2 flex space-x-2">
                      <button className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1 rounded-full border border-neutral-700 shadow-sm transition-colors">Clear</button>
                    </div>
                  </div>
                </div>
              )}

              {signatureMode === "type" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-300">Full Name</label>
                      <input 
                        type="text" 
                        value={typedSignature}
                        onChange={e => setTypedSignature(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-300">Initials</label>
                      <input 
                        type="text" 
                        value={typedInitials}
                        onChange={e => setTypedInitials(e.target.value)}
                        placeholder="JD"
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-neutral-300">Select Style</label>
                    <div className="grid grid-cols-2 gap-3 h-48 overflow-y-auto custom-scrollbar pr-2">
                      {[
                        { id: "font-serif", name: "Classic Serif" },
                        { id: "font-sans", name: "Modern Sans" },
                        { id: "font-mono", name: "Typewriter" },
                        { id: "italic font-serif", name: "Elegant Italic" },
                      ].map(font => (
                        <button
                          key={font.id}
                          onClick={() => setSelectedFont(font.id)}
                          className={\`p-4 rounded-xl border text-left transition-all \${
                            selectedFont === font.id 
                              ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500' 
                              : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600'
                          }\`}
                        >
                          <div className={\`text-2xl text-white mb-2 \${font.id}\`}>{typedSignature || "John Doe"}</div>
                          <div className={\`text-sm text-neutral-400 \${font.id}\`}>{typedInitials || "JD"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {signatureMode === "upload" && (
                <div className="space-y-4">
                  <div className="text-sm text-neutral-400">Upload an image of your signature or initials.</div>
                  <div className="h-64 border-2 border-dashed border-neutral-700 bg-neutral-950 rounded-xl flex flex-col items-center justify-center hover:bg-neutral-900 transition-colors cursor-pointer group">
                    <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-8 h-8 text-neutral-400" />
                    </div>
                    <span className="text-base font-medium text-white mb-1">Click to upload</span>
                    <span className="text-xs text-neutral-500">PNG, JPG or GIF (max 5MB)</span>
                  </div>
                </div>
              )}

              <div className="mt-8 bg-neutral-800/50 p-4 rounded-xl flex items-start space-x-3 text-sm">
                <Shield className="w-5 h-5 text-indigo-400 flex-none mt-0.5" />
                <p className="text-neutral-300">By clicking <strong className="text-white">Adopt and Sign</strong>, I agree that the signature and initials will be the electronic representation of my signature and initials for all purposes when I (or my agent) use them on documents, including legally binding contracts - just the same as a pen-and-paper signature or initial.</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950 flex justify-end space-x-3">
              <button 
                onClick={() => setShowAdoptSignature(false)}
                className="px-5 py-2.5 text-sm font-medium text-neutral-300 hover:text-white bg-transparent hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={applySignature}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/25 transition-all"
              >
                Adopt and Sign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Signing Modal */}
      {showFinalize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-center animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-br from-indigo-900/50 to-neutral-900 p-8 pb-6">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/10">
                <Check className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Almost Done!</h2>
              <p className="text-neutral-400">You've completed all required fields. Click below to finalize your signing process.</p>
            </div>
            
            <div className="p-8 bg-neutral-900 border-t border-neutral-800 space-y-6">
              <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl text-left">
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center"><FileText className="w-4 h-4 mr-2 text-indigo-400"/> Document Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Document</span>
                    <span className="text-neutral-300 font-medium">Master Services Agreement 2024.pdf</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Total Pages</span>
                    <span className="text-neutral-300 font-medium">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Fields Completed</span>
                    <span className="text-emerald-400 font-medium">{completedRequired} / {totalRequired}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-neutral-500 text-left">
                By clicking "Agree & Sign", you are legally binding yourself to the terms and conditions outlined in this document under the U.S. Electronic Signatures in Global and National Commerce Act (E-Sign Act).
              </div>
              
              <div className="pt-2 flex flex-col gap-3">
                <button 
                  onClick={() => alert('Document Signed Successfully!')}
                  className="w-full py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center"
                >
                  <FileSignature className="w-5 h-5 mr-2" />
                  Agree & Sign
                </button>
                <button 
                  onClick={() => setShowFinalize(false)}
                  className="w-full py-3 text-sm font-medium text-neutral-400 hover:text-white bg-transparent hover:bg-neutral-800 rounded-xl transition-colors"
                >
                  Return to Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for Mobile */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <button 
          onClick={handleNextRequired}
          className="w-14 h-14 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-indigo-500 transition-colors"
        >
          {requiredFields.length > 0 ? <ChevronRight className="w-6 h-6" /> : <Check className="w-6 h-6" />}
        </button>
      </div>

    </div>
  );
}
