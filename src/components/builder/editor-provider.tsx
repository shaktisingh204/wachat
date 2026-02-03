"use client";

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { editorReducer, initialEditorState } from '@/lib/builder/builder-reducer';
import { EditorState, Action, ElementNode } from '@/lib/builder/builder-types';

interface EditorContextType {
    state: EditorState;
    dispatch: React.Dispatch<Action>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(editorReducer, initialEditorState);

    return (
        <EditorContext.Provider value={{ state, dispatch }}>
            {children}
        </EditorContext.Provider>
    );
};

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
};
