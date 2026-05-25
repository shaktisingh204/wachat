async function run() {
  const url = 'https://www.google.com';
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`);
  const data = await res.json();
  if (data.lighthouseResult) {
    const audits = data.lighthouseResult.audits;
    console.log("Viewport:", audits.viewport?.score);
    console.log("Font size:", audits['font-size']?.score);
    console.log("Tap targets:", audits['tap-targets']?.score);
    console.log("Content width:", audits['content-width']?.score);
    const seo = data.lighthouseResult.categories.seo;
    console.log("SEO Score:", seo?.score);
  } else {
    console.log("No lighthouse result", data);
  }
}
run();
