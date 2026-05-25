function highlightHTML(html) {
  if (!html) return '';
  let tokenized = html.split(/(<[^>]+>)/g);
  let result = '';
  for (let i = 0; i < tokenized.length; i++) {
    let token = tokenized[i];
    if (i % 2 === 0) {
      result += token.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } else {
      if (token.startsWith('<!--')) {
         result += '<span class="text-gray-500 italic">' + token.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
         continue;
      }
      let tagInner = token.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      tagInner = tagInner.replace(/^(&lt;\/?)([a-zA-Z0-9:-]+)/, '<span class="text-blue-500">$1$2</span>');
      tagInner = tagInner.replace(/(&gt;|\/?&gt;)$/, '<span class="text-blue-500">$1</span>');
      tagInner = tagInner.replace(/(&quot;[\s\S]*?&quot;|&#039;[\s\S]*?&#039;)/g, '<span class="text-green-500">$1</span>');
      tagInner = tagInner.replace(/\s([a-zA-Z0-9-]+)(?==)/g, ' <span class="text-yellow-500">$1</span>');
      result += tagInner;
    }
  }
  return result;
}
console.log(highlightHTML('<div class="container" id="main">Hello</div><!-- comment -->'));
