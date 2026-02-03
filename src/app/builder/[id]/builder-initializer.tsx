"use client";

import { useEffect } from 'react';
import { EditorInterface } from '@/components/builder/editor-layout';
import { useEditor } from '@/components/builder/editor-provider';
import { PageData } from '@/lib/builder/builder-types';

export const BuilderInitializer = ({ initialData }: { initialData: PageData }) => {
    const { dispatch } = useEditor();

    useEffect(() => {
        if (initialData) {
            dispatch({ type: 'SET_PAGE', payload: initialData });
        }
    }, [initialData, dispatch]);

    return <EditorInterface />;
}
