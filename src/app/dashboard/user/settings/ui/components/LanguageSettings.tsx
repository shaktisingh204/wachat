'use client';

import { useId, useState } from 'react';
import { Select } from '@/components/sabcrm/20ui';

interface Language {
    code: string;
    name: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
];

export function LanguageSettings({ currentLanguage }: { currentLanguage?: string }) {
    const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || 'en');
    const labelId = useId();

    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-sm font-semibold text-[var(--st-text)]" id={labelId}>
                    Dashboard language
                </span>
                <span className="text-[0.8125rem] text-[var(--st-text-secondary)]">
                    The language used across the dashboard interface.
                </span>
            </div>
            <div className="w-full max-w-[260px] flex-shrink-0">
                <Select
                    aria-labelledby={labelId}
                    value={selectedLanguage}
                    onChange={(value) => setSelectedLanguage(value || 'en')}
                    searchable
                    placeholder="Select a language"
                    options={SUPPORTED_LANGUAGES.map((lang) => ({
                        value: lang.code,
                        label: lang.name,
                    }))}
                />
                {/* Hidden input passes the selected value to the form action. */}
                <input type="hidden" name="language" value={selectedLanguage} />
            </div>
        </div>
    );
}
