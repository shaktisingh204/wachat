'use client';

import React from 'react';
import Split from 'react-split';
import { EmailSidebar } from './email-sidebar';
import { EmailList } from './email-list';
import { EmailDisplay } from './email-display';
import { EmailCompose } from './email-compose';
import './email-split.css'; // We will create this for gutter styles

export function EmailLayout() {
    return (
        <div className="h-[calc(100vh-100px)] border rounded-lg overflow-hidden bg-background shadow-sm">
            <Split
                className="flex h-full"
                sizes={[20, 30, 50]}
                minSize={[200, 300, 400]}
                maxSize={[400, 600, Infinity]}
                expandToMin={false}
                gutterSize={1}
                gutterAlign="center"
                snapOffset={30}
                dragInterval={1}
                direction="horizontal"
                cursor="col-resize"
            >
                <div className="h-full overflow-hidden">
                    <EmailSidebar />
                </div>
                <div className="h-full overflow-hidden">
                    <EmailList />
                </div>
                <div className="h-full overflow-hidden">
                    <EmailDisplay />
                </div>
            </Split>
            <EmailCompose />
        </div>
    );
}
