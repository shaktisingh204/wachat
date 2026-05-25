const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'for', 'in', 'on', 'at', 'to', 'with', 'by', 'about', 'as', 'of', 'this', 'that', 'these', 'those', 'then', 'than', 'here', 'there'
]);

// Basic english suffix stemmer
function stem(word: string) {
  word = word.toLowerCase();
  if (word.length < 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 2) return word.slice(0, -1);
  if (word.endsWith('ing') && word.length > 4) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 3) return word.slice(0, -2);
  return word;
}

console.log(stem('shoes'), stem('running'), stem('flies'));
