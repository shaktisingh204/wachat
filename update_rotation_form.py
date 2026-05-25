import re

with open('src/app/dashboard/hrm/payroll/shift-rotations/_components/rotation-form.tsx', 'r') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "Trash2 } from 'lucide-react';",
    "Trash2,\n  Download } from 'lucide-react';"
)

# 2. Add PatternRowItem after newRowId
pattern_row_code = """
const PatternRowItem = React.memo(function PatternRowItem({
    row,
    cycleDays,
    shifts,
    updateRow,
    removeRow,
}: {
    row: PatternRow;
    cycleDays: number;
    shifts: CrmShiftDoc[];
    updateRow: (rowId: string, patch: Partial<PatternRow>) => void;
    removeRow: (rowId: string) => void;
}) {
    const shift = shifts.find((s) => s._id === row.shiftId);
    return (
        <div className="grid items-end gap-3 rounded-md border border-zoru-line bg-zoru-bg p-3 md:grid-cols-[100px_1fr_auto_auto]">
            <div className="space-y-1.5">
                <Label className="text-[12px]">Day offset</Label>
                <Input
                    type="number"
                    min={0}
                    max={Math.max(0, cycleDays - 1)}
                    value={row.dayOffset}
                    onChange={(e) =>
                        updateRow(row.rowId, {
                            dayOffset: Number(e.target.value) || 0,
                        })
                    }
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-[12px]">Shift</Label>
                <Select
                    value={row.shiftId || ''}
                    onValueChange={(v) => updateRow(row.rowId, { shiftId: v })}
                    disabled={row.isOff}
                >
                    <ZoruSelectTrigger>
                        <ZoruSelectValue
                            placeholder={
                                row.isOff ? 'Day off' : shift?.name || 'Pick a shift'
                            }
                        />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {shifts.map((s) => (
                            <ZoruSelectItem key={s._id} value={s._id}>
                                {s.name}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-[12.5px] text-zoru-ink">
                <Checkbox
                    checked={!!row.isOff}
                    onCheckedChange={(v) =>
                        updateRow(row.rowId, {
                            isOff: Boolean(v),
                            shiftId: v ? '' : row.shiftId,
                        })
                    }
                />
                Off
            </label>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.rowId)}
                aria-label="Remove pattern row"
            >
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
    );
});
"""

content = content.replace(
    "function newRowId(): string {\n    return `row_${Math.random().toString(36).slice(2, 9)}`;\n}\n",
    "function newRowId(): string {\n    return `row_${Math.random().toString(36).slice(2, 9)}`;\n}\n\n" + pattern_row_code
)

# 3. Handle defaultEndDate
content = content.replace(
    """    // Manage default dates on the client to prevent hydration mismatch
    const [defaultStartDate, setDefaultStartDate] = React.useState<string>(() => {
        return toDateInput(initialData?.startDate) || '';
    });
    
    React.useEffect(() => {
        if (!initialData?.startDate) {
            setDefaultStartDate(new Date().toISOString().slice(0, 10));
        }
    }, [initialData?.startDate]);""",
    """    // Manage default dates on the client to prevent hydration mismatch
    const [defaultStartDate, setDefaultStartDate] = React.useState<string>(() => {
        return toDateInput(initialData?.startDate) || '';
    });
    
    const [defaultEndDate, setDefaultEndDate] = React.useState<string>(() => {
        return toDateInput(initialData?.endDate) || '';
    });
    
    React.useEffect(() => {
        if (!initialData?.startDate) {
            setDefaultStartDate(new Date().toISOString().slice(0, 10));
        }
    }, [initialData?.startDate]);"""
)

content = content.replace(
    """                        <Input
                            id="endDate"
                            name="endDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.endDate)}
                        />""",
    """                        <Input
                            id="endDate"
                            name="endDate"
                            type="date"
                            key={defaultEndDate || 'empty-end'}
                            defaultValue={defaultEndDate}
                            onChange={(e) => setDefaultEndDate(e.target.value)}
                        />"""
)

# 4. WebSocket & Export to CSV
ws_code = """    React.useEffect(() => {
        let ws: WebSocket;
        try {
            ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'ROTATION_UPDATED' && initialData?._id === data.id) {
                        toast({
                            title: 'Rotation Updated',
                            description: 'Another user has modified this rotation in real-time.',
                        });
                    }
                } catch (err) {}
            };
        } catch (err) {}
        
        return () => {
            if (ws) ws.close();
        };
    }, [initialData?._id, toast]);"""

content = content.replace(
    "    }, [state]);\n\n    const updateRow =",
    "    }, [state]);\n\n" + ws_code + "\n\n    const updateRow ="
)

export_csv_code = """    const exportToCsv = React.useCallback(() => {
        const csvRows = [];
        csvRows.push(['Day Offset', 'Shift Name', 'Is Off']);
        for (const row of pattern) {
            const shift = shifts.find(s => s._id === row.shiftId);
            csvRows.push([
                row.dayOffset,
                shift ? shift.name : '',
                row.isOff ? 'Yes' : 'No'
            ]);
        }
        const csvContent = csvRows.map(e => e.join(',')).join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'pattern.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [pattern, shifts]);"""

content = content.replace(
    "        [pattern, shifts],\n    );\n\n    return (",
    "        [pattern, shifts],\n    );\n\n" + export_csv_code + "\n\n    return ("
)

# 5. Buttons Update
content = content.replace(
    """                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add day
                        </Button>""",
    """                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={exportToCsv}
                            >
                                <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addRow}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" /> Add day
                            </Button>
                        </div>"""
)

# 6. Replace pattern mapping
old_pattern_mapping = """                            pattern.map((row) => {
                                const shift = shifts.find((s) => s._id === row.shiftId);
                                return (
                                    <div
                                        key={row.rowId}
                                        className="grid items-end gap-3 rounded-md border border-zoru-line bg-zoru-bg p-3 md:grid-cols-[100px_1fr_auto_auto]"
                                    >
                                        <div className="space-y-1.5">
                                            <Label className="text-[12px]">
                                                Day offset
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={Math.max(0, cycleDays - 1)}
                                                value={row.dayOffset}
                                                onChange={(e) =>
                                                    updateRow(row.rowId, {
                                                        dayOffset: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[12px]">Shift</Label>
                                            <Select
                                                value={row.shiftId || ''}
                                                onValueChange={(v) =>
                                                    updateRow(row.rowId, { shiftId: v })
                                                }
                                                disabled={row.isOff}
                                            >
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue
                                                        placeholder={
                                                            row.isOff
                                                                ? 'Day off'
                                                                : shift?.name || 'Pick a shift'
                                                        }
                                                    />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    {shifts.map((s) => (
                                                        <ZoruSelectItem key={s._id} value={s._id}>
                                                            {s.name}
                                                        </ZoruSelectItem>
                                                    ))}
                                                </ZoruSelectContent>
                                            </Select>
                                        </div>
                                        <label className="flex items-center gap-2 pb-2 text-[12.5px] text-zoru-ink">
                                            <Checkbox
                                                checked={!!row.isOff}
                                                onCheckedChange={(v) =>
                                                    updateRow(row.rowId, {
                                                        isOff: Boolean(v),
                                                        shiftId: v ? '' : row.shiftId,
                                                    })
                                                }
                                            />
                                            Off
                                        </label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeRow(row.rowId)}
                                            aria-label="Remove pattern row"
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                );
                            })"""

new_pattern_mapping = """                            pattern.map((row) => (
                                <PatternRowItem
                                    key={row.rowId}
                                    row={row}
                                    cycleDays={cycleDays}
                                    shifts={shifts}
                                    updateRow={updateRow}
                                    removeRow={removeRow}
                                />
                            ))"""

content = content.replace(old_pattern_mapping, new_pattern_mapping)

with open('src/app/dashboard/hrm/payroll/shift-rotations/_components/rotation-form.tsx', 'w') as f:
    f.write(content)
