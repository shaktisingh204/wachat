"use client";

import React from 'react';
import { useEditor } from '@/components/builder/editor-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const ThemePanel = () => {
    const { state, dispatch } = useEditor();
    const theme = state.page.settings.theme || {
        colors: {
            primary: '#3b82f6',
            secondary: '#64748b',
            background: '#ffffff',
            text: '#0f172a'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    };

    const updateTheme = (path: string, value: string) => {
        // Create deep copy of theme
        const newTheme = JSON.parse(JSON.stringify(theme));

        // Update nested property
        const parts = path.split('.');
        let current = newTheme;
        for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;

        // Dispatch update (We need to add UPDATE_SETTINGS to reducer, or just update the whole page)
        // For efficiency, let's assume we can update settings.
        // Actually, checking reducer... I don't have UPDATE_SETTINGS. 
        // I will use SET_PAGE for now which is heavy, or I should update the reducer.

        // Let's implement a cleaner way in the next step: UPDATE_SETTINGS action. 
        // For now, I'll update the whole page object to keep moving.
        const newPage = {
            ...state.page,
            settings: {
                ...state.page.settings,
                theme: newTheme
            }
        };
        dispatch({ type: 'SET_PAGE', payload: newPage });
    };

    return (
        <div className="p-4 space-y-6">
            <h3 className="font-semibold text-lg border-b pb-2">Global Theme</h3>

            <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-500">Colors</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs">Primary</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color" className="w-8 h-8 p-0 border-0"
                                value={theme.colors.primary}
                                onChange={(e) => updateTheme('colors.primary', e.target.value)}
                            />
                            <Input className="h-8 text-xs" value={theme.colors.primary} onChange={(e) => updateTheme('colors.primary', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Secondary</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color" className="w-8 h-8 p-0 border-0"
                                value={theme.colors.secondary}
                                onChange={(e) => updateTheme('colors.secondary', e.target.value)}
                            />
                            <Input className="h-8 text-xs" value={theme.colors.secondary} onChange={(e) => updateTheme('colors.secondary', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Body Text</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color" className="w-8 h-8 p-0 border-0"
                                value={theme.colors.text}
                                onChange={(e) => updateTheme('colors.text', e.target.value)}
                            />
                            <Input className="h-8 text-xs" value={theme.colors.text} onChange={(e) => updateTheme('colors.text', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Background</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color" className="w-8 h-8 p-0 border-0"
                                value={theme.colors.background}
                                onChange={(e) => updateTheme('colors.background', e.target.value)}
                            />
                            <Input className="h-8 text-xs" value={theme.colors.background} onChange={(e) => updateTheme('colors.background', e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-500">Typography</h4>
                <div>
                    <Label className="text-xs">Heading Font</Label>
                    <Input
                        className="h-8 text-xs"
                        value={theme.fonts.heading}
                        onChange={(e) => updateTheme('fonts.heading', e.target.value)}
                        placeholder="Inter, sans-serif"
                    />
                </div>
                <div>
                    <Label className="text-xs">Body Font</Label>
                    <Input
                        className="h-8 text-xs"
                        value={theme.fonts.body}
                        onChange={(e) => updateTheme('fonts.body', e.target.value)}
                        placeholder="Inter, sans-serif"
                    />
                </div>
            </div>
        </div>
    );
};
