import fetch from 'node-fetch';

async function test() {
  const res = await fetch("http://localhost:3000/api/v1/seo/ai/keyword-clusters", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ keywords: ["coffee maker", "best coffee machine", "tea pot", "green tea"] })
  });
  console.log(res.status, await res.text());
}
test();
