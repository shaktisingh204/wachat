"use client";

import { useEffect, useState } from 'react';
import { EditorInterface } from '@/components/builder/editor-layout';
import { useEditor } from '@/components/builder/editor-provider';
import { PageData } from '@/lib/builder/builder-types';
import { savePageData } from './actions';
import * as Y from 'yjs';
import { useDebounceCallback } from 'usehooks-ts';
import { toast } from 'sonner';

export const BuilderInitializer = ({ initialData }: { initialData: PageData }) => {
    const { state, dispatch } = useEditor();
    const [isInitialized, setIsInitialized] = useState(false);

    // Groundwork for Yjs collaboration
    useEffect(() => {
        const ydoc = new Y.Doc();
        const yElements = ydoc.getArray('elements');
        // TODO: Connect to WebSocket or WebRTC provider here
        // e.g. new WebsocketProvider('ws://localhost:1234', 'my-room', ydoc)
        
        // Listen to remote changes and dispatch to local state if needed
        yElements.observe(event => {
            // Apply remote CRDT changes to our EditorState
        });

        return () => {
            ydoc.destroy();
        };
    }, []);

    useEffect(() => {
        if (initialData && !isInitialized) {
            dispatch({ type: 'SET_PAGE', payload: initialData });
            setIsInitialized(true);
        }
    }, [initialData, dispatch, isInitialized]);

    // Robust Auto-save mechanism
    const debouncedSave = useDebounceCallback(async (page: PageData) => {
        try {
            await savePageData(page);
            toast.success('All changes saved', { id: 'autosave' });
        } catch (error) {
            toast.error('Failed to save changes', { id: 'autosave' });
        }
    }, 1500);

    // Track state changes to trigger auto-save
    useEffect(() => {
        if (isInitialized && state.page) {
            toast.loading('Saving...', { id: 'autosave' });
            debouncedSave(state.page);
        }
    }, [state.page, isInitialized, debouncedSave]);

    if (!isInitialized) return null;

    return <EditorInterface />;
}
