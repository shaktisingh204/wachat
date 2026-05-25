const fs = require('fs');
const path = require('path');

const filePath = path.join(
  process.cwd(),
  'src/app/dashboard/hrm/payroll/tds/[id]/_components/tds-detail-client.tsx'
);

let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports
content = content.replace(
  `import { Card, Button, Input, Checkbox } from '@/components/zoruui';`,
  `import { Card, Button, Input, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';`
);

content = content.replace(
  `import { Download, Edit2, Search, Trash } from 'lucide-react';`,
  `import { Download, Edit2, Search, Trash, FileText } from 'lucide-react';`
);

content = content.replace(
  `import { useVirtualizer } from '@tanstack/react-virtual';`,
  `import { useVirtualizer } from '@tanstack/react-virtual';\nimport { saveTdsRecord, deleteTdsRecord } from '@/app/actions/crm-tds.actions';\nimport jsPDF from 'jspdf';\nimport autoTable from 'jspdf-autotable';`
);

// 2. Methods
const oldHandleBulkDeleteAndSave = `    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        if (!confirm('Are you sure you want to delete selected records?')) return;
        
        startTransition(() => {
            const idsToDelete = Array.from(selectedIds);
            setFyView((prev) => prev.filter(q => !idsToDelete.includes(String(q._id))));
            setSelectedIds(new Set());
            toast.success(\`Successfully deleted \${idsToDelete.length} records.\`);
        });
    };

    const handleInlineSave = (updatedRecord: any) => {
        startTransition(() => {
            setFyView((prev) =>
                prev.map((item) =>
                    String(item._id) === String(updatedRecord._id) ? updatedRecord : item
                )
            );
            setEditingId(null);
            toast.success(\`Record updated successfully!\`);
        });
    };`;

const newMethods = `    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        if (!confirm('Are you sure you want to delete selected records?')) return;
        
        const idsToDelete = Array.from(selectedIds);
        const prevView = [...fyView];
        
        startTransition(() => {
            setFyView((prev) => prev.filter(q => !idsToDelete.includes(String(q._id))));
            setSelectedIds(new Set());
        });

        Promise.all(idsToDelete.map(id => deleteTdsRecord(id)))
            .then((results) => {
                const hasError = results.some(r => !r.success);
                if (hasError) {
                    toast.error('Some records failed to delete. Rolling back.');
                    setFyView(prevView);
                } else {
                    toast.success(\`Successfully deleted \${idsToDelete.length} records.\`);
                }
            })
            .catch(() => {
                toast.error('Failed to delete records. Rolling back.');
                setFyView(prevView);
            });
    };

    const handleBulkStatusUpdate = (newStatus: string) => {
        if (selectedIds.size === 0) return;
        
        const idsToUpdate = Array.from(selectedIds);
        const prevView = [...fyView];
        
        startTransition(() => {
            setFyView(prev => prev.map(item => 
                idsToUpdate.includes(String(item._id)) ? { ...item, status: newStatus } : item
            ));
            setSelectedIds(new Set());
        });

        const promises = idsToUpdate.map(id => {
            const record = prevView.find(q => String(q._id) === id);
            if (!record) return Promise.resolve({ error: 'Not found' });
            
            const formData = new FormData();
            formData.append('recordId', id);
            formData.append('employeeName', employeeName);
            if (record.employeeId) formData.append('employeeId', record.employeeId);
            formData.append('financialYear', financialYear);
            formData.append('quarter', record.quarter || '');
            formData.append('grossAmount', String(record.grossAmount || 0));
            formData.append('tdsAmount', String(record.tdsAmount || 0));
            if (record.certificateNumber) formData.append('certificateNumber', record.certificateNumber);
            if (record.depositChallanNumber) formData.append('depositChallanNumber', record.depositChallanNumber);
            if (record.depositDate) formData.append('depositDate', record.depositDate);
            formData.append('status', newStatus);
            if (record.notes) formData.append('notes', record.notes);
            
            return saveTdsRecord(undefined, formData);
        });

        Promise.all(promises)
            .then(results => {
                const errors = results.filter(r => r.error);
                if (errors.length > 0) {
                    toast.error(\`Failed to update \${errors.length} records. Rolling back.\`);
                    setFyView(prevView);
                } else {
                    toast.success(\`Successfully updated status for \${idsToUpdate.length} records.\`);
                }
            })
            .catch(() => {
                toast.error('Failed to update status. Rolling back.');
                setFyView(prevView);
            });
    };

    const handleInlineSave = async (updatedRecord: any) => {
        const prevView = [...fyView];
        
        startTransition(() => {
            setFyView((prev) =>
                prev.map((item) =>
                    String(item._id) === String(updatedRecord._id) ? updatedRecord : item
                )
            );
            setEditingId(null);
        });

        const formData = new FormData();
        formData.append('recordId', String(updatedRecord._id));
        formData.append('employeeName', employeeName);
        if (updatedRecord.employeeId) formData.append('employeeId', updatedRecord.employeeId);
        formData.append('financialYear', financialYear);
        formData.append('quarter', updatedRecord.quarter || '');
        formData.append('grossAmount', String(updatedRecord.grossAmount || 0));
        formData.append('tdsAmount', String(updatedRecord.tdsAmount || 0));
        if (updatedRecord.certificateNumber) formData.append('certificateNumber', updatedRecord.certificateNumber);
        if (updatedRecord.depositChallanNumber) formData.append('depositChallanNumber', updatedRecord.depositChallanNumber);
        if (updatedRecord.depositDate) formData.append('depositDate', updatedRecord.depositDate);
        formData.append('status', updatedRecord.status || 'pending');
        if (updatedRecord.notes) formData.append('notes', updatedRecord.notes);

        try {
            const res = await saveTdsRecord(undefined, formData);
            if (res?.error) {
                toast.error(res.error);
                setFyView(prevView);
            } else {
                toast.success('Record updated successfully!');
            }
        } catch (e) {
            toast.error('Failed to update record');
            setFyView(prevView);
        }
    };`;

content = content.replace(oldHandleBulkDeleteAndSave, newMethods);

// 3. Export PDF
const oldExportCSV = `        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported successfully');
    };`;

const newExportCSVAndPDF = `        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported successfully');
    };

    const exportPDF = () => {
        if (filteredView.length === 0) {
            toast.error('No records to export');
            return;
        }
        const doc = new jsPDF();
        doc.text(\`TDS Details: \${employeeName} - FY \${financialYear}\`, 14, 15);
        
        const tableColumn = ["Quarter", "Gross Amount", "TDS Amount", "Status", "Deposit Date"];
        const tableRows: any[] = [];
        
        filteredView.forEach(q => {
            const d = new Date(q.depositDate as string);
            const dateStr = !q.depositDate || Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
            const rowData = [
                q.quarter || '',
                q.grossAmount?.toLocaleString('en-IN') || '0',
                q.tdsAmount?.toLocaleString('en-IN') || '0',
                q.status || '',
                dateStr
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(\`TDS_\${employeeName}_FY\${financialYear}.pdf\`);
        toast.success('PDF exported successfully');
    };`;

content = content.replace(oldExportCSV, newExportCSVAndPDF);

// 4. UI Actions
const oldUIActions = `                            <Button variant="secondary" size="sm" onClick={exportCSV}>
                                <Download className="mr-2 h-4 w-4" />
                                CSV
                            </Button>
                            {selectedIds.size > 0 && (
                                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete ({selectedIds.size})
                                </Button>
                            )}`;

const newUIActions = `                            <Button variant="secondary" size="sm" onClick={exportCSV}>
                                <Download className="mr-2 h-4 w-4" />
                                CSV
                            </Button>
                            <Button variant="secondary" size="sm" onClick={exportPDF}>
                                <FileText className="mr-2 h-4 w-4" />
                                PDF
                            </Button>
                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <Select onValueChange={handleBulkStatusUpdate}>
                                        <SelectTrigger className="h-8 w-[130px] text-[13px]">
                                            <SelectValue placeholder="Update Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="deposited">Deposited</SelectItem>
                                            <SelectItem value="filed">Filed</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                                        <Trash className="mr-2 h-4 w-4" />
                                        Delete ({selectedIds.size})
                                    </Button>
                                </div>
                            )}`;

content = content.replace(oldUIActions, newUIActions);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
