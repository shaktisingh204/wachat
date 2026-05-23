const fs = require('fs');
const file = 'src/lib/ensure-indexes.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    "db.collection('crm_audit_log').createIndex(\n      { userId: 1, createdAt: -1 },\n      { background: true },\n    ),",
    \`db.collection('crm_audit_log').createIndex(
      { userId: 1, createdAt: -1 },
      { background: true },
    ),
    db.collection('crm_audit_log').createIndex(
      { userId: 1, entityKind: 1, createdAt: -1 },
      { background: true },
    ),
    db.collection('crm_audit_log').createIndex(
      { userId: 1, actorId: 1, createdAt: -1 },
      { background: true },
    ),\`
);

fs.writeFileSync(file, content);
