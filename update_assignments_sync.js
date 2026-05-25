const fs = require('fs');
const file = 'src/app/dashboard/hrm/permission-groups/_components/permission-groups-client.tsx';
let content = fs.readFileSync(file, 'utf8');

const syncCode = `
  React.useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  React.useEffect(() => {
    setKpis(initialKpis);
  }, [initialKpis]);

  React.useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);
`;

content = content.replace(
  /const \[assignments, setAssignments\] = React.useState<Assignment\[\]>\(initialAssignments\);/,
  `const [assignments, setAssignments] = React.useState<Assignment[]>(initialAssignments);
${syncCode}`
);

fs.writeFileSync(file, content);
