async function run() {
  const url = 'https://example.com';
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`);
  const data = await res.json();
  if (data.lighthouseResult) {
    console.log("Performance:", data.lighthouseResult.categories.performance?.score);
    console.log("SEO:", data.lighthouseResult.categories.seo?.score);
    const audits = data.lighthouseResult.audits;
    console.log("Viewport:", audits.viewport?.score);
    console.log("Font size:", audits['font-size']?.score);
    console.log("Tap targets:", audits['tap-targets']?.score);
    console.log("Content width:", audits['content-width']?.score);
  } else {
    console.log("No lighthouse result", data);
  }
}
run();
