const fs = require('fs');
const file = 'src/app/dashboard/hrm/payroll/professional-tax/_components/professional-tax-form.tsx';
let content = fs.readFileSync(file, 'utf8');

const hookAddition = `
    const formRef = useRef<HTMLFormElement>(null);
    const [dirty, setDirty] = useState(false);

    const applyExtras = (v: any) => {
        if (v.state) setStateValue(v.state);
        if (v.status) setStatus(v.status);
    };

    const {
        draftAvailable,
        draftDismissed,
        restore: restoreDraft,
        discard: discardDraft,
        clearOnSave: clearDraftOnSave,
    } = useEntityDraft({
        entityName: 'professionalTax',
        recordId: initialData?._id ? String(initialData._id) : null,
        enabled: true,
        dirty,
        currentUserId,
        formRef,
        snapshotExtras: () => ({ state: stateValue, status }),
        applyExtras,
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            setDirty(false);
            clearDraftOnSave();
            const id = state.id ?? (initialData?._id as string | undefined);
            router.push(id ? \`\${BASE}/\${id}\` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id, clearDraftOnSave]);
`;

content = content.replace(
/    useEffect\(\(\) => \{\n        if \(state\?\.message\) \{[\s\S]*?    \}, \[state, toast, router, initialData\?\._id\]\);/,
hookAddition.trim()
);

// Add formRef and onChange to the form to set dirty
content = content.replace(
  '<form action={formAction} className="flex flex-col gap-6">',
  '<form action={formAction} ref={formRef} onChange={() => setDirty(true)} className="flex flex-col gap-6">'
);

// Add draft banner right inside the form
const banner = `
                {draftAvailable && !draftDismissed ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-300">
                        <span>You have an unsaved draft from a previous session.</span>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" type="button" onClick={restoreDraft}>
                                Restore draft
                            </Button>
                            <Button size="sm" variant="ghost" type="button" onClick={discardDraft}>
                                Discard
                            </Button>
                        </div>
                    </div>
                ) : null}
`;

content = content.replace(
  '{isEditing ? (',
  banner + '\n                {isEditing ? ('
);

fs.writeFileSync(file, content);
