function highlightHTML(html) {
  if (!html) return '';
  let res = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // comments
  res = res.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-gray-500 italic">$1</span>');

  // strings (attribute values)
  res = res.replace(/(&quot;[\s\S]*?&quot;|&#039;[\s\S]*?&#039;)/g, '<span class="text-green-500">$1</span>');

  // tags
  res = res.replace(/(&lt;\/?[a-zA-Z0-9:-]+)/g, '<span class="text-blue-500">$1</span>');
  res = res.replace(/(&gt;)/g, '<span class="text-blue-500">$1</span>');

  // attributes
  res = res.replace(/([a-zA-Z0-9-]+)(?==)/g, '<span class="text-yellow-500">$1</span>');

  return res;
}

console.log(highlightHTML('<div class="container" id="main">Hello</div><!-- comment -->'));
