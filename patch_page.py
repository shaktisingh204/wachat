import re

with open('src/app/sabsms/flow/page.tsx', 'r') as f:
    content = f.read()

# 1. Update imports
new_imports = """import React, { useState, useEffect } from 'react';
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
  Database,
  Inbox,
  ShieldCheck,
  Brain,
  Loader2
} from 'lucide-react';
import type { SabflowBlock } from '@/app/sabsms/sabflow-blocks/mock-data';

const IconMap: Record<string, React.FC<any>> = {
  MessageSquare,
  Inbox,
  ShieldCheck,
  Clock,
  Brain,
  Mail,
  Zap,
  Globe,
  Smartphone,
  Database,
  GitBranch,
  SplitSquareHorizontal
};
"""
content = re.sub(r"import React, { useState } from 'react';\nimport \{[\s\S]*?\} from 'lucide-react';", new_imports, content)

# 2. Add state and fetch in DripsBuilderShell
fetch_logic = """export default function DripsBuilderShell() {
  const [activeTab, setActiveTab] = useState('build');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('blk_send_sms');
  const [blocks, setBlocks] = useState<SabflowBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sabsms/blocks')
      .then(r => r.json())
      .then(d => {
        setBlocks(d.blocks);
        setIsLoading(false);
      })
      .catch(console.error);
  }, []);

  const activeBlock = blocks.find(b => b.id === selectedNodeId);
  const activeIcon = activeBlock?.icon ? IconMap[activeBlock.icon] || MessageSquare : MessageSquare;
"""
content = re.sub(
    r"export default function DripsBuilderShell\(\) \{\n  const \[activeTab, setActiveTab\] = useState\('build'\);\n  const \[selectedNode, setSelectedNode\] = useState<string \| null>\('node-sms'\);",
    fetch_logic,
    content
)

# 3. Update Left Fork and Right Fork onClick to use selectedNodeId
content = content.replace("onClick={() => setSelectedNode('node-sms')}", "onClick={() => setSelectedNodeId('blk_send_sms')}")
content = content.replace("onClick={() => setSelectedNode('node-email')}", "onClick={() => setSelectedNodeId('blk_inbound_sms')}")
content = content.replace("selectedNode === 'node-sms'", "selectedNodeId === 'blk_send_sms'")
content = content.replace("selectedNode === 'node-email'", "selectedNodeId === 'blk_inbound_sms'")

# 4. Replace the right sidebar content
right_sidebar_start = """        {/* Right Sidebar - Properties Panel */}"""
right_sidebar_end = """        </aside>"""

new_right_sidebar = """        {/* Right Sidebar - Properties Panel */}
        <aside className="w-80 shrink-0 flex flex-col border-l border-white/10 bg-[#0c0c0e] z-10 shadow-2xl relative">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : activeBlock ? (
            <>
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#131316]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                    {React.createElement(activeIcon, { className: "h-4 w-4" })}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">
                      {activeBlock.name}
                    </h2>
                    <p className="text-xs text-slate-500 capitalize">{activeBlock.type} Node</p>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-white"><MoreVertical className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
                {/* Analytics Mini-widget */}
                <div className="p-4 border-b border-white/5 bg-[#0e0e11]">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-[#18181b] p-3 border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase font-medium mb-1">Cost</div>
                      <div className="text-lg font-semibold text-slate-200">
                        {activeBlock.creditCost} credits
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#18181b] p-3 border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase font-medium mb-1">
                        Usage
                      </div>
                      <div className="text-lg font-semibold text-slate-200">
                        {(activeBlock.usageCount / 1000).toFixed(1)}k
                      </div>
                      <div className="text-xs text-blue-400 mt-1 flex items-center gap-1"><Activity className="h-3 w-3"/> Global</div>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* General Settings */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configuration</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Node Name</label>
                      <input 
                        type="text" 
                        defaultValue={activeBlock.name}
                        key={activeBlock.id}
                        className="w-full rounded-md bg-[#18181b] border border-white/10 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Description</label>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {activeBlock.description}
                      </p>
                    </div>
                  </div>

                  <hr className="border-white/5" />

                  {/* Dynamic Schema Fields */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Properties</h3>
                      <button className="text-xs text-blue-400 hover:text-blue-300">Insert Variable</button>
                    </div>
                    
                    {(() => {
                      let parsedSchema: Record<string, string> = {};
                      try {
                        parsedSchema = JSON.parse(activeBlock.schema);
                      } catch (e) {
                        // ignore
                      }
                      
                      return Object.entries(parsedSchema).map(([key, typeStr]) => {
                        const isRequired = !typeStr.endsWith('?');
                        return (
                          <div key={key} className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300 capitalize">
                              {key} {isRequired ? <span className="text-red-400">*</span> : null}
                            </label>
                            {key === 'body' || key === 'text' ? (
                              <textarea 
                                rows={4} 
                                className="w-full rounded-md bg-[#18181b] border border-white/10 p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                                placeholder={`Enter ${key}...`}
                              />
                            ) : (
                              <input 
                                type="text" 
                                className="w-full rounded-md bg-[#18181b] border border-white/10 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                placeholder={`Enter ${key}...`}
                              />
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              
              {/* Footer Save */}
              <div className="p-4 border-t border-white/10 bg-[#131316]">
                <button className="w-full rounded-md bg-white text-black hover:bg-slate-200 transition-colors py-2 text-sm font-semibold shadow-lg">
                  Save Changes
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <p className="text-sm text-slate-500">Select a node to view its properties.</p>
            </div>
          )}
        </aside>"""

pattern = re.compile(re.escape(right_sidebar_start) + r".*?" + re.escape(right_sidebar_end), re.DOTALL)
content = pattern.sub(new_right_sidebar, content)

with open('src/app/sabsms/flow/page.tsx', 'w') as f:
    f.write(content)

print("Patched src/app/sabsms/flow/page.tsx")
