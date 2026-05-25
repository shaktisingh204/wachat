const fs = require('fs');
const file = 'src/app/dashboard/seo/site-explorer/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace standard variables inside SiteExplorerPage
const searchString = `    const totalPages = Math.ceil(backlinks.length / itemsPerPage);
    const paginatedBacklinks = backlinks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const anchorMap = new Map<string, number>();`;

const replacementString = `    const dofollowCount = backlinks.filter(b => b.linkType === 'dofollow').length;
    const nofollowCount = backlinks.filter(b => b.linkType === 'nofollow').length;
    const linkTypeData = [
        { name: 'Dofollow', value: dofollowCount, color: 'hsl(var(--chart-1))' },
        { name: 'Nofollow', value: nofollowCount, color: 'hsl(var(--chart-2))' }
    ];

    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: backlinks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56,
        overscan: 5,
    });

    const anchorMap = new Map<string, number>();`;

content = content.replace(searchString, replacementString);

fs.writeFileSync(file, content);
