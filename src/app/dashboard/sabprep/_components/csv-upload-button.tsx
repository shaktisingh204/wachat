'use client';

import * as React from 'react';
import { FileUp } from 'lucide-react';

import { SabFileToFileButton } from '@/components/sabfiles';
import type { Row } from '@/lib/rust-client/sabprep-steps';

interface Props {
    onParsed: (parsed: { name: string; rows: Row[] }) => void;
}

/**
 * SabFiles-backed CSV picker. Pulls the file from the user's SabFiles
 * library (or uploads a fresh one), then parses it into rows in the
 * browser and hands them up. Per SabFiles policy, no free-text URL paste.
 */
export function CsvUploadButton({ onParsed }: Props) {
    const onPickFile = React.useCallback(
        async (file: File) => {
            const text = await file.text();
            const rows = parseCsv(text);
            onParsed({ name: file.name.replace(/\.csv$/i, ''), rows });
        },
        [onParsed],
    );

    return (
        <SabFileToFileButton
            accept="document"
            onPickFile={onPickFile}
            variant="outline"
            onError={(e) => console.error('SabFiles CSV pick failed', e)}
        >
            <FileUp className="h-4 w-4" /> Upload CSV
        </SabFileToFileButton>
    );
}

/**
 * Tiny RFC-4180-ish CSV parser. Handles quoted cells with embedded commas
 * + escaped quotes. Header row required. Numeric strings are coerced to
 * numbers; everything else stays a string. Bounded — caller decides what
 * to do with very large files.
 */
function parseCsv(text: string): Row[] {
    const lines = splitLines(text);
    if (lines.length === 0) return [];
    const header = splitRow(lines[0]);
    const rows: Row[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cells = splitRow(line);
        if (cells.length === 0) continue;
        const row: Row = {};
        for (let c = 0; c < header.length; c++) {
            row[header[c]] = coerce(cells[c] ?? '');
        }
        rows.push(row);
    }
    return rows;
}

function splitLines(text: string): string[] {
    const out: string[] = [];
    let buf = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            buf += ch;
            continue;
        }
        if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            out.push(buf);
            buf = '';
            continue;
        }
        buf += ch;
    }
    if (buf.length > 0) out.push(buf);
    return out;
}

function splitRow(line: string): string[] {
    const out: string[] = [];
    let buf = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                buf += '"';
                i++;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === ',' && !inQuotes) {
            out.push(buf);
            buf = '';
            continue;
        }
        buf += ch;
    }
    out.push(buf);
    return out.map((s) => s.trim());
}

function coerce(s: string): string | number | null {
    if (s === '') return null;
    const n = Number(s);
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(s)) return n;
    return s;
}
