'use client';

import React, { useState } from 'react';
import {
  Search, Plus, MoreVertical, Settings, Save, ArrowLeft,
  ChevronDown, Type, AlignLeft, CheckSquare, List,
  Calendar, Hash, Link as LinkIcon, Image as ImageIcon,
  FileText, Copy, Trash2, GripVertical, AlertCircle,
  Eye, Send, Undo, Redo, ZoomIn, ZoomOut, Maximize,
  MousePointer2, Hand, X, PenTool, LayoutTemplate,
  Users, Briefcase, FileSignature, Layers, ShieldCheck,
  Zap, Bell, Lock, Key, MousePointerClick, ChevronRight,
  Palette, Smartphone, Monitor, ChevronUp, GripHorizontal,
  BoxSelect, Stamp, Keyboard, Mail, MessageSquare,
  Paperclip, Tag, Database, ArrowUpRight, ArrowDownRight,
  AlignRight, AlignCenter, Bold, Italic, Underline,
  Unlock, SplitSquareHorizontal, Move, Component, Activity,
  Download, Upload, Share2
} from 'lucide-react';

export default function SabSignFormBuilder() {
  const [activeLeftTab, setActiveLeftTab] = useState('fields');
  const [activeRightTab, setActiveRightTab] = useState('properties');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedField, setSelectedField] = useState<string | null>('field-1');
  const [canvasMode, setCanvasMode] = useState('select');
  const [activeRecipient, setActiveRecipient] = useState('signer1');
  const [isGridVisible, setIsGridVisible] = useState(true);

  const tools = {
    signature: [
      { id: 'sig', name: 'Signature', icon: PenTool, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
      { id: 'initials', name: 'Initials', icon: Stamp, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
      { id: 'stamp', name: 'Company Stamp', icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    ],
    standard: [
      { id: 'name', name: 'Full Name', icon: Type, color: 'text-zinc-300', bg: 'bg-zinc-800/50', border: 'border-zinc-700/50' },
      { id: 'email', name: 'Email Address', icon: Mail, color: 'text-zinc-300', bg: 'bg-zinc-800/50', border: 'border-zinc-700/50' },
      { id: 'company', name: 'Company', icon: Briefcase, color: 'text-zinc-300', bg: 'bg-zinc-800/50', border: 'border-zinc-700/50' },
      { id: 'title', name: 'Job Title', icon: Tag, color: 'text-zinc-300', bg: 'bg-zinc-800/50', border: 'border-zinc-700/50' },
      { id: 'date', name: 'Date Signed', icon: Calendar, color: 'text-zinc-300', bg: 'bg-zinc-800/50', border: 'border-zinc-700/50' },
    ],
    custom: [
      { id: 'text', name: 'Text Field', icon: AlignLeft, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { id: 'checkbox', name: 'Checkbox', icon: CheckSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { id: 'radio', name: 'Radio Group', icon: MousePointerClick, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { id: 'dropdown', name: 'Dropdown', icon: List, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { id: 'attachment', name: 'Attachment', icon: Paperclip, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { id: 'formula', name: 'Formula', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    ]
  };

  const recipients = [
    { id: 'signer1', name: 'Client (Signer 1)', color: 'bg-blue-500', text: 'text-blue-500', role: 'Needs to Sign', email: 'client@example.com' },
    { id: 'signer2', name: 'Manager (Signer 2)', color: 'bg-emerald-500', text: 'text-emerald-500', role: 'Needs to Sign', email: 'manager@company.com' },
    { id: 'cc1', name: 'Legal Dept', color: 'bg-purple-500', text: 'text-purple-500', role: 'Receives a Copy', email: 'legal@company.com' },
  ];

  const droppedFields = [
    { id: 'field-1', type: 'signature', label: 'Signature', x: 120, y: 780, w: 200, h: 50, recipient: 'signer1', required: true },
    { id: 'field-2', type: 'date', label: 'Date Signed', x: 450, y: 780, w: 150, h: 50, recipient: 'signer1', required: true },
    { id: 'field-3', type: 'name', label: 'Printed Name', x: 120, y: 850, w: 200, h: 30, recipient: 'signer1', required: false },
    { id: 'field-4', type: 'checkbox', label: 'I agree to terms', x: 120, y: 720, w: 20, h: 20, recipient: 'signer1', required: true },
    { id: 'field-5', type: 'initials', label: 'Initials', x: 680, y: 150, w: 60, h: 40, recipient: 'signer2', required: true },
  ];

  const propertiesTabs = [
    { id: 'properties', label: 'Settings', icon: Settings },
    { id: 'logic', label: 'Logic', icon: SplitSquareHorizontal },
    { id: 'appearance', label: 'Style', icon: Palette },
  ];

  const renderFieldOnCanvas = (field: any) => {
    const isSelected = selectedField === field.id;
    const recipientColorClass = recipients.find(r => r.id === field.recipient)?.color || 'bg-zinc-500';
    const recipientTextClass = recipients.find(r => r.id === field.recipient)?.text || 'text-zinc-500';

    return (
      <div
        key={field.id}
        onClick={() => setSelectedField(field.id)}
        className={`absolute cursor-move flex items-center justify-center transition-all
          ${isSelected ? 'ring-2 ring-blue-500 z-20 shadow-lg' : 'ring-1 ring-zinc-300 hover:ring-blue-400 z-10'}
        `}
        style={{
          left: `${field.x}px`,
          top: `${field.y}px`,
          width: `${field.w}px`,
          height: `${field.h}px`,
          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.9)',
        }}
      >
        <div className={`absolute top-0 left-0 w-full h-1 opacity-80 ${recipientColorClass}`} />
        
        {field.type === 'signature' && <PenTool className={`w-5 h-5 ${recipientTextClass}`} />}
        {field.type === 'date' && <Calendar className={`w-5 h-5 ${recipientTextClass}`} />}
        {field.type === 'name' && <Type className={`w-5 h-5 ${recipientTextClass}`} />}
        {field.type === 'checkbox' && <CheckSquare className={`w-5 h-5 ${recipientTextClass}`} />}
        {field.type === 'initials' && <Stamp className={`w-5 h-5 ${recipientTextClass}`} />}

        {isSelected && (
          <>
            <div className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 cursor-pointer shadow-md hover:bg-red-600 transition-colors">
              <X className="w-3 h-3" />
            </div>
            {/* Resize Handles */}
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-se-resize shadow-sm" />
            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize shadow-sm" />
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize shadow-sm" />
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize shadow-sm" />
          </>
        )}
        
        <div className={`absolute -bottom-6 left-0 text-[10px] font-medium px-1 rounded truncate max-w-full ${recipientTextClass} bg-zinc-100/80`}>
          {field.label} {field.required && '*'}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#09090B] text-zinc-100 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#09090B] border-b border-zinc-800/80 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-zinc-800"></div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-wide">Enterprise_NDA_v2.pdf</h1>
              <span className="px-2 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-300 rounded-full">Draft</span>
            </div>
            <span className="text-xs text-zinc-500">Last saved just now</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Canvas Tools */}
          <div className="flex items-center p-1 bg-zinc-900 rounded-lg border border-zinc-800/80 mr-4">
            <button 
              onClick={() => setCanvasMode('select')}
              className={`p-1.5 rounded-md transition-colors ${canvasMode === 'select' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              title="Select Tool (V)"
            >
              <MousePointer2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCanvasMode('pan')}
              className={`p-1.5 rounded-md transition-colors ${canvasMode === 'pan' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              title="Pan Tool (H)"
            >
              <Hand className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-zinc-800 mx-1"></div>
            <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-colors" title="Undo (Cmd+Z)">
              <Undo className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-colors" title="Redo (Cmd+Shift+Z)">
              <Redo className="w-4 h-4" />
            </button>
          </div>

          <button className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors mr-2">
            <Settings className="w-5 h-5" />
          </button>
          
          <button className="px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] flex items-center gap-2 ml-2">
            <Send className="w-4 h-4" />
            Send for Signature
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar - Tool Palette */}
        <div className="w-72 bg-[#09090B] border-r border-zinc-800/80 flex flex-col shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
          {/* Sidebar Tabs */}
          <div className="flex p-2 gap-1 border-b border-zinc-800/80 bg-zinc-950/50">
            <button 
              onClick={() => setActiveLeftTab('fields')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors
                ${activeLeftTab === 'fields' ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900'}
              `}
            >
              <LayoutTemplate className="w-4 h-4" />
              Fields
            </button>
            <button 
              onClick={() => setActiveLeftTab('recipients')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors
                ${activeLeftTab === 'recipients' ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900'}
              `}
            >
              <Users className="w-4 h-4" />
              Recipients
            </button>
            <button 
              onClick={() => setActiveLeftTab('data')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors
                ${activeLeftTab === 'data' ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900'}
              `}
            >
              <Database className="w-4 h-4" />
              Data
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
            {activeLeftTab === 'fields' && (
              <>
                {/* Active Recipient Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Assign Fields To</label>
                  </div>
                  <div className="relative">
                    <select 
                      value={activeRecipient}
                      onChange={(e) => setActiveRecipient(e.target.value)}
                      className="w-full appearance-none bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 pl-3 pr-10 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow cursor-pointer"
                    >
                      {recipients.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    {/* Color indicator for active recipient */}
                    <div className={`absolute right-10 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${recipients.find(r => r.id === activeRecipient)?.color}`} />
                  </div>
                </div>

                {/* Signature Fields */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-zinc-500 flex items-center gap-2 uppercase tracking-wider">
                    <FileSignature className="w-3.5 h-3.5" /> E-Signature
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {tools.signature.map(tool => (
                      <div key={tool.id} className={`flex flex-col items-center justify-center p-3 rounded-xl border ${tool.border} ${tool.bg} cursor-grab hover:brightness-110 transition-all group`}>
                        <tool.icon className={`w-5 h-5 mb-2 ${tool.color} group-hover:scale-110 transition-transform`} />
                        <span className="text-[11px] font-medium text-zinc-300">{tool.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent"></div>

                {/* Standard Fields */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-zinc-500 flex items-center gap-2 uppercase tracking-wider">
                    <Component className="w-3.5 h-3.5" /> Auto-Fill Fields
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {tools.standard.map(tool => (
                      <div key={tool.id} className={`flex flex-col items-start p-2.5 rounded-lg border ${tool.border} ${tool.bg} cursor-grab hover:bg-zinc-800 hover:border-zinc-700 transition-all group`}>
                        <div className="flex items-center gap-2 mb-1">
                          <tool.icon className={`w-3.5 h-3.5 ${tool.color}`} />
                          <span className="text-[11px] font-medium text-zinc-200">{tool.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent"></div>

                {/* Custom Data Fields */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-zinc-500 flex items-center gap-2 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5" /> Input Fields
                  </h3>
                  <div className="flex flex-col gap-2">
                    {tools.custom.map(tool => (
                      <div key={tool.id} className={`flex items-center p-2.5 rounded-lg border ${tool.border} bg-zinc-900 cursor-grab hover:bg-zinc-800/80 transition-all group relative overflow-hidden`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${tool.bg.replace('/10', '/50')}`} />
                        <tool.icon className={`w-4 h-4 ml-2 mr-3 ${tool.color}`} />
                        <span className="text-xs font-medium text-zinc-300">{tool.name}</span>
                        <GripHorizontal className="w-3.5 h-3.5 text-zinc-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeLeftTab === 'recipients' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-200">Signing Order</h3>
                  <button className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                
                <div className="space-y-2">
                  {recipients.map((r, index) => (
                    <div key={r.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full ${r.color} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}>
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium text-zinc-200">{r.name}</span>
                        </div>
                        <MoreVertical className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 cursor-pointer" />
                      </div>
                      <div className="pl-7 space-y-1">
                        <div className="text-xs text-zinc-500">{r.email}</div>
                        <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide bg-zinc-950 inline-block px-1.5 py-0.5 rounded">
                          {r.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Canvas Area (PDF Mockup) */}
        <div className="flex-1 bg-[#09090B] relative overflow-hidden flex flex-col">
          
          {/* Canvas Toolbar overlay */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-zinc-900/90 backdrop-blur-md border border-zinc-800/80 rounded-xl shadow-2xl">
            <button 
              onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-16 text-center cursor-pointer hover:bg-zinc-800 rounded py-1 transition-colors">
              <span className="text-xs font-semibold text-zinc-200">{zoomLevel}%</span>
            </div>
            <button 
              onClick={() => setZoomLevel(Math.min(300, zoomLevel + 25))}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-zinc-800 mx-1"></div>
            <button 
              onClick={() => setIsGridVisible(!isGridVisible)}
              className={`p-1.5 rounded-lg transition-colors ${isGridVisible ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}
              title="Toggle Grid"
            >
              <BoxSelect className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas Container */}
          <div className="flex-1 overflow-auto custom-scrollbar relative bg-zinc-950/50 flex items-start justify-center p-12">
            
            {/* The PDF Document Page */}
            <div 
              className={`relative bg-white shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-transform origin-top`}
              style={{ 
                width: '816px', 
                height: '1056px',
                transform: `scale(${zoomLevel / 100})`,
                cursor: canvasMode === 'pan' ? 'grab' : 'default'
              }}
            >
              {/* Grid overlay */}
              {isGridVisible && (
                <div 
                  className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{ 
                    backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', 
                    backgroundSize: '20px 20px' 
                  }}
                />
              )}

              {/* Mock Document Content */}
              <div className="p-16 text-zinc-800 h-full flex flex-col font-serif select-none pointer-events-none">
                <div className="flex justify-between items-end border-b-2 border-zinc-800 pb-4 mb-8">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">NON-DISCLOSURE AGREEMENT</h1>
                    <p className="text-zinc-500 mt-2 text-sm font-sans">Document ID: SAB-2026-991A</p>
                  </div>
                  <div className="w-16 h-16 bg-zinc-100 flex items-center justify-center border border-zinc-200">
                    <span className="text-[10px] text-zinc-400 font-sans">LOGO</span>
                  </div>
                </div>

                <div className="space-y-6 text-[15px] leading-relaxed text-justify">
                  <p>
                    This Non-Disclosure Agreement (the "Agreement") is entered into as of the date of the last signature below (the "Effective Date") by and between the Disclosing Party and the Receiving Party (collectively referred to as the "Parties").
                  </p>

                  <div className="bg-zinc-50 p-6 border border-zinc-200 rounded-sm">
                    <h3 className="font-bold mb-4 font-sans text-sm uppercase tracking-wide text-zinc-500">1. Definition of Confidential Information</h3>
                    <p>
                      For purposes of this Agreement, "Confidential Information" shall include all information or material that has or could have commercial value or other utility in the business in which Disclosing Party is engaged. If Confidential Information is in written form, the Disclosing Party shall label or stamp the materials with the word "Confidential" or some similar warning. If Confidential Information is transmitted orally, the Disclosing Party shall promptly provide a writing indicating that such oral communication constituted Confidential Information.
                    </p>
                  </div>

                  <p>
                    <strong>2. Exclusions from Confidential Information.</strong> Receiving Party's obligations under this Agreement do not extend to information that is: (a) publicly known at the time of disclosure or subsequently becomes publicly known through no fault of the Receiving Party; (b) discovered or created by the Receiving Party before disclosure by Disclosing Party; (c) learned by the Receiving Party through legitimate means other than from the Disclosing Party or Disclosing Party's representatives; or (d) is disclosed by Receiving Party with Disclosing Party's prior written approval.
                  </p>
                  
                  <p>
                    <strong>3. Obligations of Receiving Party.</strong> Receiving Party shall hold and maintain the Confidential Information in strictest confidence for the sole and exclusive benefit of the Disclosing Party. Receiving Party shall carefully restrict access to Confidential Information to employees, contractors and third parties as is reasonably required and shall require those persons to sign nondisclosure restrictions at least as protective as those in this Agreement.
                  </p>

                  <p>
                    <strong>4. Time Periods.</strong> The nondisclosure provisions of this Agreement shall survive the termination of this Agreement and Receiving Party's duty to hold Confidential Information in confidence shall remain in effect until the Confidential Information no longer qualifies as a trade secret or until Disclosing Party sends Receiving Party written notice releasing Receiving Party from this Agreement, whichever occurs first.
                  </p>
                </div>

                <div className="mt-auto">
                  <h3 className="font-bold text-lg mb-8">IN WITNESS WHEREOF, the Parties have executed this Agreement.</h3>
                  
                  <div className="flex justify-between gap-12">
                    <div className="flex-1 space-y-8">
                      <div className="font-bold font-sans text-sm text-zinc-500 uppercase tracking-wide">Disclosing Party (Party A)</div>
                      <div className="border-b border-zinc-400 relative h-10">
                        {/* Area for dropped fields */}
                      </div>
                      <div className="border-b border-zinc-400 relative h-10">
                        {/* Area for dropped fields */}
                      </div>
                    </div>
                    <div className="flex-1 space-y-8">
                      <div className="font-bold font-sans text-sm text-zinc-500 uppercase tracking-wide">Receiving Party (Party B)</div>
                      <div className="border-b border-zinc-400 relative h-10">
                        {/* Area for dropped fields */}
                      </div>
                      <div className="border-b border-zinc-400 relative h-10">
                        {/* Area for dropped fields */}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-8 left-0 w-full text-center text-xs text-zinc-400 font-sans">
                  Page 1 of 1
                </div>
              </div>

              {/* Render Dropped Form Fields */}
              {droppedFields.map(renderFieldOnCanvas)}

            </div>
          </div>
          
          {/* Page Navigator Bottom Right */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-xl border border-zinc-800/80 shadow-2xl z-20">
            <button className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
              <ChevronUp className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-zinc-300 px-2">Page 1 / 4</span>
            <button className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-80 bg-[#09090B] border-l border-zinc-800/80 flex flex-col shrink-0 z-20 shadow-[-4px_0_24px_rgba(0,0,0,0.2)]">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800/80 flex items-center gap-3 bg-zinc-950/50">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Signature Field</h2>
              <p className="text-xs text-zinc-500">ID: field-1</p>
            </div>
          </div>

          {/* Properties Tabs */}
          <div className="flex border-b border-zinc-800/80 bg-zinc-900/30">
            {propertiesTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveRightTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all relative
                  ${activeRightTab === tab.id ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}
                `}
              >
                <tab.icon className={`w-4 h-4 ${activeRightTab === tab.id ? 'opacity-100' : 'opacity-70'}`} />
                {tab.label}
                {activeRightTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.5)]" />
                )}
              </button>
            ))}
          </div>

          {/* Properties Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            
            {activeRightTab === 'properties' && (
              <>
                {/* Basic Settings */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Basic</h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                      Field Label
                      <span className="text-[10px] text-zinc-600">Visible to signer</span>
                    </label>
                    <input 
                      type="text" 
                      defaultValue="Signature"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Data Label (API Key)</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input 
                        type="text" 
                        defaultValue="signer_1_signature"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-[13px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Assigned To</label>
                    <select className="w-full appearance-none bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all">
                      <option>Client (Signer 1)</option>
                      <option>Manager (Signer 2)</option>
                    </select>
                  </div>
                </div>

                <div className="h-px w-full bg-zinc-800/80"></div>

                {/* Validation */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Validation</h3>
                  
                  <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-zinc-200">Required Field</span>
                      <span className="text-[11px] text-zinc-500">Must be filled to submit</span>
                    </div>
                    {/* Mock Toggle */}
                    <div className="w-9 h-5 bg-blue-600 rounded-full relative cursor-pointer shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg opacity-60">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-zinc-200">Read Only</span>
                      <span className="text-[11px] text-zinc-500">Signer cannot edit</span>
                    </div>
                    <div className="w-9 h-5 bg-zinc-800 rounded-full relative cursor-not-allowed">
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-zinc-500 rounded-full"></div>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-zinc-800/80"></div>

                {/* Advanced */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Advanced</h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Tooltip / Help Text</label>
                    <textarea 
                      rows={2}
                      placeholder="Add instructions for the signer..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none placeholder:text-zinc-600 custom-scrollbar"
                    />
                  </div>
                </div>
              </>
            )}

            {activeRightTab === 'logic' && (
              <div className="space-y-6">
                <div className="flex items-center justify-center p-8 bg-zinc-900/50 border border-zinc-800/80 border-dashed rounded-xl flex-col text-center">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mb-3">
                    <SplitSquareHorizontal className="w-6 h-6 text-purple-400" />
                  </div>
                  <h4 className="text-sm font-medium text-zinc-200 mb-1">Conditional Logic</h4>
                  <p className="text-xs text-zinc-500 mb-4 max-w-[200px]">Show or hide this field based on other field values.</p>
                  <button className="px-4 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors border border-zinc-700">
                    Add Rule
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> No logic rules applied yet.
                  </div>
                  <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-2 opacity-50 select-none">
                    <div className="text-[11px] text-zinc-500 font-medium uppercase">Example Rule</div>
                    <div className="text-sm text-zinc-300">
                      <span className="text-blue-400">IF</span> Checkbox 1 <span className="text-blue-400">IS</span> Checked<br/>
                      <span className="text-emerald-400">THEN</span> Show this field
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeRightTab === 'appearance' && (
              <div className="space-y-6">
                {/* Dimensions */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Move className="w-3.5 h-3.5" /> Dimensions & Position
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 font-medium">Width (px)</label>
                      <input type="number" defaultValue="200" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 font-medium">Height (px)</label>
                      <input type="number" defaultValue="50" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 font-medium">X Pos</label>
                      <input type="number" defaultValue="120" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 font-medium">Y Pos</label>
                      <input type="number" defaultValue="780" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-zinc-800/80"></div>

                {/* Styling (Disabled for signature, but mock UI) */}
                <div className="space-y-4 opacity-50 pointer-events-none">
                  <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Type className="w-3.5 h-3.5" /> Typography
                  </h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-medium">Font Family</label>
                    <select className="w-full appearance-none bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300">
                      <option>Inter (Sans-serif)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] text-zinc-500 font-medium">Size</label>
                      <select className="w-full appearance-none bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300">
                        <option>14px</option>
                      </select>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] text-zinc-500 font-medium">Color</label>
                      <div className="w-full h-[34px] bg-zinc-900 border border-zinc-800 rounded-lg flex items-center px-2 gap-2">
                        <div className="w-4 h-4 rounded bg-black border border-zinc-700"></div>
                        <span className="text-xs text-zinc-300">#000000</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
                    <div className="p-1.5 rounded hover:bg-zinc-800"><Bold className="w-4 h-4 text-zinc-400" /></div>
                    <div className="p-1.5 rounded hover:bg-zinc-800"><Italic className="w-4 h-4 text-zinc-400" /></div>
                    <div className="p-1.5 rounded hover:bg-zinc-800"><Underline className="w-4 h-4 text-zinc-400" /></div>
                    <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                    <div className="p-1.5 rounded bg-zinc-800"><AlignLeft className="w-4 h-4 text-zinc-200" /></div>
                    <div className="p-1.5 rounded hover:bg-zinc-800"><AlignCenter className="w-4 h-4 text-zinc-400" /></div>
                    <div className="p-1.5 rounded hover:bg-zinc-800"><AlignRight className="w-4 h-4 text-zinc-400" /></div>
                  </div>
                </div>

              </div>
            )}
          </div>
          
          {/* Quick Actions Bottom */}
          <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center gap-2">
             <button className="flex-1 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex items-center justify-center gap-2">
               <Copy className="w-3.5 h-3.5" /> Duplicate
             </button>
             <button className="flex-1 py-2 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors flex items-center justify-center gap-2">
               <Trash2 className="w-3.5 h-3.5" /> Delete
             </button>
          </div>

        </div>

      </div>
    </div>
  );
}
