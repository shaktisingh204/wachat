const fs = require('fs');
const file = 'src/app/dashboard/hrm/payroll/professional-tax/_components/professional-tax-form.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /onValueChange=\{setStateValue\}/,
  'onValueChange={(val) => { setStateValue(val); setDirty(true); }}'
);

content = content.replace(
  /onChange=\{\(id\) =>[\s\S]*?setStatus\([\s\S]*?\)\s*\}/,
  'onChange={(id) => {\n                                setStatus(\n                                    (id as CrmProfessionalTaxStatus) ?? \'pending\',\n                                );\n                                setDirty(true);\n                            }}'
);

content = content.replace(
  /onChange=\{\(id, hydrated\) => \{[\s\S]*?if \(hydrated\?\.raw\?\.workState\) \{[\s\S]*?setStateValue\(hydrated\.raw\.workState as string\);[\s\S]*?\}[\s\S]*?\}\}/,
  'onChange={(id, hydrated) => {\n                                if (hydrated?.raw?.workState) {\n                                    setStateValue(hydrated.raw.workState as string);\n                                }\n                                setDirty(true);\n                            }}'
);

fs.writeFileSync(file, content);
