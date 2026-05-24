const html = `<div>Show this</div><div hidden>Hide this</div><div data-hidden="true">Show this data</div><span style="display: none;">Also hide this</span><p>Show this too</p>`;
let result = html.replace(/<([a-z0-9\-]+)\s+[^>]*?(?:style=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*["']|\shidden(?:=|>|\s))[^>]*>[\s\S]*?<\/\1>/gi, '');
console.log(result);
