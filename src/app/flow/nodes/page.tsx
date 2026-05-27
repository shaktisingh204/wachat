"use client";

import React from 'react';
import { NodesSidebar } from './NodesSidebar';

export default function NodesSidebarPage() {
  return (
    <div className="flex h-screen w-full bg-zoru-ink text-zoru-ink-muted font-sans overflow-hidden">
      <NodesSidebar />
      <main className="flex-1 flex flex-col items-center justify-center relative bg-zoru-ink">
        {/* Grid Background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
        </div>
        
        <div className="z-10 p-8 rounded-xl border border-white/5 bg-zoru-ink shadow-2xl text-center max-w-md">
          <h2 className="text-xl font-medium text-white mb-2">Flow Builder Sandbox</h2>
          <p className="text-sm text-zoru-ink-muted mb-6">Drag and drop nodes from the sidebar onto this canvas area.</p>
          <div 
            className="h-48 rounded-lg border-2 border-dashed border-white/10 bg-zoru-ink flex items-center justify-center"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const type = e.dataTransfer.getData('application/reactflow');
              alert(`Dropped node of type: ${type}`);
            }}
          >
            <span className="text-zoru-ink font-medium">Drop Zone</span>
          </div>
        </div>
      </main>
    </div>
  );
}
