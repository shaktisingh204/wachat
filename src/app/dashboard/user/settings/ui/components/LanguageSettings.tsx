'use client';

import { useState } from 'react';
import { Field, Select } from '@/components/sabcrm/20ui';

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

    return (
        <div className="space-y-2">
            <Field
                label="Dashboard language"
                help="The language used across the dashboard interface."
            >
                <Select
                    value={selectedLanguage}
                    onChange={(value) => setSelectedLanguage(value || 'en')}
                    searchable
                    placeholder="Select a language"
                    options={SUPPORTED_LANGUAGES.map((lang) => ({
                        value: lang.code,
                        label: lang.name,
                    }))}
                />
            </Field>
            {/* Hidden input passes the selected value to the form action. */}
            <input type="hidden" name="language" value={selectedLanguage} />
        </div>
    );
}
