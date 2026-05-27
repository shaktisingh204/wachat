"use client";

import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Zap,
  Clock,
  Globe,
  MessageSquare,
  Mail,
  Smartphone,
  GitBranch,
  SplitSquareHorizontal,
  Play,
  Rocket,
  MoreVertical,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronDown,
  Activity,
  AlertCircle,
  Database
} from 'lucide-react';

export default function DripsBuilderShell() {
  const [activeTab, setActiveTab] = useState('build');
  const [selectedNode, setSelectedNode] = useState<string | null>('node-sms');

  return (
    <div className="flex h-screen w-full flex-col bg-zoru-ink text-zoru-ink-muted font-sans overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-zoru-ink px-4 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button className="rounded-md p-1.5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="h-4 w-4 text-zoru-ink-muted" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zoru-ink/20 text-zoru-ink-muted">
              <Zap className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-medium text-white">Onboarding Welcome Series</h1>
            <span className="ml-2 rounded-full bg-zoru-ink/10 px-2 py-0.5 text-[10px] font-medium text-zoru-ink-muted border border-zoru-line/20">
              Live
            </span>
          </div>
        </div>

        <div className="flex items-center rounded-lg bg-zoru-ink p-1 border border-white/5">
          <button
            onClick={() => setActiveTab('build')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'build' ? 'bg-zoru-ink text-white shadow' : 'text-zoru-ink-muted hover:text-white'
            }`}
          >
            Build
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'test' ? 'bg-zoru-ink text-white shadow' : 'text-zoru-ink-muted hover:text-white'
            }`}
          >
            Test
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'analytics' ? 'bg-zoru-ink text-white shadow' : 'text-zoru-ink-muted hover:text-white'
            }`}
          >
            Analytics
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 border-r border-white/10 mr-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zoru-surface-2 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zoru-ink"></span>
            </span>
            <span className="text-xs text-zoru-ink-muted">Saved just now</span>
          </div>
          <button className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-zoru-ink-muted hover:bg-white/10 transition-colors border border-white/5">
            <Play className="h-3.5 w-3.5" />
            Test Flow
          </button>
          <button className="flex items-center gap-2 rounded-md bg-gradient-to-b from-zoru-ink to-zoru-ink px-4 py-1.5 text-xs font-medium text-white hover:from-zoru-surface-2 hover:to-zoru-ink transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-zoru-line/30">
            <Rocket className="h-3.5 w-3.5" />
            Deploy
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar - Node Palette */}
        <aside className="w-72 shrink-0 flex flex-col border-r border-white/10 bg-zoru-ink z-10">
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink" />
              <input
                type="text"
                placeholder="Search nodes..."
                className="w-full rounded-md bg-zoru-ink border border-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-zoru-ink focus:outline-none focus:ring-1 focus:ring-zoru-line/50 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
            {/* Category: Triggers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zoru-ink">Triggers</h3>
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-zoru-ink-muted">3</span>
              </div>
              <div className="space-y-1.5">
                <DraggableNode icon={<Globe />} title="Webhook Received" desc="Trigger on external event" color="purple" />
                <DraggableNode icon={<Clock />} title="Scheduled Time" desc="Run at specific intervals" color="purple" />
                <DraggableNode icon={<Zap />} title="App Event" desc="When a user performs action" color="purple" />
              </div>
            </div>

            {/* Category: Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zoru-ink">Actions</h3>
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-zoru-ink-muted">4</span>
              </div>
              <div className="space-y-1.5">
                <DraggableNode icon={<MessageSquare />} title="Send SMS" desc="Dispatch text message" color="blue" />
                <DraggableNode icon={<Mail />} title="Send Email" desc="Send via external provider" color="blue" />
                <DraggableNode icon={<Smartphone />} title="Push Notification" desc="Send to mobile app" color="blue" />
                <DraggableNode icon={<Database />} title="Update Record" desc="Modify user attributes" color="blue" />
              </div>
            </div>

            {/* Category: Logic */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zoru-ink">Logic</h3>
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-zoru-ink-muted">3</span>
              </div>
              <div className="space-y-1.5">
                <DraggableNode icon={<GitBranch />} title="If / Else" desc="Branch based on conditions" color="orange" />
                <DraggableNode icon={<SplitSquareHorizontal />} title="A/B Split" desc="Test multiple paths" color="orange" />
                <DraggableNode icon={<Clock />} title="Delay" desc="Wait before next step" color="orange" />
              </div>
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 relative bg-zoru-ink overflow-hidden">
          {/* Grid Background */}
          <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
               style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
          </div>

          {/* Floating Controls */}
          <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
            <div className="flex flex-col items-center rounded-lg bg-zoru-ink border border-white/10 p-1 shadow-xl">
              <button className="p-2 text-zoru-ink-muted hover:text-white hover:bg-white/5 rounded-md transition-colors"><ZoomIn className="h-4 w-4" /></button>
              <button className="p-2 text-zoru-ink-muted hover:text-white hover:bg-white/5 rounded-md transition-colors"><ZoomOut className="h-4 w-4" /></button>
              <button className="p-2 text-zoru-ink-muted hover:text-white hover:bg-white/5 rounded-md transition-colors"><Maximize className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Mock Canvas Content */}
          <div className="absolute inset-0 overflow-auto z-0 flex items-center justify-center p-20 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
             <div className="relative w-full max-w-2xl h-[600px] flex flex-col items-center">
                
                {/* Node 1 */}
                <CanvasNode 
                  icon={<Zap className="h-5 w-5 text-zoru-ink-muted" />}
                  title="App Event"
                  subtitle="User Signed Up"
                  colorClass="bg-zoru-ink/10 border-zoru-line/30"
                  isActive={false}
                />

                {/* SVG Line */}
                <svg className="w-10 h-16 my-2 text-zoru-ink" viewBox="0 0 40 64" fill="none" preserveAspectRatio="none">
                  <path d="M20 0 L20 64" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                  <circle cx="20" cy="32" r="4" fill="#1e293b" stroke="currentColor" strokeWidth="2" />
                </svg>

                {/* Node 2 */}
                <CanvasNode 
                  icon={<Clock className="h-5 w-5 text-zoru-ink-muted" />}
                  title="Delay"
                  subtitle="Wait 2 hours"
                  colorClass="bg-zoru-ink/10 border-zoru-line/30"
                  isActive={false}
                />

                {/* SVG Path Fork */}
                <svg className="w-[320px] h-20 my-2 text-zoru-ink" viewBox="0 0 320 80" fill="none" preserveAspectRatio="none">
                  <path d="M160 0 L160 20 C160 30 150 40 140 40 L40 40 C30 40 20 50 20 60 L20 80" stroke="currentColor" strokeWidth="2" />
                  <path d="M160 0 L160 20 C160 30 170 40 180 40 L280 40 C290 40 300 50 300 60 L300 80" stroke="currentColor" strokeWidth="2" />
                  <rect x="140" y="30" width="40" height="20" rx="10" fill="#1e293b" stroke="currentColor" strokeWidth="2" />
                  <text x="160" y="44" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="sans-serif">Split</text>
                </svg>

                <div className="flex w-[400px] justify-between">
                  {/* Left Fork Node */}
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => setSelectedNode('node-sms')}>
                    <CanvasNode 
                      icon={<MessageSquare className="h-5 w-5 text-zoru-ink-muted" />}
                      title="Send SMS"
                      subtitle="Welcome Offer"
                      colorClass={`bg-zoru-ink/10 border-zoru-line/50 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-zoru-line ${selectedNode === 'node-sms' ? 'ring-2' : ''}`}
                      isActive={true}
                    />
                    <div className="mt-4 px-3 py-1 bg-zoru-ink/50 rounded-full border border-white/5 text-xs text-zoru-ink-muted flex items-center gap-2">
                      <Activity className="h-3 w-3 text-zoru-ink-muted" />
                      45% conversion
                    </div>
                  </div>

                  {/* Right Fork Node */}
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => setSelectedNode('node-email')}>
                    <CanvasNode 
                      icon={<Mail className="h-5 w-5 text-zoru-ink-muted" />}
                      title="Send Email"
                      subtitle="Newsletter #1"
                      colorClass={`bg-zoru-ink/10 border-zoru-line/30 hover:border-zoru-line/50 ${selectedNode === 'node-email' ? 'ring-1 ring-zoru-line/50' : ''}`}
                      isActive={false}
                    />
                  </div>
                </div>

             </div>
          </div>
        </main>

        {/* Right Sidebar - Properties Panel */}
        <aside className="w-80 shrink-0 flex flex-col border-l border-white/10 bg-zoru-ink z-10 shadow-2xl relative">
          {selectedNode ? (
            <>
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zoru-ink">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-ink/20 text-zoru-ink-muted">
                    {selectedNode === 'node-sms' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {selectedNode === 'node-sms' ? 'Send SMS' : 'Send Email'}
                    </h2>
                    <p className="text-xs text-zoru-ink">Action Node</p>
                  </div>
                </div>
                <button className="text-zoru-ink-muted hover:text-white"><MoreVertical className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
                {/* Analytics Mini-widget */}
                <div className="p-4 border-b border-white/5 bg-zoru-ink">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-zoru-ink p-3 border border-white/5">
                      <div className="text-[10px] text-zoru-ink uppercase font-medium mb-1">Delivered</div>
                      <div className="text-lg font-semibold text-white">
                        {selectedNode === 'node-sms' ? '12,402' : '8,291'}
                      </div>
                      <div className="text-xs text-zoru-ink-muted mt-1 flex items-center gap-1"><Zap className="h-3 w-3"/> +12%</div>
                    </div>
                    <div className="rounded-lg bg-zoru-ink p-3 border border-white/5">
                      <div className="text-[10px] text-zoru-ink uppercase font-medium mb-1">
                        {selectedNode === 'node-sms' ? 'Clicked' : 'Opened'}
                      </div>
                      <div className="text-lg font-semibold text-white">
                        {selectedNode === 'node-sms' ? '3,891' : '4,102'}
                      </div>
                      <div className="text-xs text-zoru-ink-muted mt-1 flex items-center gap-1"><MousePointer2 className="h-3 w-3"/> {selectedNode === 'node-sms' ? '31.3%' : '49.4%'}</div>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* General Settings */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-zoru-ink-muted uppercase tracking-wider">Configuration</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zoru-ink-muted">Node Name</label>
                      <input 
                        type="text" 
                        defaultValue={selectedNode === 'node-sms' ? "Welcome Offer" : "Newsletter #1"} 
                        key={selectedNode}
                        className="w-full rounded-md bg-zoru-ink border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zoru-line/50" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zoru-ink-muted">Sender ID</label>
                      <div className="relative">
                        <select className="w-full appearance-none rounded-md bg-zoru-ink border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zoru-line/50">
                          <option>SABNODE_ALERTS</option>
                          <option>SAB_PROMO</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-zoru-ink pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <hr className="border-white/5" />

                  {/* Message Content */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-zoru-ink-muted uppercase tracking-wider">Message Content</h3>
                      <button className="text-xs text-zoru-ink-muted hover:text-zoru-ink-muted">Insert Variable</button>
                    </div>
                    
                    <div className="relative">
                      <textarea 
                        rows={5} 
                        key={selectedNode + '-text'}
                        className="w-full rounded-md bg-zoru-ink border border-white/10 p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zoru-line/50 resize-none"
                        defaultValue={
                          selectedNode === 'node-sms' 
                            ? "Hi {{user.firstName}}, welcome to Sabnode! Use code WELCOME20 for 20% off your first month." 
                            : "Hello {{user.firstName}},\n\nThank you for subscribing to our newsletter! We are thrilled to have you."
                        }
                      />
                      <div className="absolute bottom-3 right-3 text-[10px] text-zoru-ink">
                        89 / 160 chars
                      </div>
                    </div>

                    {selectedNode === 'node-sms' && (
                      <div className="rounded-lg bg-zoru-ink/10 border border-zoru-line/20 p-3 flex gap-3 items-start">
                        <AlertCircle className="h-4 w-4 text-zoru-ink-muted shrink-0 mt-0.5" />
                        <p className="text-xs text-white/80 leading-relaxed">
                          Personalized variables may increase SMS length and result in multiple segments being billed.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Footer Save */}
              <div className="p-4 border-t border-white/10 bg-zoru-ink">
                <button className="w-full rounded-md bg-white text-black hover:bg-zoru-surface-2 transition-colors py-2 text-sm font-semibold shadow-lg">
                  Save Changes
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <p className="text-sm text-zoru-ink">Select a node to view its properties.</p>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}

// Subcomponents
function DraggableNode({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: 'blue' | 'purple' | 'orange' }) {
  const colorMap = {
    blue: 'bg-zoru-ink/10 text-zoru-ink-muted border-zoru-line/20 group-hover:border-zoru-line/40',
    purple: 'bg-zoru-ink/10 text-zoru-ink-muted border-zoru-line/20 group-hover:border-zoru-line/40',
    orange: 'bg-zoru-ink/10 text-zoru-ink-muted border-zoru-line/20 group-hover:border-zoru-line/40',
  };

  return (
    <div className="group flex cursor-grab items-start gap-3 rounded-xl border border-white/5 bg-zoru-ink p-3 hover:bg-zoru-ink hover:shadow-lg transition-all active:cursor-grabbing">
      <div className={`mt-0.5 flex shrink-0 h-8 w-8 items-center justify-center rounded-lg border ${colorMap[color]} transition-colors`}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
      </div>
      <div>
        <h4 className="text-sm font-medium text-white group-hover:text-white transition-colors">{title}</h4>
        <p className="mt-0.5 text-[11px] text-zoru-ink line-clamp-1">{desc}</p>
      </div>
    </div>
  );
}

function CanvasNode({ icon, title, subtitle, colorClass, isActive }: { icon: React.ReactNode, title: string, subtitle: string, colorClass: string, isActive: boolean }) {
  return (
    <div className={`w-64 rounded-xl border bg-zoru-ink p-4 shadow-xl backdrop-blur-sm transition-all hover:border-white/20 ${isActive ? colorClass : 'border-white/10'}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${colorClass}`}>
          {icon}
        </div>
        <div className="flex-1 overflow-hidden">
          <h4 className="truncate text-sm font-semibold text-white">{title}</h4>
          <p className="truncate text-xs text-zoru-ink-muted">{subtitle}</p>
        </div>
        <button className="text-zoru-ink hover:text-zoru-ink-muted transition-colors">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
