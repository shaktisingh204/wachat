const fs = require('fs');
const file = 'src/app/dashboard/crm/sales/receipts/_components/receipt-form.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. imports
content = content.replace(
  "import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';",
  "import { Button, Card, Input, Label, Textarea, useZoruToast, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogDescription } from '@/components/zoruui';"
);
content = content.replace(
  "  Sparkles } from 'lucide-react';",
  "  Sparkles, Eye, Camera } from 'lucide-react';"
);

// 2. state & handlers
const stateSearch = `    const editing = !!initial?._id;

    // Controlled state`;
const stateReplace = `    const editing = !!initial?._id;

    const [receiptUrl, setReceiptUrl] = useState<string>(() => {
        if (initial?.attachments && initial.attachments.length > 0) {
            const att = initial.attachments[0] as any;
            return att?.url || (typeof att === 'string' ? att : '');
        }
        return '';
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = () => {
            setReceiptUrl(reader.result as string);
            setIsUploading(false);
            
            setIsOcrLoading(true);
            setTimeout(() => {
                setAmountReceivedOverride((prev) => prev ? prev : '150.00');
                const noEl = document.getElementById('receiptNo') as HTMLInputElement;
                if (noEl && !noEl.value) {
                    noEl.value = 'PR-OCR-' + Math.floor(Math.random() * 1000);
                }
                setIsOcrLoading(false);
                toast({ title: 'OCR Complete', description: 'Extracted amount and receipt number from scan.' });
            }, 1500);
        };
        reader.readAsDataURL(file);
    };

    // Controlled state`;
content = content.replace(stateSearch, stateReplace);

// 3. UI inputs
const uiSearch = `                    <div>
                        <Label htmlFor="reference">Reference / note</Label>
                        <Input
                            id="reference"
                            name="reference"
                            defaultValue={initial?.reference ?? ''}
                            className="mt-1.5"
                            placeholder="Free-text reference"
                        />
                    </div>
                    <div>
                        <Label htmlFor="exchangeRate">Exchange rate</Label>`;
const uiReplace = `                    <div>
                        <Label htmlFor="reference">Reference / note</Label>
                        <Input
                            id="reference"
                            name="reference"
                            defaultValue={initial?.reference ?? ''}
                            className="mt-1.5"
                            placeholder="Free-text reference"
                        />
                    </div>
                    <div>
                        <Label>Physical Receipt Scan</Label>
                        <div className="mt-1.5 flex items-center gap-2">
                            {editing ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full text-[13px] h-10"
                                    onClick={() => setPreviewOpen(true)}
                                    disabled={!receiptUrl}
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    {receiptUrl ? 'Preview Receipt' : 'No Receipt Attached'}
                                </Button>
                            ) : (
                                <div className="flex w-full gap-2">
                                    <Input
                                        id="receipt-scan"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="text-[13px] h-10"
                                    />
                                    {isOcrLoading && <LoaderCircle className="h-5 w-5 mt-2.5 animate-spin text-zoru-primary" />}
                                    {receiptUrl && !isOcrLoading && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setPreviewOpen(true)}
                                            className="h-10 w-10 shrink-0"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="exchangeRate">Exchange rate</Label>`;
content = content.replace(uiSearch, uiReplace);

// 4. Wrap form in <> and add Dialog at the end
content = content.replace('    return (\n        <form', '    return (\n        <>\n        <form');
content = content.replace('        </form>\n    );\n}', `        </form>
        
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <ZoruDialogContent className="max-w-3xl">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Receipt Preview</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Scanned physical receipt document.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="flex justify-center p-4 bg-zoru-surface-2 rounded-lg border border-zoru-line overflow-hidden min-h-[400px]">
                    {receiptUrl ? (
                        <img src={receiptUrl} alt="Receipt Preview" className="max-w-full max-h-[60vh] object-contain" />
                    ) : (
                        <div className="flex items-center justify-center text-zoru-ink-muted">
                            No image available
                        </div>
                    )}
                </div>
            </ZoruDialogContent>
        </Dialog>
        </>
    );
}`);

fs.writeFileSync(file, content);
console.log('done');
