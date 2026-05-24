import { minify } from 'terser';
const code = 'function add(first, second) { return first + second; }';
minify(code).then(result => console.log(result.code));
