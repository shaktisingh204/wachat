const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();
const diffs = dmp.diff_main('hello world', 'hello new world');
dmp.diff_cleanupSemantic(diffs);
console.log(diffs);
