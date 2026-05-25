const url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://vercel.com&strategy=mobile';
fetch(url).then(res => res.json()).then(data => {
  console.log(Object.keys(data));
  if (data.error) console.log(data.error);
}).catch(console.error);
