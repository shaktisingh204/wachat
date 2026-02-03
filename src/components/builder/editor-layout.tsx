"use client";

import React from 'react';
import { EditorProvider } from './editor-provider';
import { BuilderSidebar } from './sidebar/sidebar';
import { CanvasRenderer } from './canvas/canvas-renderer';

export const EditorLayout = () => {
    return (
        <EditorProvider>
            <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
                <BuilderSidebar />
                <main className="flex-1 overflow-hidden flex flex-col relative">
                    <header className="h-14 border-b bg-white flex items-center px-4 justify-between shadow-sm z-10">
                        <h1 className="font-semibold text-gray-700">Page Builder</h1>
                        <div className="flex gap-2">
                            {/* Actions like Undo/Redo/Save to be added here */}
                            <button className="px-3 py-1 bg-black text-white rounded text-sm hover:bg-gray-800">Publish</button>
                        </div>
                    </header>
                    <div className="flex-1 overflow-auto bg-slate-100 p-8">
                        <CanvasRenderer />
                    </div>
                </main>
            </div>
        </EditorProvider>
    );
};
