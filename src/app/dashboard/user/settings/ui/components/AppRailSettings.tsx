'use client';

import { useState } from 'react';
import { SegmentedControl } from '@/components/sabcrm/20ui';
import { PanelLeft, PanelTop } from 'lucide-react';

interface AppRailSettingsProps {
    currentPosition?: 'left' | 'top';
}

type RailPosition = 'left' | 'top';

export function AppRailSettings({ currentPosition = 'left' }: AppRailSettingsProps) {
    const [position, setPosition] = useState<RailPosition>(currentPosition);

    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-sm font-semibold text-[var(--st-text)]" id="app-rail-label">
                    App rail position
                </span>
                <span className="text-[0.8125rem] text-[var(--st-text-secondary)]">
                    Where the main navigation bar appears.
                </span>
            </div>
            <div className="flex-shrink-0">
                <SegmentedControl<RailPosition>
                    aria-label="App rail position"
                    value={position}
                    onChange={setPosition}
                    size="sm"
                    items={[
                        { value: 'left', label: 'Left', icon: PanelLeft },
                        { value: 'top', label: 'Top', icon: PanelTop },
                    ]}
                />
                {/* Hidden input carries the selected value to the form action. */}
                <input type="hidden" name="appRailPosition" value={position} />
            </div>
        </div>
    );
}
