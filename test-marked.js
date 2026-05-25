const { marked } = require('marked');
console.log(marked.parse('- [ ] Task 1\n- [x] Task 2\n\n| Col 1 | Col 2 |\n|---|---|\n| a | b |', { gfm: true }));
