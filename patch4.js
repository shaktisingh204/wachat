const fs = require('fs');
const file = 'src/app/dashboard/seo/site-explorer/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("    const [currentPage, setCurrentPage] = useState(1);", "");
content = content.replace("    const [itemsPerPage, setItemsPerPage] = useState(5);", "");
content = content.replace("        setCurrentPage(1);", "");

fs.writeFileSync(file, content);
