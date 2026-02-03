"use client";

import React from 'react';
import { useEditor } from '@/components/builder/editor-provider';
import { ElementWrapper } from './element-wrapper';

export const CanvasRenderer = () => {
    const { state } = useEditor();

    return (
        <div className="w-full min-h-screen bg-white p-10 shadow-sm mx-auto max-w-6xl overflow-y-auto">
            {state.page.elements.length === 0 ? (
                <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    Start by dragging a Section here
                </div>
            ) : (
                state.page.elements.map((element) => (
                    <ElementWrapper key={element.id} element={element} />
                ))
            )}
        </div>
    );
};
