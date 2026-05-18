'use client';

import { ZoruButton, ZoruInput, ZoruLabel } from '@/components/zoruui';
import { useState } from 'react';

import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type DataSourceItem = {
    id: string;
    title: string;
    description?: string;
};

interface DataSourceEditorProps {
    label: string;
    dataSource: DataSourceItem[];
    updateDataSource: (newDataSource: DataSourceItem[]) => void;
}

export function DataSourceEditor({ label, dataSource, updateDataSource }: DataSourceEditorProps) {
    const handleAddItem = () => {
        updateDataSource([...dataSource, { id: uuidv4(), title: '', description: '' }]);
    };

    const handleRemoveItem = (idToRemove: string) => {
        updateDataSource(dataSource.filter(item => item.id !== idToRemove));
    };

    const handleItemChange = (id: string, field: 'title' | 'description', value: string) => {
        updateDataSource(dataSource.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    return (
        <div className="space-y-2 rounded-lg border p-4">
            <ZoruLabel className="font-semibold">{label}</ZoruLabel>
            <div className="space-y-3">
                {dataSource.map(item => (
                    <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-muted/50">
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => handleRemoveItem(item.id)}
                        >
                            <Trash2 className="h-3 w-3 text-destructive" />
                        </ZoruButton>
                        <div className="space-y-1">
                            <ZoruLabel htmlFor={`title-${item.id}`} className="text-xs">Title</ZoruLabel>
                            <ZoruInput
                                id={`title-${item.id}`}
                                value={item.title}
                                onChange={e => handleItemChange(item.id, 'title', e.target.value)}
                                placeholder="Item Title"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <ZoruLabel htmlFor={`desc-${item.id}`} className="text-xs">Description (optional)</ZoruLabel>
                            <ZoruInput
                                id={`desc-${item.id}`}
                                value={item.description || ''}
                                onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                placeholder="Item Description"
                            />
                        </div>
                    </div>
                ))}
            </div>
             <ZoruButton
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={handleAddItem}
            >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
            </ZoruButton>
        </div>
    );
}
