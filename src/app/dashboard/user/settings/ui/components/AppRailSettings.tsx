'use client';

import { RadioGroup, RadioGroupItem } from '@/components/sabcrm/20ui';

interface AppRailSettingsProps {
    currentPosition?: 'left' | 'top';
}

export function AppRailSettings({ currentPosition = 'left' }: AppRailSettingsProps) {
    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--st-text)]" id="app-rail-label">
                App rail position
            </p>
            <p className="text-sm text-[var(--st-text-secondary)]">
                Choose where the main application navigation bar appears.
            </p>
            <RadioGroup
                name="appRailPosition"
                defaultValue={currentPosition}
                orientation="horizontal"
                aria-labelledby="app-rail-label"
                className="pt-2"
            >
                <RadioGroupItem value="left" label="Left sidebar" />
                <RadioGroupItem value="top" label="Top header" />
            </RadioGroup>
        </div>
    );
}
