'use client';

import { Label, RadioGroup, RadioGroupItem } from '@/components/sabcrm/20ui';

interface AppRailSettingsProps {
    currentPosition?: 'left' | 'top';
}

export function AppRailSettings({ currentPosition = 'left' }: AppRailSettingsProps) {
    return (
        <div className="space-y-2">
            <Label>App Rail Position</Label>
            <p className="text-sm text-[var(--st-text-secondary)]">Choose where the main application navigation bar appears.</p>
            <RadioGroup
                name="appRailPosition"
                defaultValue={currentPosition}
                className="flex gap-4 pt-2"
            >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="left" id="pos-left" />
                    <Label htmlFor="pos-left" className="font-normal">Left Sidebar</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="top" id="pos-top" />
                    <Label htmlFor="pos-top" className="font-normal">Top Header</Label>
                </div>
            </RadioGroup>
        </div>
    );
}
