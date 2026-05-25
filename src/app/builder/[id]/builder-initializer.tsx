"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { EditorInterface } from '@/components/builder/editor-layout';
import { useEditor } from '@/components/builder/editor-provider';
import { PageData } from '@/lib/builder/builder-types';
import { savePageData, getBuilderWsToken } from './actions';
import * as Y from 'yjs';
import { useSabFlowDoc } from '@/lib/sabflow/client/useSabFlowDoc';
import { useDebounceCallback } from 'usehooks-ts';
import { toast } from 'sonner';

export const BuilderInitializer = ({ initialData, projectId }: { initialData: PageData, projectId: string }) => {
    const { state, dispatch } = useEditor();
    const [isInitialized, setIsInitialized] = useState(false);
    
    // We keep a ref to avoid echo loops when we receive remote updates
    const isRemoteUpdate = useRef(false);

    // Fetch the WebSocket JWT using our server action
    const fetchToken = useCallback(() => getBuilderWsToken(initialData.id), [initialData.id]);

    const { doc, status } = useSabFlowDoc({
        workspaceId: projectId,
        docId: initialData.id,
        fetchToken
    });

    useEffect(() => {
        if (!doc) return;

        const yElements = doc.getArray('elements');
        const yTitle = doc.getText('title');
        
        // Listen to remote changes
        const handleObserve = (event: Y.YArrayEvent<any> | Y.YTextEvent, transaction: Y.Transaction) => {
            // Ignore our own local changes
            if (transaction.local) return;

            isRemoteUpdate.current = true;
            
            // Sync remote state to local React state
            const currentElements = yElements.toJSON();
            const currentTitle = yTitle.toString();
            
            dispatch({
                type: 'SET_PAGE',
                payload: {
                    ...initialData,
                    title: currentTitle || initialData.title,
                    elements: currentElements || []
                }
            });
            
            // Reset the flag after React renders
            setTimeout(() => {
                isRemoteUpdate.current = false;
            }, 0);
        };

        yElements.observe(handleObserve as any);
        yTitle.observe(handleObserve as any);

        return () => {
            yElements.unobserve(handleObserve as any);
            yTitle.unobserve(handleObserve as any);
        };
    }, [doc, dispatch, initialData]);

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

    // Sync local changes to Yjs doc & trigger auto-save
    useEffect(() => {
        if (isInitialized && state.page) {
            // Only broadcast if the state change originated locally
            if (doc && !isRemoteUpdate.current) {
                const yElements = doc.getArray('elements');
                const yTitle = doc.getText('title');
                
                doc.transact(() => {
                    // Update Title
                    if (yTitle.toString() !== state.page.title) {
                        yTitle.delete(0, yTitle.length);
                        yTitle.insert(0, state.page.title || '');
                    }
                    
                    // Simple full array replacement for MVP
                    // (A robust CRDT implementation would do diffing here)
                    yElements.delete(0, yElements.length);
                    if (state.page.elements && state.page.elements.length > 0) {
                        yElements.insert(0, state.page.elements);
                    }
                });
            }

            toast.loading('Saving...', { id: 'autosave' });
            debouncedSave(state.page);
        }
    }, [state.page, isInitialized, debouncedSave, doc]);

    if (!isInitialized) return null;

    return (
        <>
            {status !== 'connected' && (
                <div className="absolute top-2 right-2 z-50 text-xs text-orange-500 bg-orange-100 dark:bg-orange-950/40 px-2 py-1 rounded">
                    {status === 'connecting' ? 'Connecting...' : status === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
                </div>
            )}
            <EditorInterface />
        </>
    );
}
