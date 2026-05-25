Promise.all([
  fetch(`https://completion.amazon.com/search/complete?search-alias=aps&client=amazon-search-ui&mkt=1&q=running+shoes`).then(r => r.json()).catch(e => "Amazon Error"),
  fetch(`https://sugg.search.yahoo.net/sg/?output=fxjson&command=running+shoes`).then(r => r.json()).catch(e => "Yahoo Error"),
  fetch(`https://duckduckgo.com/ac/?q=running+shoes`).then(r => r.json()).catch(e => "DDG Error")
]).then(console.log);
