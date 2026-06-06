'use client';

import { useState, useMemo } from 'react';
import {
    Label,
    Input,
} from '@/components/sabcrm/20ui/compat';
import { Search, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || 'en');

    const filteredAndSortedLanguages = useMemo(() => {
        let result = SUPPORTED_LANGUAGES.filter(lang =>
            lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lang.code.toLowerCase().includes(searchQuery.toLowerCase())
        );

        result.sort((a, b) => {
            const comparison = a.name.localeCompare(b.name);
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [searchQuery, sortOrder]);

    const toggleSort = (e: React.MouseEvent) => {
        e.preventDefault();
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    return (
        <div className="space-y-4 pt-4 border-t border-[var(--st-border)]">
            <div className="space-y-2">
                <Label>Dashboard Language</Label>
                <p className="text-sm text-[var(--st-text-secondary)]">Select your preferred language for the dashboard interface.</p>
            </div>
            
            <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                    <Input
                        placeholder="Search languages..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="icon" onClick={toggleSort} title="Sort languages">
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto p-1">
                {filteredAndSortedLanguages.length > 0 ? (
                    filteredAndSortedLanguages.map(lang => (
                        <div
                            key={lang.code}
                            className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedLanguage === lang.code ? 'border-primary bg-[var(--st-text)]/5' : 'border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]'}`}
                            onClick={() => setSelectedLanguage(lang.code)}
                        >
                            <div className="font-medium text-sm">{lang.name}</div>
                            <div className="text-xs text-[var(--st-text-secondary)]">{lang.code}</div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center text-sm text-[var(--st-text-secondary)] py-4">
                        No languages found matching "{searchQuery}"
                    </div>
                )}
            </div>
            {/* Hidden input to pass the selected value to the form action */}
            <input type="hidden" name="language" value={selectedLanguage} />
        </div>
    );
}
