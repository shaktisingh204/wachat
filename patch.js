const fs = require('fs');
const file = 'src/app/sabsms/analytics/numbers/numbers-analytics-client.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add SabsmsSavedViews import
content = content.replace(
  /SabsmsExportMenu,/,
  'SabsmsExportMenu,\n  SabsmsSavedViews,'
);

// Add SabsmsSavedViews component
const searchStr = '<SabsmsColumnPicker';
const replaceStr = '<SabsmsSavedViews\n                    views={[\n                      { id: "v1", name: "High Risk Numbers", urlQuery: "banRisk=high" },\n                      { id: "v2", name: "Poor Deliverability", urlQuery: "cols=number,deliverabilityScore&period=7d" }\n                    ]}\n                    currentViewId={null}\n                    onSelectView={(v) => console.log("Load view", v)}\n                    onSaveView={() => console.log("Save view")}\n                  />\n                  <SabsmsColumnPicker';
content = content.replace(searchStr, replaceStr);

fs.writeFileSync(file, content);
